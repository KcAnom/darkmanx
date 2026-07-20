#!/usr/bin/env node
'use strict';

// Reads local Claude Code project transcript JSONL, estimates output-token
// savings from darkman-x mode-change history. Estimates only — these are not
// measured per-session numbers, see docs/HONEST-NUMBERS.md.

const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('./darkman-x-config');

// Estimated output-token compression by mode. `full` (0.65) is the only
// value with real benchmark backing; the rest are proportional estimates.
const COMPRESSION = {
  off: 0,
  lite: 0.35,
  full: 0.65,
  ultra: 0.8,
  'wenyan-lite': 0.35,
  wenyan: 0.65,
  'wenyan-full': 0.65,
  'wenyan-ultra': 0.8,
  commit: 0,
  review: 0,
  compress: 0,
};

// $ per output token, by model id prefix. Rough, for order-of-magnitude
// cost-savings estimates only.
const PRICE_PER_OUTPUT_TOKEN = [
  { prefix: 'claude-opus', price: 75 / 1_000_000 },
  { prefix: 'claude-sonnet', price: 15 / 1_000_000 },
  { prefix: 'claude-haiku', price: 4 / 1_000_000 },
  { prefix: 'opus', price: 75 / 1_000_000 },
  { prefix: 'sonnet', price: 15 / 1_000_000 },
  { prefix: 'haiku', price: 4 / 1_000_000 },
];

function priceFor(model) {
  if (!model) return 15 / 1_000_000;
  const m = model.toLowerCase();
  for (const entry of PRICE_PER_OUTPUT_TOKEN) {
    if (m.includes(entry.prefix)) return entry.price;
  }
  return 15 / 1_000_000;
}

function parseArgs(argv) {
  const args = { sessionFile: null, share: false, all: false, since: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--session-file') args.sessionFile = argv[++i];
    else if (a === '--share') args.share = true;
    else if (a === '--all') args.all = true;
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--help') args.help = true;
  }
  return args;
}

function claudeProjectsDir() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'projects');
}

function listTranscriptFiles(args) {
  if (args.sessionFile) {
    return fs.existsSync(args.sessionFile) ? [args.sessionFile] : [];
  }
  const dir = claudeProjectsDir();
  if (!fs.existsSync(dir)) return [];

  const files = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(full);
    }
  };
  walk(dir);

  if (args.all) return files;
  // Most-recent-first, capped, unless --all.
  return files
    .map((f) => ({ f, mtime: safeMtime(f) }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 20)
    .map((x) => x.f);
}

function safeMtime(f) {
  try {
    return fs.statSync(f).mtimeMs;
  } catch (_) {
    return 0;
  }
}

function readUsageEntries(filePath, sinceMs) {
  const entries = [];
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return entries;
  }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_) {
      continue;
    }
    const msg = obj.message || obj;
    const usage = msg && msg.usage;
    if (!usage || typeof usage.output_tokens !== 'number') continue;

    const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
    if (sinceMs && !Number.isNaN(ts) && ts < sinceMs) continue;

    entries.push({
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheCreateTokens: usage.cache_creation_input_tokens || 0,
      model: msg.model || obj.model || null,
      ts: Number.isNaN(ts) ? null : ts,
    });
  }
  return entries;
}

function modeAtTime(history, ts) {
  if (!history.length || ts === null) return 'full';
  let mode = 'full';
  for (const entry of history) {
    const entryTs = Date.parse(entry.ts);
    if (Number.isNaN(entryTs)) continue;
    if (entryTs <= ts) mode = entry.mode;
    else break;
  }
  return mode;
}

function estimateSavings(entries, history) {
  let actualTokens = 0;
  let estimatedBaselineTokens = 0;
  let estimatedCost = 0;
  let estimatedCostSaved = 0;

  for (const entry of entries) {
    const mode = modeAtTime(history, entry.ts);
    const compression = COMPRESSION[mode] || 0;
    actualTokens += entry.outputTokens;

    // actual = baseline * (1 - compression)  =>  baseline = actual / (1 - compression)
    const baseline = compression < 1 ? entry.outputTokens / (1 - compression) : entry.outputTokens;
    estimatedBaselineTokens += baseline;

    const price = priceFor(entry.model);
    estimatedCost += entry.outputTokens * price;
    estimatedCostSaved += (baseline - entry.outputTokens) * price;
  }

  const tokensSaved = estimatedBaselineTokens - actualTokens;
  const savingsPct = estimatedBaselineTokens > 0 ? (tokensSaved / estimatedBaselineTokens) * 100 : 0;

  return {
    actualTokens: Math.round(actualTokens),
    estimatedBaselineTokens: Math.round(estimatedBaselineTokens),
    tokensSaved: Math.round(tokensSaved),
    savingsPct: Math.round(savingsPct * 10) / 10,
    estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    estimatedCostSaved: Math.round(estimatedCostSaved * 10000) / 10000,
    sampleCount: entries.length,
  };
}

function formatStats(stats, opts) {
  opts = opts || {};
  if (stats.sampleCount === 0) {
    return 'darkman-x stats: no assistant usage found yet.';
  }
  const lines = [
    'darkman-x stats (estimated, output tokens only):',
    `  output tokens used:      ${stats.actualTokens.toLocaleString()}`,
    `  estimated w/o darkman-x: ${stats.estimatedBaselineTokens.toLocaleString()}`,
    `  estimated tokens saved:  ${stats.tokensSaved.toLocaleString()} (${stats.savingsPct}%)`,
    `  estimated cost saved:    $${stats.estimatedCostSaved.toFixed(4)}`,
    `  sample size:             ${stats.sampleCount} assistant turns`,
  ];
  if (opts.share) {
    lines.push('', `Cut ~${stats.savingsPct}% of my output tokens with darkman-x. 🥋`);
  }
  return lines.join('\n');
}

function writeStatuslineSuffix(stats) {
  const suffix = stats.sampleCount > 0 ? ` (~${stats.savingsPct}% saved)` : '';
  config.safeWriteFlag(
    path.join(config.getConfigDir(), '.darkman-x-statusline-suffix'),
    suffix
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: darkman-x-stats.js [--session-file <path>] [--share] [--all] [--since <date>]\n'
    );
    return;
  }

  const sinceMs = args.since ? Date.parse(args.since) : null;
  const files = listTranscriptFiles(args);

  let allEntries = [];
  for (const f of files) {
    allEntries = allEntries.concat(readUsageEntries(f, sinceMs));
  }

  const history = config.readHistory(config.getConfigDir());
  const stats = estimateSavings(allEntries, history);

  writeStatuslineSuffix(stats);

  process.stdout.write(formatStats(stats, { share: args.share }) + '\n');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    if (process.env.DARKMANX_DEBUG === '1') {
      process.stderr.write('[darkman-x] darkman-x-stats fatal - ' + err.message + '\n');
    }
    process.stdout.write('darkman-x stats: unavailable.\n');
  }
}

module.exports = {
  COMPRESSION,
  priceFor,
  parseArgs,
  estimateSavings,
  formatStats,
  readUsageEntries,
  modeAtTime,
};
