import type { LayoutNode, PaneMeta, PaneNode } from "../types/layout";
import { collectPanes, createId } from "../types/layout";
import { createSession, killSession, writeToSession } from "./backend";
import { disposeTerminal } from "./terminalRegistry";

export async function createPaneNode(opts?: {
  cwd?: string;
  meta?: PaneMeta;
  paneType?: "terminal" | "agent";
  agentId?: string;
}): Promise<PaneNode> {
  const resolvedMeta = opts?.meta
    ? { ...opts.meta, cwd: opts?.cwd ?? opts.meta.cwd }
    : opts?.cwd
      ? { cwd: opts.cwd }
      : undefined;

  const paneType = opts?.paneType ?? "terminal";

  // Agent panes don't need terminal sessions
  if (paneType === "agent") {
    return {
      type: "pane",
      id: createId(),
      paneType: "agent",
      sessionId: "",  // Agents don't use terminal sessions
      agentId: opts?.agentId ?? "Claude Code",
      meta: resolvedMeta,
      isEmpty: false,
    };
  }

  // Terminal panes need a session
  const sessionId = await createSession({ cwd: opts?.cwd });
  return {
    type: "pane",
    id: createId(),
    paneType: "terminal",
    sessionId,
    meta: resolvedMeta,
    isEmpty: false,
  };
}

/**
 * Create an agent pane node with the specified agent.
 * Agent panes don't have terminal sessions - they use the ACP protocol directly.
 */
export async function createAgentPaneNode(opts?: {
  agentId?: string;
  cwd?: string;
  meta?: PaneMeta;
}): Promise<PaneNode> {
  const resolvedMeta = opts?.meta
    ? { ...opts.meta, cwd: opts?.cwd ?? opts.meta.cwd }
    : opts?.cwd
      ? { cwd: opts.cwd }
      : undefined;

  return {
    type: "pane",
    id: createId(),
    paneType: "agent",
    sessionId: "",  // Agents don't use terminal sessions
    agentId: opts?.agentId ?? "Claude Code",
    meta: resolvedMeta,
    isEmpty: false,
  };
}

/**
 * Convert an empty pane to a terminal or agent pane.
 * Used when user selects what to create in an empty split pane.
 */
export async function convertEmptyPane(
  existingPaneId: string,
  paneType: "terminal" | "agent",
  opts?: { agentId?: string; cwd?: string }
): Promise<PaneNode> {
  if (paneType === "agent") {
    return {
      type: "pane",
      id: existingPaneId,  // Reuse the existing pane ID
      paneType: "agent",
      sessionId: "",
      agentId: opts?.agentId ?? "Claude Code",
      meta: opts?.cwd ? { cwd: opts.cwd } : undefined,
      isEmpty: false,
    };
  }

  // Terminal pane - need to create a session
  const sessionId = await createSession({ cwd: opts?.cwd });
  return {
    type: "pane",
    id: existingPaneId,  // Reuse the existing pane ID
    paneType: "terminal",
    sessionId,
    meta: opts?.cwd ? { cwd: opts.cwd } : undefined,
    isEmpty: false,
  };
}

export async function runStartCommand(pane: PaneNode, command: string): Promise<void> {
  if (!command.trim()) return;
  const commandToRun = command.endsWith("\n") ? command : `${command}\n`;
  await writeToSession({ id: pane.sessionId, data: commandToRun });
}

export async function killLayoutSessions(node: LayoutNode | null): Promise<void> {
  const panes = collectPanes(node);
  await Promise.all(
    panes.map(async (pane) => {
      // Agent panes don't have terminal sessions to clean up
      // ACP sessions are managed by the backend (AcpManager)
      if (pane.paneType === "agent") {
        return;
      }
      try {
        await killSession({ id: pane.sessionId });
      } catch {
        // Ignore session termination failures during teardown.
      } finally {
        disposeTerminal(pane.sessionId);
      }
    })
  );
}
