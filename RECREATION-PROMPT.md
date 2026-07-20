# Recreation Prompt: darkman-x

> **Intentional rebrand:** Same product concepts as the scanned upstream (token-compressed agent speech, multi-agent install, hooks, compress, MCP shrink, xcrew). New name **darkman-x**. New voice **Darkman X / DMX-energy** — not caveman.

## (a) Project Overview

Build **darkman-x** — multi-agent skill/plugin product. Make AI coding agents talk like **Darkman X**: short, hard, rhythmic, zero filler. Same technical payload. ~65% fewer **output** tokens measured. Code, commands, errors stay byte-exact.

**Primary users:** Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Cline, GitHub Copilot, OpenCode, OpenClaw, Hermes, and 30+ agents via `npx skills`.

**What ships:**
1. LLM skill markdown — intensity levels, rules, auto-clarity, boundaries.
2. Companion skills: commit bars, PR review lines, help card, stats, memory-file compress, xcrew subagent guide.
3. Local hooks/plugins — auto-activate mode, track `/darkman-x` commands, statusline badge, local token-savings estimates.
4. Unified Node installer — detect agents, install darkman-x for each.
5. Optional MCP stdio proxy (`darkman-x-shrink`) — compress tool `description` fields.
6. Benchmarks/evals — real measured savings only. No fake numbers.

**Non-goals / do not build:**
- Not a full terminal coding agent (sibling `darkman-x-code` is out of tree).
- No SaaS backend, accounts, telemetry, phone-home.
- No inventing a “Darkman X 2” cloud dashboard — optional waitlist link in README only.
- Do not invent agents outside the PROVIDERS matrix pattern.
- **Do not use caveman / prehistoric / “oog” meme voice.** Rebrand is complete: this is Darkman X energy only.

**Brand voice (intentional divergence from original caveman product):**
- README + product copy: DMX-inspired — terse, hard-edged, rhythmic, confident. Not cartoon caveman.
- Skill body teaches: compress style, keep substance, preserve user’s language.
- Example vibe (README only, not forced on every code comment): “Stop, drop, shut 'em down — open up shop. Cut filler. Keep the fix.”
- Statusline badge style: `[DARKMAN-X]` / `[DARKMAN-X:ULTRA]` (not caveman rock emoji as identity).
- Sentinel phrase for idempotent installs: `Respond terse like Darkman X — short, hard, exact`


---

## (b) Tech Stack & Versions

| Layer | Choice |
|-------|--------|
| Language | JavaScript (Node CommonJS for installer/hooks/MCP; ESM for OpenCode plugin), Python 3 for compress scripts, Markdown for skills |
| Runtime | **Node.js ≥ 18** |
| Root package | `darkman-x-installer` `0.1.0`, MIT, bin `darkman-x` → `./bin/install.js` |
| Runtime npm deps | **None** for installer/hooks (pure stdlib) |
| MCP package | `darkman-x-shrink` `0.1.1` under `src/mcp-servers/darkman-x-shrink` (publishable; `main`/`bin` point at local JS files) |
| OpenCode plugin | `darkman-x-opencode-plugin` `0.1.0`, `"type": "module"`, private |
| Hooks package | `src/hooks/package.json` → `{ "type": "commonjs" }` |
| Compress | Python package `skills/darkman-x-compress/scripts` version `1.0.0`; invokes Claude for rewrite |
| Benchmarks | Python + `anthropic>=0.40.0` |
| Tests | Node built-in test runner (`node --test`) for installer; additional `tests/test_*.js` and `tests/test_*.py` |
| CI | GitHub Actions: checkout v4; sync skill mirrors; zip `dist/darkman-x.skill` |
| License | MIT |

Pinned install fetch ref (in installer): env `DARKMANX_REF` or default tag like `v1.9.1` (not floating `main` for remote hook downloads).

---

## (c) Complete Directory Tree

Create this tree under project root `darkman-x/` (output path target: `/Users/kc/darkmanx` when scaffolding locally) (omit `node_modules`, `.git`, binary assets can be tiny placeholders):

