# Install matrix

One-liners:

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/KcAnom/darkmanx/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/KcAnom/darkmanx/main/install.ps1 | iex

# or, if you have Node >= 18
npx -y github:KcAnom/darkmanx

# Pi Coding Agent package
pi install git:github.com/KcAnom/darkmanx
```

Run `node bin/install.js --help` for the full flag list, or `--list` to see every detected agent on your machine before installing.

## Per-agent matrix

| Agent | id | Mechanism | Install |
|---|---|---|---|
| Claude Code | `claude` | native plugin (marketplace) | `/plugin marketplace add KcAnom/darkmanx` |
| Codex | `codex` | native (`.codex/config.toml`, `.codex/hooks.json`) | `node bin/install.js --only codex` |
| Gemini CLI | `gemini` | native (`gemini-extension.json`, `GEMINI.md`) | `node bin/install.js --only gemini` |
| Pi Coding Agent | — | native Pi package (`.pi` extension, skills, prompts) | `pi install git:github.com/KcAnom/darkmanx` |
| OpenCode | `opencode` | native plugin (`src/plugins/opencode`) | `node bin/install.js --only opencode` |
| OpenClaw | `openclaw` | native (workspace skill + `SOUL.md` bootstrap block) | `node bin/install.js --only openclaw` |
| Hermes | `hermes` | native | `node bin/install.js --only hermes` |
| Cursor | `cursor` | via `npx skills add` (`.cursor/rules/darkman-x.mdc`) | `node bin/install.js --only cursor` |
| Windsurf | `windsurf` | via `npx skills add` | `node bin/install.js --only windsurf` |
| Cline | `cline` | via `npx skills add` | `node bin/install.js --only cline` |
| GitHub Copilot | `copilot` | via `npx skills add` (AGENTS.md append) | `node bin/install.js --only copilot` |
| 30+ others | — | via `npx skills add REPO -a <profile>` | `npx skills add KcAnom/darkmanx -a <agent>` |

Soft-detected (dir-only) providers require an explicit `--only <id>` — they won't be picked up by auto-detect alone.

## Claude Code global install (any cwd)

Install as a native plugin. This is the supported global path — no symlinks, no
hand-edited `settings.json`:

```
/plugin marketplace add KcAnom/darkmanx
/plugin install darkman-x@darkman-x-marketplace
```

The plugin root is the repo root, so Claude auto-discovers `skills/`,
`commands/`, and `agents/`, and `.claude-plugin/plugin.json` wires the
`SessionStart` + `UserPromptSubmit` hooks through `${CLAUDE_PLUGIN_ROOT}`.
Restart Claude Code once after installing.

Use `node bin/install.js --only claude` only to wire a **local checkout** while
developing — it writes absolute-path hooks into `~/.claude/settings.json`. Don't
run both: two hook registrations means the activate hook fires twice per session.
Override the config dir with `--config-dir` or `$CLAUDE_CONFIG_DIR`.

## Flags

```
--dry-run            show what would change, write nothing
--force               overwrite existing installs/sentinels
--only <id>           install for exactly one provider id
--skip-skills         skip `npx skills` install step for non-native providers
--with-hooks          force-install Claude Code hooks even if the plugin already wires them
--no-hooks            skip Claude Code hooks entirely
--with-init           also run src/tools/darkman-x-init.js for per-repo IDE rules
--with-mcp-shrink=<upstream>   wrap an MCP server with darkman-x-shrink
--all                 install for every detected provider (skips soft ones unless --only)
--minimal             skip optional companion skills (commit/review/help/stats)
--uninstall           reverse a previous install
--config-dir <path>   override the Claude config dir (default: $CLAUDE_CONFIG_DIR or ~/.claude)
--list                list detected providers and exit
--non-interactive     never prompt (CI-safe)
--no-color            disable colored output
```

## Per-repo IDE rules (Cursor/Windsurf/Cline/Copilot/etc.)

```bash
node src/tools/darkman-x-init.js --dry-run
node src/tools/darkman-x-init.js
```

Standalone-safe — also runnable via `curl <raw-url> | node`.

## Uninstall

```bash
node bin/install.js --uninstall --only claude
node bin/install.js --uninstall --all
```
