import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SettingsDialog } from "../../../ai-elements-fork/app/components/settings-dialog";

const SettingsDialogPreview = () => {
  const [values, setValues] = useState<Record<string, string>>({
    OPENAI_API_KEY: "",
    SUPABASE_URL: "",
  });

  const handleChange = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8">
        <SettingsDialog
          mandatoryKeys={["OPENAI_API_KEY"]}
          onChange={handleChange}
          requiredKeyNames={["OPENAI_API_KEY", "SUPABASE_URL"]}
          selectedAgentName="Repo Scout"
          values={values}
        />
        <p className="text-sm text-muted-foreground">
          Configure credentials used by the selected agent.
        </p>
      </div>
    </div>
  );
};

const meta = {
  title: "AI Elements/SettingsDialog",
  component: SettingsDialogPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SettingsDialogPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
