import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccountHandler } from "../worker/api/account";

const mocks = vi.hoisted(() => ({
  getUserBySid: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../worker/db", () => ({
  default: class {
    getUserBySid = mocks.getUserBySid;
    deleteAccount = mocks.deleteAccount;
  },
}));

const noDb = {} as never;
const USER = { email: "olek@gmail.com", login: "claude-olek-k3m9xq", refresh_token: "rt" };

function req(method = "POST", sid: string | null = "sid-1") {
  return new Request("https://dearkarl.com/api/account/delete", {
    method,
    headers: sid ? { cookie: `sid=${sid}` } : {},
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserBySid.mockResolvedValue(USER);
});

describe("POST /api/account/delete", () => {
  it("revokes Google access, deletes the account and clears the cookie", async () => {
    const google = { revokeGoogleToken: vi.fn().mockResolvedValue(undefined) };
    const res = await deleteAccountHandler(req(), noDb, google);
    expect(res.status).toBe(200);
    expect(google.revokeGoogleToken).toHaveBeenCalledWith("rt");
    expect(mocks.deleteAccount).toHaveBeenCalledWith("olek@gmail.com");
    expect(res.headers.get("Set-Cookie")).toMatch(/^sid=;.*Max-Age=0/);
  });

  it("still deletes when Google has already dropped the token", async () => {
    const google = { revokeGoogleToken: vi.fn().mockRejectedValue(new Error("400")) };
    const res = await deleteAccountHandler(req(), noDb, google);
    expect(res.status).toBe(200);
    expect(mocks.deleteAccount).toHaveBeenCalledWith("olek@gmail.com");
  });

  it("refuses without a session, and on GET", async () => {
    const google = { revokeGoogleToken: vi.fn() };
    expect((await deleteAccountHandler(req("POST", null), noDb, google)).ok).toBe(false);
    expect((await deleteAccountHandler(req("GET"), noDb, google)).ok).toBe(false);
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it("refuses an unknown session", async () => {
    mocks.getUserBySid.mockResolvedValue(null);
    const google = { revokeGoogleToken: vi.fn() };
    expect((await deleteAccountHandler(req(), noDb, google)).ok).toBe(false);
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });
});
