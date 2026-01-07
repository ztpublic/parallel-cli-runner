import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { AppLayout } from "./app/AppLayout";
import { RepoManager } from "./app/RepoManager";
import { useDialogManager } from "./app/DialogManager";
import { GitErrorDialog } from "./components/dialogs/GitErrorDialog";
import { RebaseWorktreeGuardDialog } from "./components/dialogs/RebaseWorktreeGuardDialog";
import { SmartSwitchDialog } from "./components/dialogs/SmartSwitchDialog";
import { SquashCommitsDialog } from "./components/dialogs/SquashCommitsDialog";
import { AcpModal } from "./components/AcpModal";
import { useGitRepos } from "./hooks/git/useGitRepos";
import { useGitCommandErrorDialog } from "./hooks/git/useGitCommandErrorDialog";

function App() {
  const [isAcpModalOpen, setIsAcpModalOpen] = useState(false);

  const {
    repos,
    setRepos,
    refreshRepos,
    rebaseBranch,
    checkoutBranchAtPath,
    detachWorktreeHead,
    switchBranch,
    smartSwitchBranch,
    squashCommits,
    worktreesByRepo,
  } = useGitRepos();
  const { gitCommandError, clearGitCommandError, runGitCommand } = useGitCommandErrorDialog();
  const [gitRefreshRequest, setGitRefreshRequest] = useState<{
    seq: number;
    repoId: string | null;
  }>({ seq: 0, repoId: null });
  const [dialogs, dialogHandlers, dialogActions] = useDialogManager();

  // Refresh repos when repos change
  useEffect(() => {
    if (repos.length > 0) {
      void refreshRepos();
    }
  }, [repos, refreshRepos]);

  // Handle rebase with worktree guard
  const handleRebaseBranch = useCallback(
    (repoId: string, targetBranch: string, ontoBranch: string) => {
      const triggerRefresh = () => {
        setGitRefreshRequest((prev) => ({
          seq: prev.seq + 1,
          repoId,
        }));
      };
      const repo = repos.find((entry) => entry.repo_id === repoId);
      const worktrees = worktreesByRepo[repoId] ?? [];
      const linkedWorktree = repo
        ? worktrees.find(
            (worktree) =>
              worktree.branch === targetBranch && worktree.path !== repo.root_path
          )
        : undefined;

      if (linkedWorktree) {
        void runGitCommand(
          "Rebase failed",
          "Failed to detach the other worktree and rebase the branch.",
          async () => {
            await detachWorktreeHead(repoId, linkedWorktree.path);
            await rebaseBranch(repoId, targetBranch, ontoBranch);
            await checkoutBranchAtPath(repoId, linkedWorktree.path, targetBranch);
            triggerRefresh();
          }
        );
        return;
      }

      void runGitCommand(
        "Rebase failed",
        "Failed to rebase branch.",
        async () => {
          await rebaseBranch(repoId, targetBranch, ontoBranch);
          triggerRefresh();
        }
      );
    },
    [checkoutBranchAtPath, detachWorktreeHead, rebaseBranch, repos, runGitCommand, worktreesByRepo]
  );

  // Handle switch branch with smart switch dialog
  const handleSwitchBranchWithCheck = useCallback(
    (repoId: string, branchName: string) => {
      dialogHandlers.setSmartSwitchDialog({ open: true, repoId, branchName });
      dialogActions.onSmartSwitchForce = () => {
        void runGitCommand("Switch branch failed", "Failed to force switch branch.", () =>
          switchBranch(repoId, branchName)
        );
        dialogHandlers.setSmartSwitchDialog({ open: false, repoId: "", branchName: "" });
      };
      dialogActions.onSmartSwitchSmart = () => {
        void runGitCommand("Smart switch failed", "Failed to smart switch branch.", () =>
          smartSwitchBranch(repoId, branchName)
        );
        dialogHandlers.setSmartSwitchDialog({ open: false, repoId: "", branchName: "" });
      };
    },
    [dialogActions, dialogHandlers, runGitCommand, smartSwitchBranch, switchBranch]
  );

  // Handle squash commits with remote check
  const handleSquashCommitsWithCheck = useCallback(
    (repoId: string, worktreePath: string, commitIds: string[]) => {
      dialogHandlers.setSquashDialog({ open: true, repoId, worktreePath, commitIds });
      dialogActions.onSquashConfirm = () => {
        void runGitCommand("Squash failed", "Failed to squash commits.", () =>
          squashCommits(repoId, commitIds, worktreePath)
        );
        dialogHandlers.setSquashDialog({ open: false, repoId: "", worktreePath: "", commitIds: [] });
      };
    },
    [dialogActions, dialogHandlers, runGitCommand, squashCommits]
  );

  // Handle rebase guard dialog confirm
  const handleRebaseGuardConfirm = useCallback(() => {
    const { repoId, targetBranch, ontoBranch, worktreePath } = dialogs.rebaseGuardDialog;
    if (!repoId || !targetBranch || !ontoBranch || !worktreePath) return;
    void runGitCommand(
      "Rebase failed",
      "Failed to detach the other worktree and rebase the branch.",
      async () => {
        await detachWorktreeHead(repoId, worktreePath);
        await rebaseBranch(repoId, targetBranch, ontoBranch);
        await checkoutBranchAtPath(repoId, worktreePath, targetBranch);
      }
    );
  }, [checkoutBranchAtPath, detachWorktreeHead, dialogs.rebaseGuardDialog, rebaseBranch, runGitCommand]);

  return (
    <RepoManager repos={repos} setRepos={setRepos}>
      {(repoState, repoHandlers) => (
        <AppLayout
          repos={repos}
          enabledRepoIds={repoState.enabledRepoIds}
          setEnabledRepoIds={repoHandlers.setEnabledRepoIds}
          setRepos={repoHandlers.setRepos}
          onRemoveRepo={repoHandlers.handleRemoveRepo}
          onTriggerOpenFolder={repoHandlers.handleTriggerOpenFolder}
          onRebaseBranch={handleRebaseBranch}
          onSwitchBranchWithCheck={handleSwitchBranchWithCheck}
          onSquashCommitsWithCheck={handleSquashCommitsWithCheck}
          gitRefreshRequest={gitRefreshRequest}
        >
          {/* ACP AI Agent Modal */}
          <AcpModal
            open={isAcpModalOpen}
            onClose={() => setIsAcpModalOpen(false)}
          />

          {/* Floating button to open ACP Agent */}
          <button
            type="button"
            onClick={() => setIsAcpModalOpen(true)}
            className="fixed bottom-6 right-6 z-40 px-4 py-2 bg-[--accent] hover:bg-[--accent-strong] text-white rounded-lg shadow-lg transition-colors font-medium flex items-center gap-2"
            title="Open AI Agent"
          >
            <span>AI Agent</span>
          </button>

          {/* Dialogs */}
          <GitErrorDialog
            open={Boolean(gitCommandError)}
            title={gitCommandError?.title}
            message={gitCommandError?.message ?? ""}
            onClose={clearGitCommandError}
          />
          <RebaseWorktreeGuardDialog
            open={dialogs.rebaseGuardDialog.open}
            targetBranch={dialogs.rebaseGuardDialog.targetBranch}
            ontoBranch={dialogs.rebaseGuardDialog.ontoBranch}
            worktreePath={dialogs.rebaseGuardDialog.worktreePath}
            hasDirtyWorktree={dialogs.rebaseGuardDialog.hasDirtyWorktree}
            onClose={() => dialogHandlers.setRebaseGuardDialog((prev) => ({ ...prev, open: false }))}
            onConfirmDetach={handleRebaseGuardConfirm}
          />
          <SmartSwitchDialog
            open={dialogs.smartSwitchDialog.open}
            branchName={dialogs.smartSwitchDialog.branchName}
            onClose={() => dialogHandlers.setSmartSwitchDialog((prev) => ({ ...prev, open: false }))}
            onConfirmForce={dialogActions.onSmartSwitchForce}
            onConfirmSmart={dialogActions.onSmartSwitchSmart}
          />
          <SquashCommitsDialog
            open={dialogs.squashDialog.open}
            commitCount={dialogs.squashDialog.commitIds.length}
            onClose={() => dialogHandlers.setSquashDialog((prev) => ({ ...prev, open: false }))}
            onConfirm={dialogActions.onSquashConfirm}
          />
        </AppLayout>
      )}
    </RepoManager>
  );
}

export default App;
