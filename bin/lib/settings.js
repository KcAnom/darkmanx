'use strict';

// JSONC-tolerant settings.json read/write, plus hook-array helpers.
// String-literal-aware: never strips `//` or trailing commas that appear
// inside a JSON string value.

const fs = require('fs');
const os = require('os');
const path = require('path');

function claudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function stripJsonComments(input) {
  let out = '';
  let inString = false;
  let stringQuote = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next;
        i++;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
        stringQuote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function stripTrailingCommas(input) {
  let out = '';
  let inString = false;
  let stringQuote = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += input[i + 1];
        i++;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
        stringQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      continue;
    }
    if (ch === ',') {
      // Look ahead past whitespace/newlines for a closing bracket.
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (input[j] === '}' || input[j] === ']') {
        continue; // drop the trailing comma
      }
    }
    out += ch;
  }
  return out;
}

function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  const raw = fs.readFileSync(settingsPath, 'utf8');
  const cleaned = stripTrailingCommas(stripJsonComments(raw));
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error('failed to parse ' + settingsPath + ': ' + err.message);
  }
}

function writeSettings(settingsPath, settingsObj) {
  const dir = path.dirname(settingsPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, '.' + path.basename(settingsPath) + '.' + process.pid + '.tmp');
  fs.writeFileSync(tmpPath, JSON.stringify(settingsObj, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmpPath, settingsPath);
}

// Claude Code's settings schema is Zod-strict: a malformed hook entry (missing
// `type`/`command`, wrong shape) can reject the whole file. Drop anything
// that doesn't match the expected shape rather than let a bad entry through.
function validateHookFields(hooksObj) {
  if (!hooksObj || typeof hooksObj !== 'object') return {};
  const cleaned = {};
  for (const [event, matchers] of Object.entries(hooksObj)) {
    if (!Array.isArray(matchers)) continue;
    const cleanMatchers = matchers
      .map((matcher) => {
        if (!matcher || !Array.isArray(matcher.hooks)) return null;
        const cleanHooks = matcher.hooks.filter(
          (h) => h && h.type === 'command' && typeof h.command === 'string' && h.command.length > 0
        );
        if (cleanHooks.length === 0) return null;
        return { ...matcher, hooks: cleanHooks };
      })
      .filter(Boolean);
    if (cleanMatchers.length > 0) cleaned[event] = cleanMatchers;
  }
  return cleaned;
}

function hasDarkmanXHook(settings) {
  const hooks = (settings && settings.hooks) || {};
  return Object.values(hooks).some(
    (matchers) =>
      Array.isArray(matchers) &&
      matchers.some(
        (m) =>
          Array.isArray(m.hooks) &&
          m.hooks.some((h) => typeof h.command === 'string' && h.command.includes('darkman-x'))
      )
  );
}

function addCommandHook(settings, event, command, opts) {
  opts = opts || {};
  settings.hooks = settings.hooks || {};
  settings.hooks[event] = settings.hooks[event] || [];

  const alreadyPresent = settings.hooks[event].some(
    (m) => Array.isArray(m.hooks) && m.hooks.some((h) => h.command === command)
  );
  if (alreadyPresent) return settings;

  const entry = { hooks: [{ type: 'command', command, timeout: opts.timeout || 5 }] };
  if (opts.matcher) entry.matcher = opts.matcher;
  settings.hooks[event].push(entry);
  return settings;
}

function removeDarkmanXHooks(settings) {
  if (!settings || !settings.hooks) return settings;
  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    settings.hooks[event] = settings.hooks[event].filter(
      (m) =>
        !(
          Array.isArray(m.hooks) &&
          m.hooks.some((h) => typeof h.command === 'string' && h.command.includes('darkman-x'))
        )
    );
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return settings;
}

// Rewrites an older hook shape (single object instead of an array of
// matchers) into the current array-of-matchers shape, in place.
function rewriteLegacyHookShape(settings) {
  if (!settings || !settings.hooks) return settings;
  for (const event of Object.keys(settings.hooks)) {
    const value = settings.hooks[event];
    if (value && !Array.isArray(value) && Array.isArray(value.hooks)) {
      settings.hooks[event] = [value];
    }
  }
  return settings;
}

module.exports = {
  claudeConfigDir,
  stripJsonComments,
  stripTrailingCommas,
  readSettings,
  writeSettings,
  validateHookFields,
  hasDarkmanXHook,
  addCommandHook,
  removeDarkmanXHooks,
  rewriteLegacyHookShape,
};
