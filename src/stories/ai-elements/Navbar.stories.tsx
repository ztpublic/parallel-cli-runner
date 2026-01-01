import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router";
import { Navbar } from "../../../ai-elements-fork/components/navbar";
import { ThemeProvider } from "../../../ai-elements-fork/components/theme-provider";

type NavbarExampleProps = {
  initialPath?: string;
};

const NavbarExample = ({ initialPath = "/" }: NavbarExampleProps) => (
  <ThemeProvider>
    <MemoryRouter initialEntries={[initialPath]}>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto max-w-4xl p-8 text-sm text-muted-foreground">
          Current route: <span className="font-medium">{initialPath}</span>
        </main>
      </div>
    </MemoryRouter>
  </ThemeProvider>
);

const meta = {
  title: "AI Elements/Navbar",
  component: NavbarExample,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    initialPath: { control: "text" },
  },
} satisfies Meta<typeof NavbarExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ClientSDK: Story = {
  args: {
    initialPath: "/",
  },
};

export const AcpSDK: Story = {
  args: {
    initialPath: "/acp",
  },
};
