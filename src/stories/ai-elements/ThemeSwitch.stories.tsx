import type { Meta, StoryObj } from "@storybook/react";
import { ThemeSwitch } from "../../../ai-elements-fork/components/theme-switch";
import { ThemeProvider } from "../../../ai-elements-fork/components/theme-provider";

const ThemeSwitchExample = () => (
  <ThemeProvider>
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Theme switch</div>
              <div className="text-xs text-muted-foreground">
                Toggle between light and dark mode.
              </div>
            </div>
            <ThemeSwitch />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: switch themes to see the background and card colors update.
        </p>
      </div>
    </div>
  </ThemeProvider>
);

const meta = {
  title: "AI Elements/ThemeSwitch",
  component: ThemeSwitchExample,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ThemeSwitchExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
