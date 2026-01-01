import type { Meta, StoryObj } from "@storybook/react";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "../../../ai-elements-fork/app/components/ai-elements/tool";

const toolInput = {
  repo: "parallel-cli-runner",
  path: "ai-elements-fork",
  query: "components missing stories",
};

const toolOutput = (
  <div className="space-y-2 p-3">
    <p className="font-medium">Missing stories detected</p>
    <ul className="list-disc space-y-1 pl-4">
      <li>Actions, Branch, CodeBlock</li>
      <li>InlineCitation, Reasoning, Sources</li>
      <li>Tool, Task, WebPreview</li>
    </ul>
  </div>
);

const ToolPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <Tool defaultOpen>
        <ToolHeader
          state="output-available"
          title="Story scan"
          type="tool-story-audit"
        />
        <ToolContent>
          <ToolInput input={toolInput} />
          <ToolOutput errorText={undefined} output={toolOutput} />
        </ToolContent>
      </Tool>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Tool",
  component: ToolPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ToolPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