```
darkman-x/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── .codex/
│   ├── config.toml
│   └── hooks.json
├── .editorconfig
├── .gitattributes
├── .github/
│   ├── FUNDING.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── workflows/
│       └── sync-skill.yml
├── .gitignore
├── AGENTS.md
├── GEMINI.md
├── CLAUDE.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── INSTALL.md
├── LICENSE
├── README.md
├── SECURITY.md
├── package.json
├── skills-lock.json
├── gemini-extension.json
├── install.sh
├── install.ps1
├── agents/
│   ├── xcrew-builder.md
│   ├── xcrew-investigator.md
│   └── xcrew-reviewer.md
├── commands/
│   ├── darkman-x.md / darkman-x.toml
│   ├── darkman-x-init.md / .toml
│   ├── darkman-x-commit.md / .toml
│   ├── darkman-x-review.md / .toml
│   └── darkman-x-stats.md / .toml
├── skills/
│   ├── darkman-x/{SKILL.md, README.md}
│   ├── darkman-x-commit/{SKILL.md, README.md}
│   ├── darkman-x-review/{SKILL.md, README.md}
│   ├── darkman-x-help/{SKILL.md, README.md}
│   ├── darkman-x-stats/{SKILL.md, README.md}
│   ├── xcrew/{SKILL.md, README.md}
│   └── darkman-x-compress/
│       ├── SKILL.md, README.md, SECURITY.md
│       └── scripts/{__init__.py,__main__.py,cli.py,compress.py,detect.py,validate.py,benchmark.py}
├── plugins/darkman-x/                    # CI mirror of skills/agents + Codex packaging
│   ├── .codex-plugin/plugin.json
│   ├── agents/xcrew-*.md            # copy of agents/
│   └── skills/...                      # copy of selected skills + compress scripts
├── bin/
│   ├── install.js
│   └── lib/{settings.js, openclaw.js, opencode-agent.js}
├── src/
│   ├── hooks/
│   │   ├── package.json
│   │   ├── darkman-x-config.js
│   │   ├── darkman-x-activate.js
│   │   ├── darkman-x-mode-tracker.js
│   │   ├── darkman-x-stats.js
│   │   ├── xcrew-model-overrides.js
│   │   ├── darkman-x-statusline.sh
│   │   ├── darkman-x-statusline.ps1
│   │   ├── install.sh / install.ps1
│   │   ├── uninstall.sh / uninstall.ps1
│   │   ├── checksums.sha256
│   │   └── README.md
│   ├── rules/
│   │   ├── darkman-x-activate.md
│   │   └── darkman-x-openclaw-bootstrap.md
│   ├── tools/
│   │   └── darkman-x-init.js
│   ├── mcp-servers/darkman-x-shrink/
│   │   ├── package.json, index.js, compress.js, spawn-options.js, README.md
│   └── plugins/opencode/
│       ├── package.json, plugin.js, README.md
│       └── commands/{darkman-x,darkman-x-commit,darkman-x-compress,darkman-x-help,darkman-x-review,darkman-x-stats}.md
├── tests/                              # installer + unit tests (see catalog)
├── benchmarks/{run.py,prompts.json,requirements.txt,results/.gitkeep}
├── evals/{README.md,measure.py,llm_run.py,plot.py,prompts/en.txt,snapshots/results.json}
└── docs/{HONEST-NUMBERS.md,index.html,install-windows.md,.nojekyll}
```

Also note: `dist/darkman-x.skill` is a CI build artifact (zip of `skills/darkman-x/`); gitignore it; rebuild in CI.

Binary/docs assets under `docs/assets/` and plugin SVG logos: optional placeholders.

---

## (d) File-by-File Build Instructions

### Root manifests & entry

**`package.json`**
- name `darkman-x-installer`, version `0.1.0`, license MIT, engines node `>=18`
- `"bin": { "darkman-x": "./bin/install.js" }`
- `"scripts": { "test": "node --test tests/installer/*.test.mjs" }`
- `"files": ["bin/","src/","agents/","skills/","plugins/","commands/","dist/darkman-x.skill","README.md","LICENSE"]`
- No dependencies object required for core installer

