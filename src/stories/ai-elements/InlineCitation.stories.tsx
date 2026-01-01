import type { Meta, StoryObj } from "@storybook/react";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "../../../ai-elements-fork/app/components/ai-elements/inline-citation";

const sources = [
  {
    title: "Designing AI review flows",
    url: "https://example.com/ai-review",
    description:
      "A checklist for keeping automated responses transparent and easy to audit.",
    quote:
      "Inline citations increase trust when users can quickly verify source details.",
  },
  {
    title: "Monitoring UX rollouts",
    url: "https://example.com/ux-rollouts",
    description:
      "Guidance for phased launches, measuring adoption, and rollback triggers.",
    quote: "Launch in small rings, then expand once key metrics stabilize.",
  },
];

const InlineCitationPreview = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          The rollout plan should highlight risk owners and audit steps
          <InlineCitation>
            <InlineCitationText> for each release phase.</InlineCitationText>
            <InlineCitationCard>
              <InlineCitationCardTrigger
                sources={sources.map((source) => source.url)}
              />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <span className="text-xs font-medium">Sources</span>
                    <InlineCitationCarouselIndex />
                    <div className="flex items-center gap-2 pr-2">
                      <InlineCitationCarouselPrev />
                      <InlineCitationCarouselNext />
                    </div>
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    {sources.map((source) => (
                      <InlineCitationCarouselItem key={source.url}>
                        <InlineCitationSource
                          description={source.description}
                          title={source.title}
                          url={source.url}
                        />
                        <InlineCitationQuote>{source.quote}</InlineCitationQuote>
                      </InlineCitationCarouselItem>
                    ))}
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        </p>
      </div>
    </div>
  </div>
);

const meta = {
  title: "AI Elements/InlineCitation",
  component: InlineCitationPreview,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof InlineCitationPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
