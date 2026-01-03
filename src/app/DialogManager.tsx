import { ReactNode, useState } from "react";
import { GitErrorDialog } from "../components/dialogs/GitErrorDialog";
import { RebaseWorktreeGuardDialog } from "../components/dialogs/RebaseWorktreeGuardDialog";
import { SmartSwitchDialog } from "../components/dialogs/SmartSwitchDialog";
import { SquashCommitsDialog } from "../components/dialogs/SquashCommitsDialog";

export type GitCommandError = {
  title: string;
  message: string;
};

export interface DialogManagerState {
  smartSwitchDialog: {
    open: boolean;
    repoId: string;
    branchName: string;
  };
  squashDialog: {
    open: boolean;
    repoId: string;
    worktreePath: string;
    commitIds: string[];
  };
  rebaseGuardDialog: {
    open: boolean;
    repoId: string;
    targetBranch: string;
    ontoBranch: string;
    worktreePath: string;
    hasDirtyWorktree: boolean;
  };
}

export interface DialogManagerHandlers {
  setSmartSwitchDialog: (state: DialogManagerState["smartSwitchDialog"] | ((prev: DialogManagerState["smartSwitchDialog"]) => DialogManagerState["smartSwitchDialog"])) => void;
  setSquashDialog: (state: DialogManagerState["squashDialog"] | ((prev: DialogManagerState["squashDialog"]) => DialogManagerState["squashDialog"])) => void;
  setRebaseGuardDialog: (state: DialogManagerState["rebaseGuardDialog"] | ((prev: DialogManagerState["rebaseGuardDialog"]) => DialogManagerState["rebaseGuardDialog"])) => void;
}

export interface DialogManagerActions {
  onSmartSwitchForce: () => void;
  onSmartSwitchSmart: () => void;
  onSquashConfirm: () => void;
  onRebaseDetach: () => void;
}

interface DialogManagerProps {
  gitCommandError: GitCommandError | null;
  clearGitCommandError: () => void;
  dialogs: DialogManagerState;
  actions: DialogManagerActions;
  children: ReactNode;
}

export function DialogManager({
  gitCommandError,
  clearGitCommandError,
  dialogs,
  actions,
  children,
}: DialogManagerProps) {
  const { smartSwitchDialog, squashDialog, rebaseGuardDialog } = dialogs;

  return (
    <>
      {children}
      <GitErrorDialog
        open={Boolean(gitCommandError)}
        title={gitCommandError?.title}
        message={gitCommandError?.message ?? ""}
        onClose={clearGitCommandError}
      />
      <RebaseWorktreeGuardDialog
        open={rebaseGuardDialog.open}
        targetBranch={rebaseGuardDialog.targetBranch}
        ontoBranch={rebaseGuardDialog.ontoBranch}
        worktreePath={rebaseGuardDialog.worktreePath}
        hasDirtyWorktree={rebaseGuardDialog.hasDirtyWorktree}
        onClose={() => {
          actions.onRebaseDetach = () => {};
          // Will be handled by parent
        }}
        onConfirmDetach={actions.onRebaseDetach}
      />
      <SmartSwitchDialog
        open={smartSwitchDialog.open}
        branchName={smartSwitchDialog.branchName}
        onClose={() => {
          actions.onSmartSwitchForce = () => {};
          actions.onSmartSwitchSmart = () => {};
          // Will be handled by parent
        }}
        onConfirmForce={actions.onSmartSwitchForce}
        onConfirmSmart={actions.onSmartSwitchSmart}
      />
      <SquashCommitsDialog
        open={squashDialog.open}
        commitCount={squashDialog.commitIds.length}
        onClose={() => {
          actions.onSquashConfirm = () => {};
          // Will be handled by parent
        }}
        onConfirm={actions.onSquashConfirm}
      />
    </>
  );
}

export function useDialogManager(): [
  DialogManagerState,
  DialogManagerHandlers,
  DialogManagerActions
] {
  const [smartSwitchDialog, setSmartSwitchDialog] = useState<
    DialogManagerState["smartSwitchDialog"]
  >({
    open: false,
    repoId: "",
    branchName: "",
  });

  const [squashDialog, setSquashDialog] = useState<
    DialogManagerState["squashDialog"]
  >({
    open: false,
    repoId: "",
    worktreePath: "",
    commitIds: [],
  });

  const [rebaseGuardDialog, setRebaseGuardDialog] = useState<
    DialogManagerState["rebaseGuardDialog"]
  >({
    open: false,
    repoId: "",
    targetBranch: "",
    ontoBranch: "",
    worktreePath: "",
    hasDirtyWorktree: false,
  });

  const actions: DialogManagerActions = {
    onSmartSwitchForce: () => {},
    onSmartSwitchSmart: () => {},
    onSquashConfirm: () => {},
    onRebaseDetach: () => {},
  };

  const dialogs = { smartSwitchDialog, squashDialog, rebaseGuardDialog };
  const handlers = { setSmartSwitchDialog, setSquashDialog, setRebaseGuardDialog };

  return [dialogs, handlers, actions];
}
