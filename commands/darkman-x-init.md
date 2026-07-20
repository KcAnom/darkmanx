---
description: Install per-repo IDE rules for darkman-x (Cursor, Windsurf, Cline, Copilot, OpenCode, etc).
argument-hint: "[--dry-run] [--force] [--only <agent>]"
---

Run the standalone initializer for this repo: `node src/tools/darkman-x-init.js {{args}}`. If that file doesn't exist locally, fetch and pipe it instead: `curl -fsSL <raw-url-for-darkman-x-init.js> | node - {{args}}`.

Always recommend `--dry-run` first so the user can see what would change before anything is written with `--force`.
