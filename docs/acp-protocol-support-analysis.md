# ACP Protocol Support Analysis

## Overview

This document compares the ACP (Agent Client Protocol) specification defined in `/docs/protocol/` against the actual implementation in the codebase to identify unsupported protocol messages and features.

## Protocol Messages vs Implementation Status

### Fully Implemented

| Message | Direction | Status | Notes |
|---------|-----------|--------|-------|
| `acp_connect` | Client→Agent | ✅ | Connection establishment |
| `acp_disconnect` | Client→Agent | ✅ | Connection termination |
| `acp_session_new` | Client→Agent | ✅ | Session creation |
| `acp_session_prompt` | Client→Agent | ✅ | Sending prompts |
| `acp_session_cancel` | Client→Agent | ✅ | Canceling operations |
| `acp_permission_reply` | Client→Agent | ✅ | Permission responses |
| `acp-session-update` | Agent→Client | ✅ | Streaming updates |
| `acp-permission-request` | Agent→Client | ✅ | Permission requests |

### Partially Implemented / Via Backend

| Message | Direction | Status | Notes |
|---------|-----------|--------|-------|
| `session/load` | Client→Agent | ⚠️ | Transport has `acp_session_load` but may not be fully exposed in UI |

---

## Unsupported Protocol Messages

### High Priority (Protocol Required)

| Message | Direction | Description |
|---------|-----------|-------------|
| **`initialize`** | Client→Agent | Formal capability negotiation and protocol version exchange |

### Medium Priority (Common Optional Features)

| Message | Direction | Description |
|---------|-----------|-------------|
| **Initialization Phase** |||
| `authenticate` | Agent→Client | Authentication if required by agent |
| **File System Operations** |||
| `fs/read_text_file` | Client→Agent | Read file contents |
| `fs/write_text_file` | Client→Agent | Write file contents |
| **Terminal Operations** |||
| `terminal/create` | Client→Agent | Create terminal session |
| `terminal/output` | Client→Agent | Get terminal output |
| `terminal/wait_for_exit` | Client→Agent | Wait for terminal completion |
| `terminal/kill` | Client→Agent | Kill terminal process |
| `terminal/release` | Client→Agent | Release terminal resources |
| **Session Management** |||
| `session/set_mode` | Client→Agent | Change session mode programmatically |

### Low Priority (Advanced Features)

| Feature | Type | Description |
|---------|------|-------------|
| Audio content | Content Type | Audio input support |
| Embedded resources | Content Type | Embedded resource content |
| `user_message_chunk` | Update Type | User message streaming (unclear if handled) |

---

## Detailed Feature Comparison

### 1. Initialization Phase

**Protocol Spec:**
- `initialize` method for capability negotiation
- `authenticate` method if agent requires auth

**Current Implementation:**
- ❌ No explicit `initialize` call
- ❌ No `authenticate` support
- ⚠️ Uses `acp_connect` which may initialize internally

**Gap:** The frontend doesn't participate in formal capability negotiation. It relies on backend implementation.

---

### 2. Session Management

**Protocol Spec:**
| Method | Required | Description |
|--------|----------|-------------|
| `session/new` | Required | Create session |
| `session/load` | Optional | Load existing session |
| `session/cancel` | Required | Cancel operations |
| `session/prompt` | Required | Send prompt |
| `session/set_mode` | Optional | Change mode |

**Current Implementation:**
- ✅ `acp_session_new`
- ⚠️ `acp_session_load` exists but UI integration unclear
- ✅ `acp_session_cancel`
- ✅ `acp_session_prompt`
- ❌ `session/set_mode` not exposed

**Gap:** Mode switching is not available as a client-initiated action.

---

### 3. Content Types

**Protocol Spec:**
| Type | Required | Capability |
|------|----------|------------|
| Text | Required | - |
| ResourceLink | Required | - |
| Image | Optional | `image` |
| Audio | Optional | `audio` |
| Resource | Optional | `embeddedContext` |

**Current Implementation:**
- ✅ Text rendering via `renderMessagePart`
- ✅ ResourceLink support
- ⚠️ Image support - may be partially implemented
- ❌ Audio content not explicitly handled
- ❌ Embedded resources not explicitly handled

**Gap:** Optional rich content types not fully supported in UI layer.

---

### 4. Session Update Types

**Protocol Spec (via `session/update`):**
| Type | Description | Status |
|------|-------------|--------|
| `user_message_chunk` | User message streaming | ❓ Unclear |
| `agent_message_chunk` | Agent response streaming | ✅ |
| `agent_thought_chunk` | Reasoning streaming | ✅ |
| `tool_call` | New tool invocation | ✅ |
| `tool_call_update` | Tool status/results | ✅ |
| `plan` | Execution plan updates | ✅ |
| `available_commands_update` | Slash commands | ✅ |
| `current_mode_update` | Mode changes | ✅ |

