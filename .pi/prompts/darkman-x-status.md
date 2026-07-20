---
description: Show darkman-x mode + voice state.
argument-hint: ""
---

Set darkman-x **status** — read-only, no side effects.

Prefer the `/darkman-x-status` extension command if available (it prints `mode=<mode> prev=<prevMode> voice=ON|OFF model=<model>` from the live extension state). Otherwise say plainly that live status isn't available without the extension — don't guess at the current mode.

Args: $@
