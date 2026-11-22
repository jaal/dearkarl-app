import {
  ApiPaths,
  type LoginCodeVerified,
  isLoginCodeRequest,
  isLoginCodeVerify,
} from "../../shared/api";
import UsersDB from "../db";
import sendEmail, { readElasticCredentials } from "../send-email";
import ErrorResponse, { ApiErrors } from "./errors";
import { SESSION_MAX_AGE, sessionCookie } from "./login";
import { loginCodeEmail } from "./messages";

/**
 * Log in by email: `POST /api/login/email {email}` mails a six-digit code to an
 * existing account, `POST /api/login/verify {email, code}` trades it for a
 * session cookie. New accounts are made only through Google (/app), since the
 * Drive folder needs a Google account anyway.
 *
 * The request answer is the same whether or not the account exists, so the
 * form cannot be used to find out who has one.
 */

export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
/** A second code for the same address is not mailed sooner than this. */
export const LOGIN_CODE_RESEND_MS = 60 * 1000;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

type Clock = () => number;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Six digits, uniform (rejection sampling avoids modulo bias). */
export function newLoginCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(6, "0");
  }
}

export async function hashLoginCode(email: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${email}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

export function isEmailLoginPath(url: URL): boolean {
  return (
    url.pathname === ApiPaths.loginEmail || url.pathname === ApiPaths.loginVerify
  );
}

export async function emailLoginHandler(
  request: Request,
  env: Pick<Env, "DB" | "ELASTIC_SECRET">,
  now: Clock = Date.now,
): Promise<Response> {
  if (request.method !== "POST") return new ErrorResponse(ApiErrors.InvalidRequest);
  const url = new URL(request.url);
  const payload = await readJson(request);
  const db = env.DB;

  if (url.pathname === ApiPaths.loginEmail) {
    if (!isLoginCodeRequest(payload)) return new ErrorResponse(ApiErrors.InvalidRequest);
    const email = normalizeEmail(payload.email);
    if (!email) return new ErrorResponse(ApiErrors.InvalidRequest);

    const user = await new UsersDB(db).getUser(email);
    if (user) {
      const t = now();
      const last = await db
        .prepare(`SELECT sent_at FROM login_codes WHERE email = ?`)
        .bind(email)
        .first<{ sent_at: number }>();
      if (!last || t - last.sent_at >= LOGIN_CODE_RESEND_MS) {
        const creds = readElasticCredentials(env.ELASTIC_SECRET);
        if (!creds) {
          console.error("ELASTIC_SECRET is missing or malformed");
          return new ErrorResponse(ApiErrors.InternalError);
        }
        const code = newLoginCode();
        await db
          .prepare(
            `INSERT INTO login_codes (email, code_hash, expires_at, sent_at, attempts)
             VALUES (?, ?, ?, ?, 0)
             ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash,
               expires_at = excluded.expires_at, sent_at = excluded.sent_at, attempts = 0`,
          )
          .bind(email, await hashLoginCode(email, code), t + LOGIN_CODE_TTL_MS, t)
          .run();
        const mail = loginCodeEmail({ code, minutes: LOGIN_CODE_TTL_MS / 60000 });
        await sendEmail(creds, { to: user.email, subject: mail.subject, text: mail.html });
      }
    }
    return json({ sent: true });
  }

  // ApiPaths.loginVerify
  if (!isLoginCodeVerify(payload)) return new ErrorResponse(ApiErrors.InvalidRequest);
  const email = normalizeEmail(payload.email);
  const code = payload.code.replace(/\s+/g, "");
  if (!email || !/^\d{6}$/.test(code)) return new ErrorResponse(ApiErrors.LoginCodeInvalid);

  const row = await db
    .prepare(`SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?`)
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row) return new ErrorResponse(ApiErrors.LoginCodeInvalid);
  if (row.expires_at < now() || row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    await db.prepare(`DELETE FROM login_codes WHERE email = ?`).bind(email).run();
    return new ErrorResponse(ApiErrors.LoginCodeInvalid);
  }
  if ((await hashLoginCode(email, code)) !== row.code_hash) {
    await db
      .prepare(`UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?`)
      .bind(email)
      .run();
    return new ErrorResponse(ApiErrors.LoginCodeInvalid);
  }

  // Single use: only the request that deletes the row gets the session.
  const claimed = await db
    .prepare(`DELETE FROM login_codes WHERE email = ? AND code_hash = ? RETURNING email`)
    .bind(email, row.code_hash)
    .first();
  if (!claimed) return new ErrorResponse(ApiErrors.LoginCodeInvalid);

  const sid = crypto.randomUUID();
  await new UsersDB(db).setSession(email, sid);
  const body: LoginCodeVerified = { loggedIn: true };
  return json(body, { "Set-Cookie": sessionCookie(sid, SESSION_MAX_AGE) });
}
