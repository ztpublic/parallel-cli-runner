import type { UIMessage } from "ai";

/**
 * Helper to create a base message with all required properties
 */
export function createMessage(
  id: string,
  role: "user" | "assistant",
  parts: unknown[],
  metadata?: Record<string, unknown>
): UIMessage {
  return {
    id,
    role,
    parts,
    metadata,
  } as UIMessage;
}

/**
 * Sample individual messages demonstrating different ACP message part types
 */
export const sampleMessages = {
  /** Simple text-only message */
  textOnly: createMessage("msg-1", "assistant", [
    { type: "text", text: "Hello! How can I help you today?" },
  ]),

  /** Message with reasoning/thinking process */
  withReasoning: createMessage("msg-2", "assistant", [
    { type: "text", text: "I'll help you with that task." },
    {
      type: "reasoning",
      text: "Analyzing the request...\n- Breaking down into steps\n- Preparing response\n- Executing plan",
    },
  ]),

  /** Message with tool call showing file diff */
  withToolDiff: createMessage("msg-3", "assistant", [
    { type: "text", text: "I've updated the file:" },
    {
      type: "tool-file-edit",
      state: "output-available",
      input: {
        toolName: "file_edit",
        args: {
          _kind: "edit",
          path: "src/utils/helpers.ts",
          _locations: [{ path: "src/utils/helpers.ts", line: 42 }],
        },
      },
      output: {
        _rawOutput: { success: true },
        _content: [
          {
            type: "diff",
            path: "src/utils/helpers.ts",
            oldText: "export function oldHelper() {\n  return true;\n}",
            newText: "export function newHelper() {\n  return false;\n}",
          },
        ],
        _locations: [{ path: "src/utils/helpers.ts", line: 42 }],
      },
    },
  ]),

  /** Message with tool call showing terminal output */
  withToolTerminal: createMessage("msg-4", "assistant", [
    { type: "text", text: "Running the test suite:" },
    {
      type: "tool-bash_execute",
      state: "output-available",
      input: {
        toolName: "bash_execute",
        args: {
          _kind: "execute",
          command: "npm test",
        },
      },
      output: {
        _rawOutput: { exitCode: 0 },
        _content: [
          {
            type: "terminal",
            terminalId: "test-runner-1",
          },
        ],
      },
    },
  ]),

  /** Message with image content (via richContent metadata) */
  withImage: createMessage(
    "msg-5",
    "assistant",
    [{ type: "text", text: "Here's a diagram showing the architecture:" }],
    {
      richContent: {
        type: "image",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        mimeType: "image/png",
      },
    }
  ),

  /** Message with audio content (via richContent metadata) */
  withAudio: createMessage(
    "msg-6",
    "assistant",
    [{ type: "text", text: "I can also provide audio explanations:" }],
    {
      richContent: {
        type: "audio",
        data: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
        mimeType: "audio/wav",
      },
    }
  ),

  /** Message with resource link (via richContent metadata) */
  withResourceLink: createMessage(
    "msg-7",
    "assistant",
    [{ type: "text", text: "I've created a resource for you:" }],
    {
      richContent: {
        type: "resource_link",
        uri: "file:///path/to/document.pdf",
        name: "documentation.pdf",
        mimeType: "application/pdf",
        size: 245678,
      },
    }
  ),

  /** Message with plan metadata showing structured task list */
  withPlan: createMessage(
    "msg-8",
    "assistant",
    [{ type: "text", text: "Here's my plan to implement this feature:" }],
    {
      plan: [
        { content: "Design the database schema", status: "done", priority: "high" },
        { content: "Implement API endpoints", status: "pending", priority: "high" },
        { content: "Create UI components", status: "pending", priority: "medium" },
        { content: "Write unit tests", status: "pending", priority: "medium" },
      ],
    }
  ),

  /** Complex multi-part message with multiple tools and reasoning */
  multiPartComplex: createMessage("msg-9", "assistant", [
    {
      type: "reasoning",
      text: "- Analyzing requirements\n- Planning approach\n- Executing implementation",
    },
    { type: "text", text: "I'll help you implement this feature:" },
    {
      type: "tool-file-read",
      state: "output-available",
      input: {
        toolName: "file_read",
        args: {
          _kind: "read",
          path: "src/App.tsx",
        },
      },
      output: {
        _rawOutput: { content: "// Existing code here" },
      },
    },
    {
      type: "tool-file-edit",
      state: "output-available",
      input: {
        toolName: "file_edit",
        args: {
          _kind: "edit",
          path: "src/App.tsx",
          _locations: [{ path: "src/App.tsx", line: 10 }],
        },
      },
      output: {
        _rawOutput: { success: true },
        _content: [
          {
            type: "diff",
            path: "src/App.tsx",
            newText: "// Updated code here",
          },
        ],
        _locations: [{ path: "src/App.tsx", line: 10 }],
      },
    },
    { type: "text", text: "The feature has been implemented successfully!" },
  ]),
};

