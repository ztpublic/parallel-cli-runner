import { useCallback, useState } from "react";
import type { Agent, AgentDiffStat } from "../types/agent";
import { agentDiffStats, createAgent, listAgents, openDiffBetweenRefs, removeAgent } from "../services/tauri";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentDiffStatsById, setAgentDiffStatsById] = useState<Record<string, AgentDiffStat>>({});
  const [agentMenuOpenId, setAgentMenuOpenId] = useState<string | null>(null);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);

  const resetAgentsState = useCallback(() => {
    setAgents([]);
    setAgentMenuOpenId(null);
    setRemovingAgentId(null);
    setAgentDiffStatsById({});
  }, []);

  const toggleAgentMenu = useCallback((agentId: string) => {
    setAgentMenuOpenId((prev) => (prev === agentId ? null : agentId));
  }, []);

  const closeAgentMenu = useCallback(() => {
    setAgentMenuOpenId(null);
  }, []);

  const refreshDiffStats = useCallback(async (repoRoot: string) => {
    if (!repoRoot) {
      setAgentDiffStatsById({});
      return;
    }
    try {
      const summaries = await agentDiffStats({ repoRoot });
      const mapped = summaries.reduce<Record<string, AgentDiffStat>>((acc, item) => {
        acc[item.agent_id] = item;
        return acc;
      }, {});
      setAgentDiffStatsById(mapped);
    } catch (error) {
      console.error("Failed to load agent diff stats", error);
      setAgentDiffStatsById({});
    }
  }, []);

  const loadAgents = useCallback(
    async (repoRoot: string) => {
      const loaded = await listAgents({ repoRoot });
      setAgents(loaded);
      setAgentMenuOpenId(null);
      setRemovingAgentId(null);
      await refreshDiffStats(repoRoot);
      return loaded;
    },
    [refreshDiffStats]
  );

  const createAgentForRepo = useCallback(
    async (params: { repoRoot: string; name: string; startCommand: string; baseBranch: string }) => {
      const agent = await createAgent(params);
      setAgents((prev) => [...prev, agent]);
      setAgentDiffStatsById((prev) => ({
        ...prev,
        [agent.id]: {
          agent_id: agent.id,
          files_changed: 0,
          insertions: 0,
          deletions: 0,
        },
      }));
      return agent;
    },
    []
  );

  const removeAgentForRepo = useCallback(async (params: { repoRoot: string; agentId: string }) => {
    setRemovingAgentId(params.agentId);
    try {
      await removeAgent(params);
      setAgents((prev) => prev.filter((item) => item.id !== params.agentId));
      setAgentDiffStatsById((prev) => {
        const { [params.agentId]: _removed, ...rest } = prev;
        return rest;
      });
      setAgentMenuOpenId((current) => (current === params.agentId ? null : current));
    } finally {
      setRemovingAgentId(null);
    }
  }, []);

  const showDiff = useCallback(async (agent: Agent) => {
    await openDiffBetweenRefs({ worktreePath: agent.worktree_path, path: null });
    setAgentMenuOpenId(null);
  }, []);

  return {
    agents,
    agentDiffStatsById,
    agentMenuOpenId,
    removingAgentId,
    resetAgentsState,
    toggleAgentMenu,
    closeAgentMenu,
    loadAgents,
    refreshDiffStats,
    createAgentForRepo,
    removeAgentForRepo,
    showDiff,
  };
}

