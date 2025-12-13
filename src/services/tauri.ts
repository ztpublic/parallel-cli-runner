import { invoke } from "@tauri-apps/api/core";
import type { Agent, AgentDiffStat, BranchInfo } from "../types/agent";
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

export function gitListBranches(params: { cwd: string }): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>("git_list_branches", params);
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

export function listAgents(params: { repoRoot: string }): Promise<Agent[]> {
  return invoke<Agent[]>("list_agents", params);
}

export function createAgent(params: {
  repoRoot: string;
  name: string;
  startCommand: string;
  baseBranch: string;
}): Promise<Agent> {
  return invoke<Agent>("create_agent", params);
}

export function removeAgent(params: { repoRoot: string; agentId: string }): Promise<void> {
  return invoke("remove_agent", params);
}

export function agentDiffStats(params: { repoRoot: string }): Promise<AgentDiffStat[]> {
  return invoke<AgentDiffStat[]>("agent_diff_stats", params);
}

export function cleanupAgents(params: { repoRoot: string }): Promise<void> {
  return invoke("cleanup_agents", params);
}

export function openDiffBetweenRefs(params: {
  worktreePath: string;
  path: string | null;
}): Promise<void> {
  return invoke("open_diff_between_refs", params);
}
