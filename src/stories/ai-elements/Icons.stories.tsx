import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType, SVGProps } from "react";
import {
  ChevronDownIcon,
  DiscordIcon,
  GithubIcon,
  HeartFilledIcon,
  HeroUILogo,
  Logo,
  MoonFilledIcon,
  PlusIcon,
  SearchIcon,
  SunFilledIcon,
  TwitterIcon,
  VerticalDotsIcon,
} from "../../../ai-elements-fork/components/icons";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

type IconTile = {
  name: string;
  Component: ComponentType<IconProps>;
  props?: IconProps;
};

const iconTiles: IconTile[] = [
  { name: "Logo", Component: Logo, props: { size: 40 } },
  { name: "DiscordIcon", Component: DiscordIcon },
  { name: "TwitterIcon", Component: TwitterIcon },
  { name: "GithubIcon", Component: GithubIcon },
  { name: "MoonFilledIcon", Component: MoonFilledIcon },
  { name: "SunFilledIcon", Component: SunFilledIcon },
  { name: "HeartFilledIcon", Component: HeartFilledIcon },
  { name: "SearchIcon", Component: SearchIcon, props: { className: "h-6 w-6" } },
  { name: "HeroUILogo", Component: HeroUILogo, props: { width: 140 } },
  { name: "PlusIcon", Component: PlusIcon },
  { name: "VerticalDotsIcon", Component: VerticalDotsIcon },
  { name: "ChevronDownIcon", Component: ChevronDownIcon, props: { className: "h-6 w-6" } },
];

const IconGrid = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="grid gap-6 p-8 sm:grid-cols-2 lg:grid-cols-4">
      {iconTiles.map(({ name, Component, props }) => (
        <div
          key={name}
          className="flex flex-col items-center gap-3 rounded-xl border bg-card p-4 text-foreground shadow-sm"
        >
          <Component {...props} />
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  </div>
);

const meta = {
  title: "AI Elements/Icons",
  component: IconGrid,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof IconGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};
