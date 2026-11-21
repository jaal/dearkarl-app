import loginHandler from "./api/login";
import emailHandler from "./api/email";
import ErrorResponse, { ApiErrors } from "./api/errors";
import { readElasticCredentials, sendDiagnosticEmail } from "./send-email";
import { MCP_PATH } from "../shared/api";
import { diagErrorSubject } from "./api/messages";
import { mcpHandler } from "./mcp/handler";
import { handleStub, installStubForEmail } from "./dev/stub";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Local walkthroughs only (GOOGLE_STUB=1 in .dev.vars, on localhost).
    const stubbed = await handleStub(request, env);
    if (stubbed) return stubbed;

    const secret = env.GOOGLE_CLIENT_SECRET;
    if (!secret)
      return new Response(JSON.stringify({ error: "Missing secret" }), {
        status: 500,
      });

    try {
      if (new URL(request.url).pathname === MCP_PATH) {
        return mcpHandler(request, env, ctx);
      }
      return loginHandler(request, secret, env.DB);
    } catch (error) {
      console.error("login handler failed", error);
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
