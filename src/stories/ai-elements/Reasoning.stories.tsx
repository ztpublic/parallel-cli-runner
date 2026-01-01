import type { Meta, StoryObj } from "@storybook/react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../../../ai-elements-fork/app/components/ai-elements/reasoning";

const reasoningText = `- Audit feature flags and rollout timing.
- Verify accessibility checks for the new navigation.
- Confirm analytics events for adoption tracking.`;

const ReasoningPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Reasoning",
  component: ReasoningPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ReasoningPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
