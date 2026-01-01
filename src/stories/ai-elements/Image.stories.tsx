import type { Meta, StoryObj } from "@storybook/react";
import { Image } from "../../../ai-elements-fork/app/components/ai-elements/image";

const generatedImage = {
  base64:
    "PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMjAnIGhlaWdodD0nMjAwJz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB4Mj0nMScgeTE9JzAnIHkyPScxJz48c3RvcCBvZmZzZXQ9JzAlJyBzdG9wLWNvbG9yPScjYTViNGZjJy8+PHN0b3Agb2Zmc2V0PScxMDAlJyBzdG9wLWNvbG9yPScjZjBhYmZjJy8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9JzMyMCcgaGVpZ2h0PScyMDAnIHJ4PScxNicgZmlsbD0ndXJsKCNnKScvPjx0ZXh0IHg9JzE2MCcgeT0nMTEwJyBmb250LXNpemU9JzIwJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmaWxsPScjMTExODI3JyBmb250LWZhbWlseT0nQXJpYWwnPkdlbmVyYXRlZCBwcmV2aWV3PC90ZXh0Pjwvc3ZnPg==",
  uint8Array: new Uint8Array(),
  mediaType: "image/svg+xml",
};

const ImagePreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-8">
      <Image
        {...generatedImage}
        alt="Generated preview"
        className="w-full max-w-md shadow-sm"
      />
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Image",
  component: ImagePreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ImagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
