const WORKTREE_TARGET_PREFIX = "worktree:";

export const makeWorktreeTargetId = (repoId: string, worktreePath: string) =>
  `${WORKTREE_TARGET_PREFIX}${encodeURIComponent(repoId)}:${encodeURIComponent(worktreePath)}`;

export const parseWorktreeTargetId = (targetId: string) => {
  if (!targetId.startsWith(WORKTREE_TARGET_PREFIX)) return null;
  const rest = targetId.slice(WORKTREE_TARGET_PREFIX.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex === -1) return null;
  const repoId = decodeURIComponent(rest.slice(0, separatorIndex));
  const worktreePath = decodeURIComponent(rest.slice(separatorIndex + 1));
  return { repoId, worktreePath };
};
