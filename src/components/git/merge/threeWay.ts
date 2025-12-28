import { diff } from "@codemirror/merge";

export type LineRange = {
  startLine: number;
  endLine: number;
};

type PosRange = {
  from: number;
  to: number;
};

type SideChange = {
  side: "left" | "right";
  baseRange: LineRange;
  otherRange: LineRange;
  basePos: PosRange;
  otherPos: PosRange;
};

export type MergeChunkKind = "left-only" | "right-only" | "both" | "conflict";
export type MergeChunkAction = "keep_base" | "apply_left" | "apply_right" | "manual";

export type MergeChunk = {
  id: string;
  baseRange: LineRange;
  leftRange?: LineRange;
  rightRange?: LineRange;
  leftBaseRange?: LineRange;
  rightBaseRange?: LineRange;
  basePosRange?: PosRange;
  leftPosRange?: PosRange;
  rightPosRange?: PosRange;
  kind: MergeChunkKind;
  action: MergeChunkAction;
};

type LineIndexMap = {
  lineStarts: number[];
  lineCount: number;
};

function buildLineIndex(text: string): LineIndexMap {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }
  return { lineStarts, lineCount: lineStarts.length };
}

function lineIndexForPos(map: LineIndexMap, pos: number): number {
  let low = 0;
  let high = map.lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = map.lineStarts[mid];
    const next = map.lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY;
    if (pos < start) {
      high = mid - 1;
    } else if (pos >= next) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return map.lineCount - 1;
}

function rangeToLines(map: LineIndexMap, from: number, to: number): LineRange {
  const startLine = lineIndexForPos(map, from);
  const endPos = to > from ? to - 1 : from;
  const endLine = lineIndexForPos(map, endPos);
  return { startLine, endLine };
}

function mergeRanges(target?: LineRange, next?: LineRange): LineRange | undefined {
  if (!target) {
    return next;
  }
  if (!next) {
    return target;
  }
  return {
    startLine: Math.min(target.startLine, next.startLine),
    endLine: Math.max(target.endLine, next.endLine),
  };
}

function mergePosRanges(target?: PosRange, next?: PosRange): PosRange | undefined {
  if (!target) {
    return next;
  }
  if (!next) {
    return target;
  }
  return {
    from: Math.min(target.from, next.from),
    to: Math.max(target.to, next.to),
  };
}

function rangesOverlap(a?: LineRange, b?: LineRange): boolean {
  if (!a || !b) {
    return false;
  }
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function buildSideChanges(baseText: string, otherText: string, side: SideChange["side"]): SideChange[] {
  const baseMap = buildLineIndex(baseText);
  const otherMap = buildLineIndex(otherText);
  const changes = diff(baseText, otherText);

  return changes.map((change) => ({
    side,
    baseRange: rangeToLines(baseMap, change.fromA, change.toA),
    otherRange: rangeToLines(otherMap, change.fromB, change.toB),
    basePos: { from: change.fromA, to: change.toA },
    otherPos: { from: change.fromB, to: change.toB },
  }));
}

export function buildThreeWayChunks(
  baseText: string,
  leftText: string,
  rightText: string
): MergeChunk[] {
  const leftChanges = buildSideChanges(baseText, leftText, "left");
  const rightChanges = buildSideChanges(baseText, rightText, "right");
  const allChanges = [...leftChanges, ...rightChanges].sort((a, b) => {
    if (a.baseRange.startLine !== b.baseRange.startLine) {
      return a.baseRange.startLine - b.baseRange.startLine;
    }
    return a.baseRange.endLine - b.baseRange.endLine;
  });

  const chunks: MergeChunk[] = [];
  let current: MergeChunk | null = null;

  const pushCurrent = () => {
    if (!current) {
      return;
    }
    const hasLeft = !!current.leftRange;
    const hasRight = !!current.rightRange;
    const conflict = rangesOverlap(current.leftBaseRange, current.rightBaseRange);
    current.kind = conflict
      ? "conflict"
      : hasLeft && hasRight
      ? "both"
      : hasLeft
      ? "left-only"
      : "right-only";
    chunks.push(current);
    current = null;
  };

  for (const entry of allChanges) {
    if (!current) {
      current = {
        id: `chunk-${chunks.length + 1}`,
        baseRange: { ...entry.baseRange },
        leftRange: entry.side === "left" ? { ...entry.otherRange } : undefined,
        rightRange: entry.side === "right" ? { ...entry.otherRange } : undefined,
        leftBaseRange: entry.side === "left" ? { ...entry.baseRange } : undefined,
        rightBaseRange: entry.side === "right" ? { ...entry.baseRange } : undefined,
        basePosRange: entry.basePos,
        leftPosRange: entry.side === "left" ? entry.otherPos : undefined,
        rightPosRange: entry.side === "right" ? entry.otherPos : undefined,
        kind: "left-only",
        action: "keep_base",
      };
      continue;
    }

    const overlaps = entry.baseRange.startLine <= current.baseRange.endLine + 1;
    if (!overlaps) {
      pushCurrent();
      current = {
        id: `chunk-${chunks.length + 1}`,
        baseRange: { ...entry.baseRange },
        leftRange: entry.side === "left" ? { ...entry.otherRange } : undefined,
        rightRange: entry.side === "right" ? { ...entry.otherRange } : undefined,
        leftBaseRange: entry.side === "left" ? { ...entry.baseRange } : undefined,
        rightBaseRange: entry.side === "right" ? { ...entry.baseRange } : undefined,
        basePosRange: entry.basePos,
        leftPosRange: entry.side === "left" ? entry.otherPos : undefined,
        rightPosRange: entry.side === "right" ? entry.otherPos : undefined,
        kind: "left-only",
        action: "keep_base",
      };
      continue;
    }

    current.baseRange = mergeRanges(current.baseRange, entry.baseRange) ?? current.baseRange;
    current.basePosRange = mergePosRanges(current.basePosRange, entry.basePos) ?? current.basePosRange;
    if (entry.side === "left") {
      current.leftRange = mergeRanges(current.leftRange, entry.otherRange);
      current.leftBaseRange = mergeRanges(current.leftBaseRange, entry.baseRange);
      current.leftPosRange = mergePosRanges(current.leftPosRange, entry.otherPos);
    } else {
      current.rightRange = mergeRanges(current.rightRange, entry.otherRange);
      current.rightBaseRange = mergeRanges(current.rightBaseRange, entry.baseRange);
      current.rightPosRange = mergePosRanges(current.rightPosRange, entry.otherPos);
    }
  }

  pushCurrent();
  return chunks;
}

function sliceByPos(text: string, range?: PosRange): string {
  if (!range) {
    return "";
  }
  return text.slice(range.from, range.to);
}

export function applyChunkAction(
  baseText: string,
  leftText: string,
  rightText: string,
  chunk: MergeChunk,
  action: MergeChunkAction
): string {
  if (action === "keep_base" || action === "manual") {
    return baseText;
  }

  const baseRange = chunk.basePosRange;
  if (!baseRange) {
    return baseText;
  }

  const replacement =
    action === "apply_left"
      ? sliceByPos(leftText, chunk.leftPosRange)
      : sliceByPos(rightText, chunk.rightPosRange);

  return `${baseText.slice(0, baseRange.from)}${replacement}${baseText.slice(baseRange.to)}`;
}
