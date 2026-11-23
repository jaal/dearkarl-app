import loginHandler from "./api/login";
import emailHandler from "./api/email";
import ErrorResponse, { ApiErrors } from "./api/errors";
import { readElasticCredentials, sendDiagnosticEmail } from "./send-email";
import { ApiPaths } from "../shared/api";
import UsersDB from "./db";
import { getSid } from "./api/utils";
import { authorizeHandler, oauthProvider, revokeAllGrants } from "./mcp/oauth";
import { diagErrorSubject } from "./api/messages";
import { mcpHandler } from "./mcp/handler";
import { handleStub, installStubForEmail } from "./dev/stub";
import { emailLoginHandler, isEmailLoginPath } from "./api/emailLogin";
import { driveFolderHandler } from "./api/driveFolder";

// /k/* is the first-party path to PostHog's EU cloud (src/analytics.ts):
// /k/static/* to the assets host (lazily loaded parts of posthog-js),
// everything else to the ingestion host. The page only ever talks to its own
// origin; the privacy notice says so in §7, and the consent dialog is the
// control. Ported from the old dearkarl.com worker.
const POSTHOG_API_HOST = "eu.i.posthog.com";
const POSTHOG_ASSET_HOST = "eu-assets.i.posthog.com";

async function posthogProxy(request: Request, url: URL): Promise<Response> {
  const path = url.pathname.slice("/k".length);
  const host = path.startsWith("/static/") ? POSTHOG_ASSET_HOST : POSTHOG_API_HOST;
  const upstream = new URL(path + url.search, `https://${host}`);

  const headers = new Headers(request.headers);
  // Our cookies (session, PostHog's own visitor ID) are none of PostHog's
  // business at the HTTP layer; the SDK sends what it needs in the payload.
  headers.delete("cookie");
  // PostHog looks the country up from the client IP; without this it would
  // see Cloudflare's address. The notice (§8) says the IP is passed on.
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);

  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  // Nothing from PostHog may set a cookie on dearkarl.com.
  const out = new Response(response.body, response);
  out.headers.delete("set-cookie");
  return out;
}

/** Everything that isn't OAuth protocol or /mcp: pages, API, /authorize. */
async function appFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/k/")) return posthogProxy(request, url);

  // Local walkthroughs only (GOOGLE_STUB=1 in .dev.vars, on localhost).
  const stubbed = await handleStub(request, env);
  if (stubbed) return stubbed;

  const secret = env.GOOGLE_CLIENT_SECRET;
  if (!secret)
    return new Response(JSON.stringify({ error: "Missing secret" }), {
      status: 500,
    });

  try {
    if (url.pathname === "/authorize") return await authorizeHandler(request, env);
    if (isEmailLoginPath(url)) {
      return await emailLoginHandler(request, env);
    }
    if (url.pathname === ApiPaths.driveFolder) {
      return await driveFolderHandler(request, secret, env.DB);
    }
    if (url.pathname === ApiPaths.accountDelete && request.method === "POST") {
      // Whoever deletes their account also cuts off every Claude connector.
      const sid = getSid(request);
      const user = sid ? await new UsersDB(env.DB).getUserBySid(sid) : null;
      const res = await loginHandler(request, secret, env.DB);
      if (res.ok && user) ctx.waitUntil(revokeAllGrants(env, user.email).catch(() => {}));
      return res;
    }
    return loginHandler(request, secret, env.DB);
  } catch (error) {
    // Name and message only: a request body or address must never reach the logs.
    console.error("handler failed:", (error as Error)?.name, (error as Error)?.message?.slice(0, 200));
    return new ErrorResponse(ApiErrors.InternalError);
  }
}

export default {
  // The OAuth provider answers discovery (/.well-known/*), /oauth/token and
  // /oauth/register itself, checks the token on /mcp, and hands everything
  // else to appFetch.
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    installStubForEmail(env); // the stub's fake Google, for /mcp on localhost
    const origin = new URL(request.url).origin;
    return oauthProvider(origin, { mcp: mcpHandler, app: appFetch }).fetch(request, env, ctx);
  },
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ) {
    installStubForEmail(env);
    const creds = readElasticCredentials(env.ELASTIC_SECRET);
    if (!creds) {
      console.error("ELASTIC_SECRET is missing or malformed");
      return;
    }

    // waitUntil() returns immediately, so a try/catch around it would never
    // see a rejection — the handler has to catch on the promise itself.
    ctx.waitUntil(
      emailHandler(env, message, creds).catch((error) => {
        const detail = error?.message ?? String(error);
        return sendDiagnosticEmail(
          creds,
          diagErrorSubject(detail),
          detail,
          (env as { DIAGNOSTIC_EMAIL?: string }).DIAGNOSTIC_EMAIL,
        );
      }),
    );
  },
} satisfies ExportedHandler<Env>;
