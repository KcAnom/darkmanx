#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const readline = require('readline');

const settingsLib = require('./lib/settings');
const openclaw = require('./lib/openclaw');

const REPO_ROOT = path.join(__dirname, '..');
const DARKMANX_REF = process.env.DARKMANX_REF || 'v1.9.1';

function color(code, str, noColor) {
  if (noColor) return str;
  return '\x1b[' + code + 'm' + str + '\x1b[0m';
}

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error('darkman-x requires Node.js >= 18 (found ' + process.versions.node + ').');
    process.exit(1);
  }
}

function refuseWindowsNodeInsideWsl() {
  if (process.platform !== 'win32') return;
  try {
    const version = fs.readFileSync('/proc/version', 'utf8');
    if (/microsoft/i.test(version)) {
      console.error(
        'darkman-x: detected Windows-native Node running inside WSL. ' +
        'Use the WSL/Linux Node install instead.'
      );
      process.exit(1);
    }
  } catch (_) {
    // Not Linux /proc — not WSL, nothing to refuse.
  }
}

function commandExists(cmd) {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(which, [cmd], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function dirExists(p) {
  try {
    return fs.statSync(p.replace(/^~/, os.homedir())).isDirectory();
  } catch (_) {
    return false;
  }
}

function macAppExists(name) {
  if (process.platform !== 'darwin') return false;
  return dirExists('/Applications/' + name + '.app');
}

function vscodeExtensionExists(extId) {
  const dirs = [
    path.join(os.homedir(), '.vscode', 'extensions'),
    path.join(os.homedir(), '.vscode-server', 'extensions'),
  ];
  return dirs.some((d) => {
    try {
      return fs.readdirSync(d).some((name) => name.toLowerCase().startsWith(extId.toLowerCase()));
    } catch (_) {
      return false;
    }
  });
}

function cursorExtensionExists(extId) {
  return vscodeExtensionExists(extId) ||
    dirExists(path.join(os.homedir(), '.cursor', 'extensions'));
}

function jetbrainsPluginExists(pluginDirName) {
  const base = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'JetBrains')
    : path.join(os.homedir(), '.local', 'share', 'JetBrains');
  try {
    return fs.readdirSync(base).some((ideDir) => {
      const pluginsDir = path.join(base, ideDir, 'plugins');
      try {
        return fs.readdirSync(pluginsDir).includes(pluginDirName);
      } catch (_) {
        return false;
      }
    });
  } catch (_) {
    return false;
  }
}

// Parses a detector spec like "command:cursor||cursor-ext:anysphere.cursor"
// into a boolean.
function runDetector(spec) {
  return spec.split('||').some((clause) => {
    const [kind, arg] = clause.split(':');
    switch (kind) {
      case 'command':
        return commandExists(arg);
      case 'dir':
        return dirExists(arg.replace(/^~/, os.homedir()));
      case 'macapp':
        return macAppExists(arg);
      case 'vscode-ext':
        return vscodeExtensionExists(arg);
      case 'cursor-ext':
        return cursorExtensionExists(arg);
      case 'jetbrains-plugin':
        return jetbrainsPluginExists(arg);
      default:
        return false;
    }
  });
}

const PROVIDERS = [
  { id: 'claude', label: 'Claude Code', mech: 'native', detect: 'command:claude||dir:~/.claude' },
  { id: 'codex', label: 'Codex', mech: 'native-config', detect: 'command:codex||dir:~/.codex' },
  { id: 'gemini', label: 'Gemini CLI', mech: 'native', detect: 'command:gemini||dir:~/.gemini' },
  { id: 'cursor', label: 'Cursor', mech: 'skills', profile: 'cursor', detect: 'command:cursor||macapp:Cursor||cursor-ext:anysphere.cursor-always-local' },
  { id: 'windsurf', label: 'Windsurf', mech: 'skills', profile: 'windsurf', detect: 'command:windsurf||macapp:Windsurf' },
  { id: 'cline', label: 'Cline', mech: 'skills', profile: 'cline', detect: 'vscode-ext:saoudrizwan.claude-dev' },
  { id: 'copilot', label: 'GitHub Copilot', mech: 'skills', profile: 'copilot', detect: 'vscode-ext:github.copilot' },
  { id: 'opencode', label: 'OpenCode', mech: 'native', detect: 'command:opencode||dir:~/.config/opencode' },
  { id: 'openclaw', label: 'OpenClaw', mech: 'native', detect: 'command:openclaw||dir:~/.openclaw' },
  { id: 'hermes', label: 'Hermes', mech: 'native', detect: 'command:hermes||dir:~/.hermes' },
  { id: 'aider', label: 'Aider', mech: 'skills', profile: 'aider', detect: 'command:aider', soft: true },
  { id: 'continue', label: 'Continue', mech: 'skills', profile: 'continue', detect: 'vscode-ext:continue.continue', soft: true },
  { id: 'zed', label: 'Zed', mech: 'skills', profile: 'zed', detect: 'macapp:Zed||command:zed', soft: true },
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    only: null,
    skipSkills: false,
    withHooks: false,
    noHooks: false,
    withInit: false,
    withMcpShrink: null,
    all: false,
    minimal: false,
    uninstall: false,
    configDir: null,
    list: false,
    nonInteractive: false,
    noColor: !!process.env.NO_COLOR,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--skip-skills') args.skipSkills = true;
    else if (a === '--with-hooks') args.withHooks = true;
    else if (a === '--no-hooks') args.noHooks = true;
    else if (a === '--with-init') args.withInit = true;
    else if (a.startsWith('--with-mcp-shrink=')) args.withMcpShrink = a.split('=')[1];
    else if (a === '--all') args.all = true;
    else if (a === '--minimal') args.minimal = true;
    else if (a === '--uninstall') args.uninstall = true;
    else if (a === '--config-dir') args.configDir = argv[++i];
    else if (a === '--list') args.list = true;
    else if (a === '--non-interactive') args.nonInteractive = true;
    else if (a === '--no-color') args.noColor = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`darkman-x installer

Usage: darkman-x [options]

  --dry-run                 show what would happen, change nothing
  --force                   reinstall even if already installed
  --only <id>               install for one provider only (see --list)
  --all                     install for every detected provider, no prompt
  --minimal                 skip optional companion skills
  --skip-skills             don't route soft providers through npx skills
  --with-hooks / --no-hooks control hook registration for Claude Code
  --with-init                also run src/tools/darkman-x-init.js for this repo
  --with-mcp-shrink=<cmd>   wrap <cmd> with the darkman-x-shrink MCP proxy
  --uninstall               reverse a previous install
  --config-dir <path>       override Claude config dir
  --list                    list detected/known providers and exit
  --non-interactive         never prompt, act on flags only
  --no-color                disable colored output
  --help                    show this help
`);
}

