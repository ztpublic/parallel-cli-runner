export interface Agent {
  id: string;
  repo_id: string;
  name: string;
  branch_name: string;
  worktree_path: string;
  start_command: string;
}
