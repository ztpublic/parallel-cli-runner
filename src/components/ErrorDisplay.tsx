/**
 * ErrorDisplay Component
 *
 * A reusable component for displaying errors with consistent styling,
 * suggested actions, and recovery options.
 */

import { useCallback, useMemo } from "react";
import {
  parseError,
  formatError,
  createRecoveryStrategy,
  type AppError,
  type ParsedError,
  type ErrorDisplayOptions,
} from "../lib/errors";
import { ERROR_CODES } from "../lib/errors/errorCodes";

/**
 * Props for the ErrorDisplay component.
 */
export interface ErrorDisplayProps {
  /** The error to display */
  error: AppError;
  /** Display options */
  options?: ErrorDisplayOptions;
  /** Recovery callback (if the error is retryable) */
  onRecover?: () => void | Promise<void>;
  /** Callback when the error is dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ErrorDisplay component for showing errors with consistent styling and actions.
 */
export function ErrorDisplay({
  error,
  options = {},
  onRecover,
  onDismiss,
  className = "",
}: ErrorDisplayProps) {
  const parsed = useMemo(() => parseError(error), [error]);
  const formatted = useMemo(() => formatError(parsed), [parsed]);
  const strategy = useMemo(
    () => createRecoveryStrategy(parsed, onRecover),
    [parsed, onRecover],
  );

  const handleRecover = useCallback(async () => {
    if (strategy.recoverable && strategy.recover) {
      await strategy.recover();
    }
  }, [strategy]);

  const showDetails = options.showDetails ?? true;
  const showActions = options.showActions ?? true;
  const title = options.title ?? formatted.title;
  const message = options.message ?? formatted.message;

  // Determine error severity for styling
  const severity = getErrorSeverity(parsed);

  return (
    <div
      className={`error-display error-display--${severity} ${className}`.trim()}
      role="alert"
      aria-live="assertive"
    >
      {/* Error Header */}
      <div className="error-display__header">
        <div className="error-display__icon">{getErrorIcon(severity)}</div>
        <h3 className="error-display__title">{title}</h3>
        {onDismiss && (
          <button
            type="button"
            className="error-display__close"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>

      {/* Error Message */}
      <div className="error-display__message">{message}</div>

      {/* Error Code (if available) */}
      {parsed.code && showDetails && (
        <div className="error-display__code">
          <span className="error-display__code-label">Error Code:</span>
          <code className="error-display__code-value">{parsed.code}</code>
        </div>
      )}

      {/* Suggested Action */}
      {formatted.suggestedAction && showActions && (
        <div className="error-display__suggestion">
          <span className="error-display__suggestion-icon">💡</span>
          <span className="error-display__suggestion-text">
            {formatted.suggestedAction}
          </span>
        </div>
      )}

      {/* Recovery Actions */}
      {strategy.recoverable && showActions && (
        <div className="error-display__actions">
          <button
            type="button"
            className="error-display__retry-button"
            onClick={handleRecover}
          >
            {strategy.actionLabel || "Retry"}
          </button>
          {strategy.alternativeActions?.map((action) => (
            <button
              key={action.label}
              type="button"
              className="error-display__action-button"
              onClick={action.action}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Technical Details (dev only) */}
      {import.meta.env.DEV && showDetails && parsed.original instanceof Error && (
        <details className="error-display__details">
          <summary>Technical Details</summary>
          <pre className="error-display__stack">
            {parsed.original.stack || parsed.original.toString()}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Get error severity based on error code.
 */
function getErrorSeverity(parsed: ParsedError): "error" | "warning" | "info" {
  if (!parsed.code) return "error";

  switch (parsed.code) {
    case ERROR_CODES.VALIDATION_ERROR:
      return "warning";
    case ERROR_CODES.NOT_FOUND:
      return "info";
    default:
      return "error";
  }
}

/**
 * Get error icon based on severity.
 */
function getErrorIcon(severity: string): string {
  switch (severity) {
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "❌";
  }
}

/**
 * Props for a compact error banner component.
 */
export interface ErrorBannerProps {
  /** The error to display */
  error: AppError;
  /** Callback when the error is dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact error banner for inline error display.
 */
export function ErrorBanner({ error, onDismiss, className = "" }: ErrorBannerProps) {
  const parsed = useMemo(() => parseError(error), [error]);
  const formatted = useMemo(() => formatError(parsed), [parsed]);

  return (
    <div
      className={`error-banner ${className}`.trim()}
      role="alert"
      aria-live="polite"
    >
      <span className="error-banner__icon">⚠️</span>
      <span className="error-banner__message">{formatted.message}</span>
      {onDismiss && (
        <button
          type="button"
          className="error-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default ErrorDisplay;