**`install.sh` / `install.ps1`**
- Thin shims only: require Node ≥18; if local `bin/install.js` exists, `exec node bin/install.js "$@"`; else `npx -y github:OWNER/darkman-x` with args
- PowerShell: wrap logic in function so `irm | iex` works without `$PSCommandPath`
- Do **not** put real install logic in shims

**`AGENTS.md` / `GEMINI.md`**
```
@./skills/darkman-x/SKILL.md
@./skills/darkman-x-commit/SKILL.md
@./skills/darkman-x-review/SKILL.md
@./skills/darkman-x-compress/SKILL.md
```

**`gemini-extension.json`**
- name `darkman-x`, version, description, `"contextFileName": "GEMINI.md"`

**`.claude-plugin/plugin.json`**
- hooks:
  - SessionStart → `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/darkman-x-activate.js"` timeout 5
  - UserPromptSubmit → `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/darkman-x-mode-tracker.js"` timeout 5

**`.claude-plugin/marketplace.json`**
- schema marketplace; plugin source `./`, category productivity

**`.codex/config.toml`**
```toml
[features]
hooks = true
```

**`.codex/hooks.json`**
- SessionStart matcher `startup|resume` with command that `echo`s a one-line darkman-x rules summary

**`skills-lock.json`**
- version 1; map skill name → github source + skillPath + computedHash (hash of xcrew skill is fine to recompute)

### Skills (LLM-facing SoT — edit only here)

**`skills/darkman-x/SKILL.md`** (core)
YAML frontmatter: `name: darkman-x`, description covering 65% output cut, levels lite/full/ultra/wenyan-*, triggers.
Body must define:
- Persistence: active every response until “stop darkman-x” / “normal mode”
- Default intensity **full**; switch via `/darkman-x lite|full|ultra|wenyan…`
- Rules: drop articles/filler/pleasantries/hedging; fragments OK; short hard synonyms; no invented abbreviations (cfg/impl); no causal arrows as fake token-save; preserve technical terms/code/errors; preserve user language; **no caveman/oog/prehistoric meme tags** — Darkman X register only
- Pattern: `[thing] [action] [reason]. [next step].` Delivery: hard, clipped, confident — never soft corporate, never caveman parody.
- Intensity table for lite/full/ultra/wenyan-lite/wenyan-full/wenyan-ultra with examples
- Auto-Clarity: drop darkman-x for security warnings, irreversible confirms, ambiguous multi-step, user confusion
- Boundaries: code/commits/PRs written normal

**Sibling skills** (independent SKILL.md each):
- **darkman-x-commit**: Conventional Commits; subject ≤50; body only for why/breaking; no AI attribution fluff
- **darkman-x-review**: `L<line>: <problem>. <fix>.` with optional 🔴bug/🟡risk/🔵nit/❓q
- **darkman-x-help**: one-shot reference; document config resolution env > config file > full; modes table
- **darkman-x-stats**: state that hook delivers numbers; model does nothing
- **xcrew**: when to spawn investigator/builder/reviewer; output contracts; chaining patterns
- **darkman-x-compress**: run `python3 -m scripts <filepath>` from skill dir; backup original; preserve code/URLs/paths; only natural-language files

### Agents

**`agents/xcrew-investigator.md`**
- frontmatter: tools Read/Grep/Glob/Bash, model haiku; read-only locator
- Output: `path:line — \`symbol\` — ≤6 word note`; groups Defs/Refs/…; `No match.`

**`agents/xcrew-builder.md`**
- tools Read/Edit/Write/Grep/Glob; ≤2 files; refuse 3+
- Receipt: `<path:line-range> — <change ≤10 words>` + `verified: …`
- Terminal refusals: `too-big.`, `needs-confirm.`, `ambiguous.`, `regressed.`

**`agents/xcrew-reviewer.md`**
- tools Read/Grep/Bash, model haiku
- Format `path:line: emoji severity: problem. fix.` + totals

Mirror these under `plugins/darkman-x/agents/` (identical content).

### Commands

For each of darkman-x, darkman-x-init, darkman-x-commit, darkman-x-review, darkman-x-stats:
- `.md` with YAML description (+ argument-hint where needed) and short prompt body
- matching `.toml` with `description` + `prompt` using `{{args}}` where applicable
- init command must instruct: run local `node src/tools/darkman-x-init.js` or curl raw script | node; prefer `--dry-run` before force

