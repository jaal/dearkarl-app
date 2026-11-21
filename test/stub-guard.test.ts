import { describe, expect, it } from "vitest";
import { handleStub } from "../worker/dev/stub";

const req = (url: string) => new Request(url);
const on = { GOOGLE_STUB: "1" } as unknown as Env;
const off = {} as unknown as Env;

describe("local Google stub guard", () => {
  it("is invisible without GOOGLE_STUB, even on localhost", async () => {
    expect(await handleStub(req("http://localhost:5173/api/active"), off)).toBeNull();
    expect((await handleStub(req("http://localhost:5173/api/stub"), off))?.status).toBe(404);
  });

  it("never runs on a public host, even with the flag set", async () => {
    expect((await handleStub(req("https://dearkarl.com/api/stub"), on))?.status).toBe(404);
    expect(await handleStub(req("https://dearkarl.com/api/active"), on)).toBeNull();
  });

  it("serves the fake consent screen on localhost with the flag", async () => {
    const res = await handleStub(
      req("http://localhost:5173/api/stub/google/auth?redirect_uri=http%3A%2F%2Flocalhost%3A5173"),
      on,
    );
    expect(res?.status).toBe(200);
    expect(await res!.text()).toMatch(/LOCAL STUB/);
  });
});
