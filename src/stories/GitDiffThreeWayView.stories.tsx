import type { Meta, StoryObj } from "@storybook/react";
import { GitDiffThreeWayView } from "../components/git/GitDiffThreeWayView";
import {
  BASE_TEXT,
  LEFT_TEXT,
  RIGHT_TEXT,
  BASE_CONFLICT,
  LEFT_CONFLICT,
  RIGHT_CONFLICT,
  BASE_LONG,
  LEFT_LONG,
  RIGHT_LONG,
} from "./gitDiffStoryData";

const meta = {
  title: "Components/GitDiffThreeWayView",
  component: GitDiffThreeWayView,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    languageId: {
      control: { type: "select" },
      options: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "md",
        "py",
        "rs",
        "css",
        "html",
        "yaml",
        "cpp",
        "go",
        "java",
      ],
    },
    highlightTheme: {
      control: { type: "inline-radio" },
      options: ["vscode-dark", "monokai", "dracula"],
    },
    syncScroll: {
      control: { type: "boolean" },
    },
  },
} satisfies Meta<typeof GitDiffThreeWayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeWay: Story = {
  args: {
    baseText: BASE_TEXT,
    leftText: LEFT_TEXT,
    rightText: RIGHT_TEXT,
    languageId: "ts",
    filePath: "src/api/client.ts",
    highlightTheme: "vscode-dark",
    syncScroll: true,
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffThreeWayView {...args} />
    </div>
  ),
};

export const ConflictExample: Story = {
  args: {
    baseText: BASE_CONFLICT,
    leftText: LEFT_CONFLICT,
    rightText: RIGHT_CONFLICT,
    languageId: "ts",
    filePath: "src/theme.ts",
    highlightTheme: "vscode-dark",
    syncScroll: true,
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffThreeWayView {...args} />
    </div>
  ),
};

export const LongComplexDiff: Story = {
  args: {
    baseText: BASE_LONG,
    leftText: LEFT_LONG,
    rightText: RIGHT_LONG,
    languageId: "ts",
    filePath: "src/theme.ts",
    highlightTheme: "vscode-dark",
    syncScroll: true,
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffThreeWayView {...args} />
    </div>
  ),
};
