import { ReactNode, useCallback, useEffect, useState } from "react";
import { gitScanRepos } from "../services/backend";
import { formatInvokeError } from "../services/errors";
import { openDialog } from "../platform/actions";
import { getAppConfig } from "../platform/config";
import { RepoPickerModal } from "../components/RepoPickerModal";
import { ScanProgressModal } from "../components/ScanProgressModal";
import type { RepoInfoDto } from "../types/git";

export interface RepoManagerState {
  repoCandidates: RepoInfoDto[];
  selectedRepoIds: string[];
  isRepoPickerOpen: boolean;
  isScanning: boolean;
  repoScanError: string | null;
  enabledRepoIds: string[];
  autoOpenedWorkspace: boolean;
}

export interface RepoManagerHandlers {
  setRepoCandidates: (repos: RepoInfoDto[]) => void;
  setSelectedRepoIds: (ids: string[]) => void;
  setIsRepoPickerOpen: (open: boolean) => void;
  setEnabledRepoIds: (ids: string[]) => void;
  setRepos: (repos: RepoInfoDto[]) => void;
  handleOpenFolder: (path: string) => Promise<void>;
  handleTriggerOpenFolder: () => Promise<void>;
  handleToggleRepo: (repoId: string) => void;
  handleSelectAllRepos: () => void;
  handleClearRepos: () => void;
  handleConfirmRepos: () => void;
  handleCloseRepoPicker: () => void;
  handleRemoveRepo: (repoId: string) => void;
}

interface RepoManagerProps {
  repos: RepoInfoDto[];
  setRepos: (repos: RepoInfoDto[]) => void;
  children: (state: RepoManagerState, handlers: RepoManagerHandlers) => ReactNode;
}

export function RepoManager({ repos, setRepos, children }: RepoManagerProps) {
  const [repoCandidates, setRepoCandidates] = useState<RepoInfoDto[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [repoScanError, setRepoScanError] = useState<string | null>(null);
  const [enabledRepoIds, setEnabledRepoIds] = useState<string[]>([]);
  const [autoOpenedWorkspace, setAutoOpenedWorkspace] = useState(false);

  const handleOpenFolder = useCallback(async (path: string) => {
    setRepoScanError(null);
    setIsScanning(true);
    try {
      const repos = await gitScanRepos({ cwd: path });
      setRepoCandidates(repos);
      setSelectedRepoIds(repos.map((repo) => repo.repo_id));
      setIsRepoPickerOpen(true);
    } catch (err) {
      const message = formatInvokeError(err);
      setRepoScanError(message === "Unexpected error." ? "Failed to scan repos." : message);
      setRepoCandidates([]);
      setSelectedRepoIds([]);
      // Still open the picker to show the error
      setIsRepoPickerOpen(true);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleTriggerOpenFolder = useCallback(async () => {
    try {
      const selection = await openDialog({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });
      if (typeof selection === "string") {
        void handleOpenFolder(selection);
      } else if (Array.isArray(selection) && selection[0]) {
        void handleOpenFolder(selection[0]);
      }
    } catch (error) {
      console.error("Failed to open folder picker", error);
    }
  }, [handleOpenFolder]);

  const handleToggleRepo = useCallback((repoId: string) => {
    setSelectedRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  }, []);

  const handleSelectAllRepos = useCallback(() => {
    setSelectedRepoIds(repoCandidates.map((repo) => repo.repo_id));
  }, [repoCandidates]);

  const handleClearRepos = useCallback(() => {
    setSelectedRepoIds([]);
  }, []);

  const handleConfirmRepos = useCallback(() => {
    const selected = repoCandidates.filter((repo) =>
      selectedRepoIds.includes(repo.repo_id)
    );
    setRepos(selected);
    setEnabledRepoIds(selected.map((r) => r.repo_id));
    setIsRepoPickerOpen(false);
  }, [repoCandidates, selectedRepoIds, setRepos]);

  const handleCloseRepoPicker = useCallback(() => {
    setIsRepoPickerOpen(false);
  }, []);

  const handleRemoveRepo = useCallback((repoId: string) => {
    setRepos(repos.filter((r) => r.repo_id !== repoId));
    setEnabledRepoIds((prev) => prev.filter((id) => id !== repoId));
  }, [repos, setRepos]);

  // Auto-open workspace from config
  useEffect(() => {
    if (autoOpenedWorkspace) return;
    if (repos.length > 0 || isRepoPickerOpen || isScanning) return;
    const { workspacePath } = getAppConfig();
    if (!workspacePath) return;
    setAutoOpenedWorkspace(true);
    void handleOpenFolder(workspacePath);
  }, [autoOpenedWorkspace, handleOpenFolder, isRepoPickerOpen, isScanning, repos.length]);

  const state: RepoManagerState = {
    repoCandidates,
    selectedRepoIds,
    isRepoPickerOpen,
    isScanning,
    repoScanError,
    enabledRepoIds,
    autoOpenedWorkspace,
  };

  const handlers: RepoManagerHandlers = {
    setRepoCandidates,
    setSelectedRepoIds,
    setIsRepoPickerOpen,
    setEnabledRepoIds,
    setRepos,
    handleOpenFolder,
    handleTriggerOpenFolder,
    handleToggleRepo,
    handleSelectAllRepos,
    handleClearRepos,
    handleConfirmRepos,
    handleCloseRepoPicker,
    handleRemoveRepo,
  };

  return (
    <>
      {children(state, handlers)}
      <ScanProgressModal open={isScanning} />
      <RepoPickerModal
        open={isRepoPickerOpen}
        repos={repoCandidates}
        selectedRepoIds={selectedRepoIds}
        error={repoScanError}
        onToggleRepo={handleToggleRepo}
        onSelectAll={handleSelectAllRepos}
        onClear={handleClearRepos}
        onConfirm={handleConfirmRepos}
        onClose={handleCloseRepoPicker}
      />
    </>
  );
}
