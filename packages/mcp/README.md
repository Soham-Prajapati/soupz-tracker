# Soupz Tracker MCP

Local MCP access to the versioned Soupz Tracker engine. The server never calls an AI
provider and never accepts an AI API key; the MCP client owns its model and billing.

The default transport is stdio:

```sh
node packages/mcp/src/cli.js
```

HTTP is optional, binds only to `127.0.0.1`, and requires a user-chosen port plus a
bearer token supplied at runtime. Keep the value outside tracked files:

```sh
node packages/mcp/src/cli.js --http --port 43121
```

Set `SOUPZ_MCP_TOKEN` in the launching process environment before running that command.

The endpoint is `/mcp`. Its Host header must match `127.0.0.1:<port>` and every request
must carry `Authorization: Bearer <token>`. Soupz never prints the token.
