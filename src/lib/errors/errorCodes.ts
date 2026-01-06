/**
 * Error code constants shared between Rust and TypeScript.
 *
 * These codes are defined in src-tauri/src/error.rs and must be kept in sync.
 *
 * @module
 */

/**
 * Error codes that correspond to the Rust error codes in `src-tauri/src/error.rs`.
 * These codes are sent from the backend and used to categorize and handle errors
 * consistently across the application.
 */
export const ERROR_CODES = {
  /** Git executable was not found on the system */
  GIT_NOT_FOUND: "GIT_NOT_FOUND",
  /** Git command failed with a non-zero exit code */
  GIT_FAILED: "GIT_FAILED",
  /** Error from libgit2 */
  GIT2_ERROR: "GIT2_ERROR",
  /** IO error */
  IO_ERROR: "IO_ERROR",
  /** UTF-8 conversion error */
  UTF8_ERROR: "UTF8_ERROR",
  /** Invalid path provided */
  INVALID_PATH: "INVALID_PATH",
  /** Not a git repository */
  NOT_A_REPOSITORY: "NOT_A_REPOSITORY",
  /** Internal error */
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** Parse error */
  PARSE_ERROR: "PARSE_ERROR",
  /** Validation error */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** Resource not found */
  NOT_FOUND: "NOT_FOUND",
  /** Permission denied */
  PERMISSION_DENIED: "PERMISSION_DENIED",
  /** Conflict error */
  CONFLICT_ERROR: "CONFLICT_ERROR",
  /** Network error */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** Timeout error */
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
} as const;

/** Type of error code values */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Check if an error code is retryable (e.g., transient network issues).
 */
export function isRetryableError(code: ErrorCode): boolean {
  return (
    code === ERROR_CODES.NETWORK_ERROR ||
    code === ERROR_CODES.TIMEOUT_ERROR ||
    code === ERROR_CODES.GIT2_ERROR // Git2 errors might be network-related
  );
}

/**
 * Check if an error is a git-specific error.
 */
export function isGitError(code: ErrorCode): boolean {
  return (
    code === ERROR_CODES.GIT_NOT_FOUND ||
    code === ERROR_CODES.GIT_FAILED ||
    code === ERROR_CODES.GIT2_ERROR
  );
}

/**
 * Get a user-friendly title for an error code.
 */
export function getErrorTitle(code: ErrorCode): string {
  switch (code) {
    case ERROR_CODES.GIT_NOT_FOUND:
      return "Git Not Found";
    case ERROR_CODES.GIT_FAILED:
      return "Git Command Failed";
    case ERROR_CODES.GIT2_ERROR:
      return "Git Operation Failed";
    case ERROR_CODES.IO_ERROR:
      return "File System Error";
    case ERROR_CODES.UTF8_ERROR:
      return "Encoding Error";
    case ERROR_CODES.INVALID_PATH:
      return "Invalid Path";
    case ERROR_CODES.NOT_A_REPOSITORY:
      return "Not a Repository";
    case ERROR_CODES.INTERNAL_ERROR:
      return "Internal Error";
    case ERROR_CODES.PARSE_ERROR:
      return "Parse Error";
    case ERROR_CODES.VALIDATION_ERROR:
      return "Validation Error";
    case ERROR_CODES.NOT_FOUND:
      return "Not Found";
    case ERROR_CODES.PERMISSION_DENIED:
      return "Permission Denied";
    case ERROR_CODES.CONFLICT_ERROR:
      return "Conflict";
    case ERROR_CODES.NETWORK_ERROR:
      return "Network Error";
    case ERROR_CODES.TIMEOUT_ERROR:
      return "Timeout Error";
    default:
      return "Error";
  }
}

/**
 * Suggested actions for specific error codes.
 */
export function getSuggestedAction(code: ErrorCode): string | null {
  switch (code) {
    case ERROR_CODES.GIT_NOT_FOUND:
      return "Install Git from https://git-scm.com/downloads";
    case ERROR_CODES.PERMISSION_DENIED:
      return "Check file permissions and try again";
    case ERROR_CODES.NOT_A_REPOSITORY:
      return "Initialize a Git repository or navigate to one";
    case ERROR_CODES.NETWORK_ERROR:
    case ERROR_CODES.TIMEOUT_ERROR:
      return "Check your internet connection and try again";
    case ERROR_CODES.CONFLICT_ERROR:
      return "Resolve conflicts before continuing";
    case ERROR_CODES.VALIDATION_ERROR:
      return "Check your input and try again";
    default:
      return null;
  }
}
