import { deleteAccountHandler, sessionHandler } from "./account";
import GoogleToken, { DRIVE_FILE_SCOPE } from "../google/token";
import {
  RequestPayload,
  ResponsePayloadProfile,
  isRequestPayloadCode,
  isLoginRequest,
  isCodeRequest,
  isActiveRequest,
  ActiveSession,
  LoginUrl,
  isLogoutRequest,
  isAccountDeleteRequest,
  isSessionRequest,
  isTokensRequest,
  isTokensRevokeRequest,
  isAddressRequest,
} from "../../shared/api";
import UsersDB, { UserTableRow } from "../db";
import { getPayload, getSid, getValidToken, getUniqueLogin } from "./utils";
import ErrorResponse, { ApiErrors } from "./errors";
import { tokenHandler } from "./tokens";
import { addressHandler } from "./address";

/** Session cookie lifetime when Google does not bound it: 30 days. */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export const sessionCookie = (sid: string, maxAge: number) =>
  `sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

export const CLEAR_SID_COOKIE = sessionCookie("", 0);

type AccessData = {
  access_token: string;
  expires_in: string;
  refresh_token: string;
  refresh_token_expires_in: string;
  id_token: string;
  scope?: string;
};

export function hasDriveScope(scope: string | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(DRIVE_FILE_SCOPE);
}

function convertExpireToDate(expires_in: string) {
  const expiresTmp = parseInt(expires_in);
  if (isNaN(expiresTmp)) return 0;

  return expiresTmp * 1000 + Date.now();
}

export async function loginHandler(
  request: Request,
  secret: string,
  db: Env["DB"],
) {
  // Token routes must be handled before getPayload: reading the body here would
  // consume it, and tokenHandler needs to parse the POST body itself.
  const url = new URL(request.url);
  if (isTokensRequest(url) || isTokensRevokeRequest(url)) {
    return tokenHandler(request, db);
  }
  if (isAddressRequest(url)) {
    return addressHandler(request, db);
  }
  if (isSessionRequest(url)) {
    return sessionHandler(request, db);
  }
  if (isAccountDeleteRequest(url)) {
    return deleteAccountHandler(request, db, new GoogleToken(secret));
  }

  const payload: RequestPayload | null = await getPayload(request);

  const client = new GoogleToken(secret);
  if (isLogoutRequest(url)) {
    const sid = getSid(request);
    if (!sid) return new ErrorResponse(ApiErrors.LogoutNoSid);

    const usersDb = new UsersDB(db);
    const user = await usersDb.getUserBySid(sid);
    if (!user) return new ErrorResponse(ApiErrors.LogoutNoUser);

    // Logging out ends this browser's session only. Karl's Drive access is
    // left alone, so mail keeps landing in the folder; revoking it is what
    // deleting the account does.
    await usersDb.logout(user.email);
    return new Response(JSON.stringify({ loggedOut: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": CLEAR_SID_COOKIE,
      },
    });
  }
  if (isLoginRequest(url)) {
    const payload: LoginUrl = {
      url: client.getLoginUrl(),
    };
    return new Response(JSON.stringify(payload), { status: 200 });
  }

  if (isCodeRequest(url) && isRequestPayloadCode(payload)) {
    const access = (await client.getAccessToken(
      payload.code ?? "",
    )) as AccessData | null;
    if (!access || access.id_token === undefined)
      return new ErrorResponse(ApiErrors.CodeInvalidToken);

    // Google's consent screen shows Drive as a separate checkbox, and lets
    // the user continue with it unticked. Without it Karl cannot save a
    // thing, so make no account and keep any tokens already stored.
    if (!hasDriveScope(access.scope))
      return new ErrorResponse(ApiErrors.DriveScopeMissing);

    const jwtPayload = access.id_token.split(".")[1];
    const decoded = JSON.parse(
      atob(jwtPayload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const usersDb = new UsersDB(db);

    const user = (await usersDb.getUser(decoded.email)) as any;

    // Existing users keep their login; new users get a unique one derived from
    // their email (re-rolled until it doesn't collide with a stored login).
    const login =
      user?.login ?? (await getUniqueLogin(decoded.email, usersDb));

    const responsePayload: ResponsePayloadProfile = {
      type: "PROFILE",
      email: decoded.email,
      login,
      isNewUser: user === null,
    };

    const userRow: UserTableRow = {
      email: decoded.email,
      login,
      access_token: access.access_token,
      access_expires: convertExpireToDate(access.expires_in),
      refresh_token: access.refresh_token,
      refresh_expires: access.refresh_token_expires_in
        ? convertExpireToDate(access.refresh_token_expires_in)
        : null,
      session_id: crypto.randomUUID(),
    };

    if (user === null) {
      try {
        await usersDb.addUser(userRow);
      } catch (e) {
        // A parallel sign-in for the same new account won the insert (a
        // double-submitted callback). Join it instead of failing: keep the
        // stored address, take this sign-in's tokens and session.
        const winner = await usersDb.getUser(decoded.email);
        if (!winner?.login) throw e;
        userRow.login = winner.login;
        responsePayload.login = winner.login;
        await usersDb.updateUserTokens(userRow);
      }
    } else {
      await usersDb.updateUserTokens(userRow);
    }

    // Google gives refresh_token_expires_in in seconds, and only while the
    // OAuth app is in testing; otherwise the session lasts SESSION_MAX_AGE.
    const refreshSeconds = Number(access.refresh_token_expires_in);
    const cookieMaxAge =
      Number.isFinite(refreshSeconds) && refreshSeconds > 120
        ? Math.floor(refreshSeconds) - 60
        : SESSION_MAX_AGE;
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        "Set-Cookie": sessionCookie(userRow.session_id!, cookieMaxAge),
      },
    });
  }

  if (isActiveRequest(url)) {
    const sid = getSid(request);
    if (!sid) return new ErrorResponse(ApiErrors.NoSid);

    const usersDb = new UsersDB(db);
    const user = await usersDb.getUserBySid(sid);
    if (!user) return new ErrorResponse(ApiErrors.NoUser);

    const accessToken = await getValidToken(user, client, usersDb);
    if (!accessToken) return new ErrorResponse(ApiErrors.InvalidToken);

    let responsePayload: ActiveSession = {
      userEmail: user.email,
      karlEmail: user.login ?? "Invalid",
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
    });
  }

  return new ErrorResponse(ApiErrors.InvalidRequest);
}

export default loginHandler;
