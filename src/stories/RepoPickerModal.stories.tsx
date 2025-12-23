import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RepoPickerModal } from "../components/RepoPickerModal";
import type { RepoInfoDto } from "../types/git";

const sampleRepos: RepoInfoDto[] = [
  {
    repo_id: "/Users/you/projects/alpha",
    root_path: "/Users/you/projects/alpha",
    name: "alpha",
    is_bare: false,
  },
  {
    repo_id: "/Users/you/projects/mono/tools",
    root_path: "/Users/you/projects/mono/tools",
    name: "tools",
    is_bare: false,
  },
  {
    repo_id: "/Users/you/repos/infra.git",
    root_path: "/Users/you/repos/infra.git",
    name: "infra.git",
    is_bare: true,
  },
];

const meta: Meta<typeof RepoPickerModal> = {
  title: "Components/RepoPickerModal",
  component: RepoPickerModal,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof RepoPickerModal>;

export const Default: Story = {
  render: () => {
    const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(
      sampleRepos.map((repo) => repo.repo_id)
    );

    return (
      <RepoPickerModal
        open
        repos={sampleRepos}
        selectedRepoIds={selectedRepoIds}
        onToggleRepo={(repoId) => {
          setSelectedRepoIds((prev) =>
            prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
          );
        }}
        onSelectAll={() => setSelectedRepoIds(sampleRepos.map((repo) => repo.repo_id))}
        onClear={() => setSelectedRepoIds([])}
        onConfirm={() => {
          // noop for story
        }}
        onClose={() => {
          // noop for story
        }}
      />
    );
  },
};
