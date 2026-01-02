import { useState } from "react";
import type { RemoteItem, StashItem, SubmoduleItem } from "../../types/git-ui";

type RepoId = string;

export function useGitRepoMetadata() {
  const [remotesByRepo, setRemotesByRepo] = useState<Record<RepoId, RemoteItem[]>>({});
  const [submodulesByRepo, setSubmodulesByRepo] = useState<Record<RepoId, SubmoduleItem[]>>({});
  const [stashesByRepo, setStashesByRepo] = useState<Record<RepoId, StashItem[]>>({});

  return {
    remotesByRepo,
    setRemotesByRepo,
    submodulesByRepo,
    setSubmodulesByRepo,
    stashesByRepo,
    setStashesByRepo,
  };
}
