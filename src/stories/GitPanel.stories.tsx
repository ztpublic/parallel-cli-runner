import type { Meta, StoryObj } from "@storybook/react";
import { GitPanel } from "../components/GitPanel";
import {
  initialChangedFiles,
  initialCommits,
  initialLocalBranches,
  initialRemoteBranches,
  initialRemotes,
  initialTabs,
  initialWorktrees,
} from "./mocks/git-ui";

const meta = {
  title: "Components/GitPanel",
  component: GitPanel,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof GitPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialTabs,
    localBranches: initialLocalBranches,
    remoteBranches: initialRemoteBranches,
    commits: initialCommits,
    worktrees: initialWorktrees,
    remotes: initialRemotes,
    changedFiles: initialChangedFiles,
  },
};
