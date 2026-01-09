import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "~/components/ai-elements/message";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "~/components/ai-elements/prompt-input";
import { Loader } from "~/components/ai-elements/loader";
import { SettingsDialog } from "~/components/settings-dialog";
import { useAgentEnv } from "~/hooks/useAgentEnv";
import { renderMessagePart } from "~/utils/messageRenderer";
import { AVAILABLE_AGENTS, DEFAULT_AGENT } from "~/constants/agents";
import {
  createAcpChatTransport,
  type AcpPermissionRequestEvent,
} from "~/platform/acp-transport";
import { PermissionDialog } from "~/components/PermissionDialog";

/**
 * AcpAgentPanel - Main chat interface for ACP (Agent Client Protocol) agents
 *
 * This component provides a chat UI that connects to ACP-compatible agents
 * through the backend ACP runtime. It supports:
 * - Multiple ACP agents (Claude Code, Codex, Gemini, etc.)
 * - Per-agent environment variable configuration
 * - Streaming responses from agents
 * - Agent selection and switching
 */
interface AcpAgentPanelProps {
  agentId?: string;
  cwd?: string;
}

const AcpAgentPanel = ({ agentId, cwd }: AcpAgentPanelProps) => {
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(
    agentId ?? DEFAULT_AGENT
  );
  const [permissionQueue, setPermissionQueue] = useState<
    AcpPermissionRequestEvent[]
  >([]);
  const agentIdRef = useRef(agentId);

  useEffect(() => {
    if (agentId && agentId !== agentIdRef.current) {
      setSelectedAgent(agentId);
    }
    agentIdRef.current = agentId;
  }, [agentId]);

  // Get the selected agent object
  const currentAgent =
    AVAILABLE_AGENTS.find((agent) => agent.name === selectedAgent) ||
    AVAILABLE_AGENTS[0];

  // Prepare agent-scoped env state for the settings dialog
  const allEnvKeys = currentAgent.env.map((e) => e.key);
  const mandatoryEnvKeys = currentAgent.env
    .filter((e) => e.required !== false)
    .map((e) => e.key);
  const { envVars, setEnvVar } = useAgentEnv(
    currentAgent.command,
    allEnvKeys
  );

  const preparedEnv = useMemo(() => {
    const env: Record<string, string> = {};
    currentAgent.env.forEach((envConfig) => {
      const value = envVars[envConfig.key];
      if (value && value.trim()) {
        env[envConfig.key] = value;
      }
    });
    return env;
  }, [currentAgent, envVars]);

  const handlePermissionRequest = useCallback(
    (event: AcpPermissionRequestEvent) => {
      setPermissionQueue((prev) => [...prev, event]);
    },
    []
  );

  const transport = useMemo(
    () =>
      createAcpChatTransport({
        agent: currentAgent,
        env: preparedEnv,
        cwd,
        onPermissionRequest: handlePermissionRequest,
      }),
    [currentAgent, preparedEnv, cwd, handlePermissionRequest]
  );

  useEffect(() => {
    return () => {
      void transport.dispose();
    };
  }, [transport]);

  useEffect(() => {
    setPermissionQueue([]);
  }, [transport]);

  const chatId = useMemo(
    () => `${selectedAgent}-${cwd ?? ""}`,
    [selectedAgent, cwd]
  );

  const { messages, sendMessage, status, stop } = useChat({
    transport,
    id: chatId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      // Ensure all required env keys are present
      const missing = mandatoryEnvKeys.filter(
        (k) => !(envVars[k] ?? "").trim()
      );
      if (missing.length) {
        alert(`Please set required keys: ${missing.join(", ")}`);
        return;
      }

      sendMessage({ text: input });
      setInput("");
    }
  };

  const activePermission = permissionQueue[0] ?? null;

  const handlePermissionSelect = useCallback(
    async (optionId: string) => {
      if (!activePermission) return;
      await transport.replyPermission(activePermission.requestId, {
        outcome: "selected",
        optionId,
      });
      setPermissionQueue((prev) => prev.slice(1));
    },
    [activePermission, transport]
  );

  const handlePermissionCancel = useCallback(async () => {
    if (!activePermission) return;
    await transport.replyPermission(activePermission.requestId, {
      outcome: "cancelled",
    });
    setPermissionQueue((prev) => prev.slice(1));
  }, [activePermission, transport]);

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-background text-foreground">
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent className="p-4 space-y-4">
          {messages.map((message: UIMessage) => (
              <Message
                className="items-start"
                from={message.role as "user" | "assistant"}
                key={message.id}
              >
                <MessageContent>
                  {message.parts.map((part: any, index: number) =>
                    renderMessagePart(
                      part,
                      message.id,
                      index,
                      status === "streaming",
                      message.metadata as Record<string, unknown> | undefined
                    )
                  )}
                </MessageContent>
                {message.role === "assistant" && (
                  <MessageAvatar
                    name={currentAgent.command}
                    src={currentAgent.meta?.icon ?? ""}
                  />
                )}
              </Message>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <div className="flex-shrink-0 border-t bg-background pt-3 pb-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            onChange={(e) => setInput(e.target.value)}
            value={input}
            placeholder="What would you like to know?"
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputModelSelect
                onValueChange={setSelectedAgent}
                value={selectedAgent}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {AVAILABLE_AGENTS.map((agentOption) => (
                    <PromptInputModelSelectItem
                      key={agentOption.name}
                      value={agentOption.name}
                    >
                      {agentOption.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
              <SettingsDialog
                selectedAgentName={currentAgent.name}
                requiredKeyNames={allEnvKeys}
                mandatoryKeys={mandatoryEnvKeys}
                values={envVars}
                onChange={(k, v) => setEnvVar(k, v)}
              />
            </PromptInputTools>
            <PromptInputSubmit
              onAbort={stop}
              disabled={
                !input ||
                mandatoryEnvKeys.some((k) => !(envVars[k] ?? "").trim())
              }
              status={status}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
      <PermissionDialog
        open={Boolean(activePermission)}
        request={activePermission}
        onCancel={handlePermissionCancel}
        onSelect={handlePermissionSelect}
      />
    </div>
  );
};

export default AcpAgentPanel;