### Shared config + hooks (`src/hooks/`)

**`darkman-x-config.js`** (critical shared module)
Export: `VALID_MODES`, `getDefaultMode`, `getConfigDir`, `getConfigPath`, `findRepoConfigPath`, `safeWriteFlag`, `readFlag`, `appendFlag`, `recordModeChange`, `readHistory`, `MODE_LOG_BASENAME`.

`VALID_MODES`: `off, lite, full, ultra, wenyan-lite, wenyan, wenyan-full, wenyan-ultra, commit, review, compress`.

`getDefaultMode` order:
1. `DARKMANX_DEFAULT_MODE` env if valid
2. Repo walk: `.darkman-x/config.json` or `.darkman-x.json` (refuse symlink configs)
3. User `~/.config/darkman-x/config.json` (XDG / APPDATA on Windows)
4. default `'full'`

`safeWriteFlag(path, content)`:
- mkdir parent; if parent is symlink, resolve and ownership/home checks
- never write if flag path itself is symlink (clobber defense)
- atomic write via temp + rename, mode 0600, O_NOFOLLOW where available
- silent-fail on FS errors; optional `DARKMANX_DEBUG=1` stderr

**`darkman-x-activate.js`** (SessionStart)
- Resolve `CLAUDE_CONFIG_DIR` or `~/.claude`
- Best-effort `xcrew-model-overrides.applyOverrides`
- If mode `off`: delete flag, exit OK
- Else `recordModeChange` + `safeWriteFlag(.darkman-x-active, mode)`
- Independent modes (commit/review/compress): short activation line only
- Else load SKILL.md from candidates: `$CLAUDE_PLUGIN_ROOT/skills/darkman-x/SKILL.md`, `../../skills/...`, `../skills/...`; strip frontmatter; filter intensity table/examples to active level; write rules to stdout (hidden session context)
- Fallback hardcoded minimal rules if SKILL missing
- Optionally nudge if settings.json lacks statusLine

**`darkman-x-mode-tracker.js`** (UserPromptSubmit)
- Read JSON from stdin (`prompt`, optional `transcript_path`); always exit 0 on errors
- Deactivation phrases first (“stop darkman-x”, “normal mode” as command, etc.)
- Skip questions about darkman-x
- NL activation: activate/enable/talk like Darkman X/less tokens…
- `/darkman-x-stats` (+ namespaced `/darkman-x:darkman-x-stats`): spawn `darkman-x-stats.js` with `--session-file`, `--share`, `--all`, `--since`; stdout JSON `{decision:"block", reason: statsText}`
- `/darkman-x` and `/darkman-x-*` / marketplace namespaced forms set mode
- Independent modes save previous prose mode to `.darkman-x-active.prev` and restore on next ordinary prompt
- When flag active for non-independent mode, may emit small reinforcement (implementation detail: keep parity with OpenCode reinforcement)

**`darkman-x-stats.js`**
- Parse Claude projects JSONL for assistant `usage.output_tokens` / cache / model
- `COMPRESSION = { full: 0.65 }` for estimates; model price table by prefix
- Attribute savings by mode log timestamps
- Flags: `--session-file`, `--share`, `--all`, `--since`
- Write lifetime history + statusline suffix via `safeWriteFlag(.darkman-x-statusline-suffix)`
- Export formatters for tests

**`xcrew-model-overrides.js`**
- Env `XCREW_REVIEWER_MODEL`, `XCREW_BUILDER_MODEL`, `XCREW_INVESTIGATOR_MODEL`
- Patch agent frontmatter `model:` safely; silent fail

**`darkman-x-statusline.sh` / `.ps1`**
- Read `.darkman-x-active` → badge `[DARKMANX]` or `[DARKMANX:ULTRA]` etc.
- Append savings suffix unless `DARKMANX_STATUSLINE_SAVINGS=0`

**Legacy `install.sh`/`uninstall.sh` under hooks**
- Still useful for standalone: copy hook files into `$CLAUDE_CONFIG_DIR/hooks`, merge SessionStart/UserPromptSubmit into settings.json via node JSON edit; uninstall reverses. Prefer unified `bin/install.js` as primary path.

