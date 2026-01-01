import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "../../../ai-elements-fork/app/components/ai-elements/web-preview";

const previewHtml = encodeURIComponent(`<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; }
      .shell { height: 100vh; display: grid; place-items: center; }
      .card { padding: 32px; border-radius: 16px; background: white; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12); text-align: center; }
      .title { font-size: 20px; color: #0f172a; margin: 0 0 8px; }
      .subtitle { font-size: 14px; color: #475569; margin: 0; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <p class="title">Preview surface</p>
        <p class="subtitle">Render lightweight embeds with console output.</p>
      </div>
    </div>
  </body>
</html>`);

const previewUrl = `data:text/html,${previewHtml}`;

const logs = [
  {
    level: "log" as const,
    message: "Loaded preview shell",
    timestamp: new Date("2024-02-14T10:05:00"),
  },
  {
    level: "warn" as const,
    message: "Using mocked data for UI only",
    timestamp: new Date("2024-02-14T10:05:04"),
  },
];

const WebPreviewExample = () => {
  const [url, setUrl] = useState(previewUrl);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 p-8">
        <WebPreview className="h-[70vh]" defaultUrl={url}>
          <WebPreviewNavigation>
            <WebPreviewNavigationButton disabled tooltip="Back">
              <ArrowLeft className="size-4" />
            </WebPreviewNavigationButton>
            <WebPreviewNavigationButton disabled tooltip="Forward">
              <ArrowRight className="size-4" />
            </WebPreviewNavigationButton>
            <WebPreviewNavigationButton tooltip="Reload">
              <RefreshCw className="size-4" />
            </WebPreviewNavigationButton>
            <WebPreviewUrl
              onChange={(event) => setUrl(event.target.value)}
              value={url}
            />
          </WebPreviewNavigation>
          <WebPreviewBody src={url} />
          <WebPreviewConsole logs={logs} />
        </WebPreview>
      </div>
    </div>
  );
};

const meta = {
  title: "AI Elements/WebPreview",
  component: WebPreviewExample,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof WebPreviewExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
