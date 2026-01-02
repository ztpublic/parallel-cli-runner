import { useState } from "react";
import type { RepoStatusDto } from "../../types/git";

type RepoId = string;

export function useGitStatus() {
  const [statusByRepo, setStatusByRepo] = useState<Record<RepoId, RepoStatusDto | null>>({});
  const [statusByWorktreeByRepo, setStatusByWorktreeByRepo] = useState<
    Record<RepoId, Record<string, RepoStatusDto | null>>
  >({});

  return {
    statusByRepo,
    setStatusByRepo,
    statusByWorktreeByRepo,
    setStatusByWorktreeByRepo,
  };
}
