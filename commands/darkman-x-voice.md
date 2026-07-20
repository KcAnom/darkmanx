---
description: Toggle Fish Audio spoken replies for darkman-x (S2.1-Pro + fixed voice).
argument-hint: "[on|off|status|toggle]"
---

Set darkman-x **voice** to `{{args}}` (default `status` if no argument).

- `on` — enable spoken replies via Fish Audio `s2.1-pro-free` with voice `552fdfe0e4f542c1bb381d1006c1ac9b`.
- `off` — disable spoken replies.
- `toggle` — flip current state.
- `status` — print ON/OFF + model + voice id.

Requires `FISH_API_KEY` in the environment. Speak manually anytime:

```bash
node src/tools/darkman-x-speak.js "Port taken. Server dead. Change port or kill it."
```

Do not re-explain the whole darkman-x prose skill — just confirm the voice state.
