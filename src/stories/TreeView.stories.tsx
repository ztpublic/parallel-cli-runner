import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TreeView } from "../components/TreeView";
import type { TreeNode } from "../types/tree";

const sampleNodes: TreeNode[] = [
  {
    id: "repo-alpha",
    label: "repo-alpha",
    description: "/home/user/projects/repo-alpha",
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">3</span>,
    children: [
      {
        id: "repo-alpha:local",
        label: "Local Branches",
        icon: "branch",
        defaultExpanded: true,
        selectable: false,
        rightSlot: <span className="git-pill">2</span>,
        actions: [{ id: "new-branch", icon: "plus", label: "New Branch" }],
        children: [
          {
            id: "repo-alpha:local:main",
            label: "main",
            description: "Latest commit 2 hours ago",
            icon: "branch",
            rightSlot: <span className="git-badge">current</span>,
            actions: [
              { id: "merge", icon: "merge", label: "Merge" },
              { id: "delete", icon: "trash", label: "Delete", intent: "danger" },
            ],
            contextMenu: [
              { id: "checkout", label: "Checkout", icon: "branch" },
              { id: "rename", label: "Rename" },
              { id: "delete", label: "Delete", icon: "trash" },
            ],
          },
          {
            id: "repo-alpha:local:feature-ui",
            label: "feature/ui",
            description: "Latest commit yesterday",
            icon: "branch",
            actions: [{ id: "merge", icon: "merge", label: "Merge" }],
          },
        ],
      },
      {
        id: "repo-alpha:remote",
        label: "Remote Branches",
        icon: "cloud",
        defaultExpanded: true,
        selectable: false,
        rightSlot: <span className="git-pill">1</span>,
        children: [
          {
            id: "repo-alpha:remote:origin/main",
            label: "origin/main",
            description: "Latest commit 2 days ago",
            icon: "cloud",
            actions: [{ id: "open-pr", icon: "pull", label: "Open PR" }],
          },
        ],
      },
    ],
  },
  {
    id: "repo-beta",
    label: "repo-beta",
    description: "/home/user/projects/repo-beta",
    icon: "folder",
    defaultExpanded: true,
    selectable: false,
    rightSlot: <span className="git-pill">2</span>,
    children: [
      {
        id: "repo-beta:commit:1",
        label: "Fix selection logic in tree view",
        description: "Alex - 2 hours ago",
        icon: "commit",
        rightSlot: <span className="git-hash">a1b2c3d</span>,
      },
      {
        id: "repo-beta:commit:2",
        label: "Add context menu actions",
        description: "Maya - yesterday",
        icon: "commit",
        rightSlot: <span className="git-hash">d4e5f6a</span>,
      },
    ],
  },
];

const meta = {
  title: "Components/TreeView",
  component: TreeView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSelect: Story = {
  args: {
    nodes: sampleNodes,
  },
  render: () => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <TreeView
          nodes={sampleNodes}
          selectionMode="single"
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          toggleOnRowClick
        />
      </div>
    );
  },
};

export const MultiSelect: Story = {
  args: {
    nodes: sampleNodes,
  },
  render: () => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <TreeView
          nodes={sampleNodes}
          selectionMode="multiple"
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          toggleOnRowClick
        />
      </div>
    );
  },
};