### Installer (`bin/install.js` + lib)

**`bin/lib/settings.js`**
- `stripJsonComments` string-aware; `stripTrailingCommas` string-aware
- `readSettings` / `writeSettings` (atomic, mode 0600)
- `validateHookFields` drop malformed hooks
- `hasDarkman XHook`, `addCommandHook`, `removeDarkman XHooks`, legacy rewrite helpers
- `claudeConfigDir()` respects `CLAUDE_CONFIG_DIR`

**`bin/lib/openclaw.js`**
- Workspace: `OPENCLAW_WORKSPACE` or `~/.openclaw/workspace`
- Install: copy skill with frontmatter merge `version` + `always: true`; append marker-fenced block from `src/rules/darkman-x-openclaw-bootstrap.md` (`<!-- darkman-x-begin -->` … `<!-- darkman-x-end -->`) to SOUL.md
- Uninstall: remove skill dir; strip marker blocks without eating user content (pair begin/end carefully)
- Sentinel for rule detection: `Respond terse like Darkman X — short, hard, exact`

**`bin/lib/opencode-agent.js`**
- `stripOpencodeAgentTools(content)`: remove YAML `tools:` array from agent frontmatter (OpenCode schema wants object or omit)

**`bin/install.js`** (large — implement structure, not every edge at once)
- Pure stdlib; `PROVIDERS` matrix entries with `{id,label,mech,detect,profile?,soft?}`
- Detect: `command:`, `vscode-ext:`, `cursor-ext:`, `jetbrains-plugin:`, `dir:`, `macapp:`, OR with `||`
- Soft providers only with `--only`
- Native installers: `installClaude`, `installGemini`, `installOpencode`, `installOpenclaw`, `installHermes`; others `installViaSkills` via `npx skills add REPO -a profile`
- Claude: plugin install + optional hooks into config dir; avoid double-registering hooks if plugin already wires them
- Flags: `--dry-run --force --only --skip-skills --with-hooks --no-hooks --with-init --with-mcp-shrink=<upstream> --all --minimal --uninstall --config-dir --list --non-interactive --no-color`
- Pin remote raw URLs to `DARKMANX_REF || 'v1.9.1'`
- Guard: Node ≥18; refuse Windows Node inside WSL
- Main: detect → optional TTY multi-select → install loop → optional init → summary

### darkman-x-init (`src/tools/darkman-x-init.js`)
- Standalone-safe (curl|node): detect `require.main` **or** `module.id === '[stdin]'`
- Embedded `RULE_BODY` mirrors `src/rules/darkman-x-activate.md`
- Agents table: cursor `.cursor/rules/darkman-x.mdc` (alwaysApply), windsurf, cline, copilot append, opencode AGENTS.md append, root AGENTS.md append, openclaw via helper
- Modes replace vs append; skip if sentinel present; `--dry-run --force --only`

### Rules
**`src/rules/darkman-x-activate.md`**: short always-on rule body (drop fluff; pattern; auto-clarity; boundaries).
**`src/rules/darkman-x-openclaw-bootstrap.md`**: marker-fenced always-on section pointing at workspace skill.

### MCP shrink (`src/mcp-servers/darkman-x-shrink/`)
**`compress.js`**: protect fenced/inline code, URLs, paths, identifiers; drop articles/filler/hedges/leaders; `compress` + `compressDescriptionsInPlace`.
**`index.js`**: spawn upstream with `getSpawnOptions()` (shell true on win32); line-buffer stdout JSON-RPC; transform tools/prompts/resources/resourceTemplates description fields; pass requests through; env `DARKMANX_SHRINK_FIELDS`, `DARKMANX_SHRINK_DEBUG`.
**`package.json`**: name `darkman-x-shrink`, bin `darkman-x-shrink` → index.js.

### OpenCode plugin (`src/plugins/opencode/plugin.js`)
- ESM default export plugin object
- Load `darkman-x-config` by reading CJS file text + `new Function` (Bun compiled require quirks)
- Flag path under `~/.config/opencode/.darkman-x-active` (XDG aware)
- `event` on `session.created`: write default mode flag
- `chat.message`: parse mode changes (slash + NL)
- `experimental.chat.system.transform`: push reinforcement line when active
- Command markdown templates under `commands/`

