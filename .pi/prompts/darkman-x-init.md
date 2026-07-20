---
description: Install per-repo IDE rules for darkman-x (Cursor, Windsurf, Cline, Copilot, OpenCode, etc).
argument-hint: "[--dry-run] [--force] [--only <agent>]"
---

Run the standalone initializer for this repo:

```bash
node src/tools/darkman-x-init.js $@
```

Always recommend `--dry-run` first so the user can see what would change before anything is written with `--force`.

Do **not** modify Claude Code plugin settings (`.claude/`, `.claude-plugin/`) unless the user explicitly asks. This init targets Cursor/Windsurf/Cline/Copilot/OpenCode/AGENTS.md/OpenClaw only.

Args: $@
