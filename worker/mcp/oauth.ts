import {
  AuthorizationError,
  CimdFetchError,
  OAuthProvider,
  type ConsentDescription,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import UsersDB, { ApiTokensDB } from "../db";
import { getSid } from "../api/utils";
import { sha256Hex } from "./pat";

/**
 * OAuth 2.1 for /mcp, so Claude's apps (claude.ai, desktop, phone) can add
 * Karl as a custom connector: they discover this server, register
 * themselves, send the user to /authorize, and get a token bound to
 * https://dearkarl.com/mcp. The library (KV-backed, tokens stored as hashes)
 * does the protocol; this file is the dearkarl part: who the user is, the
 * consent page, and the personal tokens Claude Code already uses, which keep
 * working through resolveExternalToken.
 */

/** The only thing a connector can do: read the user's Karl folder. */
export const KARL_SCOPE = "karl:read";

export interface KarlProps {
  /** The account's Google email; looked up again on every MCP request. */
  email: string;
}

type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
type OAuthEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

const providers = new Map<string, OAuthProvider<Env>>();

/** One provider per origin: the resource and issuer are URLs on it. */
export function oauthProvider(
  origin: string,
  handlers: { mcp: Handler; app: Handler },
): OAuthProvider<Env> {
  let provider = providers.get(origin);
  if (provider) return provider;
  const resource = `${origin}/mcp`;
  provider = new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: { fetch: (req, env, ctx) => handlers.mcp(req, env as Env, ctx) },
    defaultHandler: { fetch: (req, env, ctx) => handlers.app(req, env as Env, ctx) },
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    clientRegistrationEndpoint: "/oauth/register",
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: [KARL_SCOPE, "offline_access"],
    // A connector in use stays connected: each refresh moves expiry 30 days
    // out. One left unused for 30 days has to be connected again.
    refreshTokenIdleTTL: 30 * 24 * 60 * 60,
    requiredScopes: [KARL_SCOPE],
    resourceMetadata: {
      resource,
      authorization_servers: [origin],
      resource_name: "DearKarl",
    },
    // Claude Code's personal tokens (karl_…), made on the account page.
    resolveExternalToken: async ({ token, env }) => {
      const tokensDb = new ApiTokensDB((env as Env).DB);
      const found = await tokensDb.findUserByTokenHash(await sha256Hex(token), Date.now());
      if (!found) return null;
      await tokensDb.touchToken(found.tokenId, Date.now()).catch(() => {});
      return { props: { email: found.user.email } satisfies KarlProps, audience: resource };
    },
  });
  providers.set(origin, provider);
  return provider;
}

/** Revoke every connector grant a user gave, e.g. when the account is deleted. */
export async function revokeAllGrants(env: Env, email: string): Promise<void> {
  const oauth = (env as OAuthEnv).OAUTH_PROVIDER;
  if (!oauth) return;
  let cursor: string | undefined;
  do {
    const page = await oauth.listUserGrants(email, cursor ? { cursor } : undefined);
    for (const grant of page.items) await oauth.revokeGrant(grant.id, email);
    cursor = page.cursor;
  } while (cursor);
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  // Only our inline styles; nothing loads, nothing runs, no framing.
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
};

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — dearkarl</title>
<style>
  body{margin:0;background:#eeece7;color:#1c1b19;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  main{max-width:34rem;margin:0 auto;padding:40px 16px 64px}
  .brand{font-weight:600;margin-bottom:32px}
  h1{font-weight:500;font-size:1.9rem;line-height:1.2;margin:0 0 .5em}
  p{margin:0 0 1em} .muted{color:#5c5a56;font-size:.92rem}
  .box{border:1px solid #cdc9c1;padding:14px 16px;margin:18px 0}
  .warn{border-color:#1c1b19}
  ul{padding-left:1.2em;margin:.4em 0 0}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
  button,.btn{font:inherit;padding:11px 22px;border:1px solid #1c1b19;background:#1c1b19;color:#eeece7;cursor:pointer;text-decoration:none;display:inline-block}
  button.ghost,.btn.ghost{background:transparent;color:#1c1b19;border-color:#cdc9c1}
  a{color:#1c1b19}
</style></head>
<body><main><div class="brand">📬 dearkarl</div>${body}</main></body></html>`;
}

function consentPage(d: ConsentDescription, handle: string, userEmail: string): string {
  const name = escape(d.clientName);
  const who = d.clientDomain
    ? `Published by <strong>${escape(d.clientDomain)}</strong>.`
    : "This app registered itself; its name is not verified.";
  const local = d.redirectIsLoopback
    ? `<div class="box warn"><strong>This sends access to an app on your computer.</strong> Continue only if you just started connecting from it.</div>`
    : "";
  return page(
    `Connect ${d.clientName}`,
    `<h1>Allow ${name} to read your Karl folder?</h1>
<p>${who} Access will be sent to <strong>${escape(d.redirectHost)}</strong>.</p>
${local}
<div class="box">
  <p style="margin:0">It will be able to:</p>
  <ul><li>list and read the files Karl saved in the <strong>dearkarl</strong> folder of your Google Drive</li></ul>
  <p class="muted" style="margin:.8em 0 0">Nothing else: not the rest of your Drive, not your mailbox. Signed in as ${escape(userEmail)}.</p>
</div>
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <div class="row">
    <button name="decision" value="approve">Allow</button>
    <button class="ghost" name="decision" value="deny">Deny</button>
  </div>
</form>
<p class="muted" style="margin-top:22px">You can disconnect it any time in that app's settings, or by deleting your DearKarl account.</p>`,
  );
}

function errorPage(message: string, status = 400): Response {
  return new Response(
    page("Can't connect", `<h1>Can't connect</h1><p>${escape(message)}</p><p><a href="/app">Go to your account</a></p>`),
    { status, headers: PAGE_HEADERS },
  );
}

/** GET shows the consent page (after sign-in); POST is the Allow / Deny. */
export async function authorizeHandler(request: Request, env: Env): Promise<Response> {
  const oauth = (env as OAuthEnv).OAUTH_PROVIDER;
  const sid = getSid(request);
  const user = sid ? await new UsersDB(env.DB).getUserBySid(sid) : null;

  try {
    if (request.method === "GET") {
      const authRequest = await oauth.parseAuthRequest(request);
      if (!user) {
        // Sign in on our own pages, then come straight back here.
        const url = new URL(request.url);
        const next = encodeURIComponent(url.pathname + url.search);
        return Response.redirect(new URL(`/login?next=${next}`, url).href, 302);
      }
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      for (const [k, v] of Object.entries(PAGE_HEADERS)) consent.headers.set(k, v);
      return new Response(consentPage(details, consent.handle, user.email), {
        headers: consent.headers,
      });
    }

    if (request.method === "POST") {
      const form = await request.formData();
      const handle = String(form.get("handle") ?? "");
      if (form.get("decision") !== "approve") {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      if (!user) return errorPage("Your DearKarl session ended. Start connecting again from the app.", 401);
      // Read access, and a refresh token so the connector stays connected.
      const approved = await oauth.approveConsent(request, handle, {
        scope: [KARL_SCOPE, "offline_access"],
      });
      const props: KarlProps = { email: user.email };
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: user.email,
        metadata: {},
        scope: approved.request.scope,
        props,
      });
      approved.headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers: approved.headers });
    }
    return errorPage("Unsupported request.", 405);
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo)
      return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError)
      return errorPage(error.description || "This request is not valid. Start connecting again from the app.");
    if (error instanceof CimdFetchError)
      return errorPage("This app could not be verified.");
    throw error;
  }
}
