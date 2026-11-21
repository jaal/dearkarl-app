import {
  type ActiveSession,
  ApiPaths,
  type ApiTokenCreated,
  type ApiTokenSummary,
  type LoginUrl,
  type ResponsePayloadProfile,
  isActiveSession,
  isApiTokenCreated,
  isApiTokensList,
  isLoginUrl,
  isChangeAddressResponse,
  isResponsePayloadError,
  isResponsePayloadProfile,
} from "../shared/api";

// Re-exported so this module remains the frontend's API client surface.
export type { ActiveSession, LoginUrl, ApiTokenCreated, ApiTokenSummary };
export { isActiveSession, isLoginUrl };

export const getActiveSession = async (): Promise<ActiveSession | null> => {
  try {
    const response = await fetch(ApiPaths.active);
    if (!response.ok) {
      console.info(await response.json());
      return null;
    }
    const result = await response.json();
    return isActiveSession(result) ? result : null;
  } catch {
    return null;
  }
};

export const getLoginUrl = async (): Promise<LoginUrl | null> => {
  try {
    const response = await fetch(ApiPaths.login);
    if (!response.ok) {
      console.info(await response.json());
      return null;
    }
    const result = await response.json();
    return isLoginUrl(result) ? result : null;
  } catch {
    return null;
  }
};

export const logout = async () => {
  try {
    const response = await fetch(ApiPaths.logout);
    if (!response.ok) console.info(await response.json());
  } catch {}
};

/** Deletes the signed-in user's account. True when it is gone. */
export const deleteAccount = async (): Promise<boolean> => {
  try {
    const response = await fetch(ApiPaths.accountDelete, { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
};

export const requestToken = async (
  code: string,
): Promise<ResponsePayloadProfile | null> => {
  try {
    const response = await fetch(ApiPaths.code, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code }),
    });
    if (!response.ok) {
      console.info(await response.json());
      return null;
    }
    const result = await response.json();
    return isResponsePayloadProfile(result) ? result : null;
  } catch {
    return null;
  }
};

export const createApiToken = async (
  name?: string,
  expiresInDays?: number,
): Promise<ApiTokenCreated | null> => {
  try {
    const response = await fetch(ApiPaths.tokens, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, expiresInDays }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return isApiTokenCreated(result) ? result : null;
  } catch {
    return null;
  }
};

export const listApiTokens = async (): Promise<ApiTokenSummary[] | null> => {
  try {
    const response = await fetch(ApiPaths.tokens);
    if (!response.ok) return null;
    const result = await response.json();
    return isApiTokensList(result) ? result : null;
  } catch {
    return null;
  }
};

export const revokeApiToken = async (id: number): Promise<boolean> => {
  try {
    const response = await fetch(ApiPaths.tokensRevoke, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/** Changes the readable part of the Karl address. Returns the new local part,
    or the reason the server gave for refusing it. */
export const changeAddressName = async (
  name: string,
): Promise<{ karlEmail: string } | { error: string }> => {
  try {
    const response = await fetch(ApiPaths.address, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    if (response.ok && isChangeAddressResponse(result))
      return { karlEmail: result.karlEmail };
    if (isResponsePayloadError(result)) return { error: result.msg };
  } catch {
    // fall through
  }
  return { error: "Could not change the address. Try again." };
};

/** Asks for a sign-in code by email. True when the server took the request
    (it answers the same whether or not the account exists). */
export const requestLoginCode = async (email: string): Promise<boolean> => {
  try {
    const response = await fetch(ApiPaths.loginEmail, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/** Trades the mailed code for a session. "ok", "invalid" (wrong or expired
    code), or "offline" (the request itself failed). */
export const verifyLoginCode = async (
  email: string,
  code: string,
): Promise<"ok" | "invalid" | "offline"> => {
  try {
    const response = await fetch(ApiPaths.loginVerify, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (response.ok) return "ok";
    return response.status === 400 ? "invalid" : "offline";
  } catch {
    return "offline";
  }
};