### Compress Python package
**`detect.py`**: compressible extensions `.md/.txt/...`; skip code/config; content heuristics for extensionless; `should_compress` skips `*.original.md`.
**`validate.py`**: compare headings, fenced code exact, URLs, paths, bullets, inline code → `ValidationResult`.
**`compress.py`**: refuse sensitive basenames/paths; out-of-tree backups under XDG_DATA_HOME or LOCALAPPDATA `darkman-x-compress/backups`; strip/restore frontmatter; call Claude; validate with ≤2 fix retries; restore original on failure.
**`cli.py`**: UTF-8 reconfigure streams; `python -m scripts <file>`.
**`__main__.py`**: call `cli.main`.

### CI
**`.github/workflows/sync-skill.yml`**: on push to main when skills/agents/compress scripts change → copy SoT into `plugins/darkman-x/...` → zip `dist/darkman-x.skill` → commit `[skip ci]`.

### Docs / product
- **README.md**: product front door — before/after, install one-liners, levels table, feature table, benchmark table from real numbers, privacy, honest-numbers link, darkman-x voice
- **INSTALL.md**: full per-agent matrix
- **CLAUDE.md**: maintainer map of SoT vs mirrors; rules for agents working in repo
- **docs/HONEST-NUMBERS.md**: explain output-only savings caveats

### Tests (implement key ones)
- Installer unit: argv parsing, settings JSONC/trailing commas, dry-run
- Symlink flag safety tests
- Mode tracker stdin tests
- MCP shrink compress boundaries
- Python detect/validate/compress safety
- Repo verify script optional

---

## (e) Dependencies & Installation

**Runtime (user machine):**
- Node.js ≥ 18 (includes npx)
- Optional: Claude Code / Gemini / OpenCode / etc. CLIs for native install paths
- Optional: Python 3 for `/darkman-x-compress`
- Optional: `ANTHROPIC_API_KEY` only for running benchmarks

**Root package.json:** no required npm dependencies for installer.

**MCP package:** no required deps (stdlib only).

**Benchmarks:**
```
anthropic>=0.40.0
```

**Install (end user):**
```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/<owner>/<repo>/main/install.ps1 | iex

# or
npx -y github:<owner>/<repo>
node bin/install.js --help
```

**Dev clone:**
```bash
git clone <repo>
cd darkman-x
npm test
# optional python tests with python3
```

---

## (f) Environment Setup

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CONFIG_DIR` | Claude config root (default `~/.claude`) |
| `CLAUDE_PLUGIN_ROOT` | Set by Claude when running plugin hooks |
| `DARKMANX_DEFAULT_MODE` | Default mode or `off` |
| `DARKMANX_STATUSLINE_SAVINGS` | `0` disables savings badge suffix |
| `DARKMANX_DEBUG` | Flag write diagnostics |
| `DARKMANX_REF` | Override pinned raw.githubusercontent ref |
| `DARKMANX_SHRINK_FIELDS` | Comma-separated fields to compress (default `description`) |
| `DARKMANX_SHRINK_DEBUG` | `1` log compression deltas |
| `OPENCLAW_WORKSPACE` | OpenClaw workspace path |
| `XDG_CONFIG_HOME` / `XDG_DATA_HOME` | Config + compress backups |
| `APPDATA` / `LOCALAPPDATA` | Windows config/backup |
| `XCREW_REVIEWER_MODEL` / `XCREW_BUILDER_MODEL` / `XCREW_INVESTIGATOR_MODEL` | Pin subagent models |
| `ANTHROPIC_API_KEY` | Benchmarks only (local `.env.local`, never commit) |
| `NO_COLOR` | Disable installer colors |

Config files to support:
- `~/.claude/settings.json` (JSONC-tolerant)
- `~/.config/darkman-x/config.json` → `{ "defaultMode": "full" }`
- Repo `.darkman-x/config.json` or `.darkman-x.json`
- Flag files: `.darkman-x-active`, `.darkman-x-active.prev`, `.darkman-x-statusline-suffix` under config dirs

Secrets: none required for core product. Never embed API keys.

---

## (g) Run & Test Instructions

```bash
# Help / list agents
node bin/install.js --help
node bin/install.js --list

