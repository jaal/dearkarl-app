import { beforeEach, describe, expect, it, vi } from "vitest";
import loginHandler from "../worker/api/login";

// Shared mocks: the handler news up GoogleToken and UsersDB internally, so we
// replace those modules and control their methods from the test. hoisted() keeps
// these references usable from inside the vi.mock factories.
const mocks = vi.hoisted(() => ({
  getLoginUrl: vi.fn(),
  getAccessToken: vi.fn(),
  isTokenValid: vi.fn(),
  refreshAccessToken: vi.fn(),
  getUser: vi.fn(),
  getUserBySid: vi.fn(),
  addUser: vi.fn(),
  updateUserTokens: vi.fn(),
  loginExists: vi.fn(),
  addressNameTaken: vi.fn(),
}));

const DRIVE_GRANT =
  "email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid";

vi.mock("../worker/google/token", () => ({
  DRIVE_FILE_SCOPE: "https://www.googleapis.com/auth/drive.file",
  default: class {
    getLoginUrl = mocks.getLoginUrl;
    getAccessToken = mocks.getAccessToken;
    isTokenValid = mocks.isTokenValid;
    refreshAccessToken = mocks.refreshAccessToken;
  },
}));

vi.mock("../worker/db", () => ({
  default: class {
    getUser = mocks.getUser;
    getUserBySid = mocks.getUserBySid;
    addUser = mocks.addUser;
    updateUserTokens = mocks.updateUserTokens;
    loginExists = mocks.loginExists;
    addressNameTaken = mocks.addressNameTaken;
  },
}));

// loginHandler ignores these when the modules above are mocked.
const SECRET = "{}";
const noDb = {} as never;

function apiRequest(path: string, init?: RequestInit) {
  return new Request(`https://example.com${path}`, init);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("/api/login", () => {
  it("returns 200 with the Google login URL for a POST", async () => {
    mocks.getLoginUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/v2/auth?foo=1",
    );

    const res = await loginHandler(
      apiRequest("/api/login", { method: "POST" }),
      SECRET,
      noDb,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?foo=1",
    });
  });

  it("returns 200 for a GET as well (routing is path-based)", async () => {
    mocks.getLoginUrl.mockReturnValue("https://accounts.google.com/");

    const res = await loginHandler(apiRequest("/api/login"), SECRET, noDb);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://accounts.google.com/" });
  });

  it("does not touch the database", async () => {
    mocks.getLoginUrl.mockReturnValue("https://accounts.google.com/");

    await loginHandler(apiRequest("/api/login"), SECRET, noDb);

    expect(mocks.getUserBySid).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});

describe("/api/active", () => {
  const sid = "abc123";
  const userRow = {
    email: "user@example.com",
    login: "karl-login",
    access_token: "google-token-123",
    refresh_token: "refresh-123",
  };

  function activeRequest() {
    return apiRequest("/api/active", {
      headers: { cookie: `sid=${sid}` },
    });
  }

  it("returns 401 when there is no sid cookie", async () => {
    const res = await loginHandler(apiRequest("/api/active"), SECRET, noDb);

    expect(res.status).toBe(401);
    expect(mocks.getUserBySid).not.toHaveBeenCalled();
  });

  it("returns 401 when no user matches the sid", async () => {
    mocks.getUserBySid.mockResolvedValue(null);

    const res = await loginHandler(activeRequest(), SECRET, noDb);

    expect(res.status).toBe(401);
    expect(mocks.getUserBySid).toHaveBeenCalledWith(sid);
    expect(mocks.isTokenValid).not.toHaveBeenCalled();
  });

  it("returns 401 when the user's Google token has expired", async () => {
    mocks.getUserBySid.mockResolvedValue(userRow);
    mocks.isTokenValid.mockReturnValue(false);
    mocks.refreshAccessToken.mockRejectedValue(new Error("refresh failed"));

    const res = await loginHandler(activeRequest(), SECRET, noDb);

    expect(res.status).toBe(401);
    expect(mocks.isTokenValid).toHaveBeenCalled();
    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("refresh-123");
  });

  it("returns 200 with the active session when the token is valid", async () => {
    mocks.getUserBySid.mockResolvedValue(userRow);
    mocks.isTokenValid.mockReturnValue(true);

    const res = await loginHandler(activeRequest(), SECRET, noDb);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      userEmail: "user@example.com",
      karlEmail: "karl-login",
    });
  });
});

