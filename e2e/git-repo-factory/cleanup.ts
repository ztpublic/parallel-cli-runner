/**
 * Cleanup utilities for test repositories
 *
 * Run this script to clean up old test repositories:
 *   npx tsx e2e/git-repo-factory/cleanup.ts
 */

import { readdir, stat, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_REPOS_DIR = join(__dirname, '../test-data/repos');

/**
 * Check if a directory is older than the specified number of milliseconds
 */
async function isOlderThan(path: string, ms: number): Promise<boolean> {
  const stats = await stat(path);
  const age = Date.now() - stats.mtimeMs;
  return age > ms;
}

/**
 * Remove a directory recursively
 */
async function removeDirectory(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
    console.log(`Removed: ${path}`);
  } catch (error) {
    console.error(`Failed to remove ${path}:`, error);
  }
}

/**
 * Clean up test repositories older than the specified age
 */
export async function cleanupOldRepos(
  dir: string = TEST_REPOS_DIR,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> {
  if (!existsSync(dir)) {
    console.log('Test repositories directory does not exist.');
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = join(dir, entry.name);

    try {
      if (await isOlderThan(fullPath, maxAgeMs)) {
        await removeDirectory(fullPath);
        removedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${entry.name}:`, error);
    }
  }

  if (removedCount === 0) {
    console.log('No old repositories found to clean up.');
  } else {
    console.log(`Cleaned up ${removedCount} old repository(s).`);
  }
}

/**
 * Clean up all test repositories
 */
export async function cleanupAllRepos(dir: string = TEST_REPOS_DIR): Promise<void> {
  if (!existsSync(dir)) {
    console.log('Test repositories directory does not exist.');
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = join(dir, entry.name);

    try {
      await removeDirectory(fullPath);
      removedCount++;
    } catch (error) {
      console.error(`Error processing ${entry.name}:`, error);
    }
  }

  console.log(`Removed ${removedCount} repository(ies).`);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const maxAge = args[0] ? parseInt(args[0], 10) * 60 * 60 * 1000 : undefined; // hours

  if (args.includes('--all')) {
    cleanupAllRepos();
  } else if (maxAge !== undefined) {
    cleanupOldRepos(TEST_REPOS_DIR, maxAge);
  } else {
    // Default: clean up repos older than 24 hours
    cleanupOldRepos();
  }
}
