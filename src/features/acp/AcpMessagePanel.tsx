import type { Agent } from "~/constants/agents";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
} from "~/components/ai-elements/message";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "~/components/ai-elements/prompt-input";
import { Loader } from "~/components/ai-elements/loader";
import { renderMessagePart } from "~/utils/messageRenderer";

/**
 * AcpMessagePanel - Presentational component for rendering ACP messages with prompt input
 *
 * This component renders the full ACP (Agent Client Protocol) chat UI including
 * both the messages area and the prompt input area below it. It has no runtime
 * dependencies (no hooks, no transport) and accepts mock data as props,
 * making it ideal for Storybook testing.
 *
 * @prop messages - Array of UI messages to render
 * @prop currentAgent - The agent configuration for avatar display
 * @prop agents - List of available agents for the dropdown
 * @prop status - Optional status for showing streaming/submitted indicators
 * @prop inputValue - Current value of the prompt input (for controlled input)
 * @prop onInputChange - Optional callback when input changes
 * @prop onSubmit - Optional callback when form is submitted
 */
interface AcpMessagePanelProps {
  messages: UIMessage[];
  currentAgent: Agent;
  agents?: Agent[];
  status?: "streaming" | "submitted" | "ready";
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
}

export const AcpMessagePanel = ({
  messages,
  currentAgent,
  agents = [],
  status = "ready",
  inputValue = "",
  onInputChange,
  onSubmit,
}: AcpMessagePanelProps) => {
  const isStreaming = status === "streaming";

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Messages area - takes all available space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent className="p-4 space-y-4">
            {messages.map((message: UIMessage) => (
              <Message
                className="items-start"
                from={message.role as "user" | "assistant"}
                key={message.id}
              >
                <MessageContent>
                  {message.parts.map((part: unknown, index: number) =>
                    renderMessagePart(
                      part,
                      message.id,
                      index,
                      isStreaming,
                      message.metadata as Record<string, unknown> | undefined
                    )
                  )}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Prompt input area - fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-background pt-3 pb-0">
        <PromptInput onSubmit={onSubmit ?? (() => {})}>
          <PromptInputTextarea
            onChange={onInputChange ? (e) => onInputChange(e.target.value) : undefined}
            value={inputValue}
            placeholder="What would you like to know?"
          />
          <PromptInputToolbar>
            <PromptInputTools>
              {agents.length > 0 && (
                <PromptInputModelSelect value={currentAgent.name}>
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {agents.map((agent) => (
                      <PromptInputModelSelectItem
                        key={agent.name}
                        value={agent.name}
                      >
                        {agent.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              )}
            </PromptInputTools>
            <PromptInputSubmit
              status={status}
              disabled={false}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};
