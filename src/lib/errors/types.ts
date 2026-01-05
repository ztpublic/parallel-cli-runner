/**
 * Error type definitions for the application.
 *
 * @module
 */

/**
 * Standard error response structure from the backend.
 * This matches the `ErrorResponse` struct in src-tauri/src/error.rs.
 */
export interface ErrorResponse {
  /** Error code (matches ERROR_CODES) */
  code: string;
  /** User-friendly error message */
  message: string;
  /** Whether the error is retryable */
  isRetryable: boolean;
  /** Additional details about the error (optional) */
  details?: string;
}

/**
 * Union type for all possible error values that can occur in the application.
 */
export type AppError =
  | ErrorResponse
  | Error
  | string
  | { message?: string; error?: string }
  | unknown;

/**
 * Parsed error with additional metadata.
 */
export interface ParsedError {
  /** The error code (if available) */
  code: string | null;
  /** The user-friendly error message */
  message: string;
  /** Whether the error is retryable */
  isRetryable: boolean;
  /** The original error object */
  original: AppError;
  /** Suggested action for the user (if available) */
  suggestedAction: string | null;
}

/**
 * Options for error display.
 */
export interface ErrorDisplayOptions {
  /** Whether to show technical details */
  showDetails?: boolean;
  /** Whether to show suggested actions */
  showActions?: boolean;
  /** Custom title override */
  title?: string;
  /** Custom message override */
  message?: string;
}

/**
 * Error recovery strategy.
 */
export interface ErrorRecoveryStrategy {
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Recovery action label (e.g., "Retry", "Cancel") */
  actionLabel?: string;
  /** Function to execute for recovery */
  recover?: () => void | Promise<void>;
  /** Alternative recovery actions */
  alternativeActions?: Array<{
    label: string;
    action: () => void | Promise<void>;
  }>;
}

/**
 * Error context for tracking where an error occurred.
 */
export interface ErrorContext {
  /** Component or feature where the error occurred */
  component: string;
  /** Operation being performed */
  operation?: string;
  /** Additional context data */
  data?: Record<string, unknown>;
}
