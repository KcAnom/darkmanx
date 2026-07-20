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
const VOICE_FLAG_BASENAME = '.darkman-x-voice';
const DEFAULT_VOICE_ID = '552fdfe0e4f542c1bb381d1006c1ac9b';
const DEFAULT_VOICE_MODEL = 's2.1-pro-free';


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


function voiceFlagPath(configDir) {
  // Prefer Claude config dir when CLAUDE_CONFIG_DIR is set (session flags),
  // else fall back to the XDG darkman-x config dir for standalone CLI use.
  const dir = configDir || process.env.CLAUDE_CONFIG_DIR || getConfigDir();
  // Session flags live next to other .darkman-x-* flags under CLAUDE_CONFIG_DIR
  // when provided; for XDG config we still write a simple flag file.
  if (configDir || process.env.CLAUDE_CONFIG_DIR) {
    return path.join(dir, VOICE_FLAG_BASENAME);
  }
  return path.join(getConfigDir(), VOICE_FLAG_BASENAME);
}

function isVoiceEnabled(configDir) {
  const env = process.env.DARKMANX_VOICE;
  if (env === '0' || env === 'off' || env === 'false') return false;
  if (env === '1' || env === 'on' || env === 'true') return true;

  const flagPath = voiceFlagPath(configDir);
  const raw = (readFlag(flagPath) || '').trim().toLowerCase();
  if (raw === 'on' || raw === '1' || raw === 'true') return true;
  if (raw === 'off' || raw === '0' || raw === 'false') return false;

  // Optional default from user config.json: { "voice": { "enabled": true } }
  const userConfig = readJsonSafe(getConfigPath());
  if (userConfig && userConfig.voice && typeof userConfig.voice.enabled === 'boolean') {
    return userConfig.voice.enabled;
  }
  return false;
}

function setVoiceEnabled(enabled, configDir) {
  const flagPath = voiceFlagPath(configDir);
  return safeWriteFlag(flagPath, enabled ? 'on' : 'off');
}

function getVoiceSettings() {
  const userConfig = readJsonSafe(getConfigPath()) || {};
  const v = (userConfig && userConfig.voice) || {};
  return {
    enabled: isVoiceEnabled(),
    referenceId:
      process.env.DARKMANX_VOICE_ID ||
      v.referenceId ||
      v.voiceId ||
      DEFAULT_VOICE_ID,
    model:
      process.env.DARKMANX_VOICE_MODEL ||
      v.model ||
      DEFAULT_VOICE_MODEL,
    format: process.env.DARKMANX_VOICE_FORMAT || v.format || 'mp3',
    play: process.env.DARKMANX_VOICE_PLAY === '0' ? false : (v.play !== false),
    speed: v.speed != null ? Number(v.speed) : null,
  };
}

module.exports = {
  VALID_MODES,
  MODE_LOG_BASENAME,
  VOICE_FLAG_BASENAME,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_MODEL,
  getDefaultMode,
  getConfigDir,
  getConfigPath,
  findRepoConfigPath,
  safeWriteFlag,
  readFlag,
  appendFlag,
  recordModeChange,
  readHistory,
  voiceFlagPath,
  isVoiceEnabled,
  setVoiceEnabled,
  getVoiceSettings,
};
