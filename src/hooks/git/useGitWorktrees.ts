import { useState } from "react";
import type { WorktreeItem } from "../../types/git-ui";

type RepoId = string;

export function useGitWorktrees() {
  const [worktreesByRepo, setWorktreesByRepo] = useState<Record<RepoId, WorktreeItem[]>>({});

  return {
    worktreesByRepo,
    setWorktreesByRepo,
  };
}
