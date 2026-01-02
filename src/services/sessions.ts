import type { LayoutNode, PaneMeta, PaneNode } from "../types/layout";
import { collectPanes, createId } from "../types/layout";
import { createSession, killSession, writeToSession } from "./backend";
import { disposeTerminal } from "./terminalRegistry";

export async function createPaneNode(opts?: {
  cwd?: string;
  meta?: PaneMeta;
}): Promise<PaneNode> {
  const sessionId = await createSession({ cwd: opts?.cwd });
  const resolvedMeta = opts?.meta
    ? { ...opts.meta, cwd: opts?.cwd ?? opts.meta.cwd }
    : opts?.cwd
      ? { cwd: opts.cwd }
      : undefined;
  return {
    type: "pane",
    id: createId(),
    sessionId,
    meta: resolvedMeta,
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
