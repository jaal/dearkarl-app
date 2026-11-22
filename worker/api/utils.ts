import { type RequestPayload } from "../../shared/api";
import {
  DEFAULT_PREFIX,
  type RandomInt,
  buildLocalPart,
  cryptoRandomInt,
  nameFromEmail,
  randomDigits,
  randomHash,
} from "../../shared/address";
import UsersDB, { UserTableRow } from "../db";
import GoogleToken from "../google/token";
import { hasDriveScope } from "../google/scope";

export function getSid(req: Request) {
  const cookieHeader = req.headers?.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? match[1] : null;
}

export async function getPayload(
  request: Request,
): Promise<RequestPayload | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function getValidToken(
  user: UserTableRow,
  client: GoogleToken,
  db: UsersDB,
): Promise<string | null> {
  if (await isAccessTokenValidWithGoogle(user, client)) {
    return user.access_token!;
  }

  // if (client.isTokenValid(user.access_expires ?? 0))
  // return user.access_token ?? null;
  if (!user.refresh_token) {
    return null;
  }
  try {
    const refreshed = await client.refreshAccessToken(user.refresh_token);
    // A refresh keeps whatever was granted: still no Drive means no access.
    if (!hasDriveScope(refreshed.scope)) return null;
    await db.updateUserTokens({
      email: user.email,
      access_token: refreshed.access_token,
      access_expires: Date.now() + refreshed.expires_in * 1000,
    });
    return refreshed.access_token;
  } catch (e: any) {
    // Google's error code only (e.g. invalid_grant): no token, no address.
    console.warn("google token refresh failed:", String(e?.message ?? e).slice(0, 120));
    return null;
  }
}

/**
 * Ask Google (not just the local expiry timestamp) whether a user's stored
 * access_token is still valid. This catches tokens that were revoked
 * server-side or expired early, which `getValidToken`'s `isTokenValid`
 * timestamp check cannot see.
 *
 * Returns false when the user has no token, when Google rejects it, or when
 * the check itself fails (e.g. a network error).
 */
export async function isAccessTokenValidWithGoogle(
  user: UserTableRow,
  client: GoogleToken,
): Promise<boolean> {
  if (!user.access_token) return false;
  try {
    const info = await client.checkGoogleTokenValidity(user.access_token);
    return info.valid && hasDriveScope(info.scope);
  } catch {
    return false;
  }
}

/**
 * Address local part for a new user: `claude-{name}-{hash}`
 * (see shared/address.ts).
 *
 * The name comes from the email's local part. If another user already has
 * that name, four random digits are appended to it. The hash is random; the
 * loop re-rolls in the (unlikely) case the whole local part is taken.
 *
 * Note: the `users.login` column is UNIQUE, so a concurrent insert that loses
 * the check-and-set race still fails safe at the DB constraint.
 */
export async function getUniqueLogin(
  email: string,
  db: UsersDB,
  randomInt: RandomInt = cryptoRandomInt,
  prefix: string = DEFAULT_PREFIX,
): Promise<string> {
  const base = nameFromEmail(email);
  let name = base;
  for (let i = 0; i < 20 && (await db.addressNameTaken(`${prefix}-${name}`)); i++)
    name = `${base}${randomDigits(randomInt)}`;

  for (;;) {
    const login = buildLocalPart(prefix, name, randomHash(randomInt));
    if (!(await db.loginExists(login))) return login;
  }
}