function detectProviders(args) {
  return PROVIDERS.map((p) => ({ ...p, detected: runDetector(p.detect) }));
}

function printProviderList(providers, noColor) {
  for (const p of providers) {
    const mark = p.detected ? color('32', 'yes', noColor) : color('90', 'no', noColor);
    const softTag = p.soft ? ' (soft — needs --only)' : '';
    console.log('  ' + p.id.padEnd(12) + p.label.padEnd(20) + 'detected: ' + mark + softTag);
  }
}

function claudeConfigDir(args) {
  return args.configDir || settingsLib.claudeConfigDir();
}

/**
 * True when darkman-x is registered through Claude's own plugin registry
 * (`/plugin marketplace add` + `/plugin install`). Only then does
 * `.claude-plugin/plugin.json` actually wire the hooks, because only then does
 * Claude expand ${CLAUDE_PLUGIN_ROOT}. Never throws — an unreadable or absent
 * registry just means "not installed as a plugin".
 */
function claudePluginInstalled(configDir) {
  try {
    const registry = JSON.parse(
      fs.readFileSync(path.join(configDir, 'plugins', 'installed_plugins.json'), 'utf8')
    );
    return Object.keys(registry.plugins || {}).some((key) => key.split('@')[0] === 'darkman-x');
  } catch (_) {
    return false;
  }
}

