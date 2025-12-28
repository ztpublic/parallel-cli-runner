import type { Meta, StoryObj } from "@storybook/react";
import { GitDiffTwoWayView } from "../components/git/GitDiffTwoWayView";
import { BASE_TEXT, COMPARE_TEXT } from "./gitDiffStoryData";

const meta = {
  title: "Components/GitDiffTwoWayView",
  component: GitDiffTwoWayView,
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
  },
} satisfies Meta<typeof GitDiffTwoWayView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoWay: Story = {
  args: {
    baseText: BASE_TEXT,
    compareText: COMPARE_TEXT,
    languageId: "ts",
    filePath: "src/api/client.ts",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffTwoWayView {...args} />
    </div>
  ),
};

export const Empty: Story = {
  args: {
    baseText: "",
    compareText: "",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffTwoWayView {...args} />
    </div>
  ),
};

export const JsonHighlight: Story = {
  args: {
    baseText: `{
  "name": "parallel-cli-runner",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "storybook": "storybook dev -p 6006"
  }
}
`,
    compareText: `{
  "name": "parallel-cli-runner",
  "private": true,
  "version": "0.2.0",
  "scripts": {
    "dev": "vite",
    "storybook": "storybook dev -p 6006",
    "build": "tsc && vite build"
  }
}
`,
    languageId: "json",
    filePath: "package.json",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffTwoWayView {...args} />
    </div>
  ),
};

export const ThemeGallery: Story = {
  args: {
    baseText: BASE_TEXT,
    compareText: COMPARE_TEXT,
    languageId: "ts",
    filePath: "src/api/client.ts",
  },
  render: (args) => (
    <div
      style={{
        height: "100vh",
        padding: "24px",
        display: "grid",
        gap: "16px",
        gridTemplateRows: "repeat(3, minmax(0, 1fr))",
      }}
    >
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "8px" }}>
        <div style={{ color: "#9aa3b2", fontSize: "12px", letterSpacing: "0.08em" }}>
          VS Code Dark+
        </div>
        <GitDiffTwoWayView {...args} highlightTheme="vscode-dark" />
      </div>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "8px" }}>
        <div style={{ color: "#9aa3b2", fontSize: "12px", letterSpacing: "0.08em" }}>
          Monokai
        </div>
        <GitDiffTwoWayView {...args} highlightTheme="monokai" />
      </div>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "8px" }}>
        <div style={{ color: "#9aa3b2", fontSize: "12px", letterSpacing: "0.08em" }}>
          Dracula
        </div>
        <GitDiffTwoWayView {...args} highlightTheme="dracula" />
      </div>
    </div>
  ),
};
