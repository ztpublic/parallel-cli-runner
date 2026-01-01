import type { Meta, StoryObj } from "@storybook/react";
import { Response } from "../../../ai-elements-fork/app/components/ai-elements/response";

const responseText = `## Rollout summary

- Stage the settings redesign behind a feature flag.
- Monitor error rates and drop-off after the first cohort.
- Collect agent feedback before expanding to 100%.

### Notes

\`owner: frontend\` needs to prepare the toggle flow and analytics events.`;

const ResponsePreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Response>{responseText}</Response>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Response",
  component: ResponsePreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ResponsePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
