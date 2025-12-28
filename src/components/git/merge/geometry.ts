import { EditorView } from "@codemirror/view";
import { LineRange } from "./threeWay";

export function lineRangeMetrics(view: EditorView, range: LineRange) {
  const startLine = Math.min(range.startLine + 1, view.state.doc.lines);
  const endLine = Math.min(range.endLine + 1, view.state.doc.lines);
  const start = view.state.doc.line(startLine);
  const end = view.state.doc.line(endLine);
  const startBlock = view.lineBlockAt(start.from);
  const endBlock = view.lineBlockAt(end.to);
  const top = startBlock.top;
  const bottom = endBlock.top + endBlock.height;
  return {
    top,
    bottom,
    center: (top + bottom) / 2,
  };
}

export function buildConnectorPaths(
  x1: number,
  x2: number,
  y1Top: number,
  y1Bottom: number,
  y2Top: number,
  y2Bottom: number
): string[] {
  const distance = Math.abs(x2 - x1);
  const direction = x2 >= x1 ? 1 : -1;
  const maxCurve = Math.min(22, distance / 2);
  const curve = Math.min(Math.max(8, distance * 0.35), maxCurve);
  const c1x = x1 + direction * curve;
  const c2x = x2 - direction * curve;
  return [
    `M ${x1} ${y1Top} C ${c1x} ${y1Top}, ${c2x} ${y2Top}, ${x2} ${y2Top}`,
    `M ${x1} ${y1Bottom} C ${c1x} ${y1Bottom}, ${c2x} ${y2Bottom}, ${x2} ${y2Bottom}`,
  ];
}
