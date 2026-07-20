#!/usr/bin/env bash
# Reverses src/hooks/install.sh: removes copied hook files and strips
# darkman-x hook entries from settings.json.
set -euo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CONFIG_DIR/hooks"

for f in darkman-x-config.js darkman-x-activate.js darkman-x-mode-tracker.js \
         darkman-x-stats.js xcrew-model-overrides.js \
         darkman-x-statusline.sh darkman-x-statusline.ps1 package.json; do
  rm -f "$HOOKS_DIR/$f"
done
rmdir "$HOOKS_DIR" 2>/dev/null || true

node -e "
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(process.env.CLAUDE_CONFIG_DIR || (require('os').homedir() + '/.claude'), 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) { process.exit(0); }
if (!settings.hooks) process.exit(0);

for (const event of ['SessionStart', 'UserPromptSubmit']) {
  if (!Array.isArray(settings.hooks[event])) continue;
  settings.hooks[event] = settings.hooks[event].filter((entry) =>
    !(entry.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('darkman-x'))
  );
  if (settings.hooks[event].length === 0) delete settings.hooks[event];
}
if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
console.log('darkman-x: hooks unregistered from ' + settingsPath);
"

echo "darkman-x: hooks removed from $HOOKS_DIR"
