import { useMemo } from "react";
import { languageExtension, readOnlyExtensions, type HighlightTheme } from "./editorConfig";

const EMPTY_STATE = "Select revisions to compare.";

type DiffViewSetupOptions = {
  languageId?: string;
  filePath?: string;
  highlightTheme?: HighlightTheme;
  className?: string;
};

export function useDiffViewSetup({
  languageId,
  filePath,
  highlightTheme = "vscode-dark",
  className,
}: DiffViewSetupOptions) {
  const langExtension = useMemo(
    () => languageExtension(languageId, filePath),
    [languageId, filePath]
  );
  const extraExtensions = useMemo(
    () => (langExtension ? [langExtension] : []),
    [langExtension]
  );
  const baseExtensions = useMemo(
    () => readOnlyExtensions(highlightTheme),
    [highlightTheme]
  );
  const containerClassName = className ? `git-diff-view ${className}` : "git-diff-view";

  return {
    langExtension,
    extraExtensions,
    baseExtensions,
    containerClassName,
  };
}

export function DiffViewEmptyState({
  className,
  message = EMPTY_STATE,
}: {
  className: string;
  message?: string;
}) {
  return (
    <section className={className}>
      <div className="git-diff-view__empty">{message}</div>
    </section>
  );
}
