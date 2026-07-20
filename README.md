# darkman-x

Stop, drop, shut 'em down — open up shop. Cut filler. Keep the fix.

**darkman-x** makes AI coding agents talk like **Darkman X**: short, hard, rhythmic, zero filler. Same technical payload — code, commands, errors stay byte-exact. ~65% fewer **output** tokens measured on real sessions ([honest numbers](./docs/HONEST-NUMBERS.md), no invented percentages).

Works with Claude Code, Codex, Gemini CLI, Cursor, Windsurf, Cline, GitHub Copilot, OpenCode, OpenClaw, Hermes, and 30+ agents via `npx skills`.

Full agent build spec: [`RECREATION-PROMPT.md`](./RECREATION-PROMPT.md).

## Before / after

**Before** (default agent voice):
> Certainly! I've gone ahead and reviewed the file you mentioned, and I found that there's an issue on line 42 where the null check is missing. I would recommend adding a guard clause here to prevent a potential crash. Let me know if you'd like me to make this change for you!

**After** (`darkman-x` full):
> L42: no null check, crashes on empty input. Add guard clause. Fix it?

Same finding. Same fix. Cut the rest.

## Install

```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/OWNER/darkman-x/main/install.sh | bash

# Windows PowerShell
irm https://raw.githubusercontent.com/OWNER/darkman-x/main/install.ps1 | iex

# or, with Node >= 18 already installed
npx -y github:OWNER/darkman-x
```

Full per-agent matrix and flags: [`INSTALL.md`](./INSTALL.md).

## Levels

| Level | Voice |
|---|---|
| `lite` | Trims filler, keeps full sentences. |
| `full` (default) | Fragments OK. Hard, clipped, confident. |
| `ultra` | Minimum viable words. Still exact. |
| `wenyan-lite` / `wenyan` / `wenyan-full` / `wenyan-ultra` | Same compression curve, classical-Chinese-terse register. |

Switch anytime: `/darkman-x lite|full|ultra|wenyan…`. Say "stop darkman-x" or "normal mode" to turn it off.

## What ships

| Piece | What it does |
|---|---|
| **Skill** (`skills/darkman-x`) | The voice rules — levels, auto-clarity, boundaries. This is the product. |
| **Hooks** | Auto-activate mode on session start, track `/darkman-x` commands, statusline badge + local savings estimate. |
| **Installer** (`bin/install.js`) | Detects your agents, installs darkman-x for each, native path where one exists. |
| **xcrew** | Three subagents (investigator/builder/reviewer) for locate → edit → review, each independently model-configurable. |
| **MCP shrink** (`darkman-x-shrink`) | Optional stdio proxy that compresses verbose tool `description` fields. |
| **Compress** (`darkman-x-compress`) | Compress a memory/instructions file (e.g. `CLAUDE.md`) in place, with backup + validation. |
| **Stats** (`/darkman-x-stats`) | Local, on-device token-savings estimate from your own session logs. |

## Auto-clarity

darkman-x drops out automatically for: security warnings, irreversible confirmations, ambiguous multi-step requests, or when you seem confused. Code, commits, and PR descriptions are always written in normal voice — compression is for conversational output only.

## Privacy

No SaaS backend. No accounts. No telemetry. No phone-home. `/darkman-x-stats` reads your own local session logs — nothing leaves your machine. See [`SECURITY.md`](./SECURITY.md).

## Honest numbers

The ~65% figure is an **output-token-only** measurement from real sessions on the analyzed upstream product — not input tokens, not a universal guarantee. Your mileage varies by task and model. Reproduce it yourself: `npm run bench`, or check `/darkman-x-stats` after a session. Full caveats: [`docs/HONEST-NUMBERS.md`](./docs/HONEST-NUMBERS.md).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the maintainer map in [`CLAUDE.md`](./CLAUDE.md).

MIT licensed. See [`LICENSE`](./LICENSE).
