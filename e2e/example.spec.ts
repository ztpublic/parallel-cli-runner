import { test, expect } from "@playwright/test";

test.describe("Application", () => {
  test("should load the main page", async ({ page }) => {
    await page.goto("/");

    // Wait for the React app to mount
    await page.waitForSelector("#root", { state: "attached" });

    // Basic smoke test - page should have title
    await expect(page).toHaveTitle(/Tauri \+ React \+ Typescript/);
  });

  test("should render the root app container", async ({ page }) => {
    await page.goto("/");

    // The React app should render into #root
    const root = page.locator("#root");
    await expect(root).toBeAttached();
  });
});
