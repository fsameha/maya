import { expect, test } from "@playwright/test";

test("loader plays once, lands, and Home renders with the H1 in the DOM from the start", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(/Maya remembers/);
  await expect(page.locator("html")).toHaveAttribute("data-intro", /play|reveal|done/);
  await expect(page.locator("html")).toHaveAttribute("data-intro", "done", { timeout: 5000 });
  await page.reload();
  await expect(page.locator(".ink-loader")).toHaveCount(0); // once per session
});

test("skip intro works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro" }).click({ timeout: 3000 });
  await expect(page.locator("html")).toHaveAttribute("data-intro", "done");
});

test("reduced motion shows the final frame (no loader)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "done");
  await expect(page.locator(".ink-loader")).toHaveCount(0);
  await ctx.close();
});

test("Watch plays, scrubs and responds to the keyboard", async ({ page }) => {
  await page.goto("/demo?nointro");
  await page.getByRole("button", { name: "Play the story" }).click();
  await expect(page.getByText("Maya, I can't find my glasses.").first()).toBeVisible({ timeout: 15000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { level: 1, name: "Glasses" })).toBeVisible();
});

test("See how it works lands on the stage for the chapter", async ({ page }) => {
  await page.goto("/demo?nointro&ch=4");
  await page.getByRole("button", { name: "Play the story" }).click();
  await page.getByRole("button", { name: /See how it works/ }).click();
  await expect(page).toHaveURL(/#how-stage-7$/);
  await expect(async () => {
    const top = await page.locator("#how-stage-7").evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top - 64)).toBeLessThan(140);
  }).toPass({ timeout: 6000 });
});

test("no horizontal scroll at 360px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  for (const path of ["/", "/demo", "/try", "/proof", "/trust"]) {
    await page.goto(path + "?nointro");
    await page.waitForTimeout(800);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw, path).toBeLessThanOrEqual(360);
  }
  await ctx.close();
});
