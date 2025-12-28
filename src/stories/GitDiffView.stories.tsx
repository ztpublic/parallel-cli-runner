import type { Meta, StoryObj } from "@storybook/react";
import { GitDiffView } from "../components/git/GitDiffView";

const BASE_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
}

export function buildHeaders() {
  return { "x-client": "parallel" };
}
`;

const COMPARE_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "x-client": "parallel",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(
      "Request failed: " + payload
    );
  }
  return res.json();
}

export function buildHeaders() {
  return {
    "x-client": "parallel",
    "x-env": "storybook",
  };
}
`;

const LEFT_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
}

export function buildHeaders() {
  return { "x-client": "parallel", "x-env": "left" };
}
`;

const RIGHT_TEXT = `export async function request(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      "x-client": "parallel",
      "x-env": "right",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json();
}

export function buildHeaders() {
  return { "x-client": "parallel", "x-env": "right" };
}
`;

const BASE_CONFLICT = `function pickColor(theme: string) {
  if (theme === "dark") {
    return "navy";
  }
  return "white";
}
`;

const LEFT_CONFLICT = `function pickColor(theme: string) {
  if (theme === "dark") {
    return "midnightblue";
  }
  return "white";
}
`;

const RIGHT_CONFLICT = `function pickColor(theme: string) {
  if (theme === "dark") {
    return "black";
  }
  return "ivory";
}
`;

const meta = {
  title: "Components/GitDiffView",
  component: GitDiffView,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    mode: {
      control: { type: "inline-radio" },
      options: ["two-way", "three-way"],
    },
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
} satisfies Meta<typeof GitDiffView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoWay: Story = {
  args: {
    mode: "two-way",
    baseText: BASE_TEXT,
    compareText: COMPARE_TEXT,
    languageId: "ts",
    filePath: "src/api/client.ts",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffView {...args} />
    </div>
  ),
};

export const ThreeWay: Story = {
  args: {
    mode: "three-way",
    baseText: BASE_TEXT,
    leftText: LEFT_TEXT,
    rightText: RIGHT_TEXT,
    languageId: "ts",
    filePath: "src/api/client.ts",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffView {...args} />
    </div>
  ),
};

export const Empty: Story = {
  args: {
    mode: "two-way",
    baseText: "",
    compareText: "",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffView {...args} />
    </div>
  ),
};

export const JsonHighlight: Story = {
  args: {
    mode: "two-way",
    baseText: `{\n  \"name\": \"parallel-cli-runner\",\n  \"private\": true,\n  \"version\": \"0.1.0\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"storybook\": \"storybook dev -p 6006\"\n  }\n}\n`,
    compareText: `{\n  \"name\": \"parallel-cli-runner\",\n  \"private\": true,\n  \"version\": \"0.2.0\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"storybook\": \"storybook dev -p 6006\",\n    \"build\": \"tsc && vite build\"\n  }\n}\n`,
    languageId: "json",
    filePath: "package.json",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffView {...args} />
    </div>
  ),
};

export const ConflictExample: Story = {
  args: {
    mode: "three-way",
    baseText: BASE_CONFLICT,
    leftText: LEFT_CONFLICT,
    rightText: RIGHT_CONFLICT,
    languageId: "ts",
    filePath: "src/theme.ts",
    highlightTheme: "vscode-dark",
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffView {...args} />
    </div>
  ),
};

export const ThemeGallery: Story = {
  args: {
    mode: "two-way",
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
        <GitDiffView {...args} highlightTheme="vscode-dark" />
      </div>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "8px" }}>
        <div style={{ color: "#9aa3b2", fontSize: "12px", letterSpacing: "0.08em" }}>
          Monokai
        </div>
        <GitDiffView {...args} highlightTheme="monokai" />
      </div>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: "8px" }}>
        <div style={{ color: "#9aa3b2", fontSize: "12px", letterSpacing: "0.08em" }}>
          Dracula
        </div>
        <GitDiffView {...args} highlightTheme="dracula" />
      </div>
    </div>
  ),
};
