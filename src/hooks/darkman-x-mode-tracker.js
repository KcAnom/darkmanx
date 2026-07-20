#!/usr/bin/env node
'use strict';

// UserPromptSubmit hook. Reads JSON from stdin, always exits 0 — a parse
// error or an unrecognized prompt is just "do nothing", never a failure.

const path = require('path');
const { spawnSync } = require('child_process');

const config = require('./darkman-x-config');

const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

const DEACTIVATION_PATTERNS = [
  /^\s*stop darkman-?x\s*\.?\s*$/i,
  /^\s*normal mode\s*\.?\s*$/i,
  /^\s*disable darkman-?x\s*\.?\s*$/i,
];

const ABOUT_DARKMANX_PATTERNS = [
  /what is darkman-?x/i,
  /how does darkman-?x work/i,
  /explain darkman-?x/i,
  /tell me about darkman-?x/i,
];

const NL_ACTIVATION_PATTERNS = [
  /activate darkman-?x/i,
  /enable darkman-?x/i,
  /talk like darkman-?x/i,
  /respond like darkman-?x/i,
  /use less tokens/i,
  /fewer tokens/i,
  /be more terse/i,
];

const MODE_COMMAND_RE = /^\s*\/darkman-x(?::darkman-x)?(?:-([a-z-]+))?(?:\s+(.+))?\s*$/i;
const VOICE_COMMAND_RE = /^\s*\/darkman-x(?::darkman-x)?(?:-voice)?\s+voice\s+(on|off|status|toggle)\s*$/i;
const VOICE_NL_ON = [/\benable (?:darkman-?x )?voice\b/i, /\bvoice (?:mode )?on\b/i, /\bspeak (?:replies|responses|out loud)\b/i];
const VOICE_NL_OFF = [/\bdisable (?:darkman-?x )?voice\b/i, /\bvoice (?:mode )?off\b/i, /\bstop speaking\b/i, /\bmute voice\b/i];
const STATS_COMMAND_RE = /^\s*\/darkman-x(?::darkman-x)?-stats\b(.*)$/i;
const STATUS_COMMAND_RE = /^\s*\/darkman-x(?::darkman-x)?(?:-status|\s+status)\b(.*)$/i;

function claudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude');
}

function activeFlagPath() {
  return path.join(claudeConfigDir(), '.darkman-x-active');
}

function prevFlagPath() {
  return path.join(claudeConfigDir(), '.darkman-x-active.prev');
}

function debugLog(...args) {
  if (process.env.DARKMANX_DEBUG === '1') {
    try {
      process.stderr.write('[darkman-x] ' + args.join(' ') + '\n');
    } catch (_) {
      // stderr unavailable
    }
  }
}

