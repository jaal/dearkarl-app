import { expect, test } from "@playwright/test";

// A first visit: no answer stored yet.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Analytics consent", () => {
  test("nothing is sent before an answer; No stores only the answer", async ({ page }) => {
    const sent: string[] = [];
    await page.route("**/k/**", (route) => {
      sent.push(route.request().url());
      return route.fulfill({ status: 200, body: "{}" });
    });

    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Can we count your visit?" });
    await expect(dialog).toBeVisible();
    expect(sent).toEqual([]);

    await dialog.getByRole("button", { name: "No" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(dialog).toBeHidden();
    expect(sent).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("dk_consent"))).toBe("no");
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("ph_")))).toEqual([]);

    // "Cookie settings" in the footer asks again.
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(dialog).toBeVisible();
  });

  test("Yes starts analytics through /k on this origin", async ({ page }) => {
    const sent: string[] = [];
    await page.route("**/k/**", (route) => {
      sent.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto("/?code=secret&utm_source=test");
    await page.getByRole("dialog").getByRole("button", { name: "Yes" }).click();
    await expect.poll(() => sent.length).toBeGreaterThan(0);
    expect(sent.every((p) => p.startsWith("/k/"))).toBe(true);
  });

  test("on the legal pages it is a bar, not a modal", async ({ page }) => {
    await page.goto("/privacy");
    const dialog = page.getByRole("dialog", { name: "Can we count your visit?" });
    await expect(dialog).toBeVisible();
    // The notice behind it stays usable.
    await page.getByRole("link", { name: /Terms/ }).first().click();
    await expect(page).toHaveURL(/\/terms/);
  });
});
