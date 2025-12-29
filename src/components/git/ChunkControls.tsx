import { MergeChunk, MergeChunkAction } from "./merge/threeWay";

export type ControlItem = {
  id: string;
  top: number;
  left: number;
  side: "left" | "right";
  conflict: boolean;
  hasLeft: boolean;
  hasRight: boolean;
  chunk: MergeChunk;
};

type ChunkControlsProps = {
  item: ControlItem;
  action: MergeChunkAction;
  isSelected: boolean;
  isVisible: boolean;
  onSelect: (id: string) => void;
  onAction: (chunk: MergeChunk, action: MergeChunkAction) => void;
};

export function ChunkControls({
  item,
  action,
  isSelected,
  isVisible,
  onSelect,
  onAction,
}: ChunkControlsProps) {
  const ignoreDisabled = item.conflict;
  const isLeft = item.side === "left";
  const applyAction: MergeChunkAction = isLeft ? "apply_left" : "apply_right";
  const canApply = isLeft ? item.hasLeft : item.hasRight;
  const applyLabel = isLeft ? "Apply left" : "Apply right";

  return (
    <div
      className={`git-diff-view__control ${
        item.conflict ? "git-diff-view__control--conflict" : ""
      } ${isSelected ? "git-diff-view__control--active" : ""} git-diff-view__control--${item.side}`}
      style={{ top: item.top, left: item.left }}
      data-visible={isVisible ? "true" : undefined}
      onMouseEnter={() => onSelect(item.chunk.id)}
    >
      <button
        type="button"
        className={`git-diff-view__action ${action === applyAction ? "is-active" : ""}`}
        onClick={() => onAction(item.chunk, applyAction)}
        disabled={!canApply}
        aria-label={applyLabel}
        title={applyLabel}
      >
        <svg className="git-diff-view__icon" viewBox="0 0 16 16" aria-hidden="true">
          {isLeft ? (
            <path
              d="M3 8h8M9 4l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          ) : (
            <path
              d="M13 8H5M7 4l-4 4 4 4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          )}
        </svg>
      </button>
      <button
        type="button"
        className={`git-diff-view__action ${action === "keep_base" ? "is-active" : ""}`}
        onClick={() => onAction(item.chunk, "keep_base")}
        disabled={ignoreDisabled}
        aria-label="Keep base"
        title="Keep base"
      >
        <svg className="git-diff-view__icon" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </button>
    </div>
  );
}
