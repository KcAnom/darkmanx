#!/usr/bin/env node
'use strict';

// darkman-x voice: Fish Audio S2.1-Pro TTS, Node stdlib only (fetch is
// built into Node >= 18). Reads FISH_API_KEY. Default voice is the
// darkman-x reference id. Silent-fail on network/auth errors when used as
// a session helper; CLI mode still exits non-zero so scripts can detect it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_VOICE_ID = '552fdfe0e4f542c1bb381d1006c1ac9b';
const DEFAULT_MODEL = 's2.1-pro-free';
const API_URL = 'https://api.fish.audio/v1/tts';

const config = (() => {
  try {
    return require(path.join(__dirname, '..', 'hooks', 'darkman-x-config'));
  } catch (_) {
    return null;
  }
})();


function isUsableApiKey(key) {
  if (!key) return false;
  const k = String(key).trim();
  if (!k) return false;
  const placeholders = [
    'paste_your_fish_api_key_here',
    'your_key_here',
    'your_api_key',
    'changeme',
    'xxx',
  ];
  if (placeholders.includes(k.toLowerCase())) return false;
  return true;
}

function loadDotEnvFiles() {
  // Non-destructive: only set keys that are not already in process.env.
  // Never logs values. Silent-fail if files are missing or unreadable.
  // Priority (first file wins per key because later files only fill empty keys):
  //   1. process env already set
  //   2. repo root .env
  //   3. ~/.config/darkman-x/.env
  const candidates = [];
  try {
    candidates.push(path.join(process.cwd(), '.env'));
  } catch (_) {}
  try {
    candidates.push(path.join(__dirname, '..', '..', '.env')); // repo root from src/tools
  } catch (_) {}
  try {
    if (config && typeof config.getConfigDir === 'function') {
      candidates.push(path.join(config.getConfigDir(), '.env'));
    } else {
      candidates.push(path.join(os.homedir(), '.config', 'darkman-x', '.env'));
    }
  } catch (_) {
    candidates.push(path.join(os.homedir(), '.config', 'darkman-x', '.env'));
  }

  const seen = new Set();
  for (const file of candidates) {
    if (!file || seen.has(file)) continue;
    seen.add(file);
    try {
      if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) continue;
      const raw = fs.readFileSync(file, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!key) continue;
        // Skip empty / placeholder values so a real key in a later file can win.
        if (!val || !isUsableApiKey(val)) continue;
        if (process.env[key] === undefined || process.env[key] === '') {
          process.env[key] = val;
        }
      }
      debugLog('loaded env from', file);
    } catch (err) {
      debugLog('dotenv skip', file, '-', err.message);
    }
  }
}


function debugLog(...args) {
  if (process.env.DARKMANX_DEBUG === '1' || process.env.DARKMANX_VOICE_DEBUG === '1') {
    try {
      process.stderr.write('[darkman-x-speak] ' + args.join(' ') + '\n');
    } catch (_) {
      /* ignore */
    }
  }
}

function usage(exitCode) {
  const text = [
    'Usage: darkman-x-speak [options] [text...]',
    '',
    'Speak text via Fish Audio S2.1-Pro (default voice: darkman-x).',
    '',
    'Options:',
    '  --stdin              Read text from stdin',
    '  --file <path>        Read text from a file',
    '  --out <path>         Write audio to this path (default: temp file)',
    '  --no-play            Skip local playback',
    '  --play               Force local playback (default when TTY)',
    '  --model <id>         TTS model header (default: s2.1-pro-free)',
    '  --voice <id>         reference_id / voice model id',
    '  --format <fmt>       mp3|wav|opus|pcm (default: mp3)',
    '  --speed <n>          Prosody speed 0.5–2.0',
    '  --dry-run            Print resolved config, do not call the API',
    '  --quiet              Suppress non-error stdout',
    '  -h, --help           Show this help',
    '',
    'Env:',
    '  FISH_API_KEY              required',
    '  DARKMANX_VOICE_ID         override default voice id',
    '  DARKMANX_VOICE_MODEL      override default model (s2.1-pro-free)',
    '  DARKMANX_VOICE_FORMAT     override format',
    '  DARKMANX_VOICE_PLAY=0     disable auto-play',
    '  DARKMANX_DEBUG=1          verbose logs',
  ].join('\n');
  process.stdout.write(text + '\n');
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = {
    stdin: false,
    file: null,
    out: null,
    play: null,
    model: null,
    voice: null,
    format: null,
    speed: null,
    dryRun: false,
    quiet: false,
    textParts: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      opts.textParts.push(...argv.slice(i + 1));
      break;
    }
    if (a === '-h' || a === '--help') usage(0);
    else if (a === '--stdin') opts.stdin = true;
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--no-play') opts.play = false;
    else if (a === '--play') opts.play = true;
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--voice') opts.voice = argv[++i];
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--speed') opts.speed = Number(argv[++i]);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a.startsWith('-')) {
      process.stderr.write('Unknown option: ' + a + '\n');
      usage(2);
    } else {
      opts.textParts.push(a);
    }
  }
  return opts;
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function loadVoiceConfig() {
  const fromFile = {};
  if (config) {
    try {
      const user = config.readJsonSafe
        ? config.readJsonSafe(config.getConfigPath())
        : null;
      // readJsonSafe is internal; fall back to direct read
    } catch (_) {
      /* ignore */
    }
    try {
      const p = config.getConfigPath();
      if (fs.existsSync(p) && !fs.lstatSync(p).isSymbolicLink()) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (raw && raw.voice && typeof raw.voice === 'object') {
          Object.assign(fromFile, raw.voice);
        }
      }
    } catch (err) {
      debugLog('config read failed -', err.message);
    }
  }
  return fromFile;
}

