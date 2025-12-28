import { type MutableRefObject, useEffect, useState } from "react";
import { MergeView } from "@codemirror/merge";

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
  }, [active, container, docA, docB, baseExtensions, extraExtensions, viewRef]);

  return (node: HTMLDivElement | null) => {
    if (containerRef) {
      containerRef.current = node;
    }
    setContainer(node);
  };
}
