import type { Meta, StoryObj } from "@storybook/react";
import { EmptyPane } from "../components/EmptyPane";
import type { PaneNode } from "../types/layout";
import type { RepoInfoDto } from "../types/git";
import type { WorktreeItem } from "../types/git-ui";

const meta = {
  title: "Components/EmptyPane",
  component: EmptyPane,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof EmptyPane>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Mock Data
// ============================================================================

const mockRepos: RepoInfoDto[] = [
  {
    repo_id: "repo-1",
    root_path: "/Users/zt/projects/main-project",
    name: "main-project",
    is_bare: false,
  },
  {
    repo_id: "repo-2",
    root_path: "/Users/zt/projects/feature-branch",
    name: "feature-branch",
    is_bare: false,
  },
];

const mockWorktreesByRepo: Record<string, WorktreeItem[]> = {
  "repo-1": [
    {
      branch: "feature-1",
      path: "/Users/zt/projects/main-project-feature-1",
      ahead: 2,
      behind: 0,
    },
    {
      branch: "feature-2",
      path: "/Users/zt/projects/main-project-feature-2",
      ahead: 0,
      behind: 1,
    },
  ],
};

// ============================================================================
// Basic Stories
// ============================================================================

const mockEmptyPane: PaneNode = {
  type: "pane",
  id: "empty-pane-1",
  paneType: "terminal",
  sessionId: "",
  isEmpty: true,
  meta: {
    title: "Empty Terminal Pane",
  },
};

export const Default: Story = {
  args: {
    pane: mockEmptyPane,
    onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      console.log(`Chose ${paneType} for pane ${paneId} with cwd: ${cwd}`);
    },
    repos: mockRepos,
    worktreesByRepo: mockWorktreesByRepo,
  },
  tags: ["basic"],
  description: "Shows the default empty pane state with Terminal and Agent options",
};

// ============================================================================
// Variations
// ============================================================================

export const EmptyAgentPane: Story = {
  args: {
    pane: {
      type: "pane",
      id: "empty-pane-2",
      paneType: "agent",
      sessionId: "",
      isEmpty: true,
      meta: {
        title: "Empty Agent Pane",
      },
    },
    onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      console.log(`Chose ${paneType} for pane ${paneId} with cwd: ${cwd}`);
    },
    repos: mockRepos,
    worktreesByRepo: mockWorktreesByRepo,
  },
  tags: ["variation"],
  description: "Shows an empty pane initialized for an agent",
};

export const EmptyPaneWithCwd: Story = {
  args: {
    pane: {
      type: "pane",
      id: "empty-pane-3",
      paneType: "terminal",
      sessionId: "",
      isEmpty: true,
      meta: {
        title: "Empty Terminal Pane",
        subtitle: "/Users/zt/projects/main-project",
        cwd: "/Users/zt/projects/main-project",
      },
    },
    onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      console.log(`Chose ${paneType} for pane ${paneId} with cwd: ${cwd}`);
    },
    repos: mockRepos,
    worktreesByRepo: mockWorktreesByRepo,
  },
  tags: ["variation"],
  description: "Shows an empty pane with working directory context preserved from split",
};

export const EmptyPaneNoMeta: Story = {
  args: {
    pane: {
      type: "pane",
      id: "empty-pane-4",
      paneType: "terminal",
      sessionId: "",
      isEmpty: true,
    },
    onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      console.log(`Chose ${paneType} for pane ${paneId} with cwd: ${cwd}`);
    },
    repos: mockRepos,
    worktreesByRepo: mockWorktreesByRepo,
  },
  tags: ["variation", "edge-case"],
  description: "Shows an empty pane without any metadata",
};

export const EmptyPaneNoRepos: Story = {
  args: {
    pane: mockEmptyPane,
    onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      console.log(`Chose ${paneType} for pane ${paneId} with cwd: ${cwd}`);
    },
    repos: [],
    worktreesByRepo: {},
  },
  tags: ["variation", "edge-case"],
  description: "Shows an empty pane when no repos are available",
};

// ============================================================================
// Interactive Story
// ============================================================================

export const Interactive: Story = {
  args: {
    pane: mockEmptyPane,
    onChoose: (paneId: string, paneType: "terminal" | "agent", cwd?: string) => {
      alert(`You chose: ${paneType === "terminal" ? "Terminal" : "Agent"} for pane ${paneId} with cwd: ${cwd || "default"}`);
    },
    repos: mockRepos,
    worktreesByRepo: mockWorktreesByRepo,
  },
  tags: ["interactive"],
  description: "Interactive example - click buttons or use keyboard shortcuts (T/A)",
};
