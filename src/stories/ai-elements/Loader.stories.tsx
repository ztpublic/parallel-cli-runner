import type { Meta, StoryObj } from "@storybook/react";
import { Loader } from "../../../ai-elements-fork/app/components/ai-elements/loader";

const LoaderPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div className="flex items-center gap-4">
        <Loader size={16} />
        <Loader size={24} />
        <Loader size={32} />
        <Loader size={48} />
      </div>
      <p className="text-sm text-muted-foreground">
        Spinning loader sizes for inline and full-screen states.
      </p>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Loader",
  component: LoaderPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LoaderPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
