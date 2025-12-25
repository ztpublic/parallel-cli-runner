import { useCallback, useState } from "react";
import { formatInvokeError } from "../../services/errors";

type GitCommandError = {
  title: string;
  message: string;
};

export function useGitCommandErrorDialog() {
  const [gitCommandError, setGitCommandError] = useState<GitCommandError | null>(null);

  const clearGitCommandError = useCallback(() => {
    setGitCommandError(null);
  }, []);

  const showGitCommandError = useCallback(
    (title: string, error: unknown, fallbackMessage: string) => {
      const message = formatInvokeError(error);
      setGitCommandError({
        title,
        message: message === "Unexpected error." ? fallbackMessage : message,
      });
    },
    []
  );

  const runGitCommand = useCallback(
    async <T,>(title: string, fallbackMessage: string, action: () => Promise<T>) => {
      try {
        return await action();
      } catch (error) {
        showGitCommandError(title, error, fallbackMessage);
        return undefined;
      }
    },
    [showGitCommandError]
  );

  return {
    gitCommandError,
    clearGitCommandError,
    showGitCommandError,
    runGitCommand,
  };
}
