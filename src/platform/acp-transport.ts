import type { ChatTransport, FinishReason, UIMessage, UIMessageChunk } from "ai";
import { getAppConfig } from "./config";
import { getTransport } from "./transport";

type AcpAgentConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

type AcpConnectionInfo = {
  id: string;
  status: string;
  protocolVersion?: string;
  agentInfo?: { name: string; title?: string; version?: string };
};

type AcpSessionNotification = {
  sessionId: string;
  update: Record<string, unknown>;
};

type AcpSessionUpdateEvent = {
  connectionId: string;
  notification: AcpSessionNotification;
};

export type PermissionOption = {
  optionId: string;
  name: string;
  kind: string;
};

export type AcpPermissionRequest = {
  sessionId: string;
  options: PermissionOption[];
  toolCall?: Record<string, unknown>;
};

export type AcpPermissionRequestEvent = {
  connectionId: string;
  requestId: string;
  request: AcpPermissionRequest;
};

type AcpPermissionOutcome =
  | { outcome: "cancelled" }
  | { outcome: "selected"; optionId: string };

type ContentBlock = {
  type: string;
  text?: string;
};

type AcpTransportConfig = {
  agent: {
    command: string;
    args?: string[];
    acpDelay?: number;
  };
  env: Record<string, string>;
  cwd?: string;
  onPermissionRequest?: (event: AcpPermissionRequestEvent) => void;
};

type ToolCallPayload = {
  toolCallId?: unknown;
  title?: unknown;
  kind?: unknown; // Tool kind: read, edit, delete, move, search, execute, think, fetch, other
  rawInput?: unknown;
  rawOutput?: unknown;
  status?: unknown;
  content?: unknown; // ToolCallContent array
  locations?: unknown; // ToolCallLocation array
};

const EMPTY_PROMPT_ERROR = "No user message available to send.";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveCwd(cwd?: string): string {
  if (cwd && cwd.trim()) return cwd;
  const config = getAppConfig();
  return config.workspacePath?.trim() || "/";
}

function extractTextFromContentBlock(block: unknown): string | null {
  if (!block || typeof block !== "object") return null;
  const record = block as Record<string, unknown>;
  const blockType = record.type;
  if (blockType === "text" || blockType === "thinking") {
    const text = record.text;
    if (typeof text === "string") {
      return text;
    }
  }
  if (blockType === "thinking_silently") {
    return "...";
  }
  return null;
}

// Helper to check if content block is rich content (not plain text)
function isRichContentBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const record = block as Record<string, unknown>;
  const blockType = record.type;
  if (typeof blockType !== "string") return false;
  // Rich content types from ACP protocol
  return blockType === "image" || blockType === "audio" ||
         blockType === "resource" || blockType === "resource_link";
}

function pickPromptMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      return messages[i];
    }
  }
  return null;
}

function uiMessageToContentBlocks(message: UIMessage): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  message.parts.forEach((part) => {
    if (part.type === "text" && part.text) {
      blocks.push({ type: "text", text: part.text });
    }
  });
  return blocks;
}

function getUpdateEntry(update: Record<string, unknown>): {
  kind: string;
  payload: Record<string, unknown>;
} | null {
  const kind = update.sessionUpdate;
  if (typeof kind === "string") {
    return { kind, payload: update };
  }
  return null;
}

function normalizeToolName(title: unknown, toolCallId: unknown): string {
  if (typeof title === "string" && title.trim()) {
    return title;
  }
  if (typeof toolCallId === "string" && toolCallId.trim()) {
    return toolCallId;
  }
  return "tool";
}

function formatToolError(rawOutput: unknown): string {
  if (typeof rawOutput === "string") {
    return rawOutput;
  }
  if (rawOutput && typeof rawOutput === "object") {
    try {
      return JSON.stringify(rawOutput);
    } catch {
      return "Tool failed.";
    }
  }
  return "Tool failed.";
}

export class AcpChatTransport implements ChatTransport<UIMessage> {
  private readonly transport = getTransport();
  private connectionId: string | null = null;
  private sessionId: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private permissionUnsubscribe: (() => void) | null = null;

  constructor(private readonly config: AcpTransportConfig) {}

