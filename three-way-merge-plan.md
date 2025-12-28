# 3-Way Merge UI Plan (Arrows + Per-Chunk Actions)

## 1) Data model
- Define a `MergeChunk` structure with stable ids and source ranges:
  - `baseRange: { startLine, endLine }`
  - `leftRange?: { startLine, endLine }`
  - `rightRange?: { startLine, endLine }`
  - `kind: "left-only" | "right-only" | "both" | "conflict"`
  - `action: "keep_base" | "apply_left" | "apply_right" | "manual"`
- Store a per-chunk decision state to control UI rendering and patching logic.

## 2) Diff computation & alignment
- Compute diffs for `base↔left` and `base↔right` using a line-based diff (CodeMirror diff utilities or a dedicated diff lib).
- Normalize each diff into a list of chunks keyed by base ranges.
- Align chunks by base line ranges to build 3-way chunks:
  - Pair left/right edits that touch the same base span.
  - Mark `kind=conflict` when both sides modify overlapping base ranges.

## 3) UI layout
- Render three synchronized panes (Left / Base / Right).
- Add a cross-pane overlay for arrows and action controls, positioned relative to line blocks.
- Ensure panes share line height metrics to avoid drift in arrow alignment.

## 4) Mapping & arrow rendering
- For each chunk, map base/left/right line ranges to DOM coordinates.
- Draw SVG arrows from left/right blocks to the base block.
- Place a chunk control widget (Apply Left / Apply Right / Ignore) at the base block midpoint.

## 5) Actions & patching
- Implement per-chunk actions:
  - Apply Left: patch base with left chunk.
  - Apply Right: patch base with right chunk.
  - Ignore: keep base unchanged for that chunk.
- After action, re-run diff + alignment to update chunk list and visuals.
- Ensure actions are undoable via editor history/transactions.

## 6) Conflict handling
- For `kind=conflict`, force explicit choice (disable Ignore unless user chooses or edits base manually).
- Allow manual edits in base and re-diff to resolve the conflict.
- Show conflict styling and a clear prompt in the action widget.

## 7) Performance & UX
- Virtualize large files and batch DOM measurements with `requestAnimationFrame`.
- Debounce diff recomputation on edits.
- Provide keyboard shortcuts for chunk navigation and apply/ignore actions.

## 8) Storybook + tests
- Stories:
  - Non-conflict example with several left-only/right-only changes.
  - Conflict example with overlapping edits.
- Tests:
  - Verify action clicks mutate base text correctly.
  - Validate chunk list updates after action.
  - Snapshot arrow/control placement for deterministic sample input.
