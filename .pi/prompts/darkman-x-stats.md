---
description: Show real darkman-x token-savings stats for this session/project.
argument-hint: "[--share] [--all] [--since <date>]"
---

Run the stats hook if present:

```bash
node src/hooks/darkman-x-stats.js $@
```

If that path is missing or fails, say so plainly — never fabricate savings numbers. Do not invent percentages. See `docs/HONEST-NUMBERS.md` for caveats.

Args: $@
