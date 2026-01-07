/**
 * TauriAcpTransport - AI SDK Chat Transport for ACP (Agent Client Protocol)
 *
 * This transport bridges the AI SDK's useChat hook with the Tauri backend
 * that communicates with ACP agents.
 *
 * Flow:
 * 1. sendMessages() invokes the Tauri "acp_chat" command
 * 2. Tauri creates/uses an ACP session and sends the prompt
 * 3. Responses are streamed via Tauri events ("acp:chunk")
 * 4. This transport converts those events to an AI SDK-compatible stream
 */

import type { ChatTransport, SendMessagesOptions } from "ai";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface AcpChunkEvent {
  chunkType: string;
  text?: string;
  metadata?: unknown;
}

interface AcpChatRequest {
  messages: unknown;
  agent: {
    command: string;
    args: string[];
    env: Record<string, string>;
    cwd?: string;
  };
  envVars: Record<string, string>;
}

interface AcpChatResponse {
  streamId: string;
}

/**
 * Convert AI SDK messages to ACP format
 *
 * AI SDK CoreMessage format:
 * { role: "user" | "assistant" | "system", content: string | { parts: [...] } }
 *
 * ACP expects messages array
 */
function prepareAcpMessages(messages: unknown[]): unknown {
  return {
    messages,
  };
}

/**
 * Get the current working directory
 */
async function getCwd(): Promise<string> {
  // In Tauri, we can use the current working directory
  // For now, use a reasonable default
  return process.cwd?.() ?? "/";
}

/**
 * Get agent configuration from localStorage or use defaults
 */
function getAgentConfig(): AcpChatRequest["agent"] {
  // For now, return a default config
  // This should be enhanced to read from the selected agent
  return {
    command: "claude",
    args: ["acp"],
    env: {},
  };
}

/**
 * Get agent environment variables from localStorage
 */
function getAgentEnvVars(agentName: string): Record<string, string> {
  const vars: Record<string, string> = {};
  // Read from localStorage pattern: AI_AGENT_ENV_${agent}_${key}
  const prefix = `AI_AGENT_ENV_${agentName}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const envKey = key.slice(prefix.length);
      vars[envKey] = localStorage.getItem(key) ?? "";
    }
  }
  return vars;
}

/**
 * ReadableStream that converts Tauri events to AI SDK chunks
 */
class TauriEventStream extends ReadableStream {
  constructor(streamId: string, controller: AbortController) {
    super({
      async start(controller) {
        const unlisten = await listen<[string, AcpChunkEvent]>(
          "acp:chunk",
          (event) => {
            const [eventId, chunk] = event.payload;
            if (eventId !== streamId) return;

            if (chunk.chunkType === "done") {
              controller.close();
              return;
            }

            if (chunk.chunkType === "error") {
              controller.error(new Error(chunk.text ?? "Unknown error"));
              return;
            }

            if (chunk.chunkType === "text" && chunk.text) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: "text-delta",
                    textDelta: chunk.text,
                  })}\n\n`
                )
              );
            }

            if (chunk.chunkType === "metadata" && chunk.metadata) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: "metadata",
                    metadata: chunk.metadata,
                  })}\n\n`
                )
              );
            }
          }
        );

        // Cleanup on abort
        controller.signal.addEventListener("abort", () => {
          unlisten();
        });
      },
    });
  }
}

/**
 * TauriAcpTransport - Chat transport that uses Tauri commands for ACP
 *
 * This implements the ChatTransport interface from the AI SDK.
 */
export class TauriAcpTransport implements ChatTransport {
  /**
   * Send messages to the ACP agent and return a stream of responses
   */
  async sendMessages({ messages, abortSignal }: SendMessagesOptions) {
    const controller = new AbortController();

    // Handle abort from the caller
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        controller.abort();
      });
    }

    // Get agent configuration
    const agent = getAgentConfig();
    const envVars = getAgentEnvVars(agent.command);

    // Prepare the request
    const request: AcpChatRequest = {
      messages: prepareAcpMessages(messages),
      agent,
      envVars,
    };

    try {
      // Invoke the Tauri command
      const response = await invoke<AcpChatResponse>("acp_chat", {
        request,
      });

      // Return a stream that listens for Tauri events
      return new TauriEventStream(response.streamId, controller);
    } catch (error) {
      controller.abort(error as Error);
      throw error;
    }
  }

  /**
   * Reconnection is not supported for ACP sessions
   * Each request creates a new session or reuses a cached one
   */
  async reconnectToStream() {
    throw new Error("Reconnection not supported for ACP transport");
  }
}

/**
 * Create a TauriAcpTransport instance
 */
export function createTauriAcpTransport(): TauriAcpTransport {
  return new TauriAcpTransport();
}
