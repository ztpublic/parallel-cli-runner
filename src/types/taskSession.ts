export type TaskSessionState = "active" | "completed" | "aborted";

export type AgentStatus = "running" | "finished" | "winner" | "discarded" | "error";

export type CleanupMode = "keep_branches" | "delete_branches";

export interface AgentWorktree {
  agent_id: string;
  panel_id?: string | null;
  branch_name: string;
  worktree_path: string;
  status: AgentStatus;
}

export interface TaskSession {
  id: string;
  repo_id: string;
  base_branch: string;
  base_commit: string;
  created_at: string;
  state: TaskSessionState;
  agents: AgentWorktree[];
}
