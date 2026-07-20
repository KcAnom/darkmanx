import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_MODULE_PATH = path.join(__dirname, '..', '..', 'hooks', 'darkman-x-config.js');

const ACTIVATION_PHRASES = [
  /\bactivate darkman[- ]?x\b/i,
  /\benable darkman[- ]?x\b/i,
  /\btalk like darkman[- ]?x\b/i,
  /\bless tokens\b/i,
];

const DEACTIVATION_PHRASES = [
  /\bstop darkman[- ]?x\b/i,
  /\bnormal mode\b/i,
];

const SLASH_MODE_RE = /^\s*\/darkman-x(?::darkman-x)?(?:[-\s]([\w-]+))?/i;

/**
 * Loads the CJS darkman-x-config module from an ESM plugin context.
 * Bun-compiled OpenCode's require() can be quirky with sibling CJS files,
 * so try a real require() first and fall back to a text-eval CJS shim.
 * Never throws — returns a safe no-op stub on failure.
 */
function loadConfigModule() {
  try {
    const require = createRequire(import.meta.url);
    return require(CONFIG_MODULE_PATH);
  } catch {
    /* fall through to text-eval shim */
  }
  try {
    const source = fs.readFileSync(CONFIG_MODULE_PATH, 'utf8');
    const moduleShim = { exports: {} };
    const fn = new Function('module', 'exports', 'require', '__filename', '__dirname', source);
    const shimRequire = createRequire(import.meta.url);
    fn(moduleShim, moduleShim.exports, shimRequire, CONFIG_MODULE_PATH, path.dirname(CONFIG_MODULE_PATH));
    return moduleShim.exports;
  } catch {
    return {
      VALID_MODES: ['off', 'lite', 'full', 'ultra'],
      getDefaultMode: () => 'full',
    };
  }
}

const darkmanXConfig = loadConfigModule();

function xdgConfigHome() {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  return path.join(os.homedir(), '.config');
}

function flagPath() {
  return path.join(xdgConfigHome(), 'opencode', '.darkman-x-active');
}

function safeWrite(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(filePath, content, { mode: 0o600 });
  } catch {
    /* silent-fail: never block a session over a flag write */
  }
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
}

function detectModeChange(text) {
  if (typeof text !== 'string') return null;

  for (const re of DEACTIVATION_PHRASES) {
    if (re.test(text)) return 'off';
  }

  const slashMatch = text.match(SLASH_MODE_RE);
  if (slashMatch) {
    return (slashMatch[1] || 'full').toLowerCase();
  }

  for (const re of ACTIVATION_PHRASES) {
    if (re.test(text)) return 'full';
  }

  return null;
}

function reinforcementLine(mode) {
  return `Respond terse like Darkman X — short, hard, exact. Mode: ${mode}.`;
}

export default function darkmanXOpencodePlugin() {
  return {
    event: async ({ event }) => {
      try {
        if (event?.type === 'session.created') {
          const mode = darkmanXConfig.getDefaultMode ? darkmanXConfig.getDefaultMode() : 'full';
          safeWrite(flagPath(), mode);
        }
      } catch {
        /* never block session creation */
      }
    },

    'chat.message': async ({ message }) => {
      try {
        const text = message?.content ?? message?.text ?? '';
        const newMode = detectModeChange(text);
        if (newMode) {
          safeWrite(flagPath(), newMode);
        }
      } catch {
        /* silent-fail per darkman-x hook conventions */
      }
    },

    'experimental.chat.system.transform': async ({ system }) => {
      try {
        const mode = safeRead(flagPath());
        if (mode && mode !== 'off') {
          return { system: [...(system || []), reinforcementLine(mode)] };
        }
      } catch {
        /* fall through to unmodified system prompt */
      }
      return { system };
    },
  };
}
