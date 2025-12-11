export interface Agent {
  id: string;
  repo_id: string;
  name: string;
  branch_name: string;
  worktree_path: string;
  start_command: string;
}

export interface AgentDiffStat {
  agent_id: string;
  files_changed: number;
  insertions: number;
  deletions: number;
}