function readStdin() {
  try {
    const chunks = [];
    let chunk;
    const fd = 0;
    const buf = Buffer.alloc(65536);
    const fs = require('fs');
    while (true) {
      let bytesRead;
      try {
        bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
      } catch (err) {
        if (err.code === 'EAGAIN') continue;
        break;
      }
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(buf.slice(0, bytesRead)));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (err) {
    debugLog('readStdin failed -', err.message);
    return '';
  }
}

function setMode(mode) {
  const configDir = claudeConfigDir();
  if (INDEPENDENT_MODES.has(mode)) {
    const current = config.readFlag(activeFlagPath());
    if (current && !INDEPENDENT_MODES.has(current.trim())) {
      config.safeWriteFlag(prevFlagPath(), current.trim());
    }
  }
  config.recordModeChange(configDir, mode);
  config.safeWriteFlag(activeFlagPath(), mode);
}

function restorePrevIfNeeded() {
  const configDir = claudeConfigDir();
  const current = (config.readFlag(activeFlagPath()) || '').trim();
  if (!INDEPENDENT_MODES.has(current)) return;
  const prev = (config.readFlag(prevFlagPath()) || '').trim();
  if (prev && config.VALID_MODES.includes(prev)) {
    config.recordModeChange(configDir, prev);
    config.safeWriteFlag(activeFlagPath(), prev);
  }
}

function clearMode() {
  const configDir = claudeConfigDir();
  config.recordModeChange(configDir, 'off');
  config.safeWriteFlag(activeFlagPath(), 'off');
}

// Shared wording with the Pi extension's ctx.ui.notify() strings
// (.pi/extensions/darkman-x.ts) so both surfaces read identically.
function modeConfirmLine(mode, voiceOn) {
  if (mode === 'off') return 'darkman-x off. Normal voice.';
  return 'darkman-x ' + mode + (voiceOn ? ' +VOICE' : '');
}

function voiceStatusLine(dir) {
  const on = config.isVoiceEnabled(dir);
  const vs = config.getVoiceSettings();
  return 'voice ' + (on ? 'ON' : 'OFF') + ' · model ' + vs.model + ' · id ' + vs.referenceId;
}

function statusLine(dir) {
  const mode = (config.readFlag(activeFlagPath()) || 'off').trim() || 'off';
  // Always print prev= (default 'full', matching the Pi extension's initial
  // state.prevMode) so the two surfaces are byte-identical, not just same-shape.
  const prev = (config.readFlag(prevFlagPath()) || '').trim() || 'full';
  const on = config.isVoiceEnabled(dir);
  const vs = config.getVoiceSettings();
  return 'mode=' + mode + ' prev=' + prev + ' voice=' + (on ? 'ON' : 'OFF') + ' model=' + vs.model;
}

function runStats(argTail, transcriptPath) {
  try {
    const statsScript = path.join(__dirname, 'darkman-x-stats.js');
    const args = [];
    if (transcriptPath) args.push('--session-file', transcriptPath);
    for (const flag of ['--share', '--all']) {
      if (argTail.includes(flag)) args.push(flag);
    }
    const sinceMatch = argTail.match(/--since\s+(\S+)/);
    if (sinceMatch) args.push('--since', sinceMatch[1]);

    const result = spawnSync(process.execPath, [statsScript, ...args], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return (result.stdout || '').trim() || 'darkman-x: no stats available.';
  } catch (err) {
    debugLog('runStats failed -', err.message);
    return 'darkman-x: stats unavailable.';
  }
}

function emitBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
}

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (err) {
    debugLog('stdin JSON parse failed -', err.message);
    process.exit(0);
    return;
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  const transcriptPath = typeof payload.transcript_path === 'string' ? payload.transcript_path : null;

  if (!prompt) {
    process.exit(0);
    return;
  }

  const statsMatch = prompt.match(STATS_COMMAND_RE);
  if (statsMatch) {
    const statsText = runStats(statsMatch[1] || '', transcriptPath);
    emitBlock(statsText);
    process.exit(0);
    return;
  }

  const statusMatch = prompt.match(STATUS_COMMAND_RE);
  if (statusMatch) {
    emitBlock(statusLine(claudeConfigDir()));
    process.exit(0);
    return;
  }

  if (DEACTIVATION_PATTERNS.some((re) => re.test(prompt))) {
    clearMode();
    emitBlock(modeConfirmLine('off', false));
    process.exit(0);
    return;
  }

  if (ABOUT_DARKMANX_PATTERNS.some((re) => re.test(prompt))) {
    process.exit(0);
    return;
  }

  if (NL_ACTIVATION_PATTERNS.some((re) => re.test(prompt))) {
    setMode(config.getDefaultMode());
    process.exit(0);
    return;
  }


  // /darkman-x voice on|off|status|toggle  (also /darkman-x-voice on|off)
  const voiceMatch = prompt.match(VOICE_COMMAND_RE) ||
    prompt.match(/^\s*\/darkman-x-voice\s+(on|off|status|toggle)\s*$/i);
  if (voiceMatch) {
    const action = (voiceMatch[1] || '').toLowerCase();
    const dir = claudeConfigDir();
    if (action === 'toggle') {
      config.setVoiceEnabled(!config.isVoiceEnabled(dir), dir);
    } else if (action === 'on' || action === 'off') {
      config.setVoiceEnabled(action === 'on', dir);
    }
    // 'status' falls through — read-only, no write.
    emitBlock(voiceStatusLine(dir));
    process.exit(0);
    return;
  }

  if (VOICE_NL_ON.some((re) => re.test(prompt))) {
    config.setVoiceEnabled(true, claudeConfigDir());
    process.exit(0);
    return;
  }
  if (VOICE_NL_OFF.some((re) => re.test(prompt))) {
    config.setVoiceEnabled(false, claudeConfigDir());
    process.exit(0);
    return;
  }

  const modeMatch = prompt.match(MODE_COMMAND_RE);
  if (modeMatch) {
    const suffix = (modeMatch[1] || '').toLowerCase();
    const arg = (modeMatch[2] || '').trim().toLowerCase();

    // /darkman-x-voice on|off  or  /darkman-x voice on|off  (suffix path)
    if (suffix === 'voice' || arg.startsWith('voice ')) {
      const action = (suffix === 'voice' ? arg : arg.replace(/^voice\s+/, '')).trim().toLowerCase();
      const dir = claudeConfigDir();
      if (action === 'toggle') {
        config.setVoiceEnabled(!config.isVoiceEnabled(dir), dir);
      } else if (action === 'on' || action === 'off') {
        config.setVoiceEnabled(action === 'on', dir);
      }
      // 'status' / '' falls through — read-only, no write.
      emitBlock(voiceStatusLine(dir));
      process.exit(0);
      return;
    }

    const requestedMode = suffix && config.VALID_MODES.includes(suffix)
      ? suffix
      : (arg && config.VALID_MODES.includes(arg) ? arg : null);

    if (requestedMode) {
      setMode(requestedMode);
      // commit/review/compress are one-shot actions, not pure state
      // switches — the prompt must keep flowing to the model so it
      // actually performs the action (per commands/darkman-x-<mode>.md).
      // Blocking here would set the flag and then do nothing else.
      if (!INDEPENDENT_MODES.has(requestedMode)) {
        emitBlock(modeConfirmLine(requestedMode, config.isVoiceEnabled(claudeConfigDir())));
        process.exit(0);
        return;
      }
    }
    process.exit(0);
    return;
  }

  restorePrevIfNeeded();
  process.exit(0);
}

try {
  main();
} catch (err) {
  debugLog('darkman-x-mode-tracker fatal (swallowed) -', err.message);
  process.exit(0);
}
