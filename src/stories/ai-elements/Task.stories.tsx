import type { Meta, StoryObj } from "@storybook/react";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "../../../ai-elements-fork/app/components/ai-elements/task";

const TaskPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <Task defaultOpen>
          <TaskTrigger title="Investigate missing stories" />
          <TaskContent>
            <TaskItem>
              Review <TaskItemFile>ai-elements-fork/app/components</TaskItemFile>
            </TaskItem>
            <TaskItem>
              Draft story coverage for <TaskItemFile>ui</TaskItemFile> primitives
            </TaskItem>
            <TaskItem>
              Confirm storybook renders in <TaskItemFile>src/stories</TaskItemFile>
            </TaskItem>
          </TaskContent>
        </Task>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Task",
  component: TaskPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TaskPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
