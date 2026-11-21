import { expect, test } from "@playwright/test";
import {
  googleConsent,
  mailTo,
  mcp,
  mcpTool,
  newEmail,
  sendToKarl,
  signUp,
  stub,
} from "./helpers";

// Real user journeys, in a real browser, against the local app. Only Google
// (consent, tokens, Drive) and Elastic (outgoing mail) are simulated; the
// worker, D1, the inbound mail handler and the MCP server are the real code.

test.describe("1. A new visitor signs up", () => {
  test("from the home page to a working address and Claude Code line", async ({ page, request }) => {
    const { email, address, token } = await signUp(page);

    // The account page shows what they just set up.
    await expect(page.getByText(address.split("@")[0])).toBeVisible();
    await expect(page.getByText("Connected — mail is landing in your Drive folder.")).toBeVisible();
    await expect(page.getByText(email).first()).toBeVisible();

    // The home page now offers their account, not sign-up.
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Account" })).toHaveText("My account");
    await expect(page.getByRole("link", { name: "Go to my account" })).toBeVisible();

    // The token from the page works with Claude Code's transport.
    expect(await mcpTool(request, token, "list_files")).not.toMatch(/error/i);
  });

  test("declines Google's consent, then changes their mind", async ({ page, request }) => {
    const email = newEmail();
    await page.goto("/app");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await googleConsent(page, email, false);
    await expect(page.getByRole("heading", { name: "You didn't approve it" })).toBeVisible();
    expect((await stub(request, email)).drive).toEqual([]);

    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await googleConsent(page, email);
    await expect(page.getByRole("heading", { name: "Where your mail lands" })).toBeVisible();
  });
});

test.describe("2. Mail to Karl", () => {
  test("their own mail is saved to Drive, confirmed, and Claude can read it", async ({ page, request }) => {
    const { email, address, token } = await signUp(page);
    await sendToKarl(request, {
      from: email,
      to: address,
      subject: "Receipt from the bakery",
      body: "Two loaves, 14 zł.",
    });

    await mailTo(request, email, /^Saved to your Google Drive$/);
    const { drive } = await stub(request, email);
    expect(drive).toHaveLength(1);
    expect(drive[0].content).toContain("Two loaves, 14 zł.");

    const listing = await mcpTool(request, token, "list_files");
    expect(listing).toContain(drive[0].name);
    expect(await mcpTool(request, token, "read_file", { name: drive[0].name })).toContain(
      "Two loaves, 14 zł.",
    );
  });

  test("a stranger is told once a day that the address is unknown, nothing is saved", async ({ page, request }) => {
    const { email, address } = await signUp(page);
    const stranger = newEmail("stranger");
    await sendToKarl(request, { from: stranger, to: address });
    await mailTo(request, stranger, /^I don't know this address yet$/);
    await sendToKarl(request, { from: stranger, to: address });

    expect((await stub(request, stranger)).outbox).toHaveLength(1);
    expect((await stub(request, email)).drive).toEqual([]);
    expect((await stub(request, email)).outbox).toEqual([]);
  });

  test("a forged mail in their name (DMARC fail) is dropped silently", async ({ page, request }) => {
    const { email, address } = await signUp(page);
    await sendToKarl(request, { from: email, to: address, dmarcFail: true });
    // Give the handler the same time a real one would need, then check nothing happened.
    await expect.poll(async () => (await stub(request, "hi@dearkarl.com")).outbox.length).toBeGreaterThan(0);
    expect((await stub(request, email)).drive).toEqual([]);
    expect((await stub(request, email)).outbox).toEqual([]);
  });

  test("after changing the address, mail to the old one is refused with the new one named", async ({ page, request }) => {
    const { email, address: oldAddress } = await signUp(page);
    await page.getByRole("link", { name: "Change" }).click();
    const newName = `notes${Math.random().toString(36).slice(2, 6)}`;
    await page.locator("#address-name").fill(newName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`claude-${newName}-`)).toBeVisible();
    const newAddress = (await page.locator(".mono-inline", { hasText: `claude-${newName}-` }).first().innerText()).trim();

    await sendToKarl(request, { from: email, to: oldAddress });
    const refusal = await mailTo(request, email, /^That isn't your DearKarl address$/);
    expect(refusal.html).toContain(newAddress);
    expect((await stub(request, email)).drive).toEqual([]);

    await sendToKarl(request, { from: email, to: newAddress });
    await mailTo(request, email, /^Saved to your Google Drive$/);
  });
});

test.describe("3. Coming back", () => {
  test("logs out, mail still lands, then logs in with an emailed code", async ({ page, request }) => {
    const { email, address } = await signUp(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in with Google" })).toBeVisible();

    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Account" });
    await expect(nav).toHaveText("Register / Log in");

    // Logging out must not stop Karl from saving mail.
    await sendToKarl(request, { from: email, to: address });
    await mailTo(request, email, /^Saved to your Google Drive$/);

    await nav.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText(/a 6-digit code is on its way/)).toBeVisible();

    const mail = await mailTo(request, email, /sign-in code/);
    const code = /(\d{6})$/.exec(mail.subject)![1];

    await page.getByLabel("Code").fill(code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toContainText("That code is wrong or has expired");

    await page.getByLabel("Code").fill(code);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
    await expect(page.getByText(address.split("@")[0])).toBeVisible();
  });

  test("an address without an account gets the same answer and no mail", async ({ page, request }) => {
    const nobody = newEmail("nobody");
    await page.goto("/login");
    await page.getByLabel("Email").fill(nobody);
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText(/a 6-digit code is on its way/)).toBeVisible();
    expect((await stub(request, nobody)).outbox).toEqual([]);
  });

  test("Register and Log in point at each other", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Create your free address" }).click();
    await expect(page.getByRole("heading", { name: "Sign in with Google" })).toBeVisible();
    await page.getByRole("link", { name: "Log in" }).last().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a signed-in visitor who opens /login goes straight to their account", async ({ page }) => {
    await signUp(page);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  });
});

