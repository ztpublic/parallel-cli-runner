import type { Meta, StoryObj } from "@storybook/react";
import { GitPanel } from "../components/GitPanel";
import {
  initialChangedFiles,
  initialCommitGroups,
  initialBranchGroups,
  initialRemotes,
  initialTabs,
  initialWorktreeGroups,
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
    repoRoot: "repo-alpha",
    branchGroups: initialBranchGroups,
    commitGroups: initialCommitGroups,
    worktreeGroups: initialWorktreeGroups,
    remotes: initialRemotes,
    changedFiles: initialChangedFiles,
  },
};
