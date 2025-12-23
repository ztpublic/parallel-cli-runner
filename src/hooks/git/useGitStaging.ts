import { useMemo, useState } from "react";
import { ChangedFile } from "../../types/git-ui";

export function useGitStaging(changedFiles: ChangedFile[]) {
  const [commitMessage, setCommitMessage] = useState("");

  const stagedFiles = useMemo(
    () => changedFiles.filter((file) => file.staged),
    [changedFiles]
  );
  const unstagedFiles = useMemo(
    () => changedFiles.filter((file) => !file.staged),
    [changedFiles]
  );

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
    commitMessage,
    setCommitMessage,
    stagedFiles,
    unstagedFiles,
    generateCommitMessage,
  };
}
