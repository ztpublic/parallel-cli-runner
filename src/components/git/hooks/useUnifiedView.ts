import { type MutableRefObject, useEffect, useState } from "react";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function useUnifiedView(
  doc: string,
  original: string,
  active: boolean,
  showChanges: boolean,
  baseExtensions: readonly unknown[],
  extraExtensions: readonly unknown[],
  viewRef: MutableRefObject<EditorView | null>,
  onReady?: () => void,
  containerRef?: MutableRefObject<HTMLDivElement | null>
) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

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

    const extensions = [
      ...extraExtensions,
      ...(showChanges
        ? [
            unifiedMergeView({
              original,
              gutter: true,
              highlightChanges: true,
              mergeControls: false,
            }),
          ]
        : []),
    ];

    const state = EditorState.create({
      doc,
      extensions: [...baseExtensions, ...extensions],
    });

    viewRef.current = new EditorView({
      state,
      parent: container,
    });
    onReady?.();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [
    active,
    container,
    doc,
    original,
    showChanges,
    baseExtensions,
    extraExtensions,
    viewRef,
    onReady,
  ]);

  return (node: HTMLDivElement | null) => {
    if (containerRef) {
      containerRef.current = node;
    }
    setContainer(node);
  };
}
