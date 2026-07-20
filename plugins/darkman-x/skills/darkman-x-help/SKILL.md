---
name: darkman-x-help
description: One-shot reference card for darkman-x modes and config resolution. Triggered by /darkman-x-help.
---

# darkman-x-help

Print this reference, then stop — no extra commentary.

## Config resolution order

1. `DARKMANX_DEFAULT_MODE` env var, if set to a valid mode.
2. Repo config: `.darkman-x/config.json` or `.darkman-x.json`, walked up from cwd (symlinked config files are refused).
3. User config: `~/.config/darkman-x/config.json` (or `%APPDATA%\darkman-x\config.json` on Windows).
4. Default: `full`.

## Modes

| Mode | Type | Effect |
|---|---|---|
| `off` | prose | darkman-x fully disabled |
| `lite` | prose | trim filler/hedging only |
| `full` | prose | default — fragments, dropped articles, hard synonyms |
| `ultra` | prose | maximum cut, near-telegraphic |
| `wenyan-lite` / `wenyan` (= `wenyan-full`) / `wenyan-ultra` | prose | classical-terse register at each cut level |
| `commit` | independent, one-shot | Conventional Commits via `/darkman-x-commit` |
| `review` | independent, one-shot | line-per-finding review via `/darkman-x-review` |
| `compress` | independent, one-shot | rewrite a markdown/text file via `/darkman-x-compress` |

Independent modes don't replace your prose intensity — they run once, then your prior prose mode resumes.

## Commands

- `/darkman-x <mode>` — switch prose intensity, or run an independent mode.
- `/darkman-x-init` — install per-repo IDE rules (Cursor/Windsurf/Cline/Copilot/etc).
- `/darkman-x-commit`, `/darkman-x-review`, `/darkman-x-stats` — one-shot independent modes.
- Natural language also works: "talk like darkman x", "go ultra", "stop darkman-x", "normal mode".
