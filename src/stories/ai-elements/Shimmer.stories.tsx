import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";
import { Shimmer } from "../../../ai-elements-fork/components/ai-elements/shimmer";

const shimmerStyle: CSSProperties = {
  "--color-muted-foreground": "hsl(var(--muted-foreground))",
};

const ShimmerPreview = () => (
  <div
    className="min-h-screen bg-background text-foreground"
    style={shimmerStyle}
  >
    <div className="flex min-h-screen flex-col justify-center gap-6 p-8">
      <Shimmer className="text-3xl font-semibold">
        Generating a structured plan...
      </Shimmer>
      <Shimmer className="text-lg" duration={2.6}>
        Summarizing context and dependencies
      </Shimmer>
      <Shimmer className="text-base" duration={3.2} spread={3}>
        Evaluating UI components for reuse
      </Shimmer>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Shimmer",
  component: ShimmerPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ShimmerPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
