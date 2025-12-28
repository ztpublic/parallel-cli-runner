import type { Meta, StoryObj } from "@storybook/react";
import { GitPanel } from "../components/GitPanel";
import {
  initialBranchGroups,
  initialChangedFileGroups,
  initialCommitGroups,
  initialRemoteGroups,
  initialTabs,
  initialWorktreeGroups,
  repoHeaders,
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
    repos: repoHeaders,
    branchGroups: initialBranchGroups,
    commitGroups: initialCommitGroups,
    worktreeGroups: initialWorktreeGroups,
    remoteGroups: initialRemoteGroups,
    changedFileGroups: initialChangedFileGroups,
  },
};
