# `.pi` — Pi Coding Agent wiring for darkman-x

Pi sidecar for darkman-x. **Does not touch Claude** (`.claude/`, `.claude-plugin/`, `CLAUDE.md`).

Works two ways:

1. **Project-local** — open Pi with cwd = this repo (loads `.pi/` after trust).
2. **Global (any cwd)** — symlink extension into `~/.pi/agent/extensions/` and point global skills/prompts at this checkout (done on this machine). Extension resolves the repo root via `import.meta.url` / `DARKMANX_ROOT` / `~/darkmanx`.

## Layout

```
.pi/
├── settings.json              # skills + prompts + extension paths
├── darkman-x-pi.env           # Pi-dedicated secrets (gitignored) — drop FISH_API_KEY here
├── darkman-x-pi.env.example   # tracked template
├── extensions/darkman-x.ts    # session activate, /darkman-x, /darkman-x-voice
├── prompts/                   # /darkman-x* slash templates
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
| **Extension** | On `session_start`, loads default mode (`full` unless env/repo/user config says otherwise), injects darkman-x rules via `before_agent_start`, statusline badge. |
| **`/darkman-x`** | Switch intensity: `off\|lite\|full\|ultra\|wenyan-lite\|wenyan\|wenyan-ultra`. Also `voice on\|off\|status\|toggle`. |
| **`/darkman-x-voice`** | Fish Audio spoken replies. Default model **`s2.1-pro-free`**, voice id `552fdfe0e4f542c1bb381d1006c1ac9b`. |
| **`/darkman-x-sfx`** | DMX sound clips, personal use only. Model-judgment triggered (no fixed schedule), never in code/commits/PRs. Clips live out-of-tree at `~/.config/darkman-x/sfx/`, never in this repo. |
| **Skills** | Symlinked from repo `skills/` — edit source there, not under `.pi/skills/`. |
| **Prompts** | Pi-native slash templates mirroring `commands/*.md`. |

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
# extension (auto-discovered)
ln -sfn /Users/kc/darkmanx/.pi/extensions/darkman-x.ts ~/.pi/agent/extensions/darkman-x.ts

# optional: skills + prompts in ~/.pi/agent/settings.json
#   "skills":  ["/Users/kc/darkmanx/.pi/skills", "/Users/kc/darkmanx/skills"]
#   "prompts": ["/Users/kc/darkmanx/.pi/prompts"]
#   "enableSkillCommands": true
```

Double-load safe: if project + global both point at the same file, only one factory runs.

Override repo location: `export DARKMANX_ROOT=/path/to/darkmanx`.

## Source of truth

- Skills: `skills/*/SKILL.md`
- Hooks / speak CLI: `src/hooks/*`, `src/tools/darkman-x-speak.js`
- Claude plugin: `.claude-plugin/` (leave alone when working on Pi)
- Codex: `.codex/` (leave alone when working on Pi)
