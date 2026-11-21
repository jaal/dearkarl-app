/**
 * Local stand-in for Google (OAuth, tokeninfo, Drive) and Elastic Email, so the
 * whole user path can be walked on localhost without real accounts.
 *
 * Active only when `.dev.vars` sets GOOGLE_STUB=1 (that file is gitignored and
 * never deployed) AND the request comes to localhost. It works by wrapping
 * `fetch`, so the product code runs unchanged; only the far end is fake.
 *
 * Pages (all under /api/stub, which the worker serves before the SPA):
 *   /api/stub/google/auth  the fake Google consent screen (Allow / Deny)
 *   /api/stub              outbox, Drive contents, send mail to Karl,
 *                          expire / restore Google access
 */
import emailHandler from "../api/email";
import { readElasticCredentials } from "../send-email";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  content: string;
  modifiedTime: string;
};
type SentMail = { at: string; to: string; subject: string; html: string };

const state = {
  /** Google access revoked or lapsed: tokeninfo and refresh both fail. */
  expired: false,
  drive: new Map<string, DriveItem[]>(), // keyed by account email
  outbox: [] as SentMail[],
};

const FOLDER_MIME = "application/vnd.google-apps.folder";
const realFetch = globalThis.fetch.bind(globalThis);
let installed = false;

export function stubEnabled(env: Env): boolean {
  return (env as { GOOGLE_STUB?: string }).GOOGLE_STUB === "1";
}

function isLocal(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

const b64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
const rand = () => crypto.randomUUID().split("-")[0];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Tokens carry the account email, so no token table is needed. */
const accessToken = (email: string) => `stub-at.${b64(email)}.${rand()}`;
const refreshToken = (email: string) => `stub-rt.${b64(email)}`;
function emailOf(token: string | null | undefined): string | null {
  const m = /^stub-(?:at|rt)\.([^.]+)/.exec(token ?? "");
  return m ? unb64(m[1]) : null;
}
function bearerEmail(init?: RequestInit): string | null {
  const h = new Headers(init?.headers);
  return emailOf(h.get("Authorization")?.replace(/^Bearer\s+/i, ""));
}

function tokenResponse(email: string, withRefresh: boolean) {
  const idPayload = b64(JSON.stringify({ email, email_verified: true }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return json({
    access_token: accessToken(email),
    expires_in: "3599",
    ...(withRefresh
      ? { refresh_token: refreshToken(email), refresh_token_expires_in: "604799" }
      : {}),
    id_token: `e30.${idPayload}.stub`,
    scope: "https://www.googleapis.com/auth/drive.file email",
    token_type: "Bearer",
  });
}

async function fakeGoogle(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();

  if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/token") {
    const form = new URLSearchParams(String(init?.body ?? ""));
    if (form.get("grant_type") === "authorization_code") {
      const code = form.get("code") ?? "";
      if (!code.startsWith("stub:")) return json({ error: "invalid_grant" }, 400);
      state.expired = false; // a fresh consent renews access
      return tokenResponse(decodeURIComponent(code.slice(5)), true);
    }
    const email = emailOf(form.get("refresh_token"));
    if (state.expired || !email) return json({ error: "invalid_grant" }, 400);
    return tokenResponse(email, false);
  }
  if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/revoke") {
    return new Response("", { status: 200 });
  }
  if (url.pathname === "/oauth2/v3/tokeninfo") {
    const email = emailOf(url.searchParams.get("access_token"));
    if (state.expired || !email) return json({ error: "invalid_token" }, 400);
    return json({
      expires_in: "3000",
      scope: "https://www.googleapis.com/auth/drive.file email",
      email,
    });
  }

  // Drive
  const email = bearerEmail(init);
  if (state.expired || !email) return json({ error: { code: 401 } }, 401);
  const items = state.drive.get(email) ?? [];
  state.drive.set(email, items);
  const now = () => new Date().toISOString();

  if (url.pathname === "/upload/drive/v3/files" && method === "POST") {
    const body = String(init?.body ?? "");
    const parts = body.split(/\r\n--[^\r\n]+/);
    const meta = JSON.parse(parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n"));
    const content = parts[2].split("\r\n\r\n").slice(1).join("\r\n\r\n");
    const item: DriveItem = {
      id: `f-${rand()}`,
      name: meta.name,
      mimeType: meta.mimeType ?? "text/plain",
      parents: meta.parents ?? [],
      content,
      modifiedTime: now(),
    };
    items.push(item);
    return json({ id: item.id, name: item.name, parents: item.parents });
  }
  if (url.pathname === "/drive/v3/files" && method === "POST") {
    const meta = JSON.parse(String(init?.body ?? "{}"));
    const item: DriveItem = {
      id: `d-${rand()}`,
      name: meta.name,
      mimeType: meta.mimeType,
      parents: [],
      content: "",
      modifiedTime: now(),
    };
    items.push(item);
    return json({ id: item.id, name: item.name });
  }
  if (url.pathname === "/drive/v3/files") {
    const q = url.searchParams.get("q") ?? "";
    const byName = /name = '([^']+)'/.exec(q)?.[1];
    const parent = /'([^']+)' in parents/.exec(q)?.[1];
    const found = items.filter(
      (i) =>
        (!byName || (i.name === byName && i.mimeType === FOLDER_MIME)) &&
        (!parent || i.parents.includes(parent)),
    );
    return json({
      files: found.map((i) => ({
        id: i.id,
        name: i.name,
        mimeType: i.mimeType,
        size: String(new TextEncoder().encode(i.content).length),
        modifiedTime: i.modifiedTime,
      })),
    });
  }
  const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
  if (fileMatch) {
    const item = items.find((i) => i.id === fileMatch[1]);
    if (!item) return json({ error: { code: 404 } }, 404);
    if (url.searchParams.get("alt") === "media")
      return new Response(item.content, { status: 200 });
    return json({ id: item.id, name: item.name, mimeType: item.mimeType });
  }
  return json({ error: `stub: unhandled ${method} ${url.pathname}` }, 501);
}

