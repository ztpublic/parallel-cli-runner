import type { Meta, StoryObj } from "@storybook/react";
import { subtitle, title } from "../../../ai-elements-fork/components/primitives";

const PrimitivesPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 p-8">
      <section className="space-y-3">
        <h1 className={title({ color: "blue", size: "lg" })}>
          Build with AI Elements
        </h1>
        <p className={subtitle()}>
          Use the primitives to compose headings with consistent scale and
          gradient accents.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className={title({ color: "cyan", size: "md" })}>
          Reusable typography
        </h2>
        <p className={subtitle({ fullWidth: true })}>
          Mix and match the color variants to align with product sections or
          feature highlights.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className={title({ color: "violet", size: "sm" })}>
            Agent tools
          </span>
          <span className={title({ color: "yellow", size: "sm" })}>
            Integrations
          </span>
          <span className={title({ color: "pink", size: "sm" })}>
            Automation
          </span>
        </div>
      </section>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Primitives",
  component: PrimitivesPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PrimitivesPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
