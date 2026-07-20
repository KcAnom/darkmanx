#!/usr/bin/env node
'use strict';

// darkman-x sfx: play a short DMX sound clip. Node stdlib only. Clips are
// never shipped in this repo (copyright — see skills/darkman-x/SKILL.md
// brand-voice rules and CLAUDE.md) — they live out-of-tree in the user's
// own XDG config dir, populated locally, never git-tracked.
//
// This is a personal-fun tool, not a hook: the model decides in-session
// when a moment actually earns a clip and picks one by name/vibe. There is
// no hardcoded event->clip mapping and no auto-fire on session events —
// silence otherwise is the default, always.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const config = (() => {
  try {
    return require(path.join(__dirname, '..', 'hooks', 'darkman-x-config'));
  } catch (_) {
    return null;
  }
})();

function debugLog(...args) {
  if (process.env.DARKMANX_DEBUG === '1') {
    try {
      process.stderr.write('[darkman-x-sfx] ' + args.join(' ') + '\n');
    } catch (_) {
      /* ignore */
    }
  }
}

function sfxDir() {
  if (process.env.DARKMANX_SFX_DIR) return process.env.DARKMANX_SFX_DIR;
  const base = config && typeof config.getConfigDir === 'function'
    ? config.getConfigDir()
    : path.join(os.homedir(), '.config', 'darkman-x');
  return path.join(base, 'sfx');
}

function listClips() {
  const dir = sfxDir();
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f))
      .map((f) => f.replace(/^myinstants-/i, '').replace(/\.[^.]+$/, ''))
      .sort();
  } catch (_) {
    return [];
  }
}

function resolveClip(name) {
  const dir = sfxDir();
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f));
  } catch (_) {
    return null;
  }
  const want = name.toLowerCase().replace(/^myinstants-/i, '').replace(/\.[^.]+$/, '');

  // Exact match on the display name (prefix stripped) first.
  for (const f of files) {
    const short = f.replace(/^myinstants-/i, '').replace(/\.[^.]+$/, '');
    if (short.toLowerCase() === want) return path.join(dir, f);
  }
  // Fall back to substring match — the model can be loose with naming.
  for (const f of files) {
    if (f.toLowerCase().includes(want)) return path.join(dir, f);
  }
  return null;
}

function playAudio(filePath) {
  const platform = process.platform;
  let cmd;
  let args;
  if (platform === 'darwin') {
    cmd = 'afplay';
    args = [filePath];
  } else if (platform === 'win32') {
    cmd = 'powershell';
    args = [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName presentationCore; ' +
        '$p = New-Object System.Windows.Media.MediaPlayer; ' +
        "$p.Open([uri]'" + filePath.replace(/'/g, "''") + "'); " +
        '$p.Play(); Start-Sleep -Milliseconds 400; ' +
        'while($p.NaturalDuration.HasTimeSpan -eq $false){Start-Sleep -Milliseconds 50}; ' +
        'Start-Sleep -Seconds $p.NaturalDuration.TimeSpan.TotalSeconds',
    ];
  } else {
    for (const candidate of ['ffplay', 'mpv', 'paplay', 'aplay', 'play']) {
      const which = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (which.status === 0) {
        cmd = candidate;
        if (candidate === 'ffplay') args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath];
        else if (candidate === 'mpv') args = ['--no-video', '--really-quiet', filePath];
        else args = [filePath];
        break;
      }
    }
    if (!cmd) return false;
  }
  const result = spawnSync(cmd, args, { stdio: 'ignore', timeout: 30000 });
  return !result.error && result.status === 0;
}

function usage(exitCode) {
  process.stdout.write(
    [
      'Usage: darkman-x-sfx [--list] [--quiet] <clip-name>',
      '',
      'Play a DMX sound clip from ' + sfxDir() + ' (out-of-tree, gitignored).',
      '  --list     print available clip names, one per line, then exit',
      '  --quiet    suppress "playing: <name>" stdout line',
      '',
      'Env: DARKMANX_SFX_DIR  override the clips directory',
    ].join('\n') + '\n'
  );
  process.exit(exitCode);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) usage(0);

  if (argv.includes('--list')) {
    const clips = listClips();
    if (!clips.length) {
      debugLog('no clips found in', sfxDir());
      process.exit(0);
    }
    process.stdout.write(clips.join('\n') + '\n');
    process.exit(0);
  }

  const quiet = argv.includes('--quiet');
  const name = argv.filter((a) => a !== '--quiet')[0];
  if (!name) usage(2);

  const clipPath = resolveClip(name);
  if (!clipPath) {
    debugLog('no clip matched:', name, 'in', sfxDir());
    process.exit(0); // silent-fail — never break the turn over a missing sound effect
  }

  if (!quiet) process.stdout.write('playing: ' + path.basename(clipPath) + '\n');
  playAudio(clipPath);
  process.exit(0);
}

try {
  main();
} catch (err) {
  debugLog('fatal (swallowed) -', err.message);
  process.exit(0);
}
