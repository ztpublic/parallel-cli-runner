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
  const arrowKeyRef = useRef<string>("");
  const controlKeyRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) {
      setArrowSegments([]);
      setControlItems([]);
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
        const leftRect = leftView.dom.getBoundingClientRect();
        const baseRect = baseView.dom.getBoundingClientRect();
        const rightRect = rightView.dom.getBoundingClientRect();

        const leftStartX = leftRect.right - overlayRect.left;
        const rightStartX = rightRect.left - overlayRect.left;
        const baseLeftX = baseRect.left - overlayRect.left;
        const baseRightX = baseRect.right - overlayRect.left;
        const leftDocTop = leftView.documentTop - overlayRect.top;
        const baseDocTop = baseView.documentTop - overlayRect.top;
        const rightDocTop = rightView.documentTop - overlayRect.top;

        const segments: ArrowSegment[] = [];
        const controls: ControlItem[] = [];
        for (const chunk of chunks) {
          if (chunk.leftRange) {
            const leftMetrics = lineRangeMetrics(leftView, chunk.leftRange);
            const baseMetrics = lineRangeMetrics(baseView, chunk.baseRange);
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
          }
          if (chunk.rightRange) {
            const rightMetrics = lineRangeMetrics(rightView, chunk.rightRange);
            const baseMetrics = lineRangeMetrics(baseView, chunk.baseRange);
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
          }

          const baseMetrics = lineRangeMetrics(baseView, chunk.baseRange);
          const baseCenter = baseMetrics.center + baseDocTop;
          controls.push({
            id: chunk.id,
            top: baseCenter,
            left: (baseRect.left + baseRect.right) / 2 - overlayRect.left,
            conflict: chunk.kind === "conflict",
            hasLeft: !!chunk.leftRange,
            hasRight: !!chunk.rightRange,
            chunk,
          });
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
              `${control.id}:${Math.round(control.left)}:${Math.round(control.top)}:${control.conflict}`
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
          const action = chunkActions[item.id] ?? item.chunk.action;
          const isSelected = item.id === selectedChunkId;
          return (
            <ChunkControls
              key={item.id}
              item={item}
              action={action}
              isSelected={isSelected}
              onSelect={onSelectChunk}
              onAction={onChunkAction}
            />
          );
        })}
      </div>
    </div>
  );
}
