import type { Meta, StoryObj } from "@storybook/react";
import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
} from "../../../ai-elements-fork/app/components/ai-elements/branch";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "../../../ai-elements-fork/app/components/ai-elements/message";

const assistantAvatar =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23e2e8f0'/><text x='32' y='38' font-size='22' text-anchor='middle' fill='%230f172a' font-family='Arial'>AI</text></svg>";

const branchReplies = [
  {
    id: "branch-1",
    title: "Short checklist",
    detail: "Summarize the rollout steps and highlight owners for each.",
  },
  {
    id: "branch-2",
    title: "Detailed rollout",
    detail: "Provide a phased release, checklist, and monitoring plan.",
  },
  {
    id: "branch-3",
    title: "Risk-focused plan",
    detail: "Call out UX risks first, then outline mitigations.",
  },
];

const BranchPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <Message from="user">
          <MessageContent>
            Give me rollout plan options for the settings redesign.
          </MessageContent>
        </Message>
        <Branch className="mt-4 gap-3">
          <BranchMessages>
            {branchReplies.map((reply) => (
              <Message
                className="items-start"
                from="assistant"
                key={reply.id}
              >
                <MessageContent>
                  <p className="font-medium text-sm">{reply.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reply.detail}
                  </p>
                </MessageContent>
                <MessageAvatar name="AI" src={assistantAvatar} />
              </Message>
            ))}
          </BranchMessages>
          <BranchSelector className="px-0" from="assistant">
            <BranchPrevious />
            <BranchPage />
            <BranchNext />
          </BranchSelector>
        </Branch>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Branch",
  component: BranchPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof BranchPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
