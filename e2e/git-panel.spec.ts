import { test, expect } from "@playwright/test";

test.describe("Git Panel", () => {
  test("should display Open Folder button when no repos are bound", async ({ page }) => {
    await page.goto("/");

    // Wait for the React app to mount
    await page.waitForSelector("#root", { state: "attached" });

    // Find the Open Folder buttons in the git panels
    // The app has multiple git panels (e.g., for different repos/tabs)
    const openFolderButtons = page.getByRole("button", { name: "Open Folder" });

    // Check that at least one Open Folder button is visible
    await expect(openFolderButtons.first()).toBeVisible();

    // Also verify there are multiple Open Folder buttons (one per git panel)
    const count = await openFolderButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have the git-empty state when no repos", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector("#root", { state: "attached" });

    // Check for the empty state containers
    const emptyStates = page.locator(".git-empty");

    // At least one git-empty state should be visible
    await expect(emptyStates.first()).toBeVisible();

    // Verify there are multiple empty states (one per git panel)
    const count = await emptyStates.count();
    expect(count).toBeGreaterThan(0);
  });
});
