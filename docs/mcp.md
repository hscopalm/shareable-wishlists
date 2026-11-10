# MCP server

Gift Guru exposes a remote MCP server at `/api/mcp` (Streamable HTTP, stateless, JSON responses). Assistants can read lists, manage items, share, and claim, with the same authorization rules as the web app. List owners never see claim data through MCP.

Auth is either OAuth 2.1 (Gift Guru is its own authorization server, login uses the normal Google session) or a personal access token sent as `Authorization: Bearer <token>`. Scopes are `wishlists` (full) and `wishlists:read` (read-only tools). Users manage tokens and connected apps at `/connect`.

The whole feature is off unless `MCP_ENABLED=true`. When off, `/api/mcp`, `/api/oauth/*`, `/.well-known/oauth-*` and `/api/mcp-tokens` return 404. Production sets it to `"true"` in `terraform/ecs.tf`; set `"false"` to turn it off. `PUBLIC_BASE_URL` is the OAuth issuer and resource origin (`https://www.giftguru.cc` in prod, `http://localhost` locally).

## Testing locally

```bash
docker-compose up --build -d        # .env.development needs MCP_ENABLED=true and PUBLIC_BASE_URL=http://localhost (see env.example)
cd backend && npm run seed
npm run mcp:token -- --email alice.johnson@example.com --scope wishlists   # prints a PAT
npm run mcp:e2e                      # OAuth + tools + spoiler checks against http://localhost (needs DEV_AUTO_LOGIN=true)
```

MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP, URL: http://localhost/api/mcp
# Header: Authorization: Bearer <token>   (or use the OAuth flow)
```

Claude Code:

```bash
claude mcp add --transport http giftguru http://localhost/api/mcp --header "Authorization: Bearer <token>"
# or add without --header and run /mcp to sign in with OAuth
```

## Marketplace checklist

MCP Registry (`server.json` at the repo root):
- Name `cc.giftguru/wishlists` requires proving ownership of `giftguru.cc`. Use `mcp-publisher login dns` and add the TXT record it prints. DNS is not in Terraform, so this is a manual step.
- Then `mcp-publisher publish` from the repo root. Bump `version` in `server.json` for each release.

Anthropic connector directory:
- Privacy policy URL: `https://www.giftguru.cc/privacy`
- Support contact: hello.guru.gifter@gmail.com
- A test account with sample data for reviewers
- Tool annotations (`title`, `readOnlyHint`, `destructiveHint`) are set on every tool

ChatGPT: deferred.
