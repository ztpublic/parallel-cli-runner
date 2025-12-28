import { useEffect, useRef, useState } from "react";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import "./GitDiffView.css";

export type GitDiffViewProps = {
  mode?: "two-way" | "three-way";
  baseText: string;
  compareText?: string;
  leftText?: string;
  rightText?: string;
  className?: string;
};

const EMPTY_STATE = "Select revisions to compare.";

const READONLY_EXTENSIONS = [EditorView.editable.of(false), EditorState.readOnly.of(true)];

function useMergeView(docA: string, docB: string, active: boolean) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const viewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!active || !container) {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      return;
    }

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    viewRef.current = new MergeView({
      a: { doc: docA, extensions: READONLY_EXTENSIONS },
      b: { doc: docB, extensions: READONLY_EXTENSIONS },
      parent: container,
      highlightChanges: true,
      gutter: true,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [active, container, docA, docB]);

  return setContainer;
}

function useUnifiedView(doc: string, original: string, active: boolean, showChanges: boolean) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!active || !container) {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      return;
    }

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const extensions = showChanges
      ? [
          unifiedMergeView({
            original,
            gutter: true,
            highlightChanges: true,
            mergeControls: false,
          }),
        ]
      : [];

    const state = EditorState.create({
      doc,
      extensions: [...READONLY_EXTENSIONS, ...extensions],
    });

    viewRef.current = new EditorView({
      state,
      parent: container,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [active, container, doc, original, showChanges]);

  return setContainer;
}

export function GitDiffView({
  mode = "two-way",
  baseText,
  compareText,
  leftText,
  rightText,
  className,
}: GitDiffViewProps) {
  const showTwoWay = mode === "two-way";
  const showThreeWay = mode === "three-way";

  const baseDoc = baseText ?? "";
  const compareDoc = compareText ?? "";
  const leftDoc = leftText ?? "";
  const rightDoc = rightText ?? "";

  const hasTwoWay = baseDoc.trim().length > 0 || compareDoc.trim().length > 0;
  const hasThreeWay =
    baseDoc.trim().length > 0 || leftDoc.trim().length > 0 || rightDoc.trim().length > 0;

  const twoWayRef = useMergeView(baseDoc, compareDoc, showTwoWay);
  const leftRef = useUnifiedView(leftDoc, baseDoc, showThreeWay, true);
  const baseRef = useUnifiedView(baseDoc, baseDoc, showThreeWay, false);
  const rightRef = useUnifiedView(rightDoc, baseDoc, showThreeWay, true);

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
        <div className="git-diff-view__grid git-diff-view__grid--three">
          <div ref={leftRef} className="git-diff-view__merge" />
          <div ref={baseRef} className="git-diff-view__merge" />
          <div ref={rightRef} className="git-diff-view__merge" />
        </div>
      ) : null}
    </section>
  );
}
