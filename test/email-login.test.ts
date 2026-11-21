import { beforeEach, describe, expect, it, vi } from "vitest";
import { sqliteD1 } from "./helpers/sqliteD1";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("../worker/send-email", async (orig) => ({
  ...(await orig<typeof import("../worker/send-email")>()),
  default: vi.fn(async (_c: unknown, mail: { to: string; subject: string; text: string }) => {
    sent.push(mail);
  }),
}));

const {
  emailLoginHandler,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_RESEND_MS,
  LOGIN_CODE_TTL_MS,
} = await import("../worker/api/emailLogin");

const ELASTIC_SECRET = JSON.stringify({ apiKey: "k", username: "karl@mail.dearkarl.com" });
let db: D1Database;
let now = 1_000_000;
const clock = () => now;

const post = (path: string, body: unknown) =>
  new Request(`https://dearkarl.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const call = (path: string, body: unknown) =>
  emailLoginHandler(post(path, body), { DB: db, ELASTIC_SECRET } as Env, clock);
const askCode = (email: string) => call("/api/login/email", { email });
const verify = (email: string, code: string) => call("/api/login/verify", { email, code });
const lastCode = () => /(\d{6})<\/p>/.exec(sent.at(-1)!.text)![1];

beforeEach(async () => {
  sent.length = 0;
  now = 1_000_000;
  db = sqliteD1(["0001_create_tables.sql", "0002_api_tokens.sql", "0004_login_codes.sql"]);
  await db
    .prepare(`INSERT INTO users (email, login, refresh_token, session_id) VALUES (?, ?, ?, ?)`)
    .bind("ania@example.com", "claude-ania-4kv27t", "rt", "old-sid")
    .run();
});

describe("log in with an emailed code", () => {
  it("mails a code to an existing account and logs in with it, once", async () => {
    const res = await askCode("  Ania@Example.com ");
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ania@example.com");
    const code = lastCode();
    expect(sent[0].subject).toContain(code);

    const ok = await verify("ania@example.com", code);
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("Set-Cookie")!;
    const sid = /sid=([^;]+)/.exec(cookie)![1];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    const user = await db
      .prepare(`SELECT session_id, refresh_token FROM users WHERE email = ?`)
      .bind("ania@example.com")
      .first<{ session_id: string; refresh_token: string }>();
    expect(user).toEqual({ session_id: sid, refresh_token: "rt" });

    expect((await verify("ania@example.com", code)).status).toBe(400);
  });

  it("answers the same for an unknown address and mails nothing", async () => {
    const res = await askCode("nobody@example.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(sent).toHaveLength(0);
  });

  it("does not mail a second code within a minute", async () => {
    await askCode("ania@example.com");
    now += LOGIN_CODE_RESEND_MS - 1;
    await askCode("ania@example.com");
    expect(sent).toHaveLength(1);
    now += 1;
    await askCode("ania@example.com");
    expect(sent).toHaveLength(2);
  });

  it("rejects an expired code", async () => {
    await askCode("ania@example.com");
    const code = lastCode();
    now += LOGIN_CODE_TTL_MS + 1;
    expect((await verify("ania@example.com", code)).status).toBe(400);
  });

  it("locks the code after too many wrong tries", async () => {
    await askCode("ania@example.com");
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < LOGIN_CODE_MAX_ATTEMPTS; i++) {
      expect((await verify("ania@example.com", wrong)).status).toBe(400);
    }
    expect((await verify("ania@example.com", code)).status).toBe(400);
  });

  it("keeps only a hash of the code", async () => {
    await askCode("ania@example.com");
    const row = await db
      .prepare(`SELECT code_hash FROM login_codes WHERE email = ?`)
      .bind("ania@example.com")
      .first<{ code_hash: string }>();
    expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.code_hash).not.toContain(lastCode());
  });

  it("refuses GET and malformed bodies", async () => {
    const get = new Request("https://dearkarl.com/api/login/email");
    expect((await emailLoginHandler(get, { DB: db, ELASTIC_SECRET } as Env, clock)).ok).toBe(false);
    expect((await askCode("not-an-email")).ok).toBe(false);
    expect(sent).toHaveLength(0);
    expect((await verify("ania@example.com", "12ab56")).status).toBe(400);
  });
});
