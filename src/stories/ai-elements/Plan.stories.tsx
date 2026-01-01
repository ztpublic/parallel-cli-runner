import type { Meta, StoryObj } from "@storybook/react";
import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "../../../ai-elements-fork/components/ai-elements/plan";
import { Button } from "../../../ai-elements-fork/app/components/ui/button";

type PlanExampleProps = {
  defaultOpen?: boolean;
  isStreaming?: boolean;
};

const PlanExample = ({ defaultOpen = true, isStreaming }: PlanExampleProps) => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
      <Plan defaultOpen={defaultOpen} isStreaming={isStreaming}>
        <PlanHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <PlanTitle>Rollout plan</PlanTitle>
            <PlanDescription>
              Draft a step-by-step deployment sequence.
            </PlanDescription>
          </div>
          <PlanTrigger />
        </PlanHeader>
        <PlanContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Validate environment variables and secret scopes.</li>
            <li>Run migrations and verify schema diff.</li>
            <li>Deploy backend services, then roll out the UI.</li>
            <li>Monitor logs and error rates for 15 minutes.</li>
          </ol>
        </PlanContent>
        <PlanFooter className="justify-end gap-2">
          <Button size="sm" variant="outline">
            Edit steps
          </Button>
          <Button size="sm">Approve</Button>
        </PlanFooter>
      </Plan>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Plan",
  component: PlanExample,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    defaultOpen: { control: "boolean" },
    isStreaming: { control: "boolean" },
  },
} satisfies Meta<typeof PlanExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultOpen: true,
    isStreaming: false,
  },
};

export const Streaming: Story = {
  args: {
    defaultOpen: true,
    isStreaming: true,
  },
};