function install() {
  if (installed) return;
  installed = true;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      url.hostname === "oauth2.googleapis.com" ||
      url.hostname === "www.googleapis.com"
    ) {
      return fakeGoogle(url, init);
    }
    if (url.hostname === "api.elasticemail.com") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const html =
        body.Content?.Body?.find((b: { ContentType: string }) => b.ContentType === "HTML")
          ?.Content ?? "";
      for (const to of body.Recipients?.To ?? [])
        state.outbox.unshift({
          at: new Date().toISOString(),
          to,
          subject: body.Content?.Subject ?? "",
          html,
        });
      return json({ TransactionID: `stub-${rand()}` });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:52rem;margin:32px auto;padding:0 16px;color:#111;background:#fff}
h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:2em;border-top:1px solid #ddd;padding-top:1em}
.stub{background:#fde68a;padding:6px 10px;display:inline-block;font-weight:600}
input,textarea{font:inherit;padding:6px 8px;width:100%;box-sizing:border-box;margin:2px 0 10px}
button{font:inherit;padding:8px 16px;margin-right:8px;cursor:pointer}
details{border:1px solid #ddd;padding:8px 12px;margin:8px 0}pre{white-space:pre-wrap}
iframe{width:100%;height:340px;border:1px solid #eee}
</style>
<p class="stub">LOCAL STUB — not Google, nothing leaves this machine</p>
${body}`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function consentPage(url: URL): Response {
  const redirect = url.searchParams.get("redirect_uri") ?? "/";
  return page(
    "Sign in with Google (stub)",
    `<h1>Sign in with Google</h1>
<p>dearkarl wants to: see and add files it creates in your Drive (<code>drive.file</code>), and see your email address.</p>
<form method="get" action="/api/stub/google/decide">
  <input type="hidden" name="redirect_uri" value="${esc(redirect)}">
  <label>Google account<input name="email" value="ania@example.com"></label>
  <button name="decision" value="allow">Allow</button>
  <button name="decision" value="deny">Cancel</button>
</form>`,
  );
}

function decide(url: URL): Response {
  const target = new URL(url.searchParams.get("redirect_uri") ?? "/", url);
  if (url.searchParams.get("decision") === "allow") {
    const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
    target.searchParams.set("code", `stub:${encodeURIComponent(email)}`);
  } else {
    target.searchParams.set("error", "access_denied");
  }
  return Response.redirect(target.href, 302);
}

function dashboard(url: URL): Response {
  const note = url.searchParams.get("note");
  const drives = [...state.drive.entries()]
    .map(([email, items]) => {
      const files = items.filter((i) => i.mimeType !== FOLDER_MIME);
      return `<h3>${esc(email)} — ${files.length} file(s)</h3>${files
        .map(
          (f) =>
            `<details><summary>${esc(f.name)} <small>${esc(f.modifiedTime)}</small></summary><pre>${esc(f.content)}</pre></details>`,
        )
        .join("")}`;
    })
    .join("");
  const outbox = state.outbox
    .map(
      (m) =>
        `<details><summary><b>${esc(m.subject)}</b> → ${esc(m.to)} <small>${esc(m.at)}</small></summary><iframe sandbox srcdoc="${esc(m.html)}"></iframe></details>`,
    )
    .join("");
  return page(
    "dearkarl stub",
    `<h1>dearkarl local stub</h1>
${note ? `<p><b>${esc(note)}</b></p>` : ""}
<p><a href="/">Site</a> · <a href="/app">App</a> · <a href="/app/reconnect">Reconnect</a></p>

<h2>Send a mail to Karl</h2>
<form method="post" action="/api/stub/send">
  <label>From (envelope)<input name="from" value="ania@example.com"></label>
  <label>To (envelope — your Karl address)<input name="to" placeholder="claude-ania-xxxxxx@in.dearkarl.com"></label>
  <label>Subject<input name="subject" value="Test note"></label>
  <label>Body<textarea name="body" rows="4">Hello Karl, please keep this.</textarea></label>
  <label><input type="checkbox" name="dmarcfail" style="width:auto"> Fail DMARC</label><br>
  <button>Send</button>
</form>

<h2>Google access</h2>
<p>Now: <b>${state.expired ? "expired (refresh fails)" : "valid"}</b></p>
<form method="post" action="/api/stub/expire" style="display:inline"><button>Expire access</button></form>
<form method="post" action="/api/stub/restore" style="display:inline"><button>Restore access</button></form>

<h2>Outbox (Elastic) — ${state.outbox.length}</h2>${outbox || "<p>Empty.</p>"}
<h2>Drive</h2>${drives || "<p>Empty.</p>"}`,
  );
}

async function sendToKarl(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const from = String(form.get("from") ?? "").trim();
  const to = String(form.get("to") ?? "").trim();
  const subject = String(form.get("subject") ?? "");
  const text = String(form.get("body") ?? "");
  const auth = form.get("dmarcfail")
    ? "mx.cloudflare.net; spf=pass; dmarc=fail"
    : "mx.cloudflare.net; spf=pass; dmarc=pass";
  const raw =
    `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\n` +
    `Authentication-Results: ${auth}\r\nMIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n`;
  const bytes = new TextEncoder().encode(raw);
  const message = {
    from,
    to,
    raw: new Response(bytes).body!,
    rawSize: bytes.length,
    headers: new Headers({ "Authentication-Results": auth }),
    setReject() {},
    forward: async () => ({}),
    reply: async () => ({}),
  } as unknown as ForwardableEmailMessage;

  const creds = readElasticCredentials(env.ELASTIC_SECRET);
  let note = "Delivered to the email handler.";
  try {
    if (!creds) throw new Error("ELASTIC_SECRET missing in .dev.vars");
    await emailHandler(env, message, creds);
  } catch (e) {
    note = `Handler threw: ${(e as Error).message}`;
  }
  return Response.redirect(
    new URL(`/api/stub?note=${encodeURIComponent(note)}`, request.url).href,
    303,
  );
}

/**
 * Call first in the worker's fetch. Returns a response for /api/stub pages,
 * or null to let the request through (with fetch wrapped when the stub is on).
 */
export async function handleStub(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const onStubPath = url.pathname.startsWith("/api/stub");
  if (!stubEnabled(env) || !isLocal(request))
    return onStubPath ? new Response("Not found", { status: 404 }) : null;

  install();
  if (!onStubPath) return null;

  const back = (note: string) =>
    Response.redirect(
      new URL(`/api/stub?note=${encodeURIComponent(note)}`, url).href,
      303,
    );
  switch (url.pathname) {
    case "/api/stub":
      return dashboard(url);
    case "/api/stub/google/auth":
      return consentPage(url);
    case "/api/stub/google/decide":
      return decide(url);
    case "/api/stub/send":
      return sendToKarl(request, env);
    case "/api/stub/expire":
      state.expired = true;
      return back("Google access expired.");
    case "/api/stub/restore":
      state.expired = false;
      return back("Google access restored.");
  }
  return new Response("Not found", { status: 404 });
}

/** For the email() entry: wrap fetch when the stub is on (no request here). */
export function installStubForEmail(env: Env): void {
  if (stubEnabled(env)) install();
}
