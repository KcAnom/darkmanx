# darkman-x

Core skill. Makes agent talk short, hard, exact — Darkman X voice. ~65% fewer output tokens, output-side only. Code/commands/errors untouched.

See [`SKILL.md`](./SKILL.md) for the full rule set, intensity levels, and boundaries.

Switch modes: `/darkman-x lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra`. Stop: say "stop darkman-x" or "normal mode".

## Optional spoken voice (Fish Audio)

Toggle spoken darkman-x replies with Fish Audio **s2.1-pro-free** and fixed voice id `552fdfe0e4f542c1bb381d1006c1ac9b`:

```bash
export FISH_API_KEY=...
/darkman-x voice on      # or: /darkman-x-voice on
node src/tools/darkman-x-speak.js "Port taken. Server dead."
/darkman-x voice off
```

Statusline shows `+VOICE` when enabled. Config: `~/.config/darkman-x/config.json` → `{ "voice": { "enabled": false, "referenceId": "552fdfe0e4f542c1bb381d1006c1ac9b", "model": "s2.1-pro-free" } }`.
