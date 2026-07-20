---
description: Show real darkman-x token-savings stats for this session/project.
---

This command is intercepted by the darkman-x mode-tracking plugin hook before it reaches you — the hook spawns `darkman-x-stats.js` and returns the computed stats text directly. You should never actually need to answer this one; if you do see it, the hook path is broken — say so plainly, don't fabricate numbers.
