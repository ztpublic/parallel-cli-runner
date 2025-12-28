import { useMemo, useRef } from "react";
import { MergeView } from "@codemirror/merge";
import { languageExtension, readOnlyExtensions, type HighlightTheme } from "./editorConfig";
import { useMergeView } from "./hooks/useMergeView";
import "./GitDiffView.css";

export type GitDiffTwoWayViewProps = {
  baseText: string;
  compareText: string;
  languageId?: string;
  filePath?: string;
  highlightTheme?: HighlightTheme;
  className?: string;
};

const EMPTY_STATE = "Select revisions to compare.";

export function GitDiffTwoWayView({
  baseText,
  compareText,
  languageId,
  filePath,
  highlightTheme = "vscode-dark",
  className,
}: GitDiffTwoWayViewProps) {
  const twoWayViewRef = useRef<MergeView | null>(null);

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

  const twoWayRef = useMergeView(
    baseText ?? "",
    compareText ?? "",
    true,
    baseExtensions,
    extraExtensions,
    twoWayViewRef
  );

  const hasTwoWay = baseText.trim().length > 0 || compareText.trim().length > 0;
  const containerClassName = className
    ? `git-diff-view ${className}`
    : "git-diff-view";

  if (!hasTwoWay) {
    return (
      <section className={containerClassName}>
        <div className="git-diff-view__empty">{EMPTY_STATE}</div>
      </section>
    );
  }

  return (
    <section className={containerClassName}>
      <div ref={twoWayRef} className="git-diff-view__merge" />
    </section>
  );
}
