import { test as base } from "@playwright/test";

/**
 * Custom test fixtures extending Playwright's base fixtures
 *
 * Add app-specific helpers and fixtures here for reuse across tests
 */
export const test = base.extend({
  // Add custom fixtures here
  // Example: authenticatedPage: async ({ page }, use) => { ... }
});

export { expect } from "@playwright/test";
