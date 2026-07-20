'use strict';

// Tests that src/hooks/darkman-x-mode-tracker.js (UserPromptSubmit hook) always
// exits 0, even on malformed stdin — a hook that exits non-zero can block the
// session. Owned by a separate build step; skips if not present yet.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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

// The tracker writes mode/voice flags under $CLAUDE_CONFIG_DIR. Without an
// explicit override here, the child inherits the real value from this
// process's env and every "run the hook" test clobbers the actual live
// session state (mode/voice flags under ~/.claude) as a side effect.
function runWithStdin(input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmanx-tracker-'));
  try {
    return spawnSync(process.execPath, [trackerPath], {
      input,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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

test('/darkman-x ultra (prose mode) blocks with a confirmation', (t) => {
  if (maybeSkip(t)) return;
  const result = runWithStdin(JSON.stringify({ prompt: '/darkman-x ultra' }));
  assert.equal(result.status, 0);
  const decision = JSON.parse(result.stdout);
  assert.equal(decision.decision, 'block');
  assert.match(decision.reason, /darkman-x ultra/);
});

// Regression: commit/review/compress are one-shot actions, not pure mode
// switches. Blocking here (like prose-mode switches correctly do) would set
// the flag and then hand back a bare confirmation instead of letting the
// prompt reach the model to actually run the review/commit/compress skill.
for (const mode of ['review', 'commit', 'compress']) {
  test(`/darkman-x-${mode} passes the prompt through unblocked`, (t) => {
    if (maybeSkip(t)) return;
    const result = runWithStdin(JSON.stringify({ prompt: `/darkman-x-${mode}` }));
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '', `expected no block output, got: ${result.stdout}`);
  });
}
