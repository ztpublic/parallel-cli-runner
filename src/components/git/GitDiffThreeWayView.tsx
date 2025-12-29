import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { languageExtension, readOnlyExtensions, type HighlightTheme } from "./editorConfig";
import {
  baseTargetEffect,
  baseTargetField,
  buildBaseTargetDecorations,
} from "./merge/baseTargetDecorations";
import { useThreeWayMergeState } from "./hooks/useThreeWayMergeState";
import { useThreeWayScrollSync } from "./hooks/useThreeWayScrollSync";
import { useUnifiedView } from "./hooks/useUnifiedView";
import { ThreeWayOverlay } from "./ThreeWayOverlay";
import "./GitDiffView.css";

export type GitDiffThreeWayViewProps = {
  baseText: string;
  leftText: string;
  rightText: string;
  languageId?: string;
  filePath?: string;
  highlightTheme?: HighlightTheme;
  syncScroll?: boolean;
  className?: string;
};

const EMPTY_STATE = "Select revisions to compare.";

export function GitDiffThreeWayView({
  baseText,
  leftText,
  rightText,
  languageId,
  filePath,
  highlightTheme = "vscode-dark",
  syncScroll = true,
  className,
}: GitDiffThreeWayViewProps) {
  const leftViewRef = useRef<EditorView | null>(null);
  const baseViewRef = useRef<EditorView | null>(null);
  const rightViewRef = useRef<EditorView | null>(null);
  const leftContainerRef = useRef<HTMLDivElement | null>(null);
  const baseContainerRef = useRef<HTMLDivElement | null>(null);
  const rightContainerRef = useRef<HTMLDivElement | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const bumpLayout = useCallback(() => {
    setLayoutTick((tick) => tick + 1);
  }, []);

  const {
    baseDocState,
    threeWayChunks,
    chunkActions,
    selectedChunkId,
    setSelectedChunkId,
    handleChunkAction,
  } = useThreeWayMergeState({
    enabled: true,
    baseText: baseText ?? "",
    leftText: leftText ?? "",
    rightText: rightText ?? "",
    baseViewRef,
  });

  const baseDoc = baseDocState ?? "";
  const leftDoc = leftText ?? "";
  const rightDoc = rightText ?? "";

  const hasThreeWay =
    baseDoc.trim().length > 0 || leftDoc.trim().length > 0 || rightDoc.trim().length > 0;

  const langExtension = useMemo(
    () => languageExtension(languageId, filePath),
    [languageId, filePath]
  );
  const extraExtensions = useMemo(
    () => (langExtension ? [langExtension] : []),
    [langExtension]
  );
  const baseTargetExtensions = useMemo(
    () => [...extraExtensions, baseTargetField],
    [extraExtensions]
  );
  const baseExtensions = useMemo(
    () => readOnlyExtensions(highlightTheme),
    [highlightTheme]
  );

  const leftRef = useUnifiedView(
    leftDoc,
    baseDoc,
    true,
    true,
    baseExtensions,
    extraExtensions,
    leftViewRef,
    bumpLayout,
    leftContainerRef
  );
  const baseRef = useUnifiedView(
    baseDoc,
    baseDoc,
    true,
    false,
    baseExtensions,
    baseTargetExtensions,
    baseViewRef,
    bumpLayout,
    baseContainerRef
  );
  const rightRef = useUnifiedView(
    rightDoc,
    baseDoc,
    true,
    true,
    baseExtensions,
    extraExtensions,
    rightViewRef,
    bumpLayout,
    rightContainerRef
  );

  useThreeWayScrollSync({
    enabled: syncScroll,
    chunks: threeWayChunks,
    leftViewRef,
    baseViewRef,
    rightViewRef,
    layoutTick,
  });

  useEffect(() => {
    const baseView = baseViewRef.current;
    if (!baseView) {
      return;
    }
    const decorations = buildBaseTargetDecorations(baseView, threeWayChunks);
    baseView.dispatch({ effects: baseTargetEffect.of(decorations) });
  }, [threeWayChunks, layoutTick]);

  const containerClassName = className
    ? `git-diff-view ${className}`
    : "git-diff-view";

  if (!hasThreeWay) {
    return (
      <section className={containerClassName}>
        <div className="git-diff-view__empty">{EMPTY_STATE}</div>
      </section>
    );
  }

  return (
    <section className={containerClassName}>
      <div className="git-diff-view__three-way">
        <div className="git-diff-view__grid git-diff-view__grid--three">
          <div ref={leftRef} className="git-diff-view__merge" />
          <div ref={baseRef} className="git-diff-view__merge" />
          <div ref={rightRef} className="git-diff-view__merge" />
        </div>
        <ThreeWayOverlay
          enabled
          chunks={threeWayChunks}
          chunkActions={chunkActions}
          selectedChunkId={selectedChunkId}
          layoutTick={layoutTick}
          leftViewRef={leftViewRef}
          baseViewRef={baseViewRef}
          rightViewRef={rightViewRef}
          leftContainerRef={leftContainerRef}
          baseContainerRef={baseContainerRef}
          rightContainerRef={rightContainerRef}
          onSelectChunk={setSelectedChunkId}
          onChunkAction={handleChunkAction}
        />
      </div>
    </section>
  );
}
