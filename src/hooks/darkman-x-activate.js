#!/usr/bin/env node
'use strict';

// SessionStart hook. Must never throw uncaught and must never block a
// session from starting — every failure path falls through to exit 0.

const fs = require('fs');
const path = require('path');

const config = require('./darkman-x-config');

const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

const FALLBACK_RULES = [
  'Respond terse like Darkman X — short, hard, exact.',
  'Drop filler, hedging, and restated questions. Fragments are fine.',
  'Preserve code, commands, errors, and the user\'s own words byte-exact.',
  'Pattern: [thing] [action] [reason]. [next step].',
].join('\n');

function debugLog(...args) {
  if (process.env.DARKMANX_DEBUG === '1') {
    try {
      process.stderr.write('[darkman-x] ' + args.join(' ') + '\n');
    } catch (_) {
      // stderr unavailable
    }
  }
}

function claudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(require('os').homedir(), '.claude');
}

function applyModelOverridesBestEffort() {
  try {
    const overrides = require('./xcrew-model-overrides');
    overrides.applyOverrides();
  } catch (err) {
    debugLog('model overrides skipped -', err.message);
  }
}

function activeFlagPath() {
  return path.join(claudeConfigDir(), '.darkman-x-active');
}

function prevFlagPath() {
  return path.join(claudeConfigDir(), '.darkman-x-active.prev');
}

function skillCandidatePaths() {
  const candidates = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'darkman-x', 'SKILL.md'));
  }
  candidates.push(path.join(__dirname, '..', '..', 'skills', 'darkman-x', 'SKILL.md'));
  candidates.push(path.join(__dirname, '..', 'skills', 'darkman-x', 'SKILL.md'));
  return candidates;
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

// Keep only the row/example relevant to `mode` in a markdown intensity table,
// so the session isn't fed rules for levels it isn't running.
function filterIntensityTable(body, mode) {
  const lines = body.split('\n');
  const out = [];
  let inTable = false;

  for (const line of lines) {
    const isTableRow = /^\s*\|/.test(line);
    if (isTableRow) {
      inTable = true;
      const isHeaderOrSeparator = /^\s*\|\s*[-:]+\s*\|/.test(line) || out.length === 0 ||
        !out[out.length - 1] || !/^\s*\|/.test(out[out.length - 1]);

      // Only look at the first cell (the level name column) — description
      // cells often reference other level names in passing and shouldn't
      // count as "this row is about that level".
      const firstCell = (line.split('|')[1] || '').toLowerCase();
      const mentionsThisMode = firstCell.includes('`' + mode.toLowerCase() + '`') ||
        (mode.toLowerCase() === 'wenyan' && firstCell.includes('`wenyan-full`'));
      const mentionsOtherModeOnly = config.VALID_MODES.some(
        (m) => m !== mode && firstCell.includes('`' + m.toLowerCase() + '`')
      ) && !mentionsThisMode;

      if (isHeaderOrSeparator || mentionsThisMode || !mentionsOtherModeOnly) {
        out.push(line);
      }
      continue;
    }
    inTable = false;
    out.push(line);
  }

  return out.join('\n');
}


function speakToolPath() {
  const candidates = [
    path.join(__dirname, '..', 'tools', 'darkman-x-speak.js'),
    path.join(__dirname, '..', '..', 'src', 'tools', 'darkman-x-speak.js'),
  ];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.unshift(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'src', 'tools', 'darkman-x-speak.js'));
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {
      /* ignore */
    }
  }
  return candidates[candidates.length - 1];
}

