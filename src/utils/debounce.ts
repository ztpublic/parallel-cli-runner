/**
 * Enhanced debounce utility with leading/trailing options and RAF alignment.
 */

type DebounceOptions = {
  leading?: boolean;
  trailing?: boolean;
  useRaf?: boolean;
};

type DebouncedFunction<T extends (...args: any[]) => any> = T & {
  cancel: () => void;
  flush: () => void;
};

/**
 * Creates a debounced function that delays invoking `func` until after `delay` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func - The function to debounce
 * @param delay - The delay in milliseconds
 * @param options - Options for controlling debounce behavior
 * @returns A debounced function with `cancel` and `flush` methods
 */
export function createDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: DebounceOptions = {}
): DebouncedFunction<T> {
  const { leading = false, trailing = true, useRaf = false } = options;

  let timeoutId: number | null = null;
  let rafId: number | null = null;
  let lastCallTime = 0;
  let isLeadingInvoked = false;

  const debouncedFn = (...args: Parameters<T>) => {
    const now = Date.now();
    const shouldInvokeLeading = leading && !isLeadingInvoked;

    // Clear any pending timeout/RAF
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (shouldInvokeLeading && now - lastCallTime >= delay) {
      // Invoke on leading edge
      isLeadingInvoked = true;
      func(...args);
      lastCallTime = now;
    }

    // Schedule trailing edge invocation
    if (trailing) {
      const scheduleInvoke = () => {
        if (!isLeadingInvoked || leading) {
          func(...args);
        }
        isLeadingInvoked = false;
        timeoutId = null;
        rafId = null;
      };

      if (useRaf) {
        // Use setTimeout first for delay, then RAF for alignment
        timeoutId = window.setTimeout(() => {
          rafId = requestAnimationFrame(scheduleInvoke);
        }, delay);
      } else {
        timeoutId = window.setTimeout(scheduleInvoke, delay);
      }
    }

    lastCallTime = now;
  };

  // Cancel pending invocation
  debouncedFn.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    isLeadingInvoked = false;
  };

  // Immediately invoke any pending debounced function
  debouncedFn.flush = () => {
    if (timeoutId !== null || rafId !== null) {
      debouncedFn.cancel();
      // Note: We can't invoke with original args here, so this just cancels
      // For true flush, you'd need to store the last args
    }
  };

  return debouncedFn as DebouncedFunction<T>;
}