describe("/api/code", () => {
  // An unsigned JWT is enough: the handler only base64-decodes the payload.
  const idToken = `x.${btoa(JSON.stringify({ email: "user@example.com" }))}.x`;

  function codeRequest() {
    return apiRequest("/api/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "abc" }),
    });
  }

  beforeEach(() => {
    mocks.getAccessToken.mockResolvedValue({
      access_token: "a",
      expires_in: "3600",
      refresh_token: "r",
      refresh_token_expires_in: "604800",
      id_token: idToken,
      scope: DRIVE_GRANT,
    });
  });

  it("marks a first sign-in as a new user, so the app runs onboarding", async () => {
    mocks.getUser.mockResolvedValue(null);
    mocks.loginExists.mockResolvedValue(false);

    const res = await loginHandler(codeRequest(), SECRET, noDb);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ type: "PROFILE", isNewUser: true });
    expect(mocks.addUser).toHaveBeenCalled();
  });

  it("marks a returning sign-in (e.g. a reconnect) as an existing user", async () => {
    mocks.getUser.mockResolvedValue({ email: "user@example.com", login: "karl" });

    const res = await loginHandler(codeRequest(), SECRET, noDb);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      type: "PROFILE",
      login: "karl",
      isNewUser: false,
    });
    expect(mocks.updateUserTokens).toHaveBeenCalled();
    expect(mocks.addUser).not.toHaveBeenCalled();
  });

  it("keeps the session for Google's refresh lifetime, in seconds", async () => {
    mocks.getUser.mockResolvedValue({ email: "user@example.com", login: "karl" });
    const res = await loginHandler(codeRequest(), SECRET, noDb);
    expect(res.headers.get("Set-Cookie")).toMatch(/Max-Age=604740(;|$)/);
  });

  it("falls back to 30 days when Google gives no refresh lifetime", async () => {
    mocks.getUser.mockResolvedValue({ email: "user@example.com", login: "karl" });
    mocks.getAccessToken.mockResolvedValue({
      access_token: "a",
      expires_in: "3600",
      refresh_token: "r",
      id_token: idToken,
      scope: DRIVE_GRANT,
    });
    const res = await loginHandler(codeRequest(), SECRET, noDb);
    expect(res.headers.get("Set-Cookie")).toMatch(/Max-Age=2592000(;|$)/);
  });

  it("makes no account and keeps stored tokens when the Drive box was left unticked", async () => {
    mocks.getUser.mockResolvedValue(null);
    mocks.getAccessToken.mockResolvedValue({
      access_token: "a",
      expires_in: "3600",
      refresh_token: "r",
      id_token: idToken,
      scope: "openid https://www.googleapis.com/auth/userinfo.email",
    });
    const res = await loginHandler(codeRequest(), SECRET, noDb);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "DRIVE_SCOPE_MISSING" });
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(mocks.addUser).not.toHaveBeenCalled();
    expect(mocks.updateUserTokens).not.toHaveBeenCalled();
  });

  it("joins a parallel first sign-in instead of failing on the duplicate", async () => {
    mocks.getUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: "user@example.com", login: "claude-won-abc234" });
    mocks.loginExists.mockResolvedValue(false);
    mocks.addUser.mockRejectedValue(new Error("UNIQUE constraint failed: users.email"));

    const res = await loginHandler(codeRequest(), SECRET, noDb);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ login: "claude-won-abc234", isNewUser: true });
    expect(mocks.updateUserTokens).toHaveBeenCalledWith(
      expect.objectContaining({ login: "claude-won-abc234" }),
    );
  });
});

describe("routing", () => {
  it("returns 404 for an unknown route", async () => {
    const res = await loginHandler(apiRequest("/api/nope"), SECRET, noDb);

    expect(res.status).toBe(404);
  });
});
