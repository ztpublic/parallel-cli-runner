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
  },
} satisfies Meta<typeof GitDiffView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoWay: Story = {
  args: {
    mode: "two-way",
    baseText: BASE_TEXT,
    compareText: COMPARE_TEXT,
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
  },
  render: (args) => (
    <div style={{ height: "100vh", padding: "24px" }}>
      <GitDiffView {...args} />
    </div>
  ),
};
