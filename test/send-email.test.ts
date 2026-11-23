import { afterEach, describe, expect, it, vi } from "vitest";
import sendEmail from "../worker/send-email";

afterEach(() => vi.unstubAllGlobals());

describe("sendEmail", () => {
  it("sends from the Elastic username with Reply-To hi@dearkarl.com", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendEmail(
      { apiKey: "k", username: "karl@mail.dearkarl.com" },
      { to: "user@example.com", subject: "s", text: "t" },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.Content.From).toBe("karl@mail.dearkarl.com");
    expect(body.Content.ReplyTo).toBe("hi@dearkarl.com");
    expect(body.Recipients).toEqual({ To: ["user@example.com"] });
    // Setting tracking per message makes Elastic reject the send with 400;
    // tracking is off at the account level instead.
    expect(body.Options).toBeUndefined();
  });
});
