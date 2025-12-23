import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createPaneNode, killLayoutSessions } from "./services/sessions";
import { useLayoutState } from "./hooks/useLayoutState";
import { useClosePaneHotkey } from "./hooks/useHotkeys";
import { collectPanes } from "./types/layout";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
import { GitPanel } from "./components/GitPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { useGitRepo } from "./hooks/git/useGitRepo";

function App() {
  const {
    layout,
    setLayout,
    activePaneId,
    setActivePaneId,
    appendPane,
    closePane,
    closeActivePane,
  } = useLayoutState();

  useClosePaneHotkey(closeActivePane);

  // Track layout for cleanup
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const {
    repoRoot,
    status,
    localBranches,
    remoteBranches,
    commits,
    worktrees,
    remotes,
    changedFiles,
    loading: gitLoading,
    error: gitError,
    refresh: refreshGit,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    commit,
  } = useGitRepo();

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

  useEffect(() => {
    let alive = true;
    let initialNode: any = null;

    const start = async () => {
      const next = await createPaneNode({
        meta: {
          title: "Local session",
        },
      });
      initialNode = next;

      if (!alive) {
        void killLayoutSessions(next);
        return;
      }
      setLayout(next);
      setActivePaneId(next.id);
    };

    void start();

    return () => {
      alive = false;
      // If we unmount before setting layout, kill the initial node
      if (initialNode && !layoutRef.current) {
        void killLayoutSessions(initialNode);
      }
    };
  }, [setLayout, setActivePaneId]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      if (layoutRef.current) {
        void killLayoutSessions(layoutRef.current);
      }
    };
  }, []);

  const panes = useMemo(() => collectPanes(layout), [layout]);

  const handleNewPane = useCallback(async () => {
    const nextIndex = panes.length + 1;
    const next = await createPaneNode({
      meta: {
        title: `Terminal ${nextIndex}`,
      },
    });
    appendPane(next);
  }, [appendPane, panes.length]);

  return (
    <main className="app-shell">
      <TopBar />
      <div className="workspace" style={{ position: "relative" }}>
        <GitPanel
          width={sidebarWidth}
          repoRoot={repoRoot}
          loading={gitLoading}
          error={gitError}
          localBranches={localBranches}
          remoteBranches={remoteBranches}
          commits={commits}
          worktrees={worktrees}
          remotes={remotes}
          changedFiles={changedFiles}
          onRefresh={() => void refreshGit()}
          onStageAll={() => void stageAll()}
          onUnstageAll={() => void unstageAll()}
          onStageFile={(path) => void stageFiles([path])}
          onUnstageFile={(path) => void unstageFiles([path])}
          onCommit={(message) => void commit(message)}
        />
        <div
          className={`resize-handle ${isResizing ? "is-resizing" : ""}`}
          style={{ left: sidebarWidth - 3 }}
          onMouseDown={startResizing}
        />
        <TerminalPanel
          layout={layout}
          panes={panes}
          activePaneId={activePaneId}
          onSetActivePane={setActivePaneId}
          onClosePane={(id) => void closePane(id)}
          onNewPane={() => void handleNewPane()}
        />
      </div>
      <StatusBar branch={status?.branch ?? "No repo"} errors={0} warnings={3} />
    </main>
  );
}

export default App;
