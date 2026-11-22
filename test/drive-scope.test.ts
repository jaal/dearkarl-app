import { describe, expect, it } from "vitest";
import { hasDriveScope } from "../worker/api/login";

describe("hasDriveScope", () => {
  it("accepts a grant that includes drive.file", () => {
    expect(
      hasDriveScope(
        "email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email openid",
      ),
    ).toBe(true);
  });
  it("rejects a grant with the Drive box unticked (email only)", () => {
    expect(hasDriveScope("openid https://www.googleapis.com/auth/userinfo.email")).toBe(false);
  });
  it("rejects a missing scope and look-alikes", () => {
    expect(hasDriveScope(undefined)).toBe(false);
    expect(hasDriveScope("https://www.googleapis.com/auth/drive.file.readonly")).toBe(false);
  });
});
