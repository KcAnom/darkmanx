#!/usr/bin/env bash
# Legacy standalone hook installer. Copies hook files into
# $CLAUDE_CONFIG_DIR/hooks and merges SessionStart/UserPromptSubmit entries
# into settings.json.
#
# Prefer `node bin/install.js` at the repo root — it wires the whole
# product (skills, agents, hooks) in one pass. This script exists for
# manual/standalone hook-only installs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CONFIG_DIR/hooks"

mkdir -p "$HOOKS_DIR"

for f in darkman-x-config.js darkman-x-activate.js darkman-x-mode-tracker.js \
         darkman-x-stats.js xcrew-model-overrides.js \
         darkman-x-statusline.sh darkman-x-statusline.ps1 package.json; do
  cp "$SCRIPT_DIR/$f" "$HOOKS_DIR/$f"
done
chmod +x "$HOOKS_DIR/darkman-x-activate.js" "$HOOKS_DIR/darkman-x-mode-tracker.js" \
         "$HOOKS_DIR/darkman-x-stats.js" "$HOOKS_DIR/darkman-x-statusline.sh"

mkdir -p "$CONFIG_DIR"
node -e "
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(process.env.CLAUDE_CONFIG_DIR || (require('os').homedir() + '/.claude'), 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) {}
settings.hooks = settings.hooks || {};
const hooksDir = '$HOOKS_DIR';

function addHook(event, script) {
  settings.hooks[event] = settings.hooks[event] || [];
  const command = 'node \"' + hooksDir + '/' + script + '\"';
  const already = settings.hooks[event].some((entry) =>
    (entry.hooks || []).some((h) => h.command === command)
  );
  if (!already) {
    settings.hooks[event].push({ hooks: [{ type: 'command', command, timeout: 5 }] });
  }
}

addHook('SessionStart', 'darkman-x-activate.js');
addHook('UserPromptSubmit', 'darkman-x-mode-tracker.js');

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
console.log('darkman-x: hooks registered in ' + settingsPath);
"

echo "darkman-x: hooks installed to $HOOKS_DIR"
