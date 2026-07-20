# darkman-x-shrink

Stdio MCP proxy. Sits between your MCP client and an upstream MCP server, compressing tool/prompt/resource `description` metadata so those fields cost fewer context tokens on every turn. Nothing else changes — requests pass through untouched, and only description-style fields in `tools/list`, `prompts/list`, `resources/list`, and `resources/templates/list` responses are rewritten. Actual tool call results, resource contents, and everything else pass through byte-exact.

## Usage

```bash
darkman-x-shrink npx @modelcontextprotocol/server-filesystem /tmp
```

Point your MCP client's stdio server config at `darkman-x-shrink <upstream-command> [...upstream-args]` instead of the upstream command directly.

## Env vars

| Variable | Purpose |
|---|---|
| `DARKMANX_SHRINK_FIELDS` | Comma-separated field names to compress (default `description`) |
| `DARKMANX_SHRINK_DEBUG` | `1` logs original vs compressed byte-length deltas to stderr |

## What it never touches

- Fenced code blocks, inline code, URLs, and file paths inside a description are preserved byte-exact.
- Tool call results, resource contents, and any non-description field are passed through unmodified.
- No dependencies — pure Node stdlib.
