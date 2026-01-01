import { type MutableRefObject, useCallback, useEffect, useMemo, useState } from "react";
import { EditorView } from "@codemirror/view";
import { applyChunkAction, buildThreeWayChunks, MergeChunk, MergeChunkAction } from "../merge/threeWay";

type UseThreeWayMergeStateProps = {
  enabled: boolean;
  baseText: string;
  leftText: string;
  rightText: string;
  baseViewRef: MutableRefObject<EditorView | null>;
  containerRef: MutableRefObject<HTMLElement | null>;
};

export function useThreeWayMergeState({
  enabled,
  baseText,
  leftText,
  rightText,
  baseViewRef,
  containerRef,
}: UseThreeWayMergeStateProps) {
  const [baseDocState, setBaseDocState] = useState(baseText ?? "");
  const [chunkActions, setChunkActions] = useState<Record<string, MergeChunkAction>>({});
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

  useEffect(() => {
    setBaseDocState(baseText ?? "");
  }, [baseText]);

  const threeWayChunks = useMemo<MergeChunk[]>(
    () => (enabled ? buildThreeWayChunks(baseDocState, leftText, rightText) : []),
    [enabled, baseDocState, leftText, rightText]
  );

  useEffect(() => {
    setChunkActions((prev) => {
      const next: Record<string, MergeChunkAction> = {};
      for (const chunk of threeWayChunks) {
        if (prev[chunk.id]) {
          next[chunk.id] = prev[chunk.id];
        }
      }
      return next;
    });
    if (threeWayChunks.length > 0) {
      setSelectedChunkId((current) => current ?? threeWayChunks[0].id);
    } else {
      setSelectedChunkId(null);
    }
  }, [threeWayChunks]);

  const handleChunkAction = useCallback(
    (chunk: MergeChunk, action: MergeChunkAction) => {
      if (action === "keep_base" || action === "manual") {
        setChunkActions((prev) => ({ ...prev, [chunk.id]: action }));
        return;
      }

      setChunkActions((prev) => ({ ...prev, [chunk.id]: action }));
      setBaseDocState((current) => applyChunkAction(current, leftText, rightText, chunk, action));
    },
    [leftText, rightText]
  );

  useEffect(() => {
    if (!enabled || threeWayChunks.length === 0) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const currentIndex = Math.max(
        0,
        threeWayChunks.findIndex((chunk) => chunk.id === selectedChunkId)
      );
      const goToIndex = (nextIndex: number) => {
        const bounded = Math.min(Math.max(nextIndex, 0), threeWayChunks.length - 1);
        const chunk = threeWayChunks[bounded];
        setSelectedChunkId(chunk.id);
        if (baseViewRef.current) {
          const startLine = Math.min(chunk.baseRange.startLine + 1, baseViewRef.current.state.doc.lines);
          const pos = baseViewRef.current.state.doc.line(startLine).from;
          baseViewRef.current.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: "center" }),
          });
        }
      };

      switch (event.key) {
        case "n":
        case "ArrowDown":
          event.preventDefault();
          goToIndex(currentIndex + 1);
          break;
        case "p":
        case "ArrowUp":
          event.preventDefault();
          goToIndex(currentIndex - 1);
          break;
        case "l":
          event.preventDefault();
          if (threeWayChunks[currentIndex]?.leftRange) {
            handleChunkAction(threeWayChunks[currentIndex], "apply_left");
          }
          break;
        case "r":
          event.preventDefault();
          if (threeWayChunks[currentIndex]?.rightRange) {
            handleChunkAction(threeWayChunks[currentIndex], "apply_right");
          }
          break;
        case "i":
          event.preventDefault();
          if (threeWayChunks[currentIndex]?.kind !== "conflict") {
            handleChunkAction(threeWayChunks[currentIndex], "keep_base");
          }
          break;
        default:
          break;
      }
    };

    container.addEventListener("keydown", handleKey);
    return () => container.removeEventListener("keydown", handleKey);
  }, [enabled, threeWayChunks, selectedChunkId, baseViewRef, handleChunkAction, containerRef]);

  return {
    baseDocState,
    threeWayChunks,
    chunkActions,
    selectedChunkId,
    setSelectedChunkId,
    handleChunkAction,
  };
}