function installClaude(args, log) {
  const configDir = claudeConfigDir(args);

  // The plugin manifest only takes effect for marketplace installs. A checkout
  // install has no ${CLAUDE_PLUGIN_ROOT}, so hooks must go into settings.json.
  const pluginWiresHooks = claudePluginInstalled(configDir);
  const shouldAddHooks = args.withHooks || (!pluginWiresHooks && !args.noHooks);

  if (pluginWiresHooks) {
    log('claude: darkman-x is installed as a plugin — hooks come from .claude-plugin/plugin.json');
  } else {
    log('claude: no plugin install detected, wiring this checkout (' + REPO_ROOT + ')');
    log('claude: for a global install instead, run in Claude Code:');
    log('claude:   /plugin marketplace add KcAnom/darkmanx');
    log('claude:   /plugin install darkman-x@darkman-x-marketplace');
  }

  if (shouldAddHooks && !args.noHooks) {
    if (pluginWiresHooks) {
      log('claude: warning — --with-hooks on top of a plugin install duplicates the hooks');
    }
    const settingsPath = path.join(configDir, 'settings.json');
    log('claude: registering hooks in ' + settingsPath);
    if (!args.dryRun) {
      let settings = {};
      try {
        settings = settingsLib.readSettings(settingsPath);
      } catch (err) {
        log('claude: warning — ' + err.message + ' (leaving settings untouched)');
        return;
      }
      settingsLib.rewriteLegacyHookShape(settings);
      const hooksDir = path.join(REPO_ROOT, 'src', 'hooks');
      settingsLib.addCommandHook(settings, 'SessionStart', 'node "' + path.join(hooksDir, 'darkman-x-activate.js') + '"', { timeout: 5 });
      settingsLib.addCommandHook(settings, 'UserPromptSubmit', 'node "' + path.join(hooksDir, 'darkman-x-mode-tracker.js') + '"', { timeout: 5 });
      settings.hooks = settingsLib.validateHookFields(settings.hooks);
      settingsLib.writeSettings(settingsPath, settings);
    }
  }
}

function installGemini(args, log) {
  const geminiDir = path.join(os.homedir(), '.gemini');
  log('gemini: linking GEMINI.md context file (' + geminiDir + ')');
  if (!args.dryRun) {
    fs.mkdirSync(geminiDir, { recursive: true });
  }
}

function installOpencode(args, log) {
  const opencodeConfigDir = process.env.XDG_CONFIG_HOME
    ? path.join(process.env.XDG_CONFIG_HOME, 'opencode')
    : path.join(os.homedir(), '.config', 'opencode');
  log('opencode: installing plugin + commands into ' + opencodeConfigDir);
  if (!args.dryRun) {
    fs.mkdirSync(path.join(opencodeConfigDir, 'plugin'), { recursive: true });
    const src = path.join(REPO_ROOT, 'src', 'plugins', 'opencode');
    if (fs.existsSync(path.join(src, 'plugin.js'))) {
      fs.copyFileSync(
        path.join(src, 'plugin.js'),
        path.join(opencodeConfigDir, 'plugin', 'darkman-x.js')
      );
    }
  }
}

function installOpenclaw(args, log) {
  log('openclaw: installing skill + SOUL.md bootstrap into ' + openclaw.workspaceDir());
  if (!args.dryRun) {
    openclaw.install(REPO_ROOT);
  }
}

function installHermes(args, log) {
  const hermesDir = path.join(os.homedir(), '.hermes', 'skills', 'darkman-x');
  log('hermes: copying skill into ' + hermesDir);
  if (!args.dryRun) {
    fs.mkdirSync(hermesDir, { recursive: true });
    const src = path.join(REPO_ROOT, 'skills', 'darkman-x', 'SKILL.md');
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(hermesDir, 'SKILL.md'));
  }
}

function installViaSkills(provider, args, log) {
  const repo = 'KcAnom/darkmanx';
  log(provider.id + ': npx skills add ' + repo + ' -a ' + provider.profile);
  if (args.dryRun) return;
  if (args.skipSkills) {
    log(provider.id + ': --skip-skills set, not invoking npx');
    return;
  }
  const result = spawnSync('npx', ['-y', 'skills', 'add', repo, '-a', provider.profile], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    log(provider.id + ': npx skills exited with status ' + result.status);
  }
}

