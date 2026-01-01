import { useRef } from "react";
import { MergeView } from "@codemirror/merge";
import { type HighlightTheme } from "./editorConfig";
import { useMergeView } from "./hooks/useMergeView";
import { DiffViewEmptyState, useDiffViewSetup } from "./diffViewUtils";
import "./GitDiffView.css";

export type GitDiffTwoWayViewProps = {
  baseText: string;
  compareText: string;
  languageId?: string;
  filePath?: string;
  highlightTheme?: HighlightTheme;
  className?: string;
};

export function GitDiffTwoWayView({
  baseText,
  compareText,
  languageId,
  filePath,
  highlightTheme = "vscode-dark",
  className,
}: GitDiffTwoWayViewProps) {
  const twoWayViewRef = useRef<MergeView | null>(null);
  const { extraExtensions, baseExtensions, containerClassName } = useDiffViewSetup({
    languageId,
    filePath,
    highlightTheme,
    className,
  });

  const twoWayRef = useMergeView(
    baseText ?? "",
    compareText ?? "",
    true,
    baseExtensions,
    extraExtensions,
    twoWayViewRef
  );

  const hasTwoWay = baseText.trim().length > 0 || compareText.trim().length > 0;

  if (!hasTwoWay) {
    return <DiffViewEmptyState className={containerClassName} />;
  }

  return (
    <section className={containerClassName}>
      <div ref={twoWayRef} className="git-diff-view__merge" />
    </section>
  );
}