test.describe("4. Google access is lost", () => {
  test("Karl mails a reconnect link; reconnecting makes saving work again", async ({ page, request }) => {
    const { email, address } = await signUp(page);
    await request.post("/api/stub/expire", { form: { email } });

    await sendToKarl(request, { from: email, to: address, body: "lost note" });
    const notice = await mailTo(request, email, /^Please sign in to DearKarl again$/);
    expect(notice.html).toContain("/app/reconnect");
    expect((await stub(request, email)).drive).toEqual([]);

    await page.goto("/app/reconnect");
    await page.getByRole("button", { name: "Reconnect Google Drive" }).click();
    await googleConsent(page, email);
    await expect(page.getByText("Drive access renewed.")).toBeVisible();

    await sendToKarl(request, { from: email, to: address, body: "found note" });
    await mailTo(request, email, /^Saved to your Google Drive$/);
    expect((await stub(request, email)).drive.map((f) => f.content).join()).toContain("found note");
  });

  test("opening the account while access is lost leads to reconnect", async ({ page, request }) => {
    const { email } = await signUp(page);
    await request.post("/api/stub/expire", { form: { email } });
    await page.goto("/");
    await page.getByRole("link", { name: "My account", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/reconnect$/);
    await expect(page.getByRole("heading", { name: "Reconnect your Google Drive" })).toBeVisible();
    await page.getByRole("button", { name: "Reconnect Google Drive" }).click();
    await googleConsent(page, email);
    await expect(page.getByText("Drive access renewed.")).toBeVisible();
  });
});

test.describe("5. Tokens and leaving", () => {
  test("a revoked Claude Code token stops working at once", async ({ page, request }) => {
    const { token } = await signUp(page);
    expect((await mcp(request, token, "tools/list")).status).toBe(200);
    await page.getByRole("button", { name: "Revoke" }).first().click();
    await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(0);
    expect((await mcp(request, token, "tools/list")).status).toBe(401);
  });

  test("deleting the account frees the address and keeps the Drive files", async ({ page, request }) => {
    const { email, address, token } = await signUp(page);
    await sendToKarl(request, { from: email, to: address, body: "keep me" });
    await mailTo(request, email, /^Saved to your Google Drive$/);

    await page.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByText("This cannot be undone.")).toBeVisible();
    await page.getByRole("button", { name: "Yes, delete my account" }).click();
    await expect(page.getByRole("heading", { name: "Your account is deleted" })).toBeVisible();

    // The files stay theirs.
    expect((await stub(request, email)).drive.map((f) => f.content).join()).toContain("keep me");
    // The address is gone: Karl no longer knows them.
    await sendToKarl(request, { from: email, to: address });
    await mailTo(request, email, /^I don't know this address yet$/);
    // The token is gone too.
    expect((await mcp(request, token, "tools/list")).status).toBe(401);
    // And there is no account to log in to.
    const before = (await stub(request, email)).outbox.length;
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText(/a 6-digit code is on its way/)).toBeVisible();
    expect((await stub(request, email)).outbox).toHaveLength(before);
  });
});

test.describe("6. The site around it", () => {
  test("legal pages: Polish on top, English below, PDFs download", async ({ page, request }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy · Prywatność" }).click();
    await expect(page.locator("#pl h1")).toHaveText("Polityka prywatności");
    await expect(page.locator("#en h1")).toHaveText("Privacy notice & imprint");
    await page.goto("/");
    await page.getByRole("link", { name: "Terms · Regulamin" }).click();
    await expect(page.locator("#pl h1")).toHaveText("Regulamin");
    for (const pdf of ["/regulamin.pdf", "/terms.pdf", "/polityka-prywatnosci.pdf"]) {
      const res = await request.get(pdf);
      expect(res.ok(), pdf).toBe(true);
      expect(res.headers()["content-type"]).toContain("pdf");
    }
  });

  test("'Self-host instead' after declining consent leads to the self-hosting guide", async ({ page }) => {
    await page.goto("/app?error=access_denied");
    await expect(page.getByRole("link", { name: "Self-host instead" })).toHaveAttribute(
      "href",
      "https://github.com/jaal/dearkarl",
    );
  });

  test("no mock-up notes or stale promises on the onboarding pages", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await googleConsent(page, newEmail());
    const leftovers = /inert in this mock|lorem|TODO|bounces/i;
    await expect(page.getByRole("heading", { name: "Where your mail lands" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(leftovers);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "This is your address" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(leftovers);
    await page.getByRole("button", { name: "Next: connect Claude Code" }).click();
    await expect(page.getByRole("heading", { name: "Paste this into Claude Code" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(leftovers);
  });
});

test.describe("7. On a phone @mobile", () => {
  test("home and the whole sign-up fit the screen @mobile", async ({ page }) => {
    const noSideScroll = async () =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    await page.goto("/login");
    await noSideScroll();
    await page.goto("/");
    await noSideScroll();
    await signUp(page);
    await noSideScroll();
  });
});
