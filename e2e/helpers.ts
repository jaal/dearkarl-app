import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** A fresh Google account per test, so parallel journeys never share state. */
export function newEmail(name = "ania"): string {
  return `${name}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export interface StubMail {
  to: string;
  subject: string;
  html: string;
}
export interface StubState {
  expired: boolean;
  outbox: StubMail[];
  drive: { name: string; content: string }[];
}

/** What the stub holds for one account: mail Karl sent it, its Drive files. */
export async function stub(request: APIRequestContext, email: string): Promise<StubState> {
  const res = await request.get(`/api/stub/state?email=${encodeURIComponent(email)}`);
  expect(res.ok()).toBe(true);
  return res.json();
}

/** Waits until Karl has sent `email` a mail whose subject matches. */
export async function mailTo(
  request: APIRequestContext,
  email: string,
  subject: RegExp,
): Promise<StubMail> {
  let found: StubMail | undefined;
  await expect
    .poll(async () => {
      found = (await stub(request, email)).outbox.find((m) => subject.test(m.subject));
      return Boolean(found);
    }, { message: `mail to ${email} matching ${subject}` })
    .toBe(true);
  return found!;
}

/** Sends a mail to Karl through the real inbound handler (Cloudflare Email
    Routing's part is simulated: envelope + Authentication-Results). */
export async function sendToKarl(
  request: APIRequestContext,
  mail: {
    from: string;
    to: string;
    subject?: string;
    body?: string;
    dmarcFail?: boolean;
    /** Sender-authentication scenario; see sendToKarl in worker/dev/stub.ts. */
    auth?: "pass" | "dmarcfail" | "softfail" | "injected" | "autoforward";
  },
): Promise<void> {
  const form: Record<string, string> = {
    from: mail.from,
    to: mail.to,
    subject: mail.subject ?? "A note",
    body: mail.body ?? "Hello Karl",
  };
  if (mail.dmarcFail) form.dmarcfail = "on";
  if (mail.auth) form.auth = mail.auth;
  const res = await request.post("/api/stub/send", { form, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const note = decodeURIComponent(new URL(res.headers().location).searchParams.get("note") ?? "");
  expect(note, "the inbound handler must not throw").not.toMatch(/threw/);
}

/** On the stub's Google consent screen: pick the account, tick or untick
    Drive access, Allow or Cancel. */
export async function googleConsent(
  page: Page,
  email: string,
  allow = true,
  drive = true,
): Promise<void> {
  await expect(page).toHaveURL(/\/api\/stub\/google\/auth/);
  await page.getByLabel("Google account").fill(email);
  if (!drive) await page.getByLabel(/Drive files you use with this app/).uncheck();
  await page.getByRole("button", { name: allow ? "Allow" : "Cancel" }).click();
}

export interface NewAccount {
  email: string;
  address: string;
  token: string;
}

/**
 * The whole sign-up, as a visitor does it: home page CTA → Google → the
 * three onboarding steps → account page. Returns the Karl address and the
 * MCP token the page showed.
 */
export async function signUp(page: Page, email = newEmail()): Promise<NewAccount> {
  await page.goto("/");
  await page.getByRole("link", { name: "Create your free address" }).first().click();
  await expect(page.getByRole("heading", { name: "Sign in with Google" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await googleConsent(page, email);

  await expect(page.getByRole("heading", { name: "Where your mail lands" })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByRole("heading", { name: "This is your address" })).toBeVisible();
  const address = (await page.locator("code.address").innerText()).trim();
  expect(address).toMatch(/^claude-[a-z0-9.]+-[a-z0-9]{6}@in\.dearkarl\.com$/);
  await expect(page.getByText(email).first()).toBeVisible();
  await page.getByRole("button", { name: "Next: connect Claude Code" }).click();

  await expect(page.getByRole("heading", { name: "Paste this into Claude Code" })).toBeVisible();
  await page.getByRole("button", { name: "Generate my token" }).click();
  const line = page.locator("code.mono", { hasText: "claude mcp add" });
  await expect(line).toBeVisible();
  const token = /Bearer ([^"\s]+)/.exec(await line.innerText())![1];
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  return { email, address, token };
}

/** Calls Karl's MCP server the way Claude Code does (streamable HTTP). */
export async function mcp(
  request: APIRequestContext,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<{ status: number; body: any }> {
  const res = await request.post("/mcp", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status(), body };
}

/** Text of an MCP tool result. */
export async function mcpTool(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const init = await mcp(request, token, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "e2e", version: "0" },
  });
  expect(init.status).toBe(200);
  const res = await mcp(request, token, "tools/call", { name, arguments: args });
  expect(res.status).toBe(200);
  return (res.body.result?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("\n");
}
