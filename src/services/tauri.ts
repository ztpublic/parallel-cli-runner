import { invoke } from "@tauri-apps/api/core";
import type {
  BranchInfoDto,
  CommitInfoDto,
  DiffRequestDto,
  DiffResponseDto,
  RemoteInfoDto,
  RepoInfoDto,
  RepoStatusDto,
  StashInfoDto,
  WorktreeInfoDto,
} from "../types/git";

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

export function gitScanRepos(params: { cwd: string }): Promise<RepoInfoDto[]> {
  return invoke<RepoInfoDto[]>("git_scan_repos", params);
}

export function gitStatus(params: { cwd: string }): Promise<RepoStatusDto> {
  return invoke<RepoStatusDto>("git_status", params);
}

export function gitListBranches(params: { cwd: string }): Promise<BranchInfoDto[]> {
  return invoke<BranchInfoDto[]>("git_list_branches", params);
}

export function gitListRemoteBranches(params: { cwd: string }): Promise<BranchInfoDto[]> {
  return invoke<BranchInfoDto[]>("git_list_remote_branches", params);
}

export function gitListCommits(params: {
  cwd: string;
  limit: number;
  skip?: number;
}): Promise<CommitInfoDto[]> {
  return invoke<CommitInfoDto[]>("git_list_commits", params);
}

export function gitListWorktrees(params: { cwd: string }): Promise<WorktreeInfoDto[]> {
  return invoke<WorktreeInfoDto[]>("git_list_worktrees", params);
}

export function gitListRemotes(params: { cwd: string }): Promise<RemoteInfoDto[]> {
  return invoke<RemoteInfoDto[]>("git_list_remotes", params);
}

export function gitListStashes(params: { cwd: string }): Promise<StashInfoDto[]> {
  return invoke<StashInfoDto[]>("git_list_stashes", params);
}

export function gitPull(params: { cwd: string }): Promise<void> {
  return invoke("git_pull", params);
}

export function gitPush(params: { cwd: string; force: boolean }): Promise<void> {
  return invoke("git_push", params);
}

export function gitCommit(params: {
  cwd: string;
  message: string;
  stageAll: boolean;
  amend: boolean;
}): Promise<void> {
  return invoke("git_commit", params);
}

export function gitStageFiles(params: { cwd: string; paths: string[] }): Promise<void> {
  return invoke("git_stage_files", params);
}

export function gitUnstageFiles(params: { cwd: string; paths: string[] }): Promise<void> {
  return invoke("git_unstage_files", params);
}

export function gitStageAll(params: { cwd: string }): Promise<void> {
  return invoke("git_stage_all", params);
}

export function gitUnstageAll(params: { cwd: string }): Promise<void> {
  return invoke("git_unstage_all", params);
}

export function gitMergeIntoBranch(params: {
  repoRoot: string;
  targetBranch: string;
  sourceBranch: string;
}): Promise<void> {
  return invoke("git_merge_into_branch", params);
}

export function gitCreateBranch(params: {
  cwd: string;
  branchName: string;
  sourceBranch?: string;
}): Promise<void> {
  return invoke("git_create_branch", params);
}

export function gitCheckoutBranch(params: {
  cwd: string;
  branchName: string;
}): Promise<void> {
  return invoke("git_checkout_branch", params);
}

export function gitSmartCheckoutBranch(params: {
  cwd: string;
  branchName: string;
}): Promise<void> {
  return invoke("git_smart_checkout_branch", params);
}

export function gitReset(params: {
  cwd: string;
  target: string;
  mode: "soft" | "mixed" | "hard";
}): Promise<void> {
  return invoke("git_reset", params);
}

export function gitRevert(params: {
  cwd: string;
  commit: string;
}): Promise<void> {
  return invoke("git_revert", params);
}

export function gitSquashCommits(params: {
  cwd: string;
  commits: string[];
}): Promise<void> {
  return invoke("git_squash_commits", params);
}

export function gitAddWorktree(params: {
  repoRoot: string;
  path: string;
  branch: string;
  startPoint: string;
}): Promise<void> {
  return invoke("git_add_worktree", params);
}

export function gitRemoveWorktree(params: {
  repoRoot: string;
  path: string;
  force: boolean;
}): Promise<void> {
  return invoke("git_remove_worktree", params);
}

export function gitDeleteBranch(params: {
  repoRoot: string;
  branch: string;
  force: boolean;
}): Promise<void> {
  return invoke("git_delete_branch", params);
}

export function gitUnifiedDiff(params: DiffRequestDto): Promise<DiffResponseDto> {
  return invoke<DiffResponseDto>("git_unified_diff", params);
}
