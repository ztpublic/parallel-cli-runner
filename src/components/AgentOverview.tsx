import { Agent, AgentDiffStat } from "../types/agent";

type AgentOverviewProps = {
  agents: Agent[];
  diffStats: Record<string, AgentDiffStat | undefined>;
  openMenuId: string | null;
  onToggleMenu: (agentId: string) => void;
  onCommitAndMerge: (agent: Agent) => void;
  onRemoveAgent: (agent: Agent) => void;
  removingAgentId: string | null;
};

export function AgentOverview({
  agents,
  diffStats,
  openMenuId,
  onToggleMenu,
  onCommitAndMerge,
  onRemoveAgent,
  removingAgentId,
}: AgentOverviewProps) {
  if (!agents.length) return null;

  const formatDiffStat = (stat?: AgentDiffStat) => {
    if (!stat) return "\u2014";
    const fileLabel = stat.files_changed === 1 ? "file" : "files";
    return `${stat.files_changed} ${fileLabel} +${stat.insertions} -${stat.deletions}`;
  };

  return (
    <div className="agent-overview">
      <div className="agent-head">
        <div className="agent-pills">
          <span className="pill">Agents {agents.length}</span>
        </div>
        <div className="agent-meta muted">Worktrees {agents.length}</div>
      </div>
      <div className="agent-grid">
        {agents.map((agent) => {
          const diff = diffStats[agent.id];
          return (
            <div className="agent-card" key={agent.id}>
              <div className="agent-card-top">
                <div className="agent-card-heading">
                  <div className="agent-name">{agent.name}</div>
                  <div className={diff ? "agent-diff" : "agent-diff agent-diff-pending"}>
                    {formatDiffStat(diff)}
                  </div>
                </div>
                <button
                  className="agent-menu-button"
                  aria-label="Agent actions"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleMenu(agent.id);
                  }}
                >
                  ...
                </button>
                {openMenuId === agent.id ? (
                  <div
                    className="agent-menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="agent-menu-item"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCommitAndMerge(agent);
                      }}
                      disabled={removingAgentId === agent.id}
                    >
                      Commit and merge
                    </button>
                    <button
                      className="agent-menu-item danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveAgent(agent);
                      }}
                      disabled={removingAgentId === agent.id}
                    >
                      {removingAgentId === agent.id ? "Removing..." : "Remove agent"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
