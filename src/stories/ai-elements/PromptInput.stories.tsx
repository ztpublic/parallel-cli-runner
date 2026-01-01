import type { Meta, StoryObj } from "@storybook/react";
import type { ChatStatus } from "ai";
import { useState } from "react";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "../../../ai-elements-fork/app/components/ai-elements/prompt-input";
import { Paperclip, Sparkles } from "lucide-react";

type PromptInputExampleProps = {
  status?: ChatStatus;
};

const modelOptions = [
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "claude-3.5", label: "Claude 3.5" },
];

const PromptInputExample = ({ status }: PromptInputExampleProps) => {
  const [input, setInput] = useState(
    "Draft a rollout plan and identify UI risks before launch."
  );
  const [model, setModel] = useState(modelOptions[0].value);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
        <PromptInput onSubmit={(event) => event.preventDefault()}>
          <PromptInputTextarea
            onChange={(event) => setInput(event.target.value)}
            value={input}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton>
                <Paperclip className="size-4" />
                <span className="sr-only">Attach file</span>
              </PromptInputButton>
              <PromptInputButton>
                <Sparkles className="size-4" />
                <span className="sr-only">Enhance prompt</span>
              </PromptInputButton>
              <PromptInputModelSelect
                onValueChange={setModel}
                value={model}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {modelOptions.map((option) => (
                    <PromptInputModelSelectItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input.trim()}
              status={status}
            />
          </PromptInputToolbar>
        </PromptInput>
        <p className="text-xs text-muted-foreground">
          Tip: press Enter to submit, Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
};

const meta = {
  title: "AI Elements/PromptInput",
  component: PromptInputExample,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PromptInputExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Submitting: Story = {
  args: {
    status: "submitted",
  },
};

export const Streaming: Story = {
  args: {
    status: "streaming",
  },
};

export const Error: Story = {
  args: {
    status: "error",
  },
};
