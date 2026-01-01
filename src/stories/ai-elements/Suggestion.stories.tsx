import type { Meta, StoryObj } from "@storybook/react";
import {
  Suggestion,
  Suggestions,
} from "../../../ai-elements-fork/app/components/ai-elements/suggestion";

const suggestionItems = [
  "Summarize key risks",
  "Draft a launch checklist",
  "Propose rollout owners",
  "Identify missing instrumentation",
];

const SuggestionPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Suggested follow-ups</p>
        <Suggestions className="mt-4">
          {suggestionItems.map((item) => (
            <Suggestion key={item} suggestion={item} />
          ))}
        </Suggestions>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Suggestion",
  component: SuggestionPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SuggestionPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
