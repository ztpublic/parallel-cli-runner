import { test as base } from "@playwright/test";
import { GitRepoFactory, GitRepoInfo } from "./git-repo-factory";

/**
 * Custom test fixtures extending Playwright's base fixtures
 *
 * Add app-specific helpers and fixtures here for reuse across tests
 */
export const test = base.extend<{
  repoFactory: GitRepoFactory;
  createRepo: (name: string) => Promise<GitRepoInfo>;
}>({
  // GitRepoFactory instance for creating test repositories
  repoFactory: async ({}, use) => {
    const factory = new GitRepoFactory();
    await use(factory);
    // Cleanup all repos after the test completes
    await factory.cleanupAll();
  },

  // Helper fixture to quickly create a simple repo
  createRepo: async ({ repoFactory }, use) => {
    const repos: GitRepoInfo[] = [];
    await use(async (name: string) => {
      const builder = await repoFactory.create({
        name,
        withInitialCommit: true,
        initialCommitMessage: "Initial commit",
      });
      const repo = builder.build();
      repos.push(repo);
      return repo;
    });
  },
});

export { expect } from "@playwright/test";
