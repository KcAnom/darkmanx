---
description: Show real darkman-x token-savings stats for this session/project.
argument-hint: "[--share] [--all] [--since <date>]"
---

This command is intercepted by the `darkman-x-mode-tracker.js` hook before it reaches you — the hook spawns `darkman-x-stats.js` and blocks the prompt with the computed stats text. You should never actually need to answer this one; if you do see it, the hook path is broken — say so plainly, don't fabricate numbers.
