import type { Meta, StoryObj } from "@storybook/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../../../ai-elements-fork/app/components/ai-elements/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "../../../ai-elements-fork/app/components/ai-elements/message";

type ChatMessage = {
  id: string;
  from: "user" | "assistant";
  content: string;
  showAvatar?: boolean;
};

const assistantAvatar =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23e2e8f0'/><text x='32' y='38' font-size='22' text-anchor='middle' fill='%230f172a' font-family='Arial'>AI</text></svg>";

const messages: ChatMessage[] = [
  {
    id: "m1",
    from: "assistant",
    content:
      "Hi! Share a repo or a task, and I'll help you line up the next steps.",
    showAvatar: true,
  },
  {
    id: "m2",
    from: "user",
    content:
      "I need a quick rollout plan for a new settings screen and a UI review.",
  },
  {
    id: "m3",
    from: "assistant",
    content:
      "Got it. I'll outline a phased rollout, then call out any UX gaps to fix before launch.",
    showAvatar: true,
  },
  {
    id: "m4",
    from: "user",
    content: "Please prioritize accessibility and quick toggles.",
  },
  {
    id: "m5",
    from: "assistant",
    content:
      "Understood. I'll include keyboard shortcuts, focus order, and default states.",
    showAvatar: true,
  },
  {
    id: "m6",
    from: "assistant",
    content:
      "Do you want a dark mode variant included in the first iteration?",
    showAvatar: true,
  },
  {
    id: "m7",
    from: "user",
    content: "Yes, but only for key surfaces.",
  },
  {
    id: "m8",
    from: "assistant",
    content:
      "Perfect. I'll keep it scoped to navigation, cards, and primary controls.",
    showAvatar: true,
  },
  {
    id: "m9",
    from: "assistant",
    content:
      "Anything else I should include in the rollout checklist?",
    showAvatar: true,
  },
];

const ConversationPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex h-[70vh] max-w-3xl flex-col justify-center p-8">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Project Chat
        </div>
        <Conversation className="flex-1">
          <ConversationContent className="space-y-4">
            {messages.map((message) => (
              <Message
                className="items-start"
                from={message.from}
                key={message.id}
              >
                <MessageContent>{message.content}</MessageContent>
                {message.from === "assistant" && message.showAvatar && (
                  <MessageAvatar name="AI" src={assistantAvatar} />
                )}
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Conversation",
  component: ConversationPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ConversationPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
