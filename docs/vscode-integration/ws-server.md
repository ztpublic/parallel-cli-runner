# WS Backend Server

The Rust binary can run as a standalone WS server for the VSCode extension.

## CLI usage

```
parallel-cli-runner --port <port> --auth-token <token>
```

- Binds to `127.0.0.1:<port>` only.
- Rejects WebSocket connections missing `?token=<token>`.
- Uses the WS request/response contract described in `docs/vscode-integration/ws-transport-contract.md`.
