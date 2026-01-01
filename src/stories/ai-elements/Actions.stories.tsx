import type { Meta, StoryObj } from "@storybook/react";
import { Copy, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  Action,
  Actions,
} from "../../../ai-elements-fork/app/components/ai-elements/actions";

const ActionsPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Response actions</p>
        <Actions className="mt-3">
          <Action label="Copy" tooltip="Copy response">
            <Copy className="size-4" />
          </Action>
          <Action label="Helpful" tooltip="Mark as helpful">
            <ThumbsUp className="size-4" />
          </Action>
          <Action label="Unhelpful" tooltip="Mark as unhelpful">
            <ThumbsDown className="size-4" />
          </Action>
          <Action label="Share" tooltip="Share response">
            <Share2 className="size-4" />
          </Action>
        </Actions>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Actions",
  component: ActionsPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ActionsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
