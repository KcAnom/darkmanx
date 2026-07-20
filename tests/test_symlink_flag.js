'use strict';

// Tests the symlink-clobber defense documented in RECREATION-PROMPT.md for
// safeWriteFlag(path, content) in src/hooks/darkman-x-config.js:
//   - never write if the flag path itself is a symlink
//   - refuse when the parent dir is a symlink resolving outside $HOME
// src/hooks/darkman-x-config.js is owned by a separate build step; if it
// doesn't exist yet, these tests skip individually.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const configPath = path.join(__dirname, '..', 'src', 'hooks', 'darkman-x-config.js');

let safeWriteFlag = null;
if (fs.existsSync(configPath)) {
  try {
    ({ safeWriteFlag } = require(configPath));
  } catch {
    safeWriteFlag = null;
  }
}

function maybeSkip(t) {
  if (typeof safeWriteFlag !== 'function') {
    t.skip('src/hooks/darkman-x-config.js does not export safeWriteFlag yet');
    return true;
  }
  return false;
}

function mkScratchDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('refuses to write when the flag path itself is a symlink', (t) => {
  if (maybeSkip(t)) return;

  const dir = mkScratchDir('darkmanx-symlink-target-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const realFile = path.join(dir, 'real-secret.txt');
  fs.writeFileSync(realFile, 'untouched');

  const flagPath = path.join(dir, 'flag-symlink');
  fs.symlinkSync(realFile, flagPath);

  const result = safeWriteFlag(flagPath, 'attacker-controlled-content');

  assert.equal(result, false, 'safeWriteFlag must refuse writing through a symlinked flag path');
  assert.equal(
    fs.readFileSync(realFile, 'utf8'),
    'untouched',
    'the real file behind the symlink must not be clobbered'
  );
});

test('refuses to write when the parent directory is a symlink resolving outside $HOME', (t) => {
  if (maybeSkip(t)) return;

  const realDir = mkScratchDir('darkmanx-real-parent-');
  t.after(() => fs.rmSync(realDir, { recursive: true, force: true }));

  const symlinkParent = path.join(os.tmpdir(), `darkmanx-parent-link-${process.pid}-${Date.now()}`);
  fs.symlinkSync(realDir, symlinkParent, 'dir');
  t.after(() => {
    try {
      fs.unlinkSync(symlinkParent);
    } catch {
      /* already gone */
    }
  });

  const flagPath = path.join(symlinkParent, 'some-flag');
  const result = safeWriteFlag(flagPath, 'should-not-land');

  assert.equal(result, false, 'safeWriteFlag must refuse writing through a symlinked parent dir outside $HOME');
  assert.equal(
    fs.existsSync(path.join(realDir, 'some-flag')),
    false,
    'no file should have been written into the real target directory'
  );
});
