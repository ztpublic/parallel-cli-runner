import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { MergeChunk } from "./threeWay";

export const baseTargetEffect = StateEffect.define<DecorationSet>();
export const baseTargetField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(baseTargetEffect)) {
        return effect.value;
      }
    }
    if (tr.docChanged) {
      return value.map(tr.changes);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function buildBaseTargetDecorations(
  view: EditorView,
  chunks: MergeChunk[]
): DecorationSet {
  if (chunks.length === 0) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  const maxLine = view.state.doc.lines;
  const decoration = Decoration.line({ class: "git-diff-view__base-target" });

  for (const chunk of chunks) {
    if (!chunk.leftRange && !chunk.rightRange) {
      continue;
    }
    const startLine = Math.max(1, Math.min(maxLine, chunk.baseRange.startLine + 1));
    const endLine = Math.max(startLine, Math.min(maxLine, chunk.baseRange.endLine + 1));
    for (let line = startLine; line <= endLine; line += 1) {
      const lineInfo = view.state.doc.line(line);
      builder.add(lineInfo.from, lineInfo.from, decoration);
    }
  }

  return builder.finish();
}