  async sendMessages({ messages, abortSignal }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]) {
    const sessionId = await this.ensureSession();
    const promptMessage = pickPromptMessage(messages);
    if (!promptMessage) {
      throw new Error(EMPTY_PROMPT_ERROR);
    }

    const prompt = uiMessageToContentBlocks(promptMessage);
    if (!prompt.length) {
      throw new Error(EMPTY_PROMPT_ERROR);
    }

    const textId = createId("text");
    const reasoningId = createId("reasoning");
    const toolStates = new Map<string, "input" | "output">();
    let textStarted = false;
    let reasoningStarted = false;
    let closed = false;

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const unsubscribe = this.transport.subscribe<AcpSessionUpdateEvent>(
          "acp-session-update",
          (event) => {
            if (event.connectionId !== this.connectionId) {
              return;
            }
            if (event.notification.sessionId !== sessionId) {
              return;
            }

            const updateEntry = getUpdateEntry(event.notification.update);
            if (!updateEntry) {
              return;
            }

            switch (updateEntry.kind) {
              case "agent_message_chunk": {
                const content = updateEntry.payload.content;

                // Check if this is rich content (image, audio, resource, resource_link)
                if (isRichContentBlock(content)) {
                  // Pass rich content through via message-metadata
                  controller.enqueue({
                    type: "message-metadata",
                    messageMetadata: { richContent: content },
                  });
                  break;
                }

                // Handle plain text content
                const text = extractTextFromContentBlock(content);
                if (!text) return;
                if (!textStarted) {
                  controller.enqueue({ type: "text-start", id: textId });
                  textStarted = true;
                }
                controller.enqueue({ type: "text-delta", id: textId, delta: text });
                break;
              }
              case "agent_thought_chunk": {
                const text = extractTextFromContentBlock(updateEntry.payload.content);
                if (!text) return;
                if (!reasoningStarted) {
                  controller.enqueue({ type: "reasoning-start", id: reasoningId });
                  reasoningStarted = true;
                }
                controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: text });
                break;
              }
              case "plan": {
                const entries = updateEntry.payload.entries;
                if (Array.isArray(entries)) {
                  controller.enqueue({
                    type: "message-metadata",
                    messageMetadata: { plan: entries },
                  });
                }
                break;
              }
              case "tool_call": {
                const payload = updateEntry.payload as ToolCallPayload;
                const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : null;
                if (!toolCallId) return;
                const toolName = normalizeToolName(payload.title, payload.toolCallId);
                const toolKind = typeof payload.kind === "string" ? payload.kind : undefined;
                const rawInput = payload.rawInput ?? payload.content ?? {};

                // Wrap input in the format expected by messageRenderer
                // { toolName: string, args: Record<string, unknown>, _kind?, _locations?, _content? }
                const enrichedInput = {
                  toolName: toolName,
                  args: rawInput,
                  _kind: toolKind,
                  _locations: Array.isArray(payload.locations) ? payload.locations : undefined,
                  _content: Array.isArray(payload.content) ? payload.content : undefined,
                };

                if (toolStates.get(toolCallId) !== "output") {
                  toolStates.set(toolCallId, "input");
                  controller.enqueue({
                    type: "tool-input-available",
                    toolCallId,
                    toolName,
                    input: enrichedInput,
                    providerExecuted: true,
                  });
                }
                break;
              }
              case "tool_call_update": {
                const payload = updateEntry.payload as ToolCallPayload;
                const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : null;
                if (!toolCallId) return;
                const toolName = normalizeToolName(payload.title, payload.toolCallId);
                const toolKind = typeof payload.kind === "string" ? payload.kind : undefined;
                const status = typeof payload.status === "string" ? payload.status : null;
                const rawOutput = payload.rawOutput ?? payload.content ?? null;

                // Include kind, locations, and content in output for the messageRenderer
                const enrichedOutput = rawOutput !== null ? {
                  _rawOutput: rawOutput,
                  _kind: toolKind,
                  _locations: Array.isArray(payload.locations) ? payload.locations : undefined,
                  _content: Array.isArray(payload.content) ? payload.content : undefined,
                } : null;

                if (toolStates.get(toolCallId) !== "output") {
                  const rawInput = payload.rawInput ?? {};
                  const enrichedInput = {
                    toolName: toolName,
                    args: rawInput,
                    _kind: toolKind,
                    _locations: Array.isArray(payload.locations) ? payload.locations : undefined,
                    _content: Array.isArray(payload.content) ? payload.content : undefined,
                  };
                  if (payload.rawInput !== undefined || !toolStates.has(toolCallId)) {
                    toolStates.set(toolCallId, "input");
                    controller.enqueue({
                      type: "tool-input-available",
                      toolCallId,
                      toolName,
                      input: enrichedInput,
                      providerExecuted: true,
                    });
                  }
                }

                if (status === "failed") {
                  toolStates.set(toolCallId, "output");
                  controller.enqueue({
                    type: "tool-output-error",
                    toolCallId,
                    errorText: formatToolError(rawOutput),
                    providerExecuted: true,
                  });
                  break;
                }

                if (status === "completed" || rawOutput !== null) {
                  toolStates.set(toolCallId, "output");
                  controller.enqueue({
                    type: "tool-output-available",
                    toolCallId,
                    output: enrichedOutput,
                    providerExecuted: true,
                  });
                }
                break;
              }
              case "user_message_chunk": {
                // Handle user message chunks for session loading/replay
                const text = extractTextFromContentBlock(updateEntry.payload.content);
                if (!text) return;
                // Create a text part for user messages
                controller.enqueue({
                  type: "text-delta",
                  id: textId,
                  delta: text,
                });
                break;
              }
              case "available_commands_update": {
                // Handle available slash commands
                const availableCommands = updateEntry.payload.availableCommands;
                if (Array.isArray(availableCommands)) {
                  controller.enqueue({
                    type: "message-metadata",
                    messageMetadata: { availableCommands },
                  });
                }
                break;
              }
              case "current_mode_update": {
                // Handle session mode changes
                const modeId = updateEntry.payload.modeId;
                if (typeof modeId === "string") {
                  controller.enqueue({
                    type: "message-metadata",
                    messageMetadata: { currentMode: modeId },
                  });
                }
                break;
              }
              default:
                break;
            }
          }
        );

        const closeStream = (finishReason?: FinishReason) => {
          if (closed) return;
          closed = true;
          if (textStarted) {
            controller.enqueue({ type: "text-end", id: textId });
          }
          if (reasoningStarted) {
            controller.enqueue({ type: "reasoning-end", id: reasoningId });
          }
          controller.enqueue(
            finishReason ? { type: "finish", finishReason } : { type: "finish" }
          );
          controller.close();
          unsubscribe();
        };

        const sendPrompt = async () => {
          try {
            await this.transport.request<void>("acp_session_prompt", {
              sessionId,
              prompt,
            });
            closeStream();
          } catch (error) {
            controller.enqueue({
              type: "error",
              errorText: error instanceof Error ? error.message : String(error),
            });
            closeStream("error");
          }
        };

        sendPrompt();

        if (abortSignal) {
          abortSignal.addEventListener(
            "abort",
            () => {
              this.transport
                .request<void>("acp_session_cancel", { sessionId })
                .catch(() => undefined);
              controller.enqueue({ type: "abort" });
              closeStream();
            },
            { once: true }
          );
        }
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }

  async replyPermission(requestId: string, outcome: AcpPermissionOutcome): Promise<void> {
    await this.transport.request<void>("acp_permission_reply", {
      requestId,
      outcome,
    });
  }

  async dispose(): Promise<void> {
    if (!this.connectionId) {
      return;
    }
    const connectionId = this.connectionId;
    this.connectionId = null;
    this.sessionId = null;
    if (this.permissionUnsubscribe) {
      this.permissionUnsubscribe();
      this.permissionUnsubscribe = null;
    }
    await this.transport.request<void>("acp_disconnect", { id: connectionId }).catch(() => undefined);
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }

  private async ensureSession(): Promise<string> {
    await this.ensureConnection();
    if (!this.connectionId) {
      throw new Error("ACP connection not initialized.");
    }
    if (this.sessionId) {
      return this.sessionId;
    }
    const cwd = resolveCwd(this.config.cwd);
    const sessionId = await this.transport.request<string>("acp_session_new", {
      connectionId: this.connectionId,
      cwd,
      mcpServers: [],
    });
    this.sessionId = sessionId;
    return sessionId;
  }

  private async ensureConnection(): Promise<void> {
    if (this.connectionId) return;
    if (!this.connectPromise) {
      this.connectPromise = (async () => {
        const info = await this.transport.request<AcpConnectionInfo>("acp_connect", {
          command: this.config.agent.command,
          args: this.config.agent.args ?? [],
          env: this.config.env,
          cwd: this.config.cwd,
        } satisfies AcpAgentConfig);
        this.connectionId = info.id;
        this.listenForPermissions();
        if (this.config.agent.acpDelay && this.config.agent.acpDelay > 0) {
          await new Promise((resolve) => {
            setTimeout(resolve, this.config.agent.acpDelay);
          });
        }
      })().finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }

  private listenForPermissions(): void {
    if (this.permissionUnsubscribe || !this.connectionId) {
      return;
    }
    this.permissionUnsubscribe = this.transport.subscribe<AcpPermissionRequestEvent>(
      "acp-permission-request",
      (event) => {
        if (event.connectionId !== this.connectionId) {
          return;
        }
        if (this.sessionId && event.request.sessionId !== this.sessionId) {
          return;
        }
        this.config.onPermissionRequest?.(event);
      }
    );
  }
}

export function createAcpChatTransport(config: AcpTransportConfig): AcpChatTransport {
  return new AcpChatTransport(config);
}
