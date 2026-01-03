import { ReactNode, useCallback, useEffect, useState } from "react";
import { GitPanelContainer } from "./GitPanelContainer";
import { TerminalPanelContainer } from "./TerminalPanelContainer";
import { useLayoutState } from "../hooks/useLayoutState";
import { useClosePaneHotkey } from "../hooks/useHotkeys";
import { killLayoutSessions } from "../services/sessions";
import type { RepoInfoDto } from "../types/git";

interface AppLayoutProps {
  repos: RepoInfoDto[];
  enabledRepoIds: string[];
  setEnabledRepoIds: (ids: string[]) => void;
  setRepos: (repos: RepoInfoDto[]) => void;
  onRemoveRepo: (repoId: string) => void;
  onTriggerOpenFolder: () => void;
  gitRefreshRequest: { seq: number; repoId: string | null };
  onRebaseBranch?: (
    repoId: string,
    targetBranch: string,
    ontoBranch: string
  ) => void;
  onSwitchBranchWithCheck?: (
    repoId: string,
    branchName: string
  ) => void;
  onSquashCommitsWithCheck?: (
    repoId: string,
    worktreePath: string,
    commitIds: string[]
  ) => void;
  children?: ReactNode;
}

export function AppLayout({
  repos,
  enabledRepoIds,
  setEnabledRepoIds,
  onRemoveRepo,
  onTriggerOpenFolder,
  gitRefreshRequest,
  onRebaseBranch,
  onSwitchBranchWithCheck,
  onSquashCommitsWithCheck,
  children,
}: AppLayoutProps) {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    setActivePaneId,
    appendPane,
    splitPaneInTab,
    closePanesInTab,
    closeActivePane,
    closeTab,
    getTabsSnapshot,
  } = useLayoutState();

  useClosePaneHotkey(closeActivePane);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    const newWidth = Math.max(240, Math.min(e.clientX, 800));
    setSidebarWidth(newWidth);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      const tabs = getTabsSnapshot();
      tabs.forEach((tab) => {
        void killLayoutSessions(tab.layout);
      });
    };
  }, [getTabsSnapshot]);

  return (
    <main className="app-shell">
      <div className="workspace" style={{ position: "relative" }}>
        <GitPanelContainer
          repos={repos}
          enabledRepoIds={enabledRepoIds}
          setEnabledRepoIds={setEnabledRepoIds}
          onRemoveRepo={onRemoveRepo}
          onTriggerOpenFolder={onTriggerOpenFolder}
          width={sidebarWidth}
          onRebaseBranch={onRebaseBranch}
          onSwitchBranchWithCheck={onSwitchBranchWithCheck}
          onSquashCommitsWithCheck={onSquashCommitsWithCheck}
          gitRefreshRequest={gitRefreshRequest}
          appendPane={appendPane}
        />
        <div
          className={`resize-handle ${isResizing ? "is-resizing" : ""}`}
          style={{ left: sidebarWidth - 3 }}
          onMouseDown={startResizing}
        />
        <TerminalPanelContainer
          tabs={tabs}
          activeTabId={activeTabId}
          closeTab={closeTab}
          closePanesInTab={closePanesInTab}
          splitPaneInTab={splitPaneInTab}
          appendPane={appendPane}
          setActiveTabId={setActiveTabId}
          setActivePaneId={setActivePaneId}
        />
        {children}
      </div>
    </main>
  );
}
