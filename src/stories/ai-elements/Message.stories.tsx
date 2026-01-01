import type { Meta, StoryObj } from "@storybook/react";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "../../../ai-elements-fork/app/components/ai-elements/message";

const assistantAvatar =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23e2e8f0'/><text x='32' y='38' font-size='22' text-anchor='middle' fill='%230f172a' font-family='Arial'>AI</text></svg>";

const MessagePreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-8">
      <Message from="user">
        <MessageContent>
          Can you summarize the component list and recommend a shortlist?
        </MessageContent>
      </Message>
      <Message className="items-start" from="assistant">
        <MessageContent>
          Yes. I will group them by layout, navigation, and input elements, then
          suggest the most reusable ones.
        </MessageContent>
        <MessageAvatar name="AI" src={assistantAvatar} />
      </Message>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Message",
  component: MessagePreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof MessagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
