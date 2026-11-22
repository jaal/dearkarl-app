import loginHandler from "./api/login";
import emailHandler from "./api/email";
import ErrorResponse, { ApiErrors } from "./api/errors";
import { readElasticCredentials, sendDiagnosticEmail } from "./send-email";
import { MCP_PATH } from "../shared/api";
import { diagErrorSubject } from "./api/messages";
import { mcpHandler } from "./mcp/handler";
import { handleStub, installStubForEmail } from "./dev/stub";
import { emailLoginHandler, isEmailLoginPath } from "./api/emailLogin";

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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const kUrl = new URL(request.url);
    if (kUrl.pathname.startsWith("/k/")) return posthogProxy(request, kUrl);

    // Local walkthroughs only (GOOGLE_STUB=1 in .dev.vars, on localhost).
    const stubbed = await handleStub(request, env);
    if (stubbed) return stubbed;

    const secret = env.GOOGLE_CLIENT_SECRET;
    if (!secret)
      return new Response(JSON.stringify({ error: "Missing secret" }), {
        status: 500,
      });

    try {
      const url = new URL(request.url);
      if (url.pathname === MCP_PATH) {
        return mcpHandler(request, env, ctx);
      }
      if (isEmailLoginPath(url)) {
        return await emailLoginHandler(request, env);
      }
      return loginHandler(request, secret, env.DB);
    } catch (error) {
      // Name and message only: a request body or address must never reach the logs.
      console.error("handler failed:", (error as Error)?.name, (error as Error)?.message?.slice(0, 200));
      return new ErrorResponse(ApiErrors.InternalError);
    }
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
