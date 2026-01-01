import type { Meta, StoryObj } from "@storybook/react";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "../../../ai-elements-fork/app/components/ai-elements/sources";

const SourcesPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Sources defaultOpen>
          <SourcesTrigger count={3} />
          <SourcesContent>
            <Source href="https://example.com/checklist" title="QA checklist" />
            <Source href="https://example.com/rollout" title="Rollout guide" />
            <Source href="https://example.com/metrics" title="Metrics tracking" />
          </SourcesContent>
        </Sources>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Sources",
  component: SourcesPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SourcesPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
