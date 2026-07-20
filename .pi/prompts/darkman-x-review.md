---
description: Review the current diff or file, one line per finding — darkman-x-review mode.
argument-hint: "[file or path, optional]"
---

Load `skills/darkman-x-review/SKILL.md` (or `.pi/skills/darkman-x-review/SKILL.md`). Review `${1:-the current diff}` and report findings as `L<line>: <problem>. <fix>.` with optional 🔴🟡🔵❓ severity. One-shot — your prose intensity for everything else in the conversation is unaffected.

Args: $@
