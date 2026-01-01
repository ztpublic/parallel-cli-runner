import { Icon } from "../Icons";
import { TreeView } from "../TreeView";
import type { RepoGroup, SubmoduleItem } from "../../types/git-ui";
import type { TreeNode } from "../../types/tree";

type GitSubmodulesProps = {
  submoduleGroups: RepoGroup<SubmoduleItem>[];
};

export function GitSubmodules({ submoduleGroups }: GitSubmodulesProps) {
  const nodes: TreeNode[] = submoduleGroups.map((group) => ({
    id: group.repo.repoId,
    label: group.repo.name,
    description: group.repo.path,
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">{group.items.length}</span>,
    children: group.items.map((submodule) => ({
      id: `${group.repo.repoId}:submodule:${submodule.path}`,
      label: submodule.name || submodule.path,
      description: submodule.url
        ? `${submodule.path} • ${submodule.url}`
        : submodule.path,
      icon: "merge",
    })),
  }));

  return (
    <div className="git-tree">
      <TreeView nodes={nodes} />
      {!submoduleGroups.length ? (
        <div className="git-empty">
          <Icon name="merge" size={22} />
          <p>No submodules configured.</p>
        </div>
      ) : null}
    </div>
  );
}
