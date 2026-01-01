import { type MutableRefObject, useEffect, useState } from "react";
import { getOriginalDoc, unifiedMergeView, updateOriginalDoc } from "@codemirror/merge";
import { ChangeSet, EditorState, Text, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

function toText(value: string) {
  return Text.of(value.split(/\r\n|\r|\n/));
}

function updateEditorDoc(view: EditorView, nextDoc: string) {
  const currentDoc = view.state.doc.toString();
  if (currentDoc === nextDoc) {
    return;
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: nextDoc },
  });
}

function updateOriginalDocIfNeeded(view: EditorView, nextOriginal: string) {
  const currentOriginal = getOriginalDoc(view.state);
  const currentText = currentOriginal.toString();
  if (currentText === nextOriginal) {
    return;
  }
  const changes = ChangeSet.of(
    [{ from: 0, to: currentOriginal.length, insert: nextOriginal }],
    currentOriginal.length
  );
  view.dispatch({
    effects: updateOriginalDoc.of({
      doc: toText(nextOriginal),
      changes,
    }),
  });
}

export function useUnifiedView(
  doc: string,
  original: string,
  active: boolean,
  showChanges: boolean,
  baseExtensions: readonly Extension[],
  extraExtensions: readonly Extension[],
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
    showChanges,
    baseExtensions,
    extraExtensions,
    viewRef,
    onReady,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    updateEditorDoc(view, doc);
    updateOriginalDocIfNeeded(view, original);
  }, [doc, original]);

  return (node: HTMLDivElement | null) => {
    if (containerRef) {
      containerRef.current = node;
    }
    setContainer(node);
  };
}
