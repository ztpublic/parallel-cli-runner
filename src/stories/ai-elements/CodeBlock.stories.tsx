import type { Meta, StoryObj } from "@storybook/react";
import {
  CodeBlock,
  CodeBlockCopyButton,
} from "../../../ai-elements-fork/app/components/ai-elements/code-block";

const codeSample = `const rollout = {
  phase: "beta",
  owners: ["design", "frontend", "qa"],
  checklist: [
    "Validate secrets",
    "Ship feature flags",
    "Monitor error rates",
  ],
};`;

const CodeBlockPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <CodeBlock code={codeSample} language="ts" showLineNumbers>
        <CodeBlockCopyButton />
      </CodeBlock>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/CodeBlock",
  component: CodeBlockPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof CodeBlockPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
