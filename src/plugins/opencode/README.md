# darkman-x-opencode-plugin

OpenCode plugin for darkman-x. Activates terse Darkman X mode by default, tracks slash-command and natural-language mode changes mid-chat, and reinforces the active mode in the system prompt each turn.

## Install

Copy this directory into your OpenCode plugin path, or let the unified installer (`node bin/install.js --only opencode`) do it.

## Behavior

- `session.created` — writes the default mode (from `darkman-x-config.js`'s `getDefaultMode()`) to `~/.config/opencode/.darkman-x-active` (respects `XDG_CONFIG_HOME`).
- `chat.message` — detects `/darkman-x [mode]` and natural-language activation/deactivation phrases ("stop darkman-x", "normal mode", "talk like darkman x", …), updates the flag file.
- `experimental.chat.system.transform` — when the flag is active and not `off`, appends a one-line reinforcement (`Respond terse like Darkman X — short, hard, exact.`) to the system prompt.

## Commands

See `commands/` for the OpenCode command templates (`darkman-x`, `darkman-x-commit`, `darkman-x-compress`, `darkman-x-help`, `darkman-x-review`, `darkman-x-stats`) — content-aligned with the top-level `commands/` directory.

Silent-fail throughout: a broken flag write or a missing config module never blocks a chat turn.
