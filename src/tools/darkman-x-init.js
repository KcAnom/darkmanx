#!/usr/bin/env node
'use strict';

// Standalone per-repo IDE-rules installer. Must run both as a normal file
// (`node darkman-x-init.js`) and piped via stdin (`curl ... | node`), where
// `require.main` is undefined and `module.id` is `[stdin]` instead.

const fs = require('fs');
const path = require('path');

const SENTINEL = 'Respond terse like Darkman X — short, hard, exact';

const RULE_BODY = [
  SENTINEL + '.',
  '',
  '- Drop articles, filler, pleasantries, and hedging. Fragments are fine.',
  '- No invented abbreviations. No fake causal arrows used just to look compressed.',
  '- Preserve technical terms, code, commands, and error text byte-exact.',
  '- Preserve the user\'s own language and terminology.',
  '- Delivery pattern: [thing] [action] [reason]. [next step].',
  '',
  'Auto-clarity — write normally for: security warnings, irreversible-action',
  'confirmations, ambiguous multi-step requests, or visible user confusion.',
  '',
  'Boundaries — always write normally: code, commit messages, PR descriptions.',
].join('\n');

function parseArgs(argv) {
  const args = { dryRun: false, force: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--only') args.only = argv[++i];
  }
  return args;
}

function hasSentinel(content) {
  return content.includes(SENTINEL);
}

function replaceOrAppendSection(content, section) {
  if (hasSentinel(content)) {
    // Best-effort: replace the darkman-x-begin/end fenced block if present,
    // else append a fresh block (old unmarked content is left alone).
    const fenced = content.replace(
      /<!-- darkman-x-begin -->[\s\S]*?<!-- darkman-x-end -->/,
      section
    );
    if (fenced !== content) return fenced;
  }
  const sep = content.length && !content.endsWith('\n') ? '\n\n' : (content.length ? '\n' : '');
  return content + sep + section + '\n';
}

function fencedSection() {
  return '<!-- darkman-x-begin -->\n' + RULE_BODY + '\n<!-- darkman-x-end -->';
}

function writeIfChanged(filePath, nextContent, args, log) {
  const exists = fs.existsSync(filePath);
  const current = exists ? fs.readFileSync(filePath, 'utf8') : '';
  if (exists && hasSentinel(current) && !args.force) {
    log('skip (already installed): ' + filePath);
    return;
  }
  if (args.dryRun) {
    log((exists ? 'would update: ' : 'would create: ') + filePath);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextContent);
  log((exists ? 'updated: ' : 'created: ') + filePath);
}

const TARGETS = {
  cursor: {
    label: 'Cursor',
    apply(cwd, args, log) {
      const file = path.join(cwd, '.cursor', 'rules', 'darkman-x.mdc');
      const body = '---\ndescription: darkman-x terse mode\nalwaysApply: true\n---\n\n' + fencedSection() + '\n';
      writeIfChanged(file, body, args, log);
    },
  },
  windsurf: {
    label: 'Windsurf',
    apply(cwd, args, log) {
      const file = path.join(cwd, '.windsurfrules');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      writeIfChanged(file, replaceOrAppendSection(current, fencedSection()), args, log);
    },
  },
  cline: {
    label: 'Cline',
    apply(cwd, args, log) {
      const file = path.join(cwd, '.clinerules');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      writeIfChanged(file, replaceOrAppendSection(current, fencedSection()), args, log);
    },
  },
  copilot: {
    label: 'GitHub Copilot',
    apply(cwd, args, log) {
      const file = path.join(cwd, '.github', 'copilot-instructions.md');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      writeIfChanged(file, replaceOrAppendSection(current, fencedSection()), args, log);
    },
  },
  opencode: {
    label: 'OpenCode',
    apply(cwd, args, log) {
      const file = path.join(cwd, 'AGENTS.md');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      writeIfChanged(file, replaceOrAppendSection(current, fencedSection()), args, log);
    },
  },
  agents: {
    label: 'root AGENTS.md',
    apply(cwd, args, log) {
      const file = path.join(cwd, 'AGENTS.md');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      writeIfChanged(file, replaceOrAppendSection(current, fencedSection()), args, log);
    },
  },
  openclaw: {
    label: 'OpenClaw',
    apply(cwd, args, log) {
      // Minimal inline logic (duplicated from bin/lib/openclaw.js) so this
      // file stays runnable standalone via curl | node.
      const workspace = process.env.OPENCLAW_WORKSPACE ||
        path.join(require('os').homedir(), '.openclaw', 'workspace');
      const soulFile = path.join(workspace, 'SOUL.md');
      if (!fs.existsSync(workspace)) {
        log('skip (no OpenClaw workspace found at ' + workspace + ')');
        return;
      }
      const current = fs.existsSync(soulFile) ? fs.readFileSync(soulFile, 'utf8') : '';
      writeIfChanged(soulFile, replaceOrAppendSection(current, fencedSection()), args, log);
    },
  },
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const log = (msg) => process.stdout.write(msg + '\n');

  const targetKeys = args.only ? [args.only] : Object.keys(TARGETS);

  for (const key of targetKeys) {
    const target = TARGETS[key];
    if (!target) {
      log('unknown target: ' + key);
      continue;
    }
    try {
      target.apply(cwd, args, log);
    } catch (err) {
      log('failed (' + target.label + '): ' + err.message);
    }
  }
}

const isDirectRun = (typeof require !== 'undefined' && require.main === module) ||
  (typeof module !== 'undefined' && module.id === '[stdin]');

if (isDirectRun) {
  main();
}

module.exports = { RULE_BODY, SENTINEL, TARGETS, main };
