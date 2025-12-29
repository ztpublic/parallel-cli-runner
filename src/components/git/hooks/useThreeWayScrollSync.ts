import { type MutableRefObject, useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { lineRangeMetrics } from "../merge/geometry";
import { type LineRange, type MergeChunk } from "../merge/threeWay";

type Side = "left" | "base" | "right";

type RangePair = {
  anchor: LineRange;
  target: LineRange;
};

type ScrollState = Record<Side, number>;

type UseThreeWayScrollSyncProps = {
  enabled: boolean;
  chunks: MergeChunk[];
  leftViewRef: MutableRefObject<EditorView | null>;
  baseViewRef: MutableRefObject<EditorView | null>;
  rightViewRef: MutableRefObject<EditorView | null>;
  layoutTick: number;
};

const SIDES: Side[] = ["left", "base", "right"];
const MAX_ALIGN_CHUNKS = 12;

function getRange(chunk: MergeChunk, side: Side): LineRange | undefined {
  switch (side) {
    case "left":
      return chunk.leftRange;
    case "base":
      return chunk.baseRange;
    case "right":
      return chunk.rightRange;
    default:
      return undefined;
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function clampScrollTop(scrollDOM: HTMLElement, nextTop: number) {
  const max = Math.max(0, scrollDOM.scrollHeight - scrollDOM.clientHeight);
  return Math.min(Math.max(nextTop, 0), max);
}

function rangesOverlap(a: LineRange, b: LineRange): boolean {
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function rangeCenterLine(range: LineRange): number {
  return (range.startLine + range.endLine) / 2;
}

function getViewportLineRange(view: EditorView): LineRange {
  const startLine = view.state.doc.lineAt(view.viewport.from).number - 1;
  const endLine = view.state.doc.lineAt(view.viewport.to).number - 1;
  return { startLine, endLine };
}

function buildRangePairs(
  chunks: MergeChunk[],
  anchorSide: Side,
  targetSide: Side
): RangePair[] {
  const pairs: RangePair[] = [];
  for (const chunk of chunks) {
    const anchor = getRange(chunk, anchorSide);
    const target = getRange(chunk, targetSide);
    if (!anchor || !target) {
      continue;
    }
    pairs.push({ anchor, target });
  }
  return pairs;
}

function computeAlignmentDelta(
  anchorView: EditorView,
  targetView: EditorView,
  pairs: RangePair[]
) {
  if (pairs.length === 0) {
    return 0;
  }
  const anchorDocTop = anchorView.documentTop;
  const targetDocTop = targetView.documentTop;
  const deltas = pairs.map((pair) => {
    const anchorMetrics = lineRangeMetrics(anchorView, pair.anchor);
    const targetMetrics = lineRangeMetrics(targetView, pair.target);
    const anchorCenter = anchorDocTop + anchorMetrics.center;
    const targetCenter = targetDocTop + targetMetrics.center;
    return targetCenter - anchorCenter;
  });
  return median(deltas);
}

function getVisibleChunks(chunks: MergeChunk[], side: Side, view: EditorView) {
  const viewportRange = getViewportLineRange(view);
  const visible = chunks.filter((chunk) => {
    const range = getRange(chunk, side);
    if (!range) {
      return false;
    }
    return rangesOverlap(range, viewportRange);
  });

  if (visible.length <= MAX_ALIGN_CHUNKS) {
    return visible;
  }

  const viewportCenter = rangeCenterLine(viewportRange);
  return visible
    .map((chunk) => {
      const range = getRange(chunk, side);
      return {
        chunk,
        distance: range ? Math.abs(rangeCenterLine(range) - viewportCenter) : Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_ALIGN_CHUNKS)
    .map((entry) => entry.chunk);
}

export function useThreeWayScrollSync({
  enabled,
  chunks,
  leftViewRef,
  baseViewRef,
  rightViewRef,
  layoutTick,
}: UseThreeWayScrollSyncProps) {
  const chunksRef = useRef(chunks);
  const lastScrollRef = useRef<ScrollState>({ left: 0, base: 0, right: 0 });
  const pendingSourceRef = useRef<Side | null>(null);
  const frameRef = useRef<number | null>(null);
  const suppressedRef = useRef<Set<Side>>(new Set());

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const leftView = leftViewRef.current;
    const baseView = baseViewRef.current;
    const rightView = rightViewRef.current;

    if (!leftView || !baseView || !rightView) {
      return;
    }

    const views: Record<Side, EditorView> = {
      left: leftView,
      base: baseView,
      right: rightView,
    };

    suppressedRef.current.clear();

    const syncState = () => {
      lastScrollRef.current = {
        left: views.left.scrollDOM.scrollTop,
        base: views.base.scrollDOM.scrollTop,
        right: views.right.scrollDOM.scrollTop,
      };
    };

    const suppressScroll = (side: Side) => {
      suppressedRef.current.add(side);
    };

    const alignTarget = (anchorSide: Side, targetSide: Side, visibleChunks: MergeChunk[]) => {
      if (visibleChunks.length === 0) {
        return;
      }
      const pairs = buildRangePairs(visibleChunks, anchorSide, targetSide);
      if (pairs.length === 0) {
        return;
      }
      const delta = computeAlignmentDelta(views[anchorSide], views[targetSide], pairs);
      if (Math.abs(delta) < 0.5) {
        return;
      }
      const targetView = views[targetSide];
      const nextTop = clampScrollTop(targetView.scrollDOM, targetView.scrollDOM.scrollTop + delta);
      suppressScroll(targetSide);
      targetView.scrollDOM.scrollTop = nextTop;
    };

    const alignFrom = (source: Side) => {
      const sourceView = views[source];
      const visibleChunks = getVisibleChunks(chunksRef.current, source, sourceView);

      if (source === "base") {
        alignTarget("base", "left", visibleChunks);
        alignTarget("base", "right", visibleChunks);
      } else {
        alignTarget(source, "base", visibleChunks);
        const otherSide: Side = source === "left" ? "right" : "left";
        alignTarget("base", otherSide, visibleChunks);
      }
    };

    const scheduleAlignment = (source: Side) => {
      pendingSourceRef.current = source;
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const pending = pendingSourceRef.current;
        pendingSourceRef.current = null;
        if (!pending) {
          return;
        }
        alignFrom(pending);
        syncState();
      });
    };

    const handleScroll = (side: Side) => {
      if (suppressedRef.current.has(side)) {
        suppressedRef.current.delete(side);
        lastScrollRef.current[side] = views[side].scrollDOM.scrollTop;
        return;
      }
      const sourceView = views[side];
      const sourceScrollTop = sourceView.scrollDOM.scrollTop;
      const delta = sourceScrollTop - lastScrollRef.current[side];
      if (delta === 0) {
        return;
      }

      SIDES.forEach((targetSide) => {
        if (targetSide === side) {
          return;
        }
        const targetView = views[targetSide];
        const nextTop = clampScrollTop(targetView.scrollDOM, targetView.scrollDOM.scrollTop + delta);
        if (nextTop !== targetView.scrollDOM.scrollTop) {
          suppressScroll(targetSide);
          targetView.scrollDOM.scrollTop = nextTop;
        }
        lastScrollRef.current[targetSide] = targetView.scrollDOM.scrollTop;
      });

      lastScrollRef.current[side] = sourceScrollTop;
      scheduleAlignment(side);
    };

    const handlers: Record<Side, () => void> = {
      left: () => handleScroll("left"),
      base: () => handleScroll("base"),
      right: () => handleScroll("right"),
    };

    syncState();

    SIDES.forEach((side) => {
      views[side].scrollDOM.addEventListener("scroll", handlers[side], { passive: true });
    });

    return () => {
      SIDES.forEach((side) => {
        views[side].scrollDOM.removeEventListener("scroll", handlers[side]);
      });
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingSourceRef.current = null;
    };
  }, [enabled, layoutTick, leftViewRef, baseViewRef, rightViewRef]);
}
