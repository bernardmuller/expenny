# MCP Server

The Expenny MCP server is a Go binary hosted on AWS Lambda. It speaks the
Model Context Protocol (MCP) over HTTP and uses OAuth 2.0 for authentication —
no tokens to copy or paste.

## How it works

1. The MCP client (Claude, Cursor, etc.) hits `POST /mcp` with no token.
2. The server returns `401 Unauthorized` with a `WWW-Authenticate` header
   pointing at Expenny's OAuth protected-resource metadata:
   ```
   WWW-Authenticate: Bearer resource_metadata="https://api.expenny.co.za/.well-known/oauth-protected-resource"
   ```
3. The client discovers the authorisation server, self-registers, and opens a
   browser login page at `https://expenny.co.za/login`.
4. The user signs in (OTP or Google) and consents. The client receives a
   refreshable access token and retries the tool call.

## Connecting from a client

**Claude Desktop / claude CLI:**
```sh
claude mcp add --transport http expenny https://mcp.expenny.co.za/mcp
```

**Cursor / other clients (mcp.json):**
```json
{
  "mcpServers": {
    "expenny": { "url": "https://mcp.expenny.co.za/mcp" }
  }
}
```

## Setup

- Create an AWS Lambda on ARM64 / Amazon Linux 2023.
- Add the AWS Lambda Web Adapter to the function's Layers section (required for
  the long-running streamable HTTP transport).
- Set the function timeout to ≥ 30 s.
- Build the binary with the `mcp` target in the Makefile, zip it, and upload it
  to the Lambda code block.
- Create an API Gateway route `POST /mcp` (and `GET /mcp` for SSE) pointing at
  the Lambda.
- Add the API Gateway URL to a CNAME record in Cloudflare.

## Lambda environment variables

| Variable | Description |
|---|---|
| `EXPENNY_API_URL` | Base URL of the Expenny API, e.g. `https://api.expenny.co.za`. Must be absolute — it is returned to MCP clients as the `resource_metadata` URL in the `WWW-Authenticate` challenge. Defaults to `http://localhost:8080`. |
| `PORT` | Port to listen on (default `5420`; set to `8080` for Lambda Web Adapter) |
