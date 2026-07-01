# Agora MCP Server

Agora includes a dependency-free Model Context Protocol server for power users who want to connect Agora to local MCP clients. It runs over stdio, talks to the normal Agora API, and uses the authenticated user's existing role, permissions, and company scope.

The server is intentionally conservative in v0:

- Reads are enabled when `AGORA_API_TOKEN` is set.
- Writes are disabled unless `AGORA_MCP_ALLOW_WRITES=true`.
- Tokens never print to stdout.
- The process writes only JSON-RPC messages to stdout.
- Secrets should come from the MCP client config or `.env`, not prompts.

## Requirements

- Node.js 18 or newer.
- The Agora API running locally or hosted.
- An Agora session token from password login, Supabase token exchange, passwordless login, or trusted demo login.

Start the API:

```sh
npm run dev:api
```

Create or sign in to an account from the app, or request a token directly:

```sh
curl -s http://127.0.0.1:8787/api/auth/password-login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}'
```

Use the returned `token` as `AGORA_API_TOKEN`.

## Run Locally

```sh
AGORA_API_URL=http://127.0.0.1:8787 \
AGORA_API_TOKEN=replace-with-session-token \
AGORA_MCP_CLIENT_NAME="Local MCP client" \
npm run mcp
```

For trusted local automation that should be allowed to create tasks, update task status, or add comments:

```sh
AGORA_API_URL=http://127.0.0.1:8787 \
AGORA_API_TOKEN=replace-with-session-token \
AGORA_MCP_ALLOW_WRITES=true \
AGORA_MCP_CLIENT_NAME="Local MCP client" \
npm run mcp
```

Keep writes disabled for general chat, research, search, and reporting workflows.

## MCP Client Config

Use an absolute path for the script in desktop MCP clients:

```json
{
  "mcpServers": {
    "agora": {
      "command": "node",
      "args": ["/absolute/path/to/Agora/scripts/agora-mcp-server.js"],
      "env": {
        "AGORA_API_URL": "http://127.0.0.1:8787",
        "AGORA_API_TOKEN": "paste-session-token",
        "AGORA_MCP_ALLOW_WRITES": "false",
        "AGORA_MCP_CLIENT_NAME": "Local MCP client"
      }
    }
  }
}
```

For a hosted API:

```json
{
  "mcpServers": {
    "agora": {
      "command": "node",
      "args": ["/absolute/path/to/Agora/scripts/agora-mcp-server.js"],
      "env": {
        "AGORA_API_URL": "https://api.example.com",
        "AGORA_API_TOKEN": "paste-session-token",
        "AGORA_MCP_ALLOW_WRITES": "false",
        "AGORA_MCP_CLIENT_NAME": "Local MCP client"
      }
    }
  }
}
```

If you run from the repo with `.env`, the MCP server loads `.env` automatically. Values passed by the MCP client environment take precedence.

## Tools

Read tools:

- `get_session`: returns the current user, role, permissions, and company scope.
- `list_projects`: lists visible projects.
- `list_tasks`: lists visible tasks with filters for project, company, assignee, status, priority, tag, query, limit, and offset.
- `get_task`: returns one task plus related comments and activity.
- `get_project_status`: summarizes task counts, due work, approvals, comments, and activity for one project.
- `search_workspace`: searches visible projects, tasks, comments, activities, and approvals.
- `get_inbox_signals`: returns due tasks, blocked work, approvals, mentions, and recent comments.

Guarded write tools:

- `create_task`
- `update_task_status`
- `add_task_comment`

The write tools fail closed unless `AGORA_MCP_ALLOW_WRITES=true`. Agora still enforces server-side permissions, so a member or client token cannot use MCP to bypass the API.

Successful write tools also attempt to create an `mcp_tool` activity record on the affected project/task. If the write succeeds but the activity record cannot be created, the tool still returns the write result with `mcpAudit.recorded=false`.

## Resources

- `agora://workspace/summary`
- `agora://projects`
- `agora://tasks`
- `agora://inbox/signals`

## Security Notes

- Prefer local API URLs or trusted private network URLs.
- Use least-privilege sessions. A client-scoped token should be enough for client review workflows.
- Rotate the token after demos, screen shares, exported configs, or accidental prompt/log exposure.
- Keep `AGORA_MCP_ALLOW_WRITES=false` unless the client is trusted and the workflow needs writes.
- Let the MCP host ask for human approval before running write tools.
- Do not paste service-role keys, AI provider keys, SMTP passwords, Stripe keys, x402 keys, or Supabase service keys into MCP configs.
- Review `docs/api-agent-contract.md` before adding new MCP tools.

## Protocol Notes

Agora's v0 server follows the MCP stdio transport pattern: JSON-RPC messages are newline-delimited on stdin/stdout, and stdout is reserved for protocol messages. The server exposes `tools/list`, `tools/call`, `resources/list`, and `resources/read`; prompts are currently empty.

References:

- [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [MCP transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
