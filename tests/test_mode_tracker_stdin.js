'use strict';

// Tests that src/hooks/darkman-x-mode-tracker.js (UserPromptSubmit hook) always
// exits 0, even on malformed stdin — a hook that exits non-zero can block the
// session. Owned by a separate build step; skips if not present yet.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const trackerPath = path.join(__dirname, '..', 'src', 'hooks', 'darkman-x-mode-tracker.js');

function maybeSkip(t) {
  if (!fs.existsSync(trackerPath)) {
    t.skip('src/hooks/darkman-x-mode-tracker.js does not exist yet');
    return true;
  }
  return false;
}

function runWithStdin(input) {
  return spawnSync(process.execPath, [trackerPath], {
    input,
    encoding: 'utf8',
    timeout: 5000,
  });
}

test('exits 0 with a well-formed prompt', (t) => {
  if (maybeSkip(t)) return;
  const result = runWithStdin(JSON.stringify({ prompt: 'hello there' }));
  assert.equal(result.status, 0);
});

test('exits 0 with malformed JSON on stdin', (t) => {
  if (maybeSkip(t)) return;
  const result = runWithStdin('{not valid json');
  assert.equal(result.status, 0);
});

test('exits 0 with empty stdin', (t) => {
  if (maybeSkip(t)) return;
  const result = runWithStdin('');
  assert.equal(result.status, 0);
});

test('exits 0 on a /darkman-x mode command', (t) => {
  if (maybeSkip(t)) return;
  const result = runWithStdin(JSON.stringify({ prompt: '/darkman-x ultra' }));
  assert.equal(result.status, 0);
});

test('exits 0 on a deactivation phrase', (t) => {
  if (maybeSkip(t)) return;
  const result = runWithStdin(JSON.stringify({ prompt: 'stop darkman-x' }));
  assert.equal(result.status, 0);
});
