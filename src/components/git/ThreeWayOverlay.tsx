import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { MergeChunk, MergeChunkAction } from "./merge/threeWay";
import { buildConnectorPaths, lineRangeMetrics } from "./merge/geometry";
import { ChunkControls, type ControlItem } from "./ChunkControls";

type ArrowSegment = {
  id: string;
  side: "left" | "right";
  paths: string[];
  conflict: boolean;
};

type HoverSide = "left" | "right";

function getSideRange(chunk: MergeChunk, side: HoverSide) {
  return side === "left" ? chunk.leftRange : chunk.rightRange;
}

function clampHeight(view: EditorView, height: number) {
  return Math.min(Math.max(height, 0), view.contentHeight);
}

function findChunkForLine(chunks: MergeChunk[], side: HoverSide, lineIndex: number) {
  for (const chunk of chunks) {
    const range = getSideRange(chunk, side);
    if (!range) {
      continue;
    }
    if (lineIndex >= range.startLine && lineIndex <= range.endLine) {
      return chunk;
    }
  }
  return null;
}

type ThreeWayOverlayProps = {
  enabled: boolean;
  chunks: MergeChunk[];
  chunkActions: Record<string, MergeChunkAction>;
  selectedChunkId: string | null;
  layoutTick: number;
  leftViewRef: MutableRefObject<EditorView | null>;
  baseViewRef: MutableRefObject<EditorView | null>;
  rightViewRef: MutableRefObject<EditorView | null>;
  leftContainerRef: MutableRefObject<HTMLDivElement | null>;
  baseContainerRef: MutableRefObject<HTMLDivElement | null>;
  rightContainerRef: MutableRefObject<HTMLDivElement | null>;
  onSelectChunk: (id: string) => void;
  onChunkAction: (chunk: MergeChunk, action: MergeChunkAction) => void;
};

