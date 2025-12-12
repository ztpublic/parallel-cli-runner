import { useCallback, useState } from "react";
import type { Agent } from "../types/agent";

type Params = {
  canCreate: boolean;
  defaultAgentName: string;
  onBlocked: () => void;
  onCreate: (args: { name: string; startCommand: string }) => Promise<Agent>;
  onCreated: (agent: Agent) => void | Promise<void>;
};

export function useCreateAgentDialog(params: Params) {
  const [open, setOpen] = useState(false);
  const [agentNameInput, setAgentNameInput] = useState("");
  const [agentCommandInput, setAgentCommandInput] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);

  const openDialog = useCallback(() => {
    if (!params.canCreate) {
      params.onBlocked();
      return;
    }
    setAgentError(null);
    setAgentNameInput((prev) => prev || params.defaultAgentName);
    setOpen(true);
  }, [params]);

  const closeDialog = useCallback(() => {
    if (creatingAgent) return;
    setOpen(false);
  }, [creatingAgent]);

  const confirmCreate = useCallback(async () => {
    const name = agentNameInput.trim();
    const startCommand = agentCommandInput.trim();

    if (!name) {
      setAgentError("Add an agent name.");
      return;
    }

    if (!startCommand) {
      setAgentError("Add a starting command.");
      return;
    }

    setCreatingAgent(true);
    setAgentError(null);
    try {
      const agent = await params.onCreate({ name, startCommand });
      await params.onCreated(agent);
      setOpen(false);
      setAgentNameInput("");
      setAgentCommandInput("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : null;
      setAgentError(message || "Failed to create agent.");
    } finally {
      setCreatingAgent(false);
    }
  }, [agentCommandInput, agentNameInput, params]);

  return {
    open,
    agentNameInput,
    setAgentNameInput,
    agentCommandInput,
    setAgentCommandInput,
    agentError,
    creatingAgent,
    openDialog,
    closeDialog,
    confirmCreate,
    setAgentError,
  };
}

