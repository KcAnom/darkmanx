# darkman-x hooks

Node stdlib only, CommonJS. Every entry point silent-fails — a hook error
must never block a Claude Code session from starting.

| File | Event | Purpose |
|---|---|---|
| `darkman-x-config.js` | (shared module) | Mode resolution, config paths, atomic/symlink-safe flag writes, mode-change history |
| `darkman-x-activate.js` | SessionStart | Applies xcrew model overrides, resolves the active mode, loads `skills/darkman-x/SKILL.md` rules (filtered to the active intensity) into session context |
| `darkman-x-mode-tracker.js` | UserPromptSubmit | Parses `/darkman-x*` commands and natural-language activation/deactivation phrases, switches modes, runs `/darkman-x-stats` |
| `darkman-x-stats.js` | (invoked by mode-tracker, or standalone) | Estimates output-token savings from local transcript logs + mode-change history |
| `xcrew-model-overrides.js` | (invoked by activate) | Rewrites `agents/xcrew-*.md` frontmatter `model:` field from env vars |
| `darkman-x-statusline.sh` / `.ps1` | statusLine | Prints the `[DARKMAN-X]` badge, optional `+VOICE`, + savings suffix |
| `../tools/darkman-x-speak.js` | (CLI) | Fish Audio S2.1-Pro TTS for darkman-x spoken replies |
| `../tools/darkman-x-sfx.js` | (CLI) | Plays a DMX sound clip from an out-of-tree, gitignored directory — personal use, model-judgment triggered, never in code/commits/PRs |

## Env vars

| Var | Effect |
|---|---|
| `CLAUDE_CONFIG_DIR` | Claude config root (default `~/.claude`) |
| `DARKMANX_DEFAULT_MODE` | Force a default mode (or `off`) |
| `DARKMANX_STATUSLINE_SAVINGS=0` | Hide the savings suffix in the statusline |
| `DARKMANX_DEBUG=1` | Print swallowed errors to stderr |
| `XCREW_INVESTIGATOR_MODEL` / `XCREW_BUILDER_MODEL` / `XCREW_REVIEWER_MODEL` | Override each xcrew subagent's model |
| `FISH_API_KEY` | Fish Audio API key for spoken replies (`darkman-x-speak`) |
| `DARKMANX_VOICE=on\|off` | Force voice toggle (overrides flag file) |
| `DARKMANX_VOICE_ID` | Override default Fish voice reference id |
| `DARKMANX_VOICE_MODEL` | Override TTS model (default `s2.1-pro-free`) |
| `DARKMANX_VOICE_PLAY=0` | Write audio file but skip local playback |
| `DARKMANX_SFX=on\|off` | Force sfx toggle (overrides flag file) |
| `DARKMANX_SFX_DIR` | Override the sfx clips directory (default `~/.config/darkman-x/sfx/`) |

## Install

Prefer the repo-root installer:

```bash
node ../../bin/install.js --only claude
```

`install.sh` / `install.ps1` in this directory are standalone fallbacks that
copy these files into `$CLAUDE_CONFIG_DIR/hooks` and wire `settings.json`
directly, for when you want the hooks without the rest of the product.
`uninstall.sh` / `uninstall.ps1` reverse that.
