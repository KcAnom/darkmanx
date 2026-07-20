#!/usr/bin/env bash
# darkman-x statusline segment. Reads the active-mode flag and prints a
# badge, e.g. [DARKMAN-X] or [DARKMAN-X:ULTRA]. Silent (empty output) if
# darkman-x is off or no flag exists yet — never errors the statusline.
set -u

config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
flag_file="$config_dir/.darkman-x-active"
suffix_file="$config_dir/.darkman-x-statusline-suffix"

[ -f "$flag_file" ] || exit 0

mode="$(cat "$flag_file" 2>/dev/null | tr -d '[:space:]')"
[ -n "$mode" ] || exit 0
[ "$mode" = "off" ] && exit 0

if [ "$mode" = "full" ]; then
  badge="[DARKMAN-X]"
else
  upper_mode="$(printf '%s' "$mode" | tr '[:lower:]' '[:upper:]')"
  badge="[DARKMAN-X:${upper_mode}]"
fi

suffix=""
if [ "${DARKMANX_STATUSLINE_SAVINGS:-1}" != "0" ] && [ -f "$suffix_file" ]; then
  suffix="$(cat "$suffix_file" 2>/dev/null)"
fi

printf '%s%s' "$badge" "$suffix"