function voiceRulesBlock() {
  try {
    if (!config.isVoiceEnabled(claudeConfigDir())) return '';
    const vs = config.getVoiceSettings();
    const tool = speakToolPath();
    return [
      '',
      '## Voice (Fish Audio — ON)',
      'Spoken replies are enabled for this session.',
      '- Model: `' + vs.model + '`',
      '- Voice reference_id: `' + vs.referenceId + '`',
      '- After each conversational reply (not code/commits/PRs), speak it by running:',
      '  `node "' + tool + '" --quiet -- "YOUR SPOKEN VERSION"`',
      '- Speak the full substance, not a trimmed summary — cover every point you made, in natural spoken prose. Rewrite markdown into flowing sentences (no headers, bullets, asterisks, backticks read aloud). Skip code blocks, commands, paths, and URLs entirely. No hard length cap — match the length of the actual reply.',
      '- If FISH_API_KEY is missing, skip speaking silently — do not fail the turn.',
      '- Toggle: `/darkman-x voice off` or say "stop speaking".',
      '',
    ].join('\n');
  } catch (err) {
    debugLog('voice rules skipped -', err.message);
    return '';
  }
}

function sfxToolPath() {
  const candidates = [
    path.join(__dirname, '..', 'tools', 'darkman-x-sfx.js'),
    path.join(__dirname, '..', '..', 'src', 'tools', 'darkman-x-sfx.js'),
  ];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.unshift(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'src', 'tools', 'darkman-x-sfx.js'));
  }
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {
      /* ignore */
    }
  }
  return candidates[candidates.length - 1];
}

function sfxRulesBlock() {
  try {
    if (!config.isSfxEnabled(claudeConfigDir())) return '';
    const tool = sfxToolPath();
    return [
      '',
      '## SFX (DMX sound clips — ON, personal use only)',
      'A small library of DMX audio clips is available, out-of-tree (never committed, never in code/commits/PRs).',
      '- List what exists: `node "' + tool + '" --list`',
      '- Play one: `node "' + tool + '" --quiet <clip-name>` (fuzzy match on name, case-insensitive)',
      '- This is fully your call, not a fixed trigger table. Use real judgment on when a moment earns one — a genuine win, activation, something funny, hype, or just because. No fixed schedule, no per-turn requirement, no held-back clips. Personal machine only — enjoy it, but "every now and then" beats every single reply.',
      '- Missing/unmatched clip → skip silently, never fail the turn over it.',
      '- Toggle: `/darkman-x sfx off`.',
      '',
    ].join('\n');
  } catch (err) {
    debugLog('sfx rules skipped -', err.message);
    return '';
  }
}

function loadSkillRules(mode) {
  for (const candidate of skillCandidatePaths()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, 'utf8');
      const body = stripFrontmatter(raw);
      return filterIntensityTable(body, mode).trim();
    } catch (err) {
      debugLog('failed reading skill candidate', candidate, '-', err.message);
    }
  }
  return null;
}

function maybeNudgeStatusline(configDir) {
  try {
    const settingsPath = path.join(configDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return;
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(raw);
    if (!settings.statusLine) {
      process.stdout.write(
        '\n(darkman-x tip: add a statusLine in settings.json to see the [DARKMAN-X] mode badge)\n'
      );
    }
  } catch (err) {
    debugLog('statusline nudge skipped -', err.message);
  }
}

function main() {
  const configDir = claudeConfigDir();

  applyModelOverridesBestEffort();

  const mode = config.getDefaultMode();

  if (mode === 'off') {
    try {
      const flagPath = activeFlagPath();
      if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
    } catch (err) {
      debugLog('failed clearing flag on off mode -', err.message);
    }
    process.exit(0);
    return;
  }

  config.recordModeChange(configDir, mode);
  config.safeWriteFlag(activeFlagPath(), mode);

  if (INDEPENDENT_MODES.has(mode)) {
    process.stdout.write('darkman-x: ' + mode + ' mode active.\n');
    process.exit(0);
    return;
  }

  const rules = loadSkillRules(mode) || FALLBACK_RULES;
  process.stdout.write(rules + voiceRulesBlock() + sfxRulesBlock() + '\n');

  maybeNudgeStatusline(configDir);

  process.exit(0);
}

try {
  main();
} catch (err) {
  debugLog('darkman-x-activate fatal (swallowed) -', err.message);
  process.exit(0);
}