/**
 * Sample conversation flows showing realistic multi-turn interactions
 */
export const sampleConversations = {
  /** Simple back-and-forth conversation */
  simpleChat: [
    createMessage("msg-1", "user", [
      { type: "text", text: "Can you help me with React?" },
    ]),
    createMessage("msg-2", "assistant", [
      { type: "text", text: "Of course! What would you like to know?" },
    ]),
    createMessage("msg-3", "user", [
      { type: "text", text: "How do I use hooks?" },
    ]),
    createMessage("msg-4", "assistant", [
      {
        type: "text",
        text: "React hooks let you use state and other React features in functional components. The most common hooks are useState and useEffect.",
      },
    ]),
  ],

  /** Complex workflow showing file operations */
  complexWorkflow: [
    createMessage("msg-1", "user", [
      { type: "text", text: "Help me refactor this component" },
    ]),
    createMessage("msg-2", "assistant", [
      {
        type: "reasoning",
        text: "- Reading the component\n- Identifying issues\n- Planning refactoring",
      },
      { type: "text", text: "I'll analyze the component first:" },
      {
        type: "tool-file-read",
        state: "output-available",
        input: {
          toolName: "file_read",
          args: {
            _kind: "read",
            path: "src/components/Button.tsx",
          },
        },
        output: {
          _rawOutput: { content: "export const Button = () => <button>Click</button>" },
        },
      },
    ]),
    createMessage("msg-3", "assistant", [
      { type: "text", text: "Now I'll refactor it to accept props:" },
      {
        type: "tool-file-edit",
        state: "output-available",
        input: {
          toolName: "file_edit",
          args: {
            _kind: "edit",
            path: "src/components/Button.tsx",
            _locations: [{ path: "src/components/Button.tsx", line: 1 }],
          },
        },
        output: {
          _rawOutput: { success: true },
          _content: [
            {
              type: "diff",
              path: "src/components/Button.tsx",
              oldText: "export const Button = () => <button>Click</button>",
              newText: "interface ButtonProps {\n  label: string;\n}\n\nexport const Button = ({ label }: ButtonProps) => <button>{label}</button>",
            },
          ],
          _locations: [{ path: "src/components/Button.tsx", line: 1 }],
        },
      },
      {
        type: "text",
        text: "Done! I've added a props interface and updated the component to accept a label prop.",
      },
    ]),
  ],

  /** Conversation with plan and execution */
  plannedWorkflow: [
    createMessage("msg-1", "user", [
      { type: "text", text: "Add error handling to the API layer" },
    ]),
    createMessage("msg-2", "assistant", [
      { type: "text", text: "I'll add error handling to your API layer:" },
    ], {
      plan: [
        { content: "Review existing API code", status: "done", priority: "high" },
        { content: "Add error wrapper function", status: "done", priority: "high" },
        { content: "Update API calls to use error handler", status: "pending", priority: "high" },
        { content: "Add error logging", status: "pending", priority: "medium" },
      ],
    }),
    createMessage("msg-3", "assistant", [
      { type: "text", text: "I've created an error wrapper utility:" },
      {
        type: "tool-file-edit",
        state: "output-available",
        input: {
          toolName: "file_edit",
          args: {
            _kind: "create",
            path: "src/utils/api-error.ts",
          },
        },
        output: {
          _rawOutput: { success: true },
          _content: [
            {
              type: "diff",
              path: "src/utils/api-error.ts",
              newText: "export async function withErrorHandling<T>(\n  fn: () => Promise<T>\n): Promise<T | null> {\n  try {\n    return await fn();\n  } catch (error) {\n    console.error('API Error:', error);\n    return null;\n  }\n}",
            },
          ],
        },
      },
    ]),
  ],
};
