import { type MutableRefObject, useEffect, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView } from "@codemirror/view";

function updateEditorDoc(view: EditorView, nextDoc: string) {
  const currentDoc = view.state.doc.toString();
  if (currentDoc === nextDoc) {
    return;
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: nextDoc },
  });
}

export function useMergeView(
  docA: string,
  docB: string,
  active: boolean,
  baseExtensions: readonly unknown[],
  extraExtensions: readonly unknown[],
  viewRef: MutableRefObject<MergeView | null>,
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

    viewRef.current = new MergeView({
      a: { doc: docA, extensions: [...baseExtensions, ...extraExtensions] },
      b: { doc: docB, extensions: [...baseExtensions, ...extraExtensions] },
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
  }, [active, container, baseExtensions, extraExtensions, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    updateEditorDoc(view.a, docA);
    updateEditorDoc(view.b, docB);
  }, [docA, docB]);

  return (node: HTMLDivElement | null) => {
    if (containerRef) {
      containerRef.current = node;
    }
    setContainer(node);
  };
}
