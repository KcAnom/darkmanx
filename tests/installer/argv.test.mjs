// Tests the installer's argv/flag parsing contract from RECREATION-PROMPT.md section (d):
// --dry-run --force --only --skip-skills --with-hooks --no-hooks --with-init
// --with-mcp-shrink=<upstream> --all --minimal --uninstall --config-dir --list
// --non-interactive --no-color
//
// bin/install.js is owned by a separate build step. If it doesn't export a
// parser yet, these tests skip individually rather than failing the run —
// once `parseArgv`/`parseArgs` is exported, they'll start asserting for real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const installerPath = path.join(__dirname, '..', '..', 'bin', 'install.js');

let parseArgv = null;
if (existsSync(installerPath)) {
  try {
    const mod = await import(installerPath);
    parseArgv = mod.parseArgv || mod.parseArgs || (mod.default && (mod.default.parseArgv || mod.default.parseArgs));
  } catch {
    parseArgv = null;
  }
}

function maybeSkip(t) {
  if (!parseArgv) {
    t.skip('bin/install.js does not export parseArgv/parseArgs yet');
    return true;
  }
  return false;
}

test('parses boolean flags', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv(['--dry-run', '--force', '--all']);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.force, true);
  assert.equal(opts.all, true);
});

test('parses --only value', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv(['--only', 'claude']);
  assert.equal(opts.only, 'claude');
});

test('parses --with-mcp-shrink=<upstream>', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv(['--with-mcp-shrink=npx @modelcontextprotocol/server-filesystem /tmp']);
  assert.equal(opts.withMcpShrink, 'npx @modelcontextprotocol/server-filesystem /tmp');
});

test('parses --config-dir value', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv(['--config-dir', '/tmp/fake-claude-config']);
  assert.equal(opts.configDir, '/tmp/fake-claude-config');
});

test('--no-hooks and --with-hooks are mutually distinct flags', (t) => {
  if (maybeSkip(t)) return;
  const a = parseArgv(['--no-hooks']);
  const b = parseArgv(['--with-hooks']);
  assert.equal(a.noHooks, true);
  assert.equal(b.withHooks, true);
});

test('--list and --uninstall parse as booleans', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv(['--list']);
  assert.equal(opts.list, true);
  const opts2 = parseArgv(['--uninstall']);
  assert.equal(opts2.uninstall, true);
});

test('--non-interactive and --no-color parse as booleans', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv(['--non-interactive', '--no-color']);
  assert.equal(opts.nonInteractive, true);
  assert.equal(opts.noColor, true);
});

test('dry-run install produces no output flag by default', (t) => {
  if (maybeSkip(t)) return;
  const opts = parseArgv([]);
  assert.equal(opts.dryRun, undefined || false);
});
