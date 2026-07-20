---
description: Toggle DMX sound clips for darkman-x (personal use, out-of-tree, never committed).
argument-hint: "[on|off|status|toggle]"
---

Set darkman-x **sfx** to `${1:-status}`.

Prefer the `/darkman-x-sfx` extension command if available. Clips live out-of-tree at `~/.config/darkman-x/sfx/` (or `$DARKMANX_SFX_DIR`) — never in this repo, never referenced in code/commits/PRs. When ON, this is fully your judgment call, not a fixed trigger table: play one (`node src/tools/darkman-x-sfx.js --quiet <clip-name>`, see `--list` for what's available) when a moment genuinely earns it — a win, activation, something funny, hype, or just because. No fixed schedule, no clips held back, but "every now and then" beats every reply.

Do not re-explain the whole darkman-x prose skill — just confirm the sfx state.

Args: $@
