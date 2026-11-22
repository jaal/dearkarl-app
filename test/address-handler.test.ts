import { beforeEach, describe, expect, it, vi } from "vitest";
import { addressHandler } from "../worker/api/address";
import { getUniqueLogin } from "../worker/api/utils";

const mocks = vi.hoisted(() => ({
  getUserBySid: vi.fn(),
  addressNameTaken: vi.fn(),
  updateLogin: vi.fn(),
}));

vi.mock("../worker/db", () => ({
  default: class {
    getUserBySid = mocks.getUserBySid;
    addressNameTaken = mocks.addressNameTaken;
    updateLogin = mocks.updateLogin;
  },
}));

const noDb = {} as never;
const USER = { email: "olek@gmail.com", login: "claude-olek-k3m9xq" };
const zero = () => 0; // randomHash -> "aaaaaa", randomDigits -> "1000"

function post(body: unknown, sid: string | null = "sid-1") {
  return new Request("https://dearkarl.com/api/address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sid ? { cookie: `sid=${sid}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserBySid.mockResolvedValue(USER);
  mocks.addressNameTaken.mockResolvedValue(false);
});

describe("POST /api/address", () => {
  it("needs a session", async () => {
    const res = await addressHandler(post({ name: "x" }, null), noDb);
    expect(res.status).toBe(401);
  });

  it("changes the name and keeps prefix and hash", async () => {
    const res = await addressHandler(post({ name: "Karl.Notes" }), noDb);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ karlEmail: "claude-karl.notes-k3m9xq" });
    expect(mocks.updateLogin).toHaveBeenCalledWith(
      "olek@gmail.com",
      "claude-karl.notes-k3m9xq",
    );
    expect(mocks.addressNameTaken).toHaveBeenCalledWith(
      "claude-karl.notes",
      "olek@gmail.com",
    );
  });

  it("rejects an invalid name with the reason", async () => {
    const res = await addressHandler(post({ name: "a b" }), noDb);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ADDRESS_INVALID");
    expect(mocks.updateLogin).not.toHaveBeenCalled();
  });

  it("refuses a name another user has", async () => {
    mocks.addressNameTaken.mockResolvedValue(true);
    const res = await addressHandler(post({ name: "taken" }), noDb);
    expect(res.status).toBe(409);
    expect(mocks.updateLogin).not.toHaveBeenCalled();
  });

  it("gives a legacy login a fresh hash", async () => {
    mocks.getUserBySid.mockResolvedValue({ ...USER, login: "olek1" });
    const res = await addressHandler(post({ name: "olek" }), noDb, zero);
    expect(await res.json()).toEqual({ karlEmail: "claude-olek-aaaaaa" });
  });

  it("does nothing when the name is unchanged", async () => {
    const res = await addressHandler(post({ name: "olek" }), noDb);
    expect(res.status).toBe(200);
    expect(mocks.updateLogin).not.toHaveBeenCalled();
  });
});

describe("getUniqueLogin", () => {
  const db = (taken: string[]) =>
    ({
      addressNameTaken: async (p: string) => taken.includes(p),
      loginExists: async () => false,
    }) as never;

  it("builds claude-{name}-{hash} from the email", async () => {
    expect(await getUniqueLogin("Olek.Jaworski@gmail.com", db([]), zero)).toBe(
      "claude-olek.jaworski-aaaaaa",
    );
  });

  it("adds four digits when the name is taken", async () => {
    expect(
      await getUniqueLogin(
        "olek.jaworski@yahoo.com",
        db(["claude-olek.jaworski"]),
        zero,
      ),
    ).toBe("claude-olek.jaworski1000-aaaaaa");
  });
});
