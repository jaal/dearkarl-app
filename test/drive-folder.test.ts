import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRIVE_HOME, driveFolderHandler, folderUrl } from "../worker/api/driveFolder";

const mocks = vi.hoisted(() => ({
  getUserBySid: vi.fn(),
  getValidToken: vi.fn(),
  getRootFolderId: vi.fn(),
}));

vi.mock("../worker/db", () => ({
  default: class {
    getUserBySid = mocks.getUserBySid;
  },
}));
vi.mock("../worker/api/utils", async (orig) => ({
  ...(await orig<typeof import("../worker/api/utils")>()),
  getValidToken: mocks.getValidToken,
}));
vi.mock("../worker/google/token", () => ({ default: class {} }));
vi.mock("../worker/google/drive", () => ({
  default: class {
    getRootFolderId = mocks.getRootFolderId;
  },
}));

const get = (sid: string | null = "sid-1") =>
  new Request("https://dearkarl.com/api/drive/folder", {
    headers: sid ? { cookie: `sid=${sid}` } : {},
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserBySid.mockResolvedValue({ email: "olek@gmail.com" });
  mocks.getValidToken.mockResolvedValue("access");
  mocks.getRootFolderId.mockResolvedValue("folder123");
});

describe("GET /api/drive/folder", () => {
  it("redirects to the user's dearkarl folder", async () => {
    const res = await driveFolderHandler(get(), "secret", {} as never);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(folderUrl("folder123"));
    expect(folderUrl("folder123")).toBe("https://drive.google.com/drive/folders/folder123");
  });

  it("falls back to Drive home without a session", async () => {
    const res = await driveFolderHandler(get(null), "secret", {} as never);
    expect(res.headers.get("Location")).toBe(DRIVE_HOME);
  });

  it("falls back to Drive home when Drive access is gone", async () => {
    mocks.getValidToken.mockResolvedValue(null);
    const res = await driveFolderHandler(get(), "secret", {} as never);
    expect(res.headers.get("Location")).toBe(DRIVE_HOME);
  });

  it("falls back to Drive home when Drive errors", async () => {
    mocks.getRootFolderId.mockRejectedValue(new Error("boom"));
    const res = await driveFolderHandler(get(), "secret", {} as never);
    expect(res.headers.get("Location")).toBe(DRIVE_HOME);
  });
});