function uninstallClaude(args, log) {
  const configDir = claudeConfigDir(args);
  const settingsPath = path.join(configDir, 'settings.json');
  log('claude: removing darkman-x hooks from ' + settingsPath);
  if (!args.dryRun && fs.existsSync(settingsPath)) {
    let settings;
    try {
      settings = settingsLib.readSettings(settingsPath);
    } catch (err) {
      log('claude: warning — ' + err.message);
      return;
    }
    settingsLib.removeDarkmanXHooks(settings);
    settingsLib.writeSettings(settingsPath, settings);
  }
  const marker = path.join(configDir, 'plugins', 'darkman-x.json');
  if (!args.dryRun && fs.existsSync(marker)) fs.unlinkSync(marker);
}

const INSTALLERS = {
  claude: installClaude,
  codex: (args, log) => log('codex: see .codex/config.toml + .codex/hooks.json (static config, no action needed)'),
  gemini: installGemini,
  opencode: installOpencode,
  openclaw: installOpenclaw,
  hermes: installHermes,
};

function runInit(args, log) {
  log('running src/tools/darkman-x-init.js for this repo...');
  if (args.dryRun) return;
  const initScript = path.join(REPO_ROOT, 'src', 'tools', 'darkman-x-init.js');
  spawnSync(process.execPath, [initScript], { stdio: 'inherit' });
}

function promptMultiSelect(providers) {
  return new Promise((resolve) => {
    console.log('\nDetected providers:');
    providers.forEach((p, i) => {
      console.log('  [' + (p.detected ? 'x' : ' ') + '] ' + (i + 1) + '. ' + p.label);
    });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nInstall for detected providers? [Y/n] ', (answer) => {
      rl.close();
      const proceed = !answer.trim() || /^y/i.test(answer.trim());
      resolve(proceed ? providers.filter((p) => p.detected) : []);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  checkNodeVersion();
  refuseWindowsNodeInsideWsl();

  const providers = detectProviders(args);

  if (args.list) {
    printProviderList(providers, args.noColor);
    return;
  }

  let selected;
  if (args.only) {
    selected = providers.filter((p) => p.id === args.only);
    if (selected.length === 0) {
      console.error('unknown provider id: ' + args.only + ' (use --list)');
      process.exit(1);
    }
  } else if (args.all) {
    selected = providers.filter((p) => !p.soft || args.force);
  } else if (args.nonInteractive) {
    selected = providers.filter((p) => p.detected && !p.soft);
  } else if (process.stdin.isTTY) {
    selected = await promptMultiSelect(providers.filter((p) => !p.soft));
  } else {
    selected = providers.filter((p) => p.detected && !p.soft);
  }

  const log = (msg) => console.log(msg);

  for (const provider of selected) {
    if (args.uninstall) {
      if (provider.id === 'claude') uninstallClaude(args, log);
      else if (provider.id === 'openclaw') {
        log('openclaw: removing skill + SOUL.md bootstrap');
        if (!args.dryRun) openclaw.uninstall();
      } else {
        log(provider.id + ': manual uninstall — see INSTALL.md');
      }
      continue;
    }

    const installer = INSTALLERS[provider.id];
    if (installer) {
      installer(args, log);
    } else {
      installViaSkills(provider, args, log);
    }
  }

  if (args.withInit && !args.uninstall) {
    runInit(args, log);
  }

  if (args.withMcpShrink) {
    log(
      'mcp-shrink: wrap your MCP server command with:\n' +
      '  node "' + path.join(REPO_ROOT, 'src', 'mcp-servers', 'darkman-x-shrink', 'index.js') + '" ' +
      args.withMcpShrink
    );
  }

  console.log('\ndarkman-x: ' + (args.uninstall ? 'uninstall' : 'install') +
    (args.dryRun ? ' (dry-run)' : '') + ' complete for: ' +
    (selected.map((p) => p.id).join(', ') || '(none)'));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('darkman-x install failed:', err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, parseArgv: parseArgs, PROVIDERS, main };
