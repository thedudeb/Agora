# MCP Security Audit

Date: 2026-07-01

Scope:

- `scripts/agora-mcp-server.js`
- `docs/api-agent-contract.md`
- `.env.example`
- README and release checklist references

## Summary

The Agora MCP server is acceptable for a local v0 power-user release. It uses the existing Agora API as the trust boundary, requires a normal bearer token for API-backed tools and resources, keeps write tools disabled by default, records MCP write activity when possible, and does not log protocol or token data to stdout.

## Findings

No blocking security issues found for a local stdio v0.

Resolved during this pass:

- Protocol negotiation no longer echoes arbitrary client-requested protocol strings; it returns Agora's supported MCP protocol version.
- The MCP process now loads `.env` through the existing server env loader while preserving explicit MCP-client environment overrides.
- Successful MCP write tools now attempt to create a project/task activity record with type `mcp_tool`.

Residual risks:

- `AGORA_MCP_ALLOW_WRITES=true` gives the connected MCP host access to create tasks, update task status, and add comments within the authenticated user's server-side permissions. Use only with trusted local clients.
- Bearer tokens in desktop MCP config files are sensitive. Treat those files like credentials and rotate tokens after accidental exposure.
- The v0 server does not implement OAuth, per-tool policy prompts, or remote HTTP transport. Those should be designed before exposing MCP over a network.
- Search and summary tools can return client/company scoped workspace data. The API scopes records before return, but the MCP host and model still need appropriate data-handling rules.

## Controls Present

- Uses normal Agora `Authorization: Bearer <token>` authentication.
- Requires `AGORA_API_TOKEN` before API-backed tools and resources run.
- Uses existing API role checks and company scoping.
- Defaults `AGORA_MCP_ALLOW_WRITES` to false.
- Requires explicit env opt-in for write tools.
- Records successful MCP write tools as `mcp_tool` activity when the authenticated user has activity write permission.
- Avoids stdout logs; stdout is reserved for newline-delimited JSON-RPC responses.
- Keeps implementation dependency-free, reducing supply-chain surface for the v0 server.
- Adds syntax coverage to `npm run check` and the power-user CLI check path.

## Next Security Steps

- Add a dedicated MCP integration test that starts a temporary API, logs in, and calls read/write tools with writes both disabled and enabled.
- Add token creation and revocation UX for short-lived automation tokens.
- Add optional per-tool allowlists, for example `AGORA_MCP_TOOLS=list_tasks,get_task`.
- Add a remote MCP design only after OAuth, origin checks, rate limits, and audit logging are specified.
- Add deeper server-side audit entries for MCP write tool calls with client name, tool name, target id, and rationale when available.
