import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { BranchInfo } from "../types/agent";
import type { RepoStatusDto } from "../types/git";
import { formatInvokeError } from "../services/errors";
import { getString, remove, setString } from "../services/storage";
import { LAST_BRANCH_KEY, LAST_REPO_KEY } from "../services/storageKeys";
import { gitDetectRepo, gitListBranches, gitStatus } from "../services/tauri";

type UseRepoBindingOptions = {
  onBound?: (repoRoot: string) => void | Promise<void>;
  onBindFailed?: () => void | Promise<void>;
};

export function useRepoBinding(options?: UseRepoBindingOptions) {
  const [repoStatus, setRepoStatus] = useState<RepoStatusDto | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [baseBranch, setBaseBranch] = useState<string | null>(null);

  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState<BranchInfo[]>([]);
  const [branchSelection, setBranchSelection] = useState<string>("");
  const [pendingRepoPath, setPendingRepoPath] = useState<string | null>(null);

  const hasRestoredRepo = useRef(false);

  const resetRepoState = useCallback(() => {
    setRepoStatus(null);
    setBaseBranch(null);
  }, []);

  const clearBinding = useCallback(() => {
    resetRepoState();
    setRepoError(null);
    remove(LAST_REPO_KEY);
    remove(LAST_BRANCH_KEY);
  }, [resetRepoState]);

  const bindRepoPath = useCallback(
    async (repoRoot: string, branchName: string, silent?: boolean) => {
      if (!repoRoot || !branchName) return;
      setRepoError(null);
      setRepoLoading(true);
      try {
        const detected = await gitDetectRepo({ cwd: repoRoot });
        if (!detected) {
          resetRepoState();
          if (!silent) {
            setRepoError("Selected folder is not inside a git repository.");
            await options?.onBindFailed?.();
          }
          return;
        }

        const status = await gitStatus({ cwd: detected });
        const statusWithBranch = { ...status, branch: branchName };
        setRepoStatus(statusWithBranch);
        setBaseBranch(branchName);
        setRepoError(null);
        setString(LAST_REPO_KEY, detected);
        setString(LAST_BRANCH_KEY, branchName);
        await options?.onBound?.(detected);
      } catch (error) {
        if (!silent) {
          setRepoError(formatInvokeError(error) || "Failed to bind git repo.");
          resetRepoState();
          await options?.onBindFailed?.();
        }
      } finally {
        setRepoLoading(false);
      }
    },
    [options, resetRepoState]
  );

  const beginBindRepo = useCallback(async () => {
    setRepoError(null);
    setBranchOptions([]);
    setBranchSelection("");
    setPendingRepoPath(null);

    let pickedPath: string | null = null;
    try {
      const selection = await open({
        directory: true,
        multiple: false,
      });
      pickedPath = Array.isArray(selection) ? selection[0] : selection;
    } catch (error) {
      setRepoError(formatInvokeError(error) || "Failed to open folder picker.");
      return;
    }

    if (!pickedPath) return;

    try {
      const repoRoot = await gitDetectRepo({ cwd: pickedPath });
      if (!repoRoot) {
        setRepoError("Selected folder is not inside a git repository.");
        return;
      }
      const branches = await gitListBranches({ cwd: repoRoot });
      if (!branches.length) {
        setRepoError("No branches found in repository.");
        return;
      }
      setBranchOptions(branches);
      const current = branches.find((b) => b.current) ?? branches[0];
      setBranchSelection(current?.name ?? "");
      setPendingRepoPath(repoRoot);
      setBranchDialogOpen(true);
    } catch (error) {
      setRepoError(formatInvokeError(error) || "Failed to prepare branch selection.");
    }
  }, []);

  const cancelBindRepo = useCallback(() => {
    if (repoLoading) return;
    setBranchDialogOpen(false);
    setPendingRepoPath(null);
  }, [repoLoading]);

  const confirmBindRepo = useCallback(async () => {
    if (!pendingRepoPath || !branchSelection) {
      setRepoError("Select a branch to bind.");
      return;
    }
    setBranchDialogOpen(false);
    await bindRepoPath(pendingRepoPath, branchSelection);
    setPendingRepoPath(null);
  }, [bindRepoPath, branchSelection, pendingRepoPath]);

  useEffect(() => {
    if (hasRestoredRepo.current) return;
    const storedRepo = getString(LAST_REPO_KEY);
    const storedBranch = getString(LAST_BRANCH_KEY);
    hasRestoredRepo.current = true;
    if (storedRepo) {
      const restore = async () => {
        try {
          const repoRoot = await gitDetectRepo({ cwd: storedRepo });
          if (!repoRoot) return;
          let branch = storedBranch;
          if (!branch) {
            const branches = await gitListBranches({ cwd: repoRoot });
            const current = branches.find((b) => b.current) ?? branches[0];
            branch = current?.name ?? null;
          }
          if (branch) {
            await bindRepoPath(repoRoot, branch, true);
          }
        } catch (error) {
          console.error("Failed to restore repo binding", error);
        }
      };
      void restore();
    }
  }, [bindRepoPath]);

  return {
    repoStatus,
    repoError,
    setRepoError,
    repoLoading,
    baseBranch,
    resetRepoState,
    clearBinding,
    beginBindRepo,
    confirmBindRepo,
    cancelBindRepo,
    branchDialogOpen,
    branchOptions,
    branchSelection,
    setBranchSelection,
    pendingRepoPath,
  };
}