# Dry-run install
node bin/install.js --dry-run

# Install for one agent
node bin/install.js --only claude --no-hooks

# Per-repo IDE rules
node src/tools/darkman-x-init.js --dry-run

# Hooks unit-ish
node src/hooks/darkman-x-stats.js --help  # or run with session file if present

# MCP shrink (needs upstream)
node src/mcp-servers/darkman-x-shrink/index.js npx @modelcontextprotocol/server-filesystem /tmp

# Compress a markdown memory file
cd skills/darkman-x-compress && python3 -m scripts /absolute/path/to/CLAUDE.md

# Tests
npm test
node --test tests/test_mcp_shrink.js tests/test_darkman-x_init.js tests/test_symlink_flag.js
python3 -m pytest tests/test_detect.py tests/test_validate_inline.py  # if pytest used; else run as scripts
```

There is no long-running app server. “Run” = install into agent configs + use agent sessions.

---

## (h) Design Decisions & Conventions

1. **Single source of truth:** `skills/*/SKILL.md`, `agents/*`, `src/rules/*`, `bin/install.js`. CI copies into `plugins/darkman-x/`. Never hand-edit mirrors as primary.
2. **Hooks must silent-fail** — never block Claude session start.
3. **All predictable flag writes** go through `safeWriteFlag` (symlink clobber defense).
4. **settings.json** read/write only via JSONC-safe helpers + `validateHookFields` (Claude Zod-strict settings).
5. **Installer shims stay thin** — one Node truth avoids bash/PS1 drift.
6. **Mode model:** session flag file bridges SessionStart, UserPromptSubmit, statusline, OpenCode plugin.
7. **Independent modes** (commit/review/compress) are one-shots that must not permanently displace prose intensity (save/restore prev).
8. **Compress style, not language**; never mangle code fences, inline code, URLs, paths.
9. **README is product UI** — preserve darkman-x voice; benchmarks only from real measurements.
10. **Privacy:** post-install zero network for core skill/hooks; stats read local logs only.
11. **Dual command formats** (.md + .toml) stay content-aligned.
12. **Idempotent install/uninstall** with sentinels and HTML markers.
13. **Provider soft detection:** dir-only agents require explicit `--only`.
14. **Pinned remote ref** for curl-installed hooks + checksums for integrity.

---

## (i) Out of Scope / Do Not Invent

- Do **not** invent a cloud analytics backend or auth system.
- Do **not** fabricate benchmark percentages; use placeholder table only if no API key, clearly labeled unreproduced.
- Full per-agent INSTALL.md matrix: implement the PROVIDERS-driven installer first; INSTALL.md can document the same ids without inventing unique undocumented agents.
- Exact historical issue-number comments optional; behavior above is required.
- `docs/index.html` marketing site: optional simple static page; not required for product function.
- `evals/snapshots/results.json` large snapshot: stub empty structure OK if not regenerating evals.
- Hand-committed `plugins/darkman-x/skills/darkman-x-stats` may exist; CI may not sync stats skill — prefer installing stats via hooks path.
- Sibling repos (darkman-x-code, cavemem, cavekit, cavegemma) are **out of tree** — link only.
- Windows PS1 statusline/uninstall: implement parity with shell versions; if timeboxed, ship sh + document PS1 as thin ports.
- Do not copy any real user settings, API keys, or session JSONL into the repo.
- OpenCode hook API is version-sensitive (`event` + `session.created` type, not a top-level `session.created` key) — follow that mapping.
- Marketplace command namespacing `/darkman-x:darkman-x-*` must be accepted by mode tracker.

**Faithfulness rule:** Architecture and behavior must match the analyzed darkman-x (caveman-upstream) design. Branding/voice is an **intentional divergence**: name **darkman-x**, persona **Darkman X / DMX-energy**, zero caveman meme. If a technical detail was not in the analysis, stub minimally and mark TODO rather than inventing APIs.

