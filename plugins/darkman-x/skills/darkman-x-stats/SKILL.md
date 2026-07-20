---
name: darkman-x-stats
description: Show token-savings stats. Triggered by /darkman-x-stats. The model does nothing here — the hook computes and prints the numbers.
---

# darkman-x-stats

When `/darkman-x-stats` (or the namespaced `/darkman-x:darkman-x-stats`) fires, the **hook** (`darkman-x-stats.js`) intercepts the prompt, computes real numbers from local session logs, and blocks the prompt from reaching the model — it prints the stats text directly.

**The model takes no action for this command.** If you are the model and somehow see this SKILL.md loaded without a hook having already produced output, something is misconfigured — do not fabricate stats or estimate numbers yourself. Say so plainly and point at the hook.

Flags the hook understands: `--session-file`, `--share`, `--all`, `--since`.
