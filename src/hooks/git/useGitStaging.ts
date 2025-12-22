import { useState } from "react";
import { ChangedFile } from "../../types/git-ui";

export function useGitStaging(initialFiles: ChangedFile[]) {
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>(initialFiles);
  const [commitMessage, setCommitMessage] = useState("");

  const stagedFiles = changedFiles.filter((file) => file.staged);
  const unstagedFiles = changedFiles.filter((file) => !file.staged);

  const toggleFileStage = (path: string) => {
    setChangedFiles((files) =>
      files.map((file) => (file.path === path ? { ...file, staged: !file.staged } : file))
    );
  };

  const stageAllFiles = () => {
    setChangedFiles((files) => files.map((file) => ({ ...file, staged: true })));
  };

  const unstageAllFiles = () => {
    setChangedFiles((files) => files.map((file) => ({ ...file, staged: false })));
  };

  const generateCommitMessage = () => {
    if (!stagedFiles.length) return;
    const added = stagedFiles.filter((file) => file.status === "added").length;
    const modified = stagedFiles.filter((file) => file.status === "modified").length;
    const deleted = stagedFiles.filter((file) => file.status === "deleted").length;

    const parts: string[] = [];
    if (added) parts.push(`Add ${added} file${added === 1 ? "" : "s"}`);
    if (modified) parts.push(`Update ${modified} file${modified === 1 ? "" : "s"}`);
    if (deleted) parts.push(`Delete ${deleted} file${deleted === 1 ? "" : "s"}`);

    let message = parts.join(", ");
    if (stagedFiles.length <= 3) {
      const fileList = stagedFiles
        .map((file) => file.path.split("/").pop() || file.path)
        .map((name) => `- ${name}`)
        .join("\n");
      message = `${message}\n\n${fileList}`;
    }

    setCommitMessage(message);
  };

  return {
    changedFiles,
    commitMessage,
    setCommitMessage,
    stagedFiles,
    unstagedFiles,
    toggleFileStage,
    stageAllFiles,
    unstageAllFiles,
    generateCommitMessage,
  };
}
