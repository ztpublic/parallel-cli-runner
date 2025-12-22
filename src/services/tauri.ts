import { invoke } from "@tauri-apps/api/core";
import type { RepoStatusDto } from "../types/git";

export function createSession(params: { cwd?: string }): Promise<string> {
  return invoke<string>("create_session", params);
}

export function writeToSession(params: { id: string; data: string }): Promise<void> {
  return invoke("write_to_session", params);
}

export function killSession(params: { id: string }): Promise<void> {
  return invoke("kill_session", params);
}

export function gitDetectRepo(params: { cwd: string }): Promise<string | null> {
  return invoke<string | null>("git_detect_repo", params);
}

export function gitStatus(params: { cwd: string }): Promise<RepoStatusDto> {
  return invoke<RepoStatusDto>("git_status", params);
}

export function gitCommit(params: {
  cwd: string;
  message: string;
  stageAll: boolean;
  amend: boolean;
}): Promise<void> {
  return invoke("git_commit", params);
}

export function gitMergeIntoBranch(params: {
  repoRoot: string;
  targetBranch: string;
  sourceBranch: string;
}): Promise<void> {
  return invoke("git_merge_into_branch", params);
}
