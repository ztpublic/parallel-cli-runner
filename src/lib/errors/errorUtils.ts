/**
 * Error utility functions for parsing and handling errors.
 *
 * @module
 */

import type {
  AppError,
  ErrorResponse,
  ParsedError,
  ErrorRecoveryStrategy,
} from "./types";
import {
  ERROR_CODES,
  isRetryableError,
  getSuggestedAction,
  getErrorTitle,
  type ErrorCode,
} from "./errorCodes";

/**
 * Parse an error into a standardized ParsedError structure.
 */
export function parseError(error: AppError): ParsedError {
  let code: string | null = null;
  let message = "An unexpected error occurred";
  let isRetryable = false;

  if (isErrorResponse(error)) {
    code = error.code;
    message = error.message;
    isRetryable = error.isRetryable;
  } else if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
    // Try to extract error code from error name
    const maybeCode = error.name as ErrorCode;
    if (Object.values(ERROR_CODES).includes(maybeCode)) {
      code = maybeCode;
    }
  } else if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      message = maybeMessage;
      // Check if message is actually an error code
      const maybeCode = maybeMessage as ErrorCode;
      if (Object.values(ERROR_CODES).includes(maybeCode)) {
        code = maybeCode;
      }
    }
    const maybeError = (error as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim()) {
      message = maybeError;
    }
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === "string" && Object.values(ERROR_CODES).includes(maybeCode as ErrorCode)) {
      code = maybeCode;
    }
  }

  // If we don't have a code yet, try to infer it from the message
  if (!code) {
    code = inferErrorCode(message);
  }

  // Determine if retryable based on code
  if (code && isRetryableError(code as ErrorCode)) {
    isRetryable = true;
  }

  return {
    code,
    message,
    isRetryable,
    original: error,
    suggestedAction: code ? getSuggestedAction(code as ErrorCode) : null,
  };
}

/**
 * Check if an error is an ErrorResponse.
 */
function isErrorResponse(error: unknown): error is ErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as ErrorResponse).code === "string" &&
    typeof (error as ErrorResponse).message === "string"
  );
}

/**
 * Infer error code from error message.
 */
function inferErrorCode(message: string): ErrorCode | null {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("git not found") || lowerMessage.includes("git: command not found")) {
    return ERROR_CODES.GIT_NOT_FOUND;
  }
  if (lowerMessage.includes("permission denied")) {
    return ERROR_CODES.PERMISSION_DENIED;
  }
  if (lowerMessage.includes("not a repository") || lowerMessage.includes("not a git repository")) {
    return ERROR_CODES.NOT_A_REPOSITORY;
  }
  if (lowerMessage.includes("network") || lowerMessage.includes("connection")) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  if (lowerMessage.includes("timeout")) {
    return ERROR_CODES.TIMEOUT_ERROR;
  }
  if (lowerMessage.includes("conflict")) {
    return ERROR_CODES.CONFLICT_ERROR;
  }
  if (lowerMessage.includes("invalid") && lowerMessage.includes("path")) {
    return ERROR_CODES.INVALID_PATH;
  }
  if (lowerMessage.includes("not found")) {
    return ERROR_CODES.NOT_FOUND;
  }

  return null;
}

/**
 * Format an error for display.
 */
export function formatError(error: ParsedError): {
  title: string;
  message: string;
  suggestedAction: string | null;
  isRetryable: boolean;
} {
  const code = error.code as ErrorCode | null;

  return {
    title: code ? getErrorTitle(code) : "Error",
    message: error.message,
    suggestedAction: error.suggestedAction,
    isRetryable: error.isRetryable,
  };
}

/**
 * Create a recovery strategy for an error.
 */
export function createRecoveryStrategy(
  error: ParsedError,
  retryFn?: () => void | Promise<void>,
): ErrorRecoveryStrategy {
  if (!error.isRetryable || !retryFn) {
    return { recoverable: false };
  }

  return {
    recoverable: true,
    actionLabel: "Retry",
    recover: retryFn,
    alternativeActions: [
      {
        label: "Cancel",
        action: () => {
          // Default cancel action (no-op)
        },
      },
    ],
  };
}

/**
 * Log an error with context.
 */
export function logError(error: AppError, context?: string): void {
  const parsed = parseError(error);
  const contextPrefix = context ? `[${context}] ` : "";

  if (parsed.code) {
    console.error(`${contextPrefix}Error (${parsed.code}): ${parsed.message}`);
  } else {
    console.error(`${contextPrefix}Error: ${parsed.message}`);
  }

  // Log original error in development for debugging
  if (import.meta.env.DEV) {
    console.error(`${contextPrefix}Original error:`, error);
  }

  if (parsed.suggestedAction) {
    console.info(`${contextPrefix}Suggested action: ${parsed.suggestedAction}`);
  }
}

/**
 * Wraps an async function with error handling.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    return null;
  }
}

/**
 * Wraps an async function with error handling and recovery.
 */
export async function withRecovery<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    context?: string;
    onRetry?: (attempt: number, error: ParsedError) => void;
  } = {},
): Promise<T | null> {
  const { maxRetries = 3, retryDelay = 1000, context, onRetry } = options;

  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const parsed = parseError(error);

      // Don't retry if the error is not retryable or we've exhausted retries
      if (!parsed.isRetryable || attempt >= maxRetries) {
        logError(error, context);
        return null;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, parsed);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  // Log the last error if we exhausted all retries
  if (lastError) {
    logError(lastError, context);
  }

  return null;
}

/**
 * Create an error response object.
 */
export function createErrorResponse(
  code: string,
  message: string,
  isRetryable = false,
  details?: string,
): ErrorResponse {
  return { code, message, isRetryable, details };
}

/**
 * Check if an error is a specific error code.
 */
export function isErrorCode(error: AppError, code: ErrorCode): boolean {
  const parsed = parseError(error);
  return parsed.code === code;
}
