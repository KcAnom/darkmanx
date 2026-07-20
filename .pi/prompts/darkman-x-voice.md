---
description: Toggle Fish Audio spoken replies for darkman-x (S2.1-Pro free + fixed voice).
argument-hint: "[on|off|status|toggle]"
---

Set darkman-x **voice** to `${1:-status}`.

- `on` — enable spoken replies via Fish Audio `s2.1-pro-free` with voice `552fdfe0e4f542c1bb381d1006c1ac9b`.
- `off` — disable spoken replies.
- `toggle` — flip current state.
- `status` — print ON/OFF + model + voice id.

Prefer the `/darkman-x-voice` extension command if available. Requires `FISH_API_KEY` in `.pi/darkman-x-pi.env` (Pi-first) or root `.env`. When voice is ON, speak the **full reply substance** (not a 2-sentence summary) via:

```bash
node src/tools/darkman-x-speak.js --quiet -- "YOUR SPOKEN VERSION"
```

Do not re-explain the whole darkman-x prose skill — just confirm the voice state.

Args: $@
