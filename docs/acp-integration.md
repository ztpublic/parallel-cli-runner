# ACP Integration Notes

- ACP runtime lives in `src-tauri/src/acp/` and is shared by Tauri + standalone WS server modes.
- `AcpManager` owns per-agent connections, each running in a `tokio::task::LocalSet` because the ACP crate uses non-Send futures.
- The stdio transport spawns agent subprocesses with piped stdin/stdout; ACP framing is handled by `agent-client-protocol`.
- Phase 2 will expose ACP operations through the existing WS contract (`docs/vscode-integration/ws-transport-contract.md`).
