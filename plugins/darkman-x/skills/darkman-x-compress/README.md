# darkman-x-compress

Rewrites a markdown/text file into darkman-x style — shorter, same substance, byte-exact code/URLs/paths. Out-of-tree backup, auto-revert on failed validation.

```bash
cd skills/darkman-x-compress && python3 -m scripts /absolute/path/to/file.md
```

## No API keys

The rewrite is done by spawning a CLI you're already logged into — same subscription an interactive session would use. No `ANTHROPIC_API_KEY` or any other API key required.

Auto-detects, in order: `claude` → `codex` → `grok` → `pi`. First one found on `PATH` wins.

| Env var | Effect |
|---|---|
| `DARKMANX_COMPRESS_AGENT` | Force one agent (`claude`\|`codex`\|`grok`\|`pi`), skipping auto-detect. |
| `DARKMANX_COMPRESS_AGENT_ORDER` | Override the auto-detect priority order (comma-separated). |
| `DARKMANX_COMPRESS_MODEL` | Model id to pass to whichever agent runs. |
| `DARKMANX_COMPRESS_MODEL_<AGENT>` | Per-agent model override, e.g. `DARKMANX_COMPRESS_MODEL_CODEX`. |
| `DARKMANX_COMPRESS_TIMEOUT` | Seconds before the CLI call is killed (default 120). |

See [`SKILL.md`](./SKILL.md) and [`SECURITY.md`](./SECURITY.md).
