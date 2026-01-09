import type { Meta, StoryObj } from "@storybook/react";
import { EmptyPane } from "../components/EmptyPane";
import type { PaneNode } from "../types/layout";

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
    onChoose: (paneId: string, paneType: "terminal" | "agent") => {
      console.log(`Chose ${paneType} for pane ${paneId}`);
    },
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
    onChoose: (paneId: string, paneType: "terminal" | "agent") => {
      console.log(`Chose ${paneType} for pane ${paneId}`);
    },
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
        subtitle: "/Users/zt/projects/parallel-cli-runner-claude-feature",
        cwd: "/Users/zt/projects/parallel-cli-runner-claude-feature",
      },
    },
    onChoose: (paneId: string, paneType: "terminal" | "agent") => {
      console.log(`Chose ${paneType} for pane ${paneId}`);
    },
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
    onChoose: (paneId: string, paneType: "terminal" | "agent") => {
      console.log(`Chose ${paneType} for pane ${paneId}`);
    },
  },
  tags: ["variation", "edge-case"],
  description: "Shows an empty pane without any metadata",
};

// ============================================================================
// Interactive Story
// ============================================================================

export const Interactive: Story = {
  args: {
    pane: mockEmptyPane,
    onChoose: (paneId: string, paneType: "terminal" | "agent") => {
      alert(`You chose: ${paneType === "terminal" ? "Terminal" : "Agent"} for pane ${paneId}`);
    },
  },
  tags: ["interactive"],
  description: "Interactive example - click buttons or use keyboard shortcuts (T/A)",
};