export function ThreeWayOverlay({
  enabled,
  chunks,
  chunkActions,
  selectedChunkId,
  layoutTick,
  leftViewRef,
  baseViewRef,
  rightViewRef,
  leftContainerRef,
  baseContainerRef,
  rightContainerRef,
  onSelectChunk,
  onChunkAction,
}: ThreeWayOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [arrowSegments, setArrowSegments] = useState<ArrowSegment[]>([]);
  const [controlItems, setControlItems] = useState<ControlItem[]>([]);
  const [hoveredControlId, setHoveredControlId] = useState<string | null>(null);
  const arrowKeyRef = useRef<string>("");
  const controlKeyRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) {
      setArrowSegments([]);
      setControlItems([]);
      setHoveredControlId(null);
      return;
    }

    const leftView = leftViewRef.current;
    const baseView = baseViewRef.current;
    const rightView = rightViewRef.current;
    const overlay = overlayRef.current;

    if (!leftView || !baseView || !rightView || !overlay) {
      return;
    }

    let frame = 0;
    let scheduled = false;

    const measure = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      frame = requestAnimationFrame(() => {
        scheduled = false;
        const overlayRect = overlay.getBoundingClientRect();
        const leftRect =
          leftContainerRef.current?.getBoundingClientRect() ?? leftView.dom.getBoundingClientRect();
        const baseRect =
          baseContainerRef.current?.getBoundingClientRect() ?? baseView.dom.getBoundingClientRect();
        const rightRect =
          rightContainerRef.current?.getBoundingClientRect() ?? rightView.dom.getBoundingClientRect();

        const leftStartX = leftRect.right - overlayRect.left;
        const rightStartX = rightRect.left - overlayRect.left;
        const baseLeftX = baseRect.left - overlayRect.left;
        const baseRightX = baseRect.right - overlayRect.left;
        const controlInset = 8;
        const leftControlX = leftRect.right - overlayRect.left - controlInset;
        const rightControlX = rightRect.left - overlayRect.left + controlInset;
        const leftDocTop = leftView.documentTop - overlayRect.top;
        const baseDocTop = baseView.documentTop - overlayRect.top;
        const rightDocTop = rightView.documentTop - overlayRect.top;

        const segments: ArrowSegment[] = [];
        const controls: ControlItem[] = [];
        for (const chunk of chunks) {
          const baseMetrics = lineRangeMetrics(baseView, chunk.baseRange);
          if (chunk.leftRange) {
            const leftMetrics = lineRangeMetrics(leftView, chunk.leftRange);
            segments.push({
              id: `${chunk.id}-left`,
              side: "left",
              conflict: chunk.kind === "conflict",
              paths: buildConnectorPaths(
                leftStartX,
                baseLeftX,
                leftMetrics.top + leftDocTop,
                leftMetrics.bottom + leftDocTop,
                baseMetrics.top + baseDocTop,
                baseMetrics.bottom + baseDocTop
              ),
            });
            const leftCenter = leftMetrics.center + leftDocTop;
            controls.push({
              id: `${chunk.id}-left`,
              top: leftCenter,
              left: leftControlX,
              side: "left",
              conflict: chunk.kind === "conflict",
              hasLeft: !!chunk.leftRange,
              hasRight: !!chunk.rightRange,
              chunk,
            });
          }
          if (chunk.rightRange) {
            const rightMetrics = lineRangeMetrics(rightView, chunk.rightRange);
            segments.push({
              id: `${chunk.id}-right`,
              side: "right",
              conflict: chunk.kind === "conflict",
              paths: buildConnectorPaths(
                rightStartX,
                baseRightX,
                rightMetrics.top + rightDocTop,
                rightMetrics.bottom + rightDocTop,
                baseMetrics.top + baseDocTop,
                baseMetrics.bottom + baseDocTop
              ),
            });
            const rightCenter = rightMetrics.center + rightDocTop;
            controls.push({
              id: `${chunk.id}-right`,
              top: rightCenter,
              left: rightControlX,
              side: "right",
              conflict: chunk.kind === "conflict",
              hasLeft: !!chunk.leftRange,
              hasRight: !!chunk.rightRange,
              chunk,
            });
          }
        }

        const nextArrowKey = segments
          .map((segment) => `${segment.id}:${segment.paths.join(";")}`)
          .join("|");
        if (nextArrowKey !== arrowKeyRef.current) {
          arrowKeyRef.current = nextArrowKey;
          setArrowSegments(segments);
        }

        const nextControlKey = controls
          .map(
            (control) =>
              `${control.id}:${control.side}:${Math.round(control.left)}:${Math.round(
                control.top
              )}:${control.conflict}`
          )
          .join("|");
        if (nextControlKey !== controlKeyRef.current) {
          controlKeyRef.current = nextControlKey;
          setControlItems(controls);
        }
      });
    };

    const scrollTargets = [
      leftView.scrollDOM,
      baseView.scrollDOM,
      rightView.scrollDOM,
      leftContainerRef.current,
      baseContainerRef.current,
      rightContainerRef.current,
    ].filter((target): target is HTMLElement => Boolean(target));
    scrollTargets.forEach((target) => target.addEventListener("scroll", measure, { passive: true }));
    window.addEventListener("resize", measure);
    measure();

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      scrollTargets.forEach((target) => target.removeEventListener("scroll", measure));
      window.removeEventListener("resize", measure);
    };
  }, [
    enabled,
    chunks,
    layoutTick,
    leftViewRef,
    baseViewRef,
    rightViewRef,
    leftContainerRef,
    baseContainerRef,
    rightContainerRef,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const leftView = leftViewRef.current;
    const rightView = rightViewRef.current;

    if (!leftView || !rightView) {
      return;
    }

    let frame = 0;
    let pendingSide: HoverSide | null = null;
    let pendingEvent: PointerEvent | null = null;

    const updateHover = (side: HoverSide, event: PointerEvent) => {
      const view = side === "left" ? leftView : rightView;
      const height = clampHeight(view, event.clientY - view.documentTop);
      const block = view.lineBlockAtHeight(height);
      const lineIndex = view.state.doc.lineAt(block.from).number - 1;
      const chunk = findChunkForLine(chunks, side, lineIndex);
      const nextId = chunk ? `${chunk.id}-${side}` : null;
      setHoveredControlId((current) => (current === nextId ? current : nextId));
    };

    const scheduleUpdate = (side: HoverSide, event: PointerEvent) => {
      pendingSide = side;
      pendingEvent = event;
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pendingSide || !pendingEvent) {
          return;
        }
        updateHover(pendingSide, pendingEvent);
        pendingSide = null;
        pendingEvent = null;
      });
    };

    const handleLeave = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      pendingSide = null;
      pendingEvent = null;
      setHoveredControlId(null);
    };

    const handleLeftMove = (event: PointerEvent) => {
      scheduleUpdate("left", event);
    };

    const handleRightMove = (event: PointerEvent) => {
      scheduleUpdate("right", event);
    };

    leftView.scrollDOM.addEventListener("pointermove", handleLeftMove);
    rightView.scrollDOM.addEventListener("pointermove", handleRightMove);
    leftView.scrollDOM.addEventListener("pointerleave", handleLeave);
    rightView.scrollDOM.addEventListener("pointerleave", handleLeave);

    return () => {
      leftView.scrollDOM.removeEventListener("pointermove", handleLeftMove);
      rightView.scrollDOM.removeEventListener("pointermove", handleRightMove);
      leftView.scrollDOM.removeEventListener("pointerleave", handleLeave);
      rightView.scrollDOM.removeEventListener("pointerleave", handleLeave);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [enabled, chunks, leftViewRef, rightViewRef]);

  return (
    <div ref={overlayRef} className="git-diff-view__overlay">
      <svg className="git-diff-view__arrows" aria-hidden="true">
        {arrowSegments.flatMap((segment) =>
          segment.paths.map((path, index) => (
            <path
              key={`${segment.id}-${index}`}
              className={`git-diff-view__arrow git-diff-view__arrow--${segment.side} ${
                segment.conflict ? "git-diff-view__arrow--conflict" : ""
              }`}
              d={path}
            />
          ))
        )}
      </svg>
      <div className="git-diff-view__controls">
        {controlItems.map((item) => {
          const action = chunkActions[item.chunk.id] ?? item.chunk.action;
          const isSelected = item.chunk.id === selectedChunkId;
          return (
            <ChunkControls
              key={item.id}
              item={item}
              action={action}
              isSelected={isSelected}
              isVisible={hoveredControlId === item.id}
              onSelect={onSelectChunk}
              onAction={onChunkAction}
            />
          );
        })}
      </div>
    </div>
  );
}
