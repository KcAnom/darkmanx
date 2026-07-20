# Reverses install.ps1: removes copied hook files and strips darkman-x
# hook entries from settings.json.

$ConfigDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$HooksDir = Join-Path $ConfigDir 'hooks'

$files = @(
  'darkman-x-config.js', 'darkman-x-activate.js', 'darkman-x-mode-tracker.js',
  'darkman-x-stats.js', 'xcrew-model-overrides.js',
  'darkman-x-statusline.sh', 'darkman-x-statusline.ps1', 'package.json'
)
foreach ($f in $files) {
  Remove-Item (Join-Path $HooksDir $f) -Force -ErrorAction SilentlyContinue
}
if ((Test-Path $HooksDir) -and ((Get-ChildItem $HooksDir -Force | Measure-Object).Count -eq 0)) {
  Remove-Item $HooksDir -Force
}

$env:CLAUDE_CONFIG_DIR = $ConfigDir
node -e @"
const fs = require('fs');
const path = require('path');
const settingsPath = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) { process.exit(0); }
if (!settings.hooks) process.exit(0);
for (const event of ['SessionStart', 'UserPromptSubmit']) {
  if (!Array.isArray(settings.hooks[event])) continue;
  settings.hooks[event] = settings.hooks[event].filter((entry) =>
    !(entry.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('darkman-x')));
  if (settings.hooks[event].length === 0) delete settings.hooks[event];
}
if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log('darkman-x: hooks unregistered from ' + settingsPath);
"@

Write-Host "darkman-x: hooks removed from $HooksDir"
