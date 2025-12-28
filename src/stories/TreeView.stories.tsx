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

const checkableNodes: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: "folder",
    defaultExpanded: true,
    checkable: true,
    children: [
      {
        id: "src/components",
        label: "components",
        icon: "folder",
        checkable: true,
        children: [
          { id: "src/components/Button.tsx", label: "Button.tsx", icon: "fileEdit", checkable: true },
          { id: "src/components/Input.tsx", label: "Input.tsx", icon: "fileEdit", checkable: true },
        ],
      },
      { id: "src/App.tsx", label: "App.tsx", icon: "fileEdit", checkable: true },
      { id: "src/index.tsx", label: "index.tsx", icon: "fileEdit", checkable: true },
    ],
  },
  {
    id: "public",
    label: "public",
    icon: "folder",
    checkable: true,
    children: [
      { id: "public/index.html", label: "index.html", icon: "fileEdit", checkable: true },
      { id: "public/favicon.ico", label: "favicon.ico", icon: "fileEdit", checkable: true },
    ],
  },
];

const loadMoreNodes: TreeNode[] = [
  {
    id: "commits",
    label: "Commits",
    icon: "folder",
    defaultExpanded: true,
    children: [
      { id: "c1", label: "Initial commit", icon: "commit" },
      { id: "c2", label: "Update README", icon: "commit" },
      { id: "load-more", label: "Load More...", variant: "load-more", isLoading: false },
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
    selectionMode: "single",
    toggleOnRowClick: true,
  },
  render: (args) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <h3>Single Selection</h3>
        <TreeView
          {...args}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
        <div style={{ marginTop: 16, fontSize: 12 }}>
          Selected: {JSON.stringify(selectedIds)}
        </div>
      </div>
    );
  },
};

export const MultiSelect: Story = {
  args: {
    nodes: sampleNodes,
    selectionMode: "multiple",
    toggleOnRowClick: true,
  },
  render: (args) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <h3>Multiple Selection (Cmd/Ctrl+Click, Shift+Click)</h3>
        <TreeView
          {...args}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
        <div style={{ marginTop: 16, fontSize: 12 }}>
          Selected: {JSON.stringify(selectedIds)}
        </div>
      </div>
    );
  },
};

export const WithCheckboxes: Story = {
  args: {
    nodes: checkableNodes,
    selectionMode: "single",
    toggleOnRowClick: true,
  },
  render: (args) => {
    const [checkedIds, setCheckedIds] = useState<string[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <h3>Checkboxes (Independent of Selection)</h3>
        <TreeView
          {...args}
          checkedIds={checkedIds}
          onCheckChange={setCheckedIds}
        />
        <div style={{ marginTop: 16, fontSize: 12 }}>
          Checked: {JSON.stringify(checkedIds)}
        </div>
      </div>
    );
  },
};

export const WithAutoCheckChildren: Story = {
  args: {
    nodes: checkableNodes,
    selectionMode: "single",
    autoCheckChildren: true,
    toggleOnRowClick: true,
  },
  render: (args) => {
    const [checkedIds, setCheckedIds] = useState<string[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <h3>Checkboxes with Auto-Check Children</h3>
        <p style={{fontSize: 12, marginBottom: 12}}>Checking a parent automatically checks all its descendants.</p>
        <TreeView
          {...args}
          checkedIds={checkedIds}
          onCheckChange={setCheckedIds}
        />
        <div style={{ marginTop: 16, fontSize: 12 }}>
          Checked: {JSON.stringify(checkedIds)}
        </div>
      </div>
    );
  },
};

export const LoadMore: Story = {
  args: {
    nodes: loadMoreNodes,
    selectionMode: "single",
    toggleOnRowClick: true,
  },
  render: (args) => {
    const [nodes, setNodes] = useState(args.nodes);
    
    const handleActivate = (node: TreeNode) => {
      if (node.variant === "load-more") {
        // Simulate loading state
        setNodes(prev => {
          const newNodes = [...prev];
          const commits = newNodes[0];
          if (commits.children) {
             const loadMoreIndex = commits.children.findIndex(c => c.id === "load-more");
             if (loadMoreIndex !== -1) {
               commits.children[loadMoreIndex] = { ...commits.children[loadMoreIndex], isLoading: true };
             }
          }
          return newNodes;
        });

        setTimeout(() => {
          setNodes(prev => {
            const newNodes = [...prev];
            const commits = newNodes[0];
            if (commits.children) {
               // Remove load more, add items
               const currentCount = commits.children.length - 1; // minus load more
               const newItems = [
                 { id: `c${currentCount + 1}`, label: `Commit ${currentCount + 1}`, icon: "commit" as const },
                 { id: `c${currentCount + 2}`, label: `Commit ${currentCount + 2}`, icon: "commit" as const },
                 { id: "load-more", label: "Load More...", variant: "load-more" as const, isLoading: false }
               ];
               // Replace load more with new items
               commits.children.splice(commits.children.length - 1, 1, ...newItems);
            }
            return newNodes;
          });
        }, 1000);
      }
    };

    return (
      <div style={{ padding: 24 }}>
        <h3>Load More Example</h3>
        <TreeView
          {...args}
          nodes={nodes}
          onNodeActivate={handleActivate}
        />
      </div>
    );
  },
};