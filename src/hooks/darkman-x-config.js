'use strict';

// Shared config/mode module. Node stdlib only. Every write path here is
// silent-fail by design: a hook that throws or blocks would break session
// start, so callers get `false`/`null` back instead of an exception.

const fs = require('fs');
const os = require('os');
const path = require('path');

const VALID_MODES = [
  'off',
  'lite',
  'full',
  'ultra',
  'wenyan-lite',
  'wenyan',
  'wenyan-full',
  'wenyan-ultra',
  'commit',
  'review',
  'compress',
];

const MODE_LOG_BASENAME = '.darkman-x-mode-log.jsonl';

function debugLog(...args) {
  if (process.env.DARKMANX_DEBUG === '1') {
    try {
      process.stderr.write('[darkman-x] ' + args.join(' ') + '\n');
    } catch (_) {
      // stderr unavailable — nothing to do
    }
  }
}

function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch (_) {
    return false;
  }
}

function xdgConfigHome() {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function getConfigDir() {
  return path.join(xdgConfigHome(), 'darkman-x');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath) || isSymlink(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    debugLog('readJsonSafe failed for', filePath, '-', err.message);
    return null;
  }
}

function findRepoConfigPath(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  const candidates = ['.darkman-x/config.json', '.darkman-x.json'];

  // Bounded walk: stop at filesystem root.
  for (let i = 0; i < 64; i++) {
    for (const rel of candidates) {
      const candidate = path.join(dir, rel);
      if (isSymlink(candidate)) {
        debugLog('refusing symlinked repo config at', candidate);
        continue;
      }
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function getDefaultMode(opts) {
  opts = opts || {};

  const envMode = process.env.DARKMANX_DEFAULT_MODE;
  if (envMode && VALID_MODES.includes(envMode)) return envMode;

  const repoConfigPath = findRepoConfigPath(opts.cwd);
  if (repoConfigPath) {
    const repoConfig = readJsonSafe(repoConfigPath);
    if (repoConfig && VALID_MODES.includes(repoConfig.defaultMode)) {
      return repoConfig.defaultMode;
    }
  }

  const userConfig = readJsonSafe(getConfigPath());
  if (userConfig && VALID_MODES.includes(userConfig.defaultMode)) {
    return userConfig.defaultMode;
  }

  return 'full';
}

function ensureSafeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
    return true;
  }
  if (isSymlink(dirPath)) {
    const resolved = fs.realpathSync(dirPath);
    const home = os.homedir();
    if (!resolved.startsWith(home)) {
      throw new Error('refusing to write through symlinked dir outside home: ' + dirPath);
    }
  }
  return true;
}

function safeWriteFlag(filePath, content) {
  try {
    if (isSymlink(filePath)) {
      debugLog('refusing to write flag through symlink:', filePath);
      return false;
    }
    ensureSafeDir(path.dirname(filePath));

    const dir = path.dirname(filePath);
    const tmpPath = path.join(
      dir,
      '.' + path.basename(filePath) + '.' + process.pid + '.' + Date.now() + '.tmp'
    );

    const openFlags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC |
      (fs.constants.O_NOFOLLOW || 0);
    const fd = fs.openSync(tmpPath, openFlags, 0o600);
    try {
      fs.writeSync(fd, String(content));
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    debugLog('safeWriteFlag failed for', filePath, '-', err.message);
    return false;
  }
}

function readFlag(filePath) {
  try {
    if (!fs.existsSync(filePath) || isSymlink(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    debugLog('readFlag failed for', filePath, '-', err.message);
    return null;
  }
}

function appendFlag(filePath, line) {
  try {
    if (isSymlink(filePath)) {
      debugLog('refusing to append through symlink:', filePath);
      return false;
    }
    ensureSafeDir(path.dirname(filePath));
    const text = line.endsWith('\n') ? line : line + '\n';
    fs.appendFileSync(filePath, text, { mode: 0o600 });
    return true;
  } catch (err) {
    debugLog('appendFlag failed for', filePath, '-', err.message);
    return false;
  }
}

function recordModeChange(configDir, mode) {
  const logPath = path.join(configDir, MODE_LOG_BASENAME);
  const entry = JSON.stringify({ mode: mode, ts: new Date().toISOString() });
  return appendFlag(logPath, entry);
}

function readHistory(configDir) {
  const logPath = path.join(configDir, MODE_LOG_BASENAME);
  const raw = readFlag(logPath);
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = {
  VALID_MODES,
  MODE_LOG_BASENAME,
  getDefaultMode,
  getConfigDir,
  getConfigPath,
  findRepoConfigPath,
  safeWriteFlag,
  readFlag,
  appendFlag,
  recordModeChange,
  readHistory,
};
