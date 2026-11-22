import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import GoogleToken from "../google/token";
import UsersDB from "../db";
import { createMcpServer } from "./server";
import type { KarlProps } from "./oauth";

/**
 * MCP entrypoint, reached only through the OAuth provider (oauth.ts), which
 * has already checked the bearer token: an OAuth access token from a Claude
 * connector, or a personal token from the account page. ctx.props names the
 * account. The user is looked up again on every request, so a deleted
 * account stops working at once. The protocol is served statelessly: a fresh
 * server + transport per request (`sessionIdGenerator: undefined`).
 */
export async function mcpHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const props = (ctx as ExecutionContext & { props?: KarlProps }).props;
  const user = props?.email ? await new UsersDB(env.DB).getUser(props.email) : null;
  if (!user)
    // Same answer whatever the reason: no account behind this token any more.
    return new Response("Unauthorized", { status: 401 });

  const client = new GoogleToken(env.GOOGLE_CLIENT_SECRET);
  const server = createMcpServer({ user, client, db: env.DB });
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: one server + transport per request, no session ids.
    sessionIdGenerator: undefined,
    // Reply with plain JSON instead of SSE streams: no long-lived stream or
    // keep-alive timer to leak across per-request servers on a stateless worker.
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