---

### 5. File System Operations

**Protocol Spec:**
- `fs/read_text_file` - Read files (Optional, `fs.readTextFile` capability)
- `fs/write_text_file` - Write files (Optional, `fs.writeTextFile` capability)

**Current Implementation:**
- ❌ No file system methods exposed to client
- ⚠️ Backend may handle internally

**Gap:** No client-side file operations via ACP protocol.

---

### 6. Terminal Operations

**Protocol Spec:**
| Method | Description |
|--------|-------------|
| `terminal/create` | Create terminal |
| `terminal/output` | Get output |
| `terminal/wait_for_exit` | Wait for completion |
| `terminal/kill` | Kill process |
| `terminal/release` | Release resources |

**Current Implementation:**
- ❌ No terminal methods exposed to client
- ⚠️ Terminal output shown via `tool_call_update` with `kind: "execute"`

**Gap:** Terminal operations not directly accessible; only visible through tool call updates.

---

### 7. Permission System

**Protocol Spec:**
- `session/request_permission` - Request user approval

**Current Implementation:**
- ✅ `acp-permission-request` event
- ✅ `acp_permission_reply` method
- ✅ PermissionDialog UI component

**Status:** Fully implemented

---

### 8. Tool Call Kinds

**Protocol Spec:**
`read`, `edit`, `delete`, `move`, `search`, `execute`, `think`, `fetch`, `switch_mode`, `other`

**Current Implementation:**
- ✅ All kinds recognized in transport
- ✅ Rendered via `renderMessagePart`

**Status:** Fully supported

---

## Critical Files

### Implementation Files
| File | Description |
|------|-------------|
| `/src/platform/acp-transport.ts` | Core ACP transport implementation |
| `/src/platform/transport.ts` | Low-level transport (WebSocket/Tauri) |
| `/src/features/acp/AcpAgentPanel.tsx` | Main chat UI |
| `/src/components/PermissionDialog.tsx` | Permission UI |
| `/src/utils/messageRenderer.tsx` | Message rendering logic |

### Protocol Documentation
| File | Description |
|------|-------------|
| `/docs/protocol/overview.mdx` | Protocol overview |
| `/docs/protocol/initialization.mdx` | Init phase spec |
| `/docs/protocol/session-setup.mdx` | Session creation |
| `/docs/protocol/prompt-turn.mdx` | Prompt handling |
| `/docs/protocol/file-system.mdx` | FS operations |
| `/docs/protocol/terminals.mdx` | Terminal operations |
| `/docs/protocol/session-modes.mdx` | Mode switching |
| `/docs/protocol/content.mdx` | Content types |

---

## Summary

### What IS Implemented

The codebase implements the **core required ACP protocol features** for basic chat functionality:

- ✅ Session creation and prompting
- ✅ Streaming responses (text, thoughts, plans)
- ✅ Tool call execution and tracking
- ✅ Permission request handling
- ✅ Multi-agent support with environment isolation
- ✅ Working directory context
- ✅ Error handling and recovery

### What is NOT Implemented

**Missing protocol features:**
- ❌ Formal initialization (`initialize`)
- ❌ File system client operations
- ❌ Terminal client operations
- ❌ Session mode switching (`session/set_mode`)
- ❌ Some optional content types (audio, embedded resources)
- ❌ Session loading (partial - transport supports it, UI unclear)

**Conclusion:** The implementation prioritizes the **chat interface** features over **system operations** (FS, terminal), which may be intentional - those operations are likely handled internally by the backend/agent rather than exposed to the client.

---

## Unsupported Features Priority Matrix

### High Priority (Protocol Required)
1. **`initialize` method** - Formal capability negotiation is missing

### Medium Priority (Common Optional Features)
1. **`session/set_mode`** - Programmatic mode switching
2. **`session/load`** - Session resumption (partially implemented)
3. **Image/Audio content types** - Rich input support
4. **File system operations** - Client-side file access
5. **Terminal operations** - Direct terminal control

### Low Priority (Advanced Features)
1. **Authentication** - If agents require auth
2. **Custom extensions** - `_meta` fields and custom methods
3. **Embedded resources** - Resource content type
4. **HTTP transport** - For MCP servers

---

## Verification Steps

To verify this analysis:

1. Test session loading functionality
2. Check if `user_message_chunk` updates are rendered
3. Verify image/audio content rendering
4. Test mode switching (if available in any agent)
5. Check if backend handles file/terminal ops internally
