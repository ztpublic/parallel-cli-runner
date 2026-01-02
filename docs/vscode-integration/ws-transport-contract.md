# WebSocket Transport Contract

This contract defines the WS-only request/response + event protocol shared by Tauri and VSCode.

## Message envelope

All messages are JSON and use one of these shapes:

Request:
```
{
  "type": "request",
  "id": "uuid-or-ulid",
  "method": "string",
  "params": { ... }
}
```

Response (success):
```
{
  "type": "response",
  "id": "uuid-or-ulid",
  "ok": true,
  "result": { ... }
}
```

Response (error):
```
{
  "type": "response",
  "id": "uuid-or-ulid",
  "ok": false,
  "error": {
    "message": "string",
    "code": "optional-string",
    "data": { ... }
  }
}
```

Event:
```
{
  "type": "event",
  "event": "string",
  "payload": { ... }
}
```

## Rules

- The client generates `id` values and must match responses by `id`.
- The server must return a response for every request.
- Events are one-way and do not include `id`.
- Unknown methods return an error response with `ok: false`.
- `params` and `result` are JSON-serializable.

## Current method names

These match the existing Tauri command surface; see `docs/vscode-integration/tauri-deps.md` for the full list.

Platform-routing methods (handled by extension host or backend as needed):
- `dialog.open`
- `shell.openPath`

## Event names

- `session-data`
- `scan-progress`

## Runtime config injection

The webview expects a global config object:

```
window.__APP_CONFIG__ = {
  wsUrl: "ws://127.0.0.1:12345",
  authToken: "token-string",
  settings: { /* same shape as VSCode settings */ }
};
```

- `wsUrl` is required in VSCode; in Tauri it can be injected later when the WS server is added.
- `authToken` is included in the WS query string (`?token=`).
- `settings` mirrors VSCode settings for easy conversion and merge.
