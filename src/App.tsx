import { useCallback, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { Agent } from "./types/agent";
import { formatInvokeError } from "./services/errors";
import { getString } from "./services/storage";
import { LAST_REPO_KEY } from "./services/storageKeys";
import { createPaneNode, killLayoutSessions, runStartCommand } from "./services/sessions";
import {
  cleanupAgents,
  killSession,
} from "./services/tauri";
import { useLayoutState } from "./hooks/useLayoutState";
import { useRepoBinding } from "./hooks/useRepoBinding";
import { useAgents } from "./hooks/useAgents";
import { useCreateAgentDialog } from "./hooks/useCreateAgentDialog";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { useDismissOnWindowClickOrEscape } from "./hooks/useDismiss";
import {
  PaneNode,
  LayoutNode,
  collectPanes,
  getFirstPane,
  removePane,
  buildLayoutFromPanes,
} from "./types/layout";
import { LayoutRenderer } from "./components/LayoutRenderer";
import { SyncBar } from "./components/SyncBar";
import { AgentOverview } from "./components/AgentOverview";
import { BranchBindDialog } from "./components/dialogs/BranchBindDialog";
import { CreateAgentDialog } from "./components/dialogs/CreateAgentDialog";
function App() {
  const {
    layout,
    setLayout,
    activePaneId,
    setActivePaneId,
    resetLayoutState,
    getLayoutSnapshot,
    appendPane,
    closeActivePane,
    broadcastPaneInput,
  } = useLayoutState();
  const [syncTyping, setSyncTyping] = useState(false);
  const agentsApi = useAgents();

  useClosePaneHotkey(closeActivePane);
  useDismissOnWindowClickOrEscape(agentsApi.closeAgentMenu);

  const handleBindFailed = useCallback(async () => {
    agentsApi.resetAgentsState();
    await killLayoutSessions(getLayoutSnapshot());
    resetLayoutState();
    setSyncTyping(false);
  }, [agentsApi, getLayoutSnapshot, resetLayoutState]);

  const launchAgentPanes = useCallback(
    async (agentList: Agent[]) => {
      await killLayoutSessions(getLayoutSnapshot());
      if (!agentList.length) {
        resetLayoutState();
        setSyncTyping(false);
        return;
      }

      const panesWithAgents: { pane: PaneNode; agent: Agent }[] = [];
      for (const agent of agentList) {
        const pane = await createPaneNode({
          cwd: agent.worktree_path,
          meta: {
            agentId: agent.id,
            agentName: agent.name,
            branchName: agent.branch_name,
            worktreePath: agent.worktree_path,
          },
        });
        panesWithAgents.push({ pane, agent });
      }
      const panes = panesWithAgents.map(({ pane }) => pane);
      const nextLayout = buildLayoutFromPanes(panes);
      setLayout(nextLayout);
      setActivePaneId(panes[0]?.id ?? null);
      setSyncTyping(false);
      await Promise.all(
        panesWithAgents.map(({ pane, agent }) =>
          runStartCommand(pane, agent.start_command).catch((error) => {
            console.error("Failed to run start command for agent", agent.id, error);
          })
        )
      );
    },
    [getLayoutSnapshot, resetLayoutState, setActivePaneId, setLayout]
  );

  const {
    repoStatus,
    repoError,
    setRepoError,
    repoLoading,
    baseBranch,
    beginBindRepo,
    confirmBindRepo,
    cancelBindRepo,
    branchDialogOpen,
    branchOptions,
    branchSelection,
    setBranchSelection,
    pendingRepoPath,
    clearBinding,
  } = useRepoBinding({
    onBound: async (repoRoot) => {
      const loaded = await agentsApi.loadAgents(repoRoot);
      await launchAgentPanes(loaded);
    },
    onBindFailed: handleBindFailed,
  });

  const createDialog = useCreateAgentDialog({
    canCreate: !!repoStatus,
    defaultAgentName: `agent-${agentsApi.agents.length + 1}`,
    onBlocked: () => setRepoError("Bind a git repo before creating an agent."),
    onCreate: async ({ name, startCommand }) => {
      if (!repoStatus) throw new Error("Bind a git repo before creating an agent.");
      const branchForAgent = baseBranch ?? repoStatus.branch;
      return agentsApi.createAgentForRepo({
        repoRoot: repoStatus.root_path,
        name,
        startCommand,
        baseBranch: branchForAgent,
      });
    },
    onCreated: async (agent) => {
      if (!repoStatus) return;
      const pane = await createPaneNode({
        cwd: agent.worktree_path,
        meta: {
          agentId: agent.id,
          agentName: agent.name,
          branchName: agent.branch_name,
          worktreePath: agent.worktree_path,
        },
      });
      appendPane(pane);
      setSyncTyping(false);
      await runStartCommand(pane, agent.start_command);
      await agentsApi.refreshDiffStats(repoStatus.root_path);
    },
  });

  const handleRemoveAgent = useCallback(
    async (agent: Agent) => {
      if (!repoStatus) {
        setRepoError("Bind a git repo before removing an agent.");
        return;
      }

      setRepoError(null);
      const panesForAgent = collectPanes(getLayoutSnapshot()).filter(
        (pane) => pane.meta?.agentId === agent.id
      );

      try {
        await agentsApi.removeAgentForRepo({
          repoRoot: repoStatus.root_path,
          agentId: agent.id,
        });
      } catch (error) {
        setRepoError(formatInvokeError(error) || "Failed to remove agent.");
        return;
      }

      await Promise.all(
        panesForAgent.map((pane) =>
          killSession({ id: pane.sessionId }).catch(() => undefined)
        )
      );

      setLayout((prev) => {
        if (!prev) return prev;
        let next: LayoutNode | null = prev;
        for (const pane of panesForAgent) {
          if (!next) break;
          next = removePane(next, pane.id);
        }
        const fallbackPane = getFirstPane(next);
        setActivePaneId((currentActive) => {
          if (!currentActive) return fallbackPane?.id ?? null;
          if (panesForAgent.some((pane) => pane.id === currentActive)) {
            return fallbackPane?.id ?? null;
          }
          return currentActive;
        });
        setSyncTyping(false);
        return next;
      });
    },
    [agentsApi, getLayoutSnapshot, repoStatus, setLayout]
  );

  const handleShowDiff = useCallback(
    async (agent: Agent) => {
      if (!repoStatus) {
        setRepoError("Bind a git repo before opening a diff view.");
        return;
      }

      try {
        await agentsApi.showDiff(agent);
      } catch (error) {
        setRepoError(formatInvokeError(error) || "Failed to open diff view.");
      }
    },
    [agentsApi, repoStatus, setRepoError]
  );

  const handleQuit = useCallback(() => {
    void getCurrentWindow().close();
  }, []);

  const handleClearCachesAndQuit = useCallback(async () => {
    const repoIds = new Set<string>();

    if (repoStatus?.root_path) {
      repoIds.add(repoStatus.root_path);
    }

    const lastRepo = getString(LAST_REPO_KEY);
    if (lastRepo) {
      repoIds.add(lastRepo);
    }

    await Promise.all(
      Array.from(repoIds).map(async (repoRoot) => {
        try {
          await cleanupAgents({ repoRoot });
        } catch (error) {
          console.error("Failed to cleanup agents for repo", repoRoot, error);
        }
      })
    );

    clearBinding();
    void getCurrentWindow().close();
  }, [clearBinding, repoStatus]);

  return (
    <main className="app-shell">
      <SyncBar
        syncEnabled={syncTyping}
        onToggleSync={() => setSyncTyping((prev) => !prev)}
        onBindRepo={() => void beginBindRepo()}
        repoStatus={repoStatus}
        repoError={repoError}
        repoLoading={repoLoading}
      onCreateAgent={createDialog.openDialog}
      onQuit={handleQuit}
      onClearCachesAndQuit={handleClearCachesAndQuit}
    />
      <AgentOverview
        agents={agentsApi.agents}
        diffStats={agentsApi.agentDiffStatsById}
        openMenuId={agentsApi.agentMenuOpenId}
        onToggleMenu={agentsApi.toggleAgentMenu}
        onShowDiff={(agent) => void handleShowDiff(agent)}
        onRemoveAgent={(agent) => void handleRemoveAgent(agent)}
        removingAgentId={agentsApi.removingAgentId}
      />
      <section className="terminal-card">
        {layout ? (
          <div className="layout-root">
            <LayoutRenderer
              node={layout}
              activePaneId={activePaneId}
              onFocusPane={setActivePaneId}
              onPaneInput={
                syncTyping
                  ? broadcastPaneInput
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="loading">No terminals yet. Create an agent to start.</div>
        )}
      </section>
      <BranchBindDialog
        open={branchDialogOpen}
        branches={branchOptions}
        selection={branchSelection}
        onChangeSelection={setBranchSelection}
        onCancel={cancelBindRepo}
        onConfirm={() => void confirmBindRepo()}
        busy={repoLoading}
        pendingRepoPath={pendingRepoPath}
      />
      <CreateAgentDialog
        open={createDialog.open}
        creating={createDialog.creatingAgent}
        repoRootPathLabel={repoStatus?.root_path ?? "your repo"}
        agentName={createDialog.agentNameInput}
        onChangeAgentName={createDialog.setAgentNameInput}
        startCommand={createDialog.agentCommandInput}
        onChangeStartCommand={createDialog.setAgentCommandInput}
        error={createDialog.agentError}
        placeholderAgentName={`agent-${agentsApi.agents.length + 1}`}
        onCancel={createDialog.closeDialog}
        onConfirm={() => void createDialog.confirmCreate()}
      />
    </main>
  );
}

export default App;
