import { MergeChunk, MergeChunkAction } from "./merge/threeWay";

export type ControlItem = {
  id: string;
  top: number;
  left: number;
  conflict: boolean;
  hasLeft: boolean;
  hasRight: boolean;
  chunk: MergeChunk;
};

type ChunkControlsProps = {
  item: ControlItem;
  action: MergeChunkAction;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAction: (chunk: MergeChunk, action: MergeChunkAction) => void;
};

export function ChunkControls({
  item,
  action,
  isSelected,
  onSelect,
  onAction,
}: ChunkControlsProps) {
  const ignoreDisabled = item.conflict;

  return (
    <div
      className={`git-diff-view__control ${
        item.conflict ? "git-diff-view__control--conflict" : ""
      } ${isSelected ? "git-diff-view__control--active" : ""}`}
      style={{ top: item.top, left: item.left }}
      onMouseEnter={() => onSelect(item.id)}
    >
      <button
        type="button"
        className={`git-diff-view__action ${action === "apply_left" ? "is-active" : ""}`}
        onClick={() => onAction(item.chunk, "apply_left")}
        disabled={!item.hasLeft}
      >
        Apply Left
      </button>
      <button
        type="button"
        className={`git-diff-view__action ${action === "keep_base" ? "is-active" : ""}`}
        onClick={() => onAction(item.chunk, "keep_base")}
        disabled={ignoreDisabled}
      >
        Ignore
      </button>
      <button
        type="button"
        className={`git-diff-view__action ${action === "apply_right" ? "is-active" : ""}`}
        onClick={() => onAction(item.chunk, "apply_right")}
        disabled={!item.hasRight}
      >
        Apply Right
      </button>
    </div>
  );
}
