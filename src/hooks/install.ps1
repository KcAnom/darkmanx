# Legacy standalone hook installer (Windows port of install.sh).
# Prefer `node bin/install.js` at the repo root for a full install.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$HooksDir = Join-Path $ConfigDir 'hooks'

New-Item -ItemType Directory -Force -Path $HooksDir | Out-Null

$files = @(
  'darkman-x-config.js', 'darkman-x-activate.js', 'darkman-x-mode-tracker.js',
  'darkman-x-stats.js', 'xcrew-model-overrides.js',
  'darkman-x-statusline.sh', 'darkman-x-statusline.ps1', 'package.json'
)
foreach ($f in $files) {
  Copy-Item (Join-Path $ScriptDir $f) (Join-Path $HooksDir $f) -Force
}

$env:CLAUDE_CONFIG_DIR = $ConfigDir
node -e @"
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) {}
settings.hooks = settings.hooks || {};
const hooksDir = process.env.CLAUDE_CONFIG_DIR + '/hooks';
function addHook(event, script) {
  settings.hooks[event] = settings.hooks[event] || [];
  const command = 'node "' + hooksDir + '/' + script + '"';
  const already = settings.hooks[event].some((entry) => (entry.hooks || []).some((h) => h.command === command));
  if (!already) settings.hooks[event].push({ hooks: [{ type: 'command', command, timeout: 5 }] });
}
addHook('SessionStart', 'darkman-x-activate.js');
addHook('UserPromptSubmit', 'darkman-x-mode-tracker.js');
fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log('darkman-x: hooks registered in ' + settingsPath);
"@

Write-Host "darkman-x: hooks installed to $HooksDir"
