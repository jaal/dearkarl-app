import { createHash, randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mailTo, mcpTool, sendToKarl, signUp } from "./helpers";

// What Claude's apps do when you add https://dearkarl.com/mcp as a custom
// connector: discover the OAuth server, register, send you to /authorize,
// trade the code for a token, then call MCP with it.

const ORIGIN = "http://localhost:5180";
const RESOURCE = `${ORIGIN}/mcp`;
// A test client's callback: never contacted (we read the redirect off the
// 302), and .example never resolves.
const REDIRECT = "https://client.example/callback";

const b64url = (buf: Buffer) => buf.toString("base64url");

async function register(request: APIRequestContext): Promise<string> {
  const res = await request.post("/oauth/register", {
    data: {
      client_name: "Claude",
      redirect_uris: [REDIRECT],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).client_id;
}

function authorizeUrl(clientId: string, challenge: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "st4te",
    scope: "karl:read",
    resource: RESOURCE,
  });
  return `/authorize?${q}`;
}

/** Click Allow or Deny and return where /authorize sends the browser. */
async function decide(page: Page, button: "Allow" | "Deny"): Promise<URL> {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/authorize") && r.request().method() === "POST"),
    page.getByRole("button", { name: button }).click(),
  ]);
  expect(res.status()).toBe(302);
  return new URL(res.headers()["location"]);
}

test.describe("Claude connector (OAuth)", () => {
  test("discovery: /mcp without a token points Claude at the metadata", async ({ request }) => {
    const res = await request.post("/mcp", { data: {} });
    expect(res.status()).toBe(401);
    expect(res.headers()["www-authenticate"]).toContain("resource_metadata=");

    const meta = await (await request.get("/.well-known/oauth-protected-resource/mcp")).json();
    expect(meta.resource).toBe(RESOURCE);
    const as = await (await request.get("/.well-known/oauth-authorization-server")).json();
    expect(as.authorization_endpoint).toBe(`${ORIGIN}/authorize`);
    expect(as.registration_endpoint).toBe(`${ORIGIN}/oauth/register`);
  });

  test("signed out: log in with an emailed code, allow, and Claude reads the folder", async ({ page, request, browser }) => {
    // An account with one saved mail, made in another browser.
    const other = await browser.newPage();
    const { email, address } = await signUp(other);
    await sendToKarl(request, { from: email, to: address, subject: "Bakery receipt", body: "two croissants" });
    await mailTo(request, email, /^Saved to your Google Drive$/);
    await other.close();

    const clientId = await register(request);
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    // Not signed in here: /authorize sends us to log in first.
    await page.goto(authorizeUrl(clientId, challenge));
    await expect(page).toHaveURL(/\/login\?next=%2Fauthorize/);
    await expect(page.getByText("Log in to connect Claude to your Karl folder.")).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a code" }).click();
    const mail = await mailTo(request, email, /sign-in code/);
    const code = /(\d{6})/.exec(mail.subject)![1];
    await page.getByLabel("Code").fill(code);
    await page.getByRole("button", { name: "Log in" }).click();

    // Back on the consent page.
    await expect(page.getByRole("heading", { name: "Allow Claude to read your Karl folder?" })).toBeVisible();
    await expect(page.getByText("client.example")).toBeVisible();
    const back = await decide(page, "Allow");
    expect(back.origin + back.pathname).toBe(REDIRECT);
    expect(back.searchParams.get("state")).toBe("st4te");

    const token = await request.post("/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: back.searchParams.get("code")!,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
        resource: RESOURCE,
      },
    });
    expect(token.status()).toBe(200);
    const { access_token, refresh_token } = await token.json();
    expect(refresh_token).toBeTruthy();

    const files = await mcpTool(request, access_token, "list_files");
    expect(files).toContain("Bakery receipt");
  });

  test("Deny sends Claude access_denied and no token", async ({ page, request }) => {
    await signUp(page);
    const clientId = await register(request);
    await page.goto(authorizeUrl(clientId, b64url(createHash("sha256").update("v".repeat(43)).digest())));
    const back = await decide(page, "Deny");
    expect(back.searchParams.get("error")).toBe("access_denied");
    expect(back.searchParams.get("code")).toBeNull();
  });

  test("deleting the account cuts the connector off", async ({ page, request }) => {
    await signUp(page);
    const clientId = await register(request);
    const verifier = b64url(randomBytes(32));
    await page.goto(authorizeUrl(clientId, b64url(createHash("sha256").update(verifier).digest())));
    const back = await decide(page, "Allow");
    const { access_token } = await (
      await request.post("/oauth/token", {
        form: {
          grant_type: "authorization_code",
          code: back.searchParams.get("code")!,
          redirect_uri: REDIRECT,
          client_id: clientId,
          code_verifier: verifier,
          resource: RESOURCE,
        },
      })
    ).json();

    await page.goto("/app");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByRole("button", { name: "Yes, delete my account" }).click();
    await expect(page.getByRole("heading", { name: "Your account is deleted" })).toBeVisible();

    const res = await request.post("/mcp", {
      headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json, text/event-stream" },
      data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(res.status()).toBe(401);
  });
});