function resolveSettings(opts) {
  const fileCfg = loadVoiceConfig();
  const model =
    opts.model ||
    process.env.DARKMANX_VOICE_MODEL ||
    fileCfg.model ||
    DEFAULT_MODEL;
  const voice =
    opts.voice ||
    process.env.DARKMANX_VOICE_ID ||
    fileCfg.referenceId ||
    fileCfg.voiceId ||
    DEFAULT_VOICE_ID;
  const format =
    opts.format ||
    process.env.DARKMANX_VOICE_FORMAT ||
    fileCfg.format ||
    'mp3';
  let play = opts.play;
  if (play === null) {
    if (process.env.DARKMANX_VOICE_PLAY === '0') play = false;
    else if (fileCfg.play === false) play = false;
    else play = true;
  }
  const speed =
    opts.speed != null && !Number.isNaN(opts.speed)
      ? opts.speed
      : fileCfg.speed != null
        ? Number(fileCfg.speed)
        : null;

  return { model, voice, format, play, speed };
}

function stripForSpeech(text) {
  // Keep conversational content only — drop fenced code, inline code, and
  // markdown syntax so a TTS engine doesn't read literal "asterisk asterisk".
  let t = String(text || '');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`[^`\n]+`/g, ' ');
  t = t.replace(/^#{1,6}\s+/gm, ''); // headers
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
  t = t.replace(/(^|\n)\s*[-*]\s+/g, '$1'); // bullet markers
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // markdown links -> label only
  t = t.replace(/\s+/g, ' ').trim();
  // Sanity cap so a runaway prompt can't produce an unbounded TTS call.
  if (t.length > 4000) t = t.slice(0, 3997) + '...';
  return t;
}

function defaultOutPath(format) {
  const dir = path.join(os.tmpdir(), 'darkman-x-voice');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, 'speak-' + process.pid + '-' + Date.now() + '.' + format);
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
    // Linux: try common players in order
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
    if (!cmd) {
      debugLog('no audio player found; wrote', filePath);
      return false;
    }
  }
  const result = spawnSync(cmd, args, { stdio: 'ignore', timeout: 120000 });
  if (result.error) {
    debugLog('play failed -', result.error.message);
    return false;
  }
  return result.status === 0;
}

async function synthesize({ apiKey, text, model, voice, format, speed }) {
  const body = {
    text,
    format,
    reference_id: voice,
  };
  if (speed != null && !Number.isNaN(speed)) {
    body.prosody = { speed };
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      model: model,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch (_) {
      /* ignore */
    }
    const err = new Error(
      'Fish Audio TTS failed: HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 300) : '')
    );
    err.status = res.status;
    throw err;
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function main() {
  loadDotEnvFiles();
  const opts = parseArgs(process.argv.slice(2));
  const settings = resolveSettings(opts);

  let text = '';
  if (opts.stdin) {
    text = readStdinSync();
  } else if (opts.file) {
    text = fs.readFileSync(opts.file, 'utf8');
  } else if (opts.textParts.length) {
    text = opts.textParts.join(' ');
  } else if (!process.stdin.isTTY) {
    text = readStdinSync();
  }

  text = stripForSpeech(text);
  if (!text) {
    process.stderr.write('darkman-x-speak: no text to speak\n');
    process.exit(2);
  }

  const apiKeyRaw = process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || '';
  const apiKey = isUsableApiKey(apiKeyRaw) ? apiKeyRaw.trim() : '';

  if (opts.dryRun) {
    process.stdout.write(
      JSON.stringify(
        {
          model: settings.model,
          voice: settings.voice,
          format: settings.format,
          play: settings.play,
          speed: settings.speed,
          textPreview: text.slice(0, 120),
          apiKey: apiKey ? 'set' : 'missing',
        },
        null,
        2
      ) + '\n'
    );
    process.exit(apiKey ? 0 : 2);
  }

  if (!apiKey) {
    process.stderr.write(
      'darkman-x-speak: FISH_API_KEY is not set.\n  Root: .env\n  User: ~/.config/darkman-x/.env\n  Line: FISH_API_KEY=your_key_here\n'
    );
    process.exit(2);
  }

  const outPath = opts.out || defaultOutPath(settings.format);
  try {
    const audio = await synthesize({
      apiKey,
      text,
      model: settings.model,
      voice: settings.voice,
      format: settings.format,
      speed: settings.speed,
    });
    fs.writeFileSync(outPath, audio, { mode: 0o600 });
  } catch (err) {
    process.stderr.write('darkman-x-speak: ' + err.message + '\n');
    process.exit(1);
  }

  if (!opts.quiet) {
    process.stdout.write(outPath + '\n');
  }

  if (settings.play) {
    playAudio(outPath);
  }
}

main().catch((err) => {
  process.stderr.write('darkman-x-speak: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
