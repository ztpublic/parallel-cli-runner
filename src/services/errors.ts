/**
 * Error service for Tauri invoke errors.
 *
 * @module
 */

import { parseError, formatError } from "../lib/errors";

/**
 * Format an error from a Tauri invoke call.
 *
 * @deprecated Use `parseError` and `formatError` from `../lib/errors` instead.
 * This function is kept for backwards compatibility.
 */
export function formatInvokeError(error: unknown): string {
  const parsed = parseError(error);
  const formatted = formatError(parsed);
  return formatted.message;
}

/**
 * Parse an error from a Tauri invoke call.
 *
 * @deprecated Use `parseError` from `../lib/errors` instead.
 * This function is kept for backwards compatibility.
 */
export function parseInvokeError(error: unknown) {
  return parseError(error);
}

/**
 * Re-export the error utilities for convenience.
 */
export { parseError, formatError } from "../lib/errors";
export type { AppError, ParsedError } from "../lib/errors";