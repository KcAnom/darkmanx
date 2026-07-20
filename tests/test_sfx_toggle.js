'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hooksDir = path.join(__dirname, '..', 'src', 'hooks');
const configPath = path.join(hooksDir, 'darkman-x-config.js');
const trackerPath = path.join(hooksDir, 'darkman-x-mode-tracker.js');

function withTempClaudeDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmanx-sfx-'));
  const prev = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    return fn(dir);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runTracker(dir, prompt) {
  return spawnSync(process.execPath, [trackerPath], {
    input: JSON.stringify({ prompt }),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
  });
}

test('config sfx helpers default off and toggle on', () => {
  withTempClaudeDir((dir) => {
    const config = require(configPath);
    delete process.env.DARKMANX_SFX;
    assert.equal(config.isSfxEnabled(dir), false);
    assert.equal(config.setSfxEnabled(true, dir), true);
    assert.equal(config.isSfxEnabled(dir), true);
    const flag = path.join(dir, config.SFX_FLAG_BASENAME);
    assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'on');
    assert.equal(config.setSfxEnabled(false, dir), true);
    assert.equal(config.isSfxEnabled(dir), false);
  });
});

test('mode-tracker /darkman-x sfx on writes flag and exits 0', () => {
  withTempClaudeDir((dir) => {
    delete process.env.DARKMANX_SFX;
    const result = runTracker(dir, '/darkman-x sfx on');
    assert.equal(result.status, 0);
    const flag = path.join(dir, '.darkman-x-sfx');
    assert.ok(fs.existsSync(flag), 'sfx flag should exist');
    assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'on');
    assert.match(result.stdout, /sfx ON/);
  });
});

test('mode-tracker /darkman-x-sfx off exits 0', () => {
  withTempClaudeDir((dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.darkman-x-sfx'), 'on');
    const result = runTracker(dir, '/darkman-x-sfx off');
    assert.equal(result.status, 0);
    assert.equal(fs.readFileSync(path.join(dir, '.darkman-x-sfx'), 'utf8').trim(), 'off');
    assert.match(result.stdout, /sfx OFF/);
  });
});

test('/darkman-x-status includes sfx= field', () => {
  withTempClaudeDir((dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.darkman-x-sfx'), 'on');
    const result = runTracker(dir, '/darkman-x-status');
    assert.equal(result.status, 0);
    const decision = JSON.parse(result.stdout);
    assert.match(decision.reason, /\bsfx=ON\b/);
  });
});
