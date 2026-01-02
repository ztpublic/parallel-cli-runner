import { useState } from "react";
import type { RemoteItem, StashItem, SubmoduleItem, TagItem } from "../../types/git-ui";

type RepoId = string;

export function useGitRepoMetadata() {
  const [remotesByRepo, setRemotesByRepo] = useState<Record<RepoId, RemoteItem[]>>({});
  const [submodulesByRepo, setSubmodulesByRepo] = useState<Record<RepoId, SubmoduleItem[]>>({});
  const [stashesByRepo, setStashesByRepo] = useState<Record<RepoId, StashItem[]>>({});
  const [tagsByRepo, setTagsByRepo] = useState<Record<RepoId, TagItem[]>>({});

  return {
    remotesByRepo,
    setRemotesByRepo,
    submodulesByRepo,
    setSubmodulesByRepo,
    stashesByRepo,
    setStashesByRepo,
    tagsByRepo,
    setTagsByRepo,
  };
}
