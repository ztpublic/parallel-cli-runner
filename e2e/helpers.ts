import type { Page } from "@playwright/test";

/**
 * Helper functions for E2E tests
 */

/**
 * Wait for the app to be fully hydrated and ready
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the body to be visible
  await page.waitForSelector("body", { state: "attached" });

  // Add any app-specific readiness checks here
  // Example: await page.waitForSelector('[data-testid="app-ready"]');
}

/**
 * Navigate to a specific route in the app
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForAppReady(page);
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: `screenshots/${name}.png`,
    fullPage: true,
  });
}
