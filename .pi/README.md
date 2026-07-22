# `.pi` — Pi Coding Agent wiring for darkman-x

Pi sidecar for darkman-x. **Does not touch Claude** (`.claude/`, `.claude-plugin/`, `CLAUDE.md`).

Works two ways:

1. **Project-local** — open Pi with cwd = this repo (loads `.pi/` after trust).
2. **Global (any cwd)** — install this checkout/repository as a Pi package. Extension resolves repo root via `import.meta.url` / `DARKMANX_ROOT` / `~/darkmanx`.

## Layout

```
.pi/
├── settings.json              # project behavior; resources auto-discover
├── darkman-x-pi.env           # Pi-dedicated secrets (gitignored) — drop FISH_API_KEY here
├── darkman-x-pi.env.example   # tracked template
├── extensions/darkman-x.ts    # session activate, /darkman-x, /darkman-x-voice
├── prompts/                   # non-extension slash templates (commit/review/init/compress)
└── skills/                    # symlinks → ../skills/* (source of truth)
```

## Pi owns its own env

Pi does **not** rely on Claude’s world. Secrets for this sidecar live here:

```
.pi/darkman-x-pi.env
```

Load order (first non-empty value wins per key):

1. Process env already set
2. **`.pi/darkman-x-pi.env`** ← Pi-dedicated (this file)
3. Repo root `.env` (shared fallback)
4. `~/.config/darkman-x/.env`

Root `.env` can still exist for other tools. Pi reads its own file first.

## What it does

| Piece | Behavior |
|---|---|
| **Extension** | On `session_start`, loads default mode (`full` unless env/repo/user config says otherwise), injects darkman-x rules via `before_agent_start`, statusline badge, native Pi session stats. |
| **`/darkman-x`** | Switch intensity: `off\|lite\|full\|ultra\|wenyan-lite\|wenyan\|wenyan-ultra`. Also `voice on\|off\|status\|toggle`. |
| **`/darkman-x-voice`** | Fish Audio spoken replies. Default model **`s2.1-pro-free`**, voice id `552fdfe0e4f542c1bb381d1006c1ac9b`. |
| **`/darkman-x-sfx`** | DMX sound clips, personal use only. Model-judgment triggered (no fixed schedule), never in code/commits/PRs. Clips live out-of-tree at `~/.config/darkman-x/sfx/`, never in this repo. |
| **`/darkman-x-stats`** | Reads current Pi branch usage. Reports real output tokens/cost plus clearly marked savings estimate by active mode. |
| **Skills** | Symlinked from repo `skills/` — edit source there, not under `.pi/skills/`. |
| **Prompts** | Pi-native templates for commands not owned by the extension: commit, review, init, compress. |

## Voice (matches Claude SessionStart)

Default TTS model: **`s2.1-pro-free`**. Same rules as `src/hooks/darkman-x-activate.js`:

- Speak the **full reply substance**, not a ~2-sentence summary.
- Natural spoken prose — rewrite markdown (no headers/bullets/asterisks read aloud).
- Skip code blocks, commands, paths, URLs.
- `stripForSpeech()` in `darkman-x-speak.js` strips markdown + caps at 4000 chars safety.
- Missing `FISH_API_KEY` → skip speak, never fail the turn.

```bash
# 1) drop the key in Pi's own env (preferred)
cp .pi/darkman-x-pi.env.example .pi/darkman-x-pi.env
# edit .pi/darkman-x-pi.env → FISH_API_KEY=...

# 2) in Pi
/darkman-x voice on

# 3) or one-shot CLI (loads .pi/darkman-x-pi.env first)
node src/tools/darkman-x-speak.js --quiet -- "Port taken. Server dead."
```

## Trust

First interactive Pi session in this repo may ask to trust the project so `.pi/` loads. Global trust lives in `~/.pi/agent/trust.json`.

## Global install (any terminal / any folder)

```bash
# From GitHub. Pin a tag or commit for reproducibility.
pi install git:github.com/KcAnom/darkmanx

# Or use a local checkout while developing.
pi install /absolute/path/to/darkmanx
```

`package.json` exposes the extension, source skills, and only the four non-overlapping Pi prompts through its `pi` manifest. The five stateful commands (`darkman-x`, `voice`, `sfx`, `stats`, `status`) are extension-only so command names stay unique. Do not also add the extension path or symlink it manually; duplicate resource paths create duplicate commands and skill warnings.

Project-local use needs no path entries: Pi auto-discovers `.pi/extensions`, `.pi/skills`, and `.pi/prompts` after trust.

After upgrading from the old boolean-guard extension, restart Pi once. This version releases its duplicate-load guard on `session_shutdown`, so later `/reload` calls work.

Override repo location: `export DARKMANX_ROOT=/path/to/darkmanx`.

## Source of truth

- Skills: `skills/*/SKILL.md`
- Hooks / speak CLI: `src/hooks/*`, `src/tools/darkman-x-speak.js`
- Claude plugin: `.claude-plugin/` (leave alone when working on Pi)
- Codex: `.codex/` (leave alone when working on Pi)
