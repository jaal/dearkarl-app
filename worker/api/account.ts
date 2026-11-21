import UsersDB from "../db";
import ErrorResponse, { ApiErrors } from "./errors";
import { getSid } from "./utils";

interface TokenRevoker {
  revokeGoogleToken(token: string): Promise<void>;
}

/**
 * `POST /api/account/delete`: deletes the signed-in user's account. Karl's
 * Google access is revoked, the user row and their API tokens are removed,
 * and the address stops working at once (mail to it gets the "unknown
 * sender" reply). The dearkarl folder in the user's Drive stays theirs.
 */
export async function deleteAccountHandler(
  request: Request,
  db: Env["DB"],
  google: TokenRevoker,
): Promise<Response> {
  if (request.method !== "POST")
    return new ErrorResponse(ApiErrors.InvalidRequest);

  const sid = getSid(request);
  if (!sid) return new ErrorResponse(ApiErrors.NoSid);

  const usersDb = new UsersDB(db);
  const user = await usersDb.getUserBySid(sid);
  if (!user) return new ErrorResponse(ApiErrors.NoUser);

  // Best effort: a token Google already dropped must not block deletion.
  if (user.refresh_token) {
    try {
      await google.revokeGoogleToken(user.refresh_token);
    } catch {
      // Already revoked or expired; nothing left to revoke.
    }
  }

  await usersDb.deleteAccount(user.email);

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}
