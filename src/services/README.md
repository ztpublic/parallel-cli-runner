# Services

Non-React logic and side-effectful helpers.

- `src/services/backend.ts` wraps transport requests for sessions, git operations, and backend events.
- `src/services/sessions.ts` manages pane/PTY lifecycle and start commands.
- `src/services/terminalRegistry.ts` wires xterm instances to backend sessions and resize behavior.
- `src/services/storage.ts` and `src/services/storageKeys.ts` handle persisted UI state.
- `src/services/errors.ts` formats backend errors for display.
