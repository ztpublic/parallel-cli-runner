import type { Meta, StoryObj } from "@storybook/react";
import { AcpMessagePanel } from "../features/acp/AcpMessagePanel";
import { AVAILABLE_AGENTS } from "../constants/agents";
import { sampleMessages, sampleConversations } from "./mocks/acp-messages";

const demoAgent = AVAILABLE_AGENTS.find((agent) => agent.name === "Demo") || AVAILABLE_AGENTS[0];

const meta = {
  title: "Features/AcpAgentPanel/Message Rendering",
  component: AcpMessagePanel,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    status: {
      control: "select",
      options: ["ready", "streaming", "submitted"],
      description: "Status indicator for loading states",
    },
    inputValue: {
      control: "text",
      description: "Current value of the prompt input",
    },
    agents: {
      control: "object",
      description: "List of available agents for dropdown",
    },
  },
} satisfies Meta<typeof AcpMessagePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Basic Message Stories
// ============================================================================

export const TextOnly: Story = {
  args: {
    messages: [sampleMessages.textOnly],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
    inputValue: "",
  },
  tags: ["basic"],
};

export const WithReasoning: Story = {
  args: {
    messages: [sampleMessages.withReasoning],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
    inputValue: "",
  },
  tags: ["basic"],
};

export const WithPromptInput: Story = {
  args: {
    messages: [sampleMessages.textOnly],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
    inputValue: "Help me write a React component",
  },
  tags: ["basic"],
  description: "Shows the full UI with messages and prompt input",
};

// ============================================================================
// Tool Stories
// ============================================================================

export const ToolWithDiff: Story = {
  args: {
    messages: [sampleMessages.withToolDiff],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["tools"],
  description: "Shows a tool call with file diff output",
};

export const ToolWithTerminal: Story = {
  args: {
    messages: [sampleMessages.withToolTerminal],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["tools"],
  description: "Shows a tool call with terminal output",
};

export const MultipleTools: Story = {
  args: {
    messages: [sampleMessages.multiPartComplex],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["tools", "complex"],
  description: "Shows a message with multiple tool calls and reasoning",
};

// ============================================================================
// Rich Content Stories
// ============================================================================

export const WithImage: Story = {
  args: {
    messages: [sampleMessages.withImage],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["rich-content"],
  description: "Shows a message with embedded image content",
};

export const WithAudio: Story = {
  args: {
    messages: [sampleMessages.withAudio],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["rich-content"],
  description: "Shows a message with embedded audio content",
};

export const WithResourceLink: Story = {
  args: {
    messages: [sampleMessages.withResourceLink],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["rich-content"],
  description: "Shows a message with a resource link",
};

// ============================================================================
// Plan Stories
// ============================================================================

export const WithPlan: Story = {
  args: {
    messages: [sampleMessages.withPlan],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["plan"],
  description: "Shows a message with structured plan metadata",
};

// ============================================================================
// Conversation Stories
// ============================================================================

export const SimpleConversation: Story = {
  args: {
    messages: sampleConversations.simpleChat,
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["conversation"],
  description: "Shows a simple back-and-forth conversation",
};

export const ComplexWorkflow: Story = {
  args: {
    messages: sampleConversations.complexWorkflow,
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["conversation", "complex"],
  description: "Shows a complex workflow with file operations",
};

export const PlannedWorkflow: Story = {
  args: {
    messages: sampleConversations.plannedWorkflow,
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["conversation", "plan"],
  description: "Shows a workflow with plan and execution steps",
};

// ============================================================================
// State Stories
// ============================================================================

export const StreamingIndicator: Story = {
  args: {
    messages: [sampleMessages.textOnly],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "streaming",
  },
  tags: ["state"],
  description: "Shows the streaming state indicator",
};

export const SubmittedIndicator: Story = {
  args: {
    messages: [sampleMessages.textOnly],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "submitted",
  },
  tags: ["state"],
  description: "Shows the submitted state (loading spinner)",
};

// ============================================================================
// Edge Cases
// ============================================================================

export const Empty: Story = {
  args: {
    messages: [],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["edge-case"],
  description: "Shows an empty conversation state",
};

export const LongConversation: Story = {
  args: {
    messages: [
      ...sampleConversations.simpleChat,
      sampleMessages.withReasoning,
      sampleMessages.withToolDiff,
      sampleMessages.withPlan,
      sampleMessages.withResourceLink,
    ],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["edge-case"],
  description: "Tests scrolling with a long conversation",
};

// ============================================================================
// Comprehensive Example
// ============================================================================

/**
 * This story combines all message types into one conversation
 * to demonstrate the full range of ACP message rendering capabilities.
 */
export const AllMessageTypes: Story = {
  args: {
    messages: [
      createMessage("user-1", "user", [
        { type: "text", text: "Can you help me build a feature?" },
      ]),
      sampleMessages.withReasoning,
      sampleMessages.withPlan,
      sampleMessages.withToolDiff,
      sampleMessages.withToolTerminal,
      sampleMessages.withImage,
      sampleMessages.withResourceLink,
      createMessage("assistant-final", "assistant", [
        { type: "text", text: "That's everything! Let me know if you need anything else." },
      ]),
    ],
    currentAgent: demoAgent,
    agents: AVAILABLE_AGENTS,
    status: "ready",
  },
  tags: ["comprehensive"],
  description: "Shows all message types in a single conversation",
};

// Helper function for the AllMessageTypes story
function createMessage(
  id: string,
  role: "user" | "assistant",
  parts: unknown[]
): typeof import("../stories/mocks/acp-messages").sampleMessages.textOnly {
  return {
    id,
    role,
    parts,
  } as typeof import("../stories/mocks/acp-messages").sampleMessages.textOnly;
}
