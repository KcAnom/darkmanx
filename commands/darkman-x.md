---
description: Switch darkman-x intensity, or turn it off.
argument-hint: "[off|lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra|voice on|voice off]"
---

Set darkman-x mode to `{{args}}` (default `full` if no argument given). If args start with `voice`, treat as voice toggle (`on`/`off`/`status`/`toggle`) for Fish Audio spoken replies (`s2.1-pro-free`, voice `552fdfe0e4f542c1bb381d1006c1ac9b`) — confirm voice state only. Otherwise load `skills/darkman-x/SKILL.md`, apply the requested intensity, and confirm the switch in that same intensity — don't explain the whole rule set back, just confirm the mode.
