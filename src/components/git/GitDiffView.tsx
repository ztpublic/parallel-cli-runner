import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { Decoration, EditorView } from "@codemirror/view";
import {
  baseTargetEffect,
  baseTargetField,
  buildBaseTargetDecorations,
} from "./merge/baseTargetDecorations";
import { languageExtension, readOnlyExtensions, type HighlightTheme } from "./editorConfig";
import { useMergeView } from "./hooks/useMergeView";
import { useThreeWayMergeState } from "./hooks/useThreeWayMergeState";
import { useUnifiedView } from "./hooks/useUnifiedView";
import { ThreeWayOverlay } from "./ThreeWayOverlay";
import "./GitDiffView.css";

export type GitDiffViewProps = {
  mode?: "two-way" | "three-way";
  baseText: string;
  compareText?: string;
  leftText?: string;
  rightText?: string;
  languageId?: string;
  filePath?: string;
  highlightTheme?: HighlightTheme;
  className?: string;
};

const EMPTY_STATE = "Select revisions to compare.";

export function GitDiffView({
  mode = "two-way",
  baseText,
  compareText,
  leftText,
  rightText,
  languageId,
  filePath,
  highlightTheme = "vscode-dark",
  className,
}: GitDiffViewProps) {
  const showTwoWay = mode === "two-way";
  const showThreeWay = mode === "three-way";

  const compareDoc = compareText ?? "";
  const leftDoc = leftText ?? "";
  const rightDoc = rightText ?? "";
  const twoWayViewRef = useRef<MergeView | null>(null);
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
    enabled: showThreeWay,
    baseText: baseText ?? "",
    leftText: leftDoc,
    rightText: rightDoc,
    baseViewRef,
  });

  const baseDoc = showThreeWay ? baseDocState : baseText ?? "";

  const hasTwoWay = baseDoc.trim().length > 0 || compareDoc.trim().length > 0;
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

  const twoWayRef = useMergeView(
    baseDoc,
    compareDoc,
    showTwoWay,
    baseExtensions,
    extraExtensions,
    twoWayViewRef
  );
  const leftRef = useUnifiedView(
    leftDoc,
    baseDoc,
    showThreeWay,
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
    showThreeWay,
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
    showThreeWay,
    true,
    baseExtensions,
    extraExtensions,
    rightViewRef,
    bumpLayout,
    rightContainerRef
  );

  useEffect(() => {
    const baseView = baseViewRef.current;
    if (!baseView) {
      return;
    }
    const decorations = showThreeWay
      ? buildBaseTargetDecorations(baseView, threeWayChunks)
      : Decoration.none;
    baseView.dispatch({ effects: baseTargetEffect.of(decorations) });
  }, [showThreeWay, threeWayChunks, layoutTick]);

  const containerClassName = className
    ? `git-diff-view ${className}`
    : "git-diff-view";

  if (showTwoWay && !hasTwoWay) {
    return (
      <section className={containerClassName}>
        <div className="git-diff-view__empty">{EMPTY_STATE}</div>
      </section>
    );
  }

  if (showThreeWay && !hasThreeWay) {
    return (
      <section className={containerClassName}>
        <div className="git-diff-view__empty">{EMPTY_STATE}</div>
      </section>
    );
  }

  return (
    <section className={containerClassName}>
      {showTwoWay ? <div ref={twoWayRef} className="git-diff-view__merge" /> : null}
      {showThreeWay ? (
        <div className="git-diff-view__three-way">
          <div className="git-diff-view__grid git-diff-view__grid--three">
            <div ref={leftRef} className="git-diff-view__merge" />
            <div ref={baseRef} className="git-diff-view__merge" />
            <div ref={rightRef} className="git-diff-view__merge" />
          </div>
          <ThreeWayOverlay
            enabled={showThreeWay}
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
      ) : null}
    </section>
  );
}
