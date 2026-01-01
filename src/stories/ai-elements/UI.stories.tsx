import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Avatar as UiAvatar, AvatarFallback, AvatarImage } from "../../../ai-elements-fork/app/components/ui/avatar";
import { Badge } from "../../../ai-elements-fork/app/components/ui/badge";
import { Button } from "../../../ai-elements-fork/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../ai-elements-fork/app/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../../ai-elements-fork/app/components/ui/carousel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../ai-elements-fork/app/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../ai-elements-fork/app/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../ai-elements-fork/app/components/ui/hover-card";
import { Input } from "../../../ai-elements-fork/app/components/ui/input";
import { Label } from "../../../ai-elements-fork/app/components/ui/label";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../../../ai-elements-fork/app/components/ui/navigation-menu";
import { ScrollArea } from "../../../ai-elements-fork/app/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../../ai-elements-fork/app/components/ui/select";
import { Switch } from "../../../ai-elements-fork/app/components/ui/switch";
import { Textarea } from "../../../ai-elements-fork/app/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../ai-elements-fork/app/components/ui/tooltip";

const avatarImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23cbd5f5'/><text x='20' y='26' font-size='14' text-anchor='middle' fill='%231e1b4b' font-family='Arial'>AE</text></svg>";

type PreviewSurfaceProps = {
  title: string;
  children: ReactNode;
};

const PreviewSurface = ({ title, children }: PreviewSurfaceProps) => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 p-8">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/UI",
  component: PreviewSurface,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PreviewSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Avatar: Story = {
  render: () => (
    <PreviewSurface title="Avatar">
      <div className="flex items-center gap-4">
        <UiAvatar>
          <AvatarImage src={avatarImage} />
          <AvatarFallback>AE</AvatarFallback>
        </UiAvatar>
        <UiAvatar>
          <AvatarImage src="" />
          <AvatarFallback>JD</AvatarFallback>
        </UiAvatar>
      </div>
    </PreviewSurface>
  ),
};

export const BadgeVariants: Story = {
  render: () => (
    <PreviewSurface title="Badge">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
    </PreviewSurface>
  ),
};

export const Buttons: Story = {
  render: () => (
    <PreviewSurface title="Button">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </div>
    </PreviewSurface>
  ),
};

export const CardLayout: Story = {
  render: () => (
    <PreviewSurface title="Card">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Release snapshot</CardTitle>
          <CardDescription>Summary of the staged rollout.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Flagged cohorts: Design, QA, 10% of beta users.
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm" variant="outline">
            Review
          </Button>
          <Button size="sm">Approve</Button>
        </CardFooter>
      </Card>
    </PreviewSurface>
  ),
};

export const CarouselStory: Story = {
  render: () => (
    <PreviewSurface title="Carousel">
      <Carousel className="w-full max-w-md px-12">
        <CarouselContent>
          {["Setup", "Review", "Launch"].map((step) => (
            <CarouselItem key={step}>
              <div className="rounded-xl border bg-card p-6 text-sm shadow-sm">
                <p className="font-medium">{step}</p>
                <p className="mt-1 text-muted-foreground">
                  Track tasks for the {step.toLowerCase()} phase.
                </p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </PreviewSurface>
  ),
};

export const CollapsibleStory: Story = {
  render: () => (
    <PreviewSurface title="Collapsible">
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="outline">
            Toggle details
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          Collapsible content is useful for optional details and follow-up notes.
        </CollapsibleContent>
      </Collapsible>
    </PreviewSurface>
  ),
};

export const DialogStory: Story = {
  render: () => (
    <PreviewSurface title="Dialog">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm rollout</DialogTitle>
            <DialogDescription>
              You are about to publish the next release candidate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PreviewSurface>
  ),
};

export const HoverCardStory: Story = {
  render: () => (
    <PreviewSurface title="HoverCard">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="outline">Hover for details</Button>
        </HoverCardTrigger>
        <HoverCardContent>
          <p className="text-sm text-muted-foreground">
            Hover cards are useful for quick context without leaving the page.
          </p>
        </HoverCardContent>
      </HoverCard>
    </PreviewSurface>
  ),
};

export const InputField: Story = {
  render: () => (
    <PreviewSurface title="Input">
      <div className="grid gap-2 max-w-sm">
        <Label htmlFor="search-input">Search</Label>
        <Input id="search-input" placeholder="Search components..." />
      </div>
    </PreviewSurface>
  ),
};

export const NavigationMenuStory: Story = {
  render: () => (
    <PreviewSurface title="NavigationMenu">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Guides</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="grid gap-2 p-4 text-sm">
                <NavigationMenuLink href="#">Getting started</NavigationMenuLink>
                <NavigationMenuLink href="#">Deployment checklist</NavigationMenuLink>
                <NavigationMenuLink href="#">Monitoring</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              className="rounded-md px-4 py-2 text-sm hover:bg-accent"
              href="#"
            >
              API reference
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </PreviewSurface>
  ),
};

export const ScrollAreaStory: Story = {
  render: () => (
    <PreviewSurface title="ScrollArea">
      <ScrollArea className="h-40 w-full max-w-sm rounded-md border">
        <div className="space-y-2 p-4 text-sm">
          {Array.from({ length: 12 }).map((_, index) => (
            <p key={`log-${index}`}>Deployment log entry #{index + 1}</p>
          ))}
        </div>
      </ScrollArea>
    </PreviewSurface>
  ),
};

export const SelectStory: Story = {
  render: () => (
    <PreviewSurface title="Select">
      <div className="max-w-xs">
        <Select defaultValue="beta">
          <SelectTrigger>
            <SelectValue placeholder="Choose rollout" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Rollout</SelectLabel>
              <SelectItem value="alpha">Alpha</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="ga">GA</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </PreviewSurface>
  ),
};

export const SwitchStory: Story = {
  render: () => (
    <PreviewSurface title="Switch">
      <div className="flex items-center gap-3">
        <Switch defaultChecked id="toggle-telemetry" />
        <Label htmlFor="toggle-telemetry">Enable telemetry</Label>
      </div>
    </PreviewSurface>
  ),
};

export const TextareaStory: Story = {
  render: () => (
    <PreviewSurface title="Textarea">
      <Textarea className="max-w-md" placeholder="Add rollout notes..." />
    </PreviewSurface>
  ),
};

export const TooltipStory: Story = {
  render: () => (
    <PreviewSurface title="Tooltip">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Quick context appears here.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </PreviewSurface>
  ),
};
