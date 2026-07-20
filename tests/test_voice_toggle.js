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
const speakPath = path.join(__dirname, '..', 'src', 'tools', 'darkman-x-speak.js');

function withTempClaudeDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmanx-voice-'));
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

test('config voice helpers default off and toggle on', () => {
  withTempClaudeDir((dir) => {
    const config = require(configPath);
    // clear module cache env influence
    delete process.env.DARKMANX_VOICE;
    assert.equal(config.isVoiceEnabled(dir), false);
    assert.equal(config.setVoiceEnabled(true, dir), true);
    assert.equal(config.isVoiceEnabled(dir), true);
    const flag = path.join(dir, config.VOICE_FLAG_BASENAME);
    assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'on');
    assert.equal(config.setVoiceEnabled(false, dir), true);
    assert.equal(config.isVoiceEnabled(dir), false);
    assert.equal(config.DEFAULT_VOICE_ID, '552fdfe0e4f542c1bb381d1006c1ac9b');
    assert.equal(config.DEFAULT_VOICE_MODEL, 's2.1-pro');
  });
});

test('mode-tracker /darkman-x voice on writes flag and exits 0', () => {
  withTempClaudeDir((dir) => {
    delete process.env.DARKMANX_VOICE;
    const result = spawnSync(process.execPath, [trackerPath], {
      input: JSON.stringify({ prompt: '/darkman-x voice on' }),
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    });
    assert.equal(result.status, 0);
    const flag = path.join(dir, '.darkman-x-voice');
    assert.ok(fs.existsSync(flag), 'voice flag should exist');
    assert.equal(fs.readFileSync(flag, 'utf8').trim(), 'on');
    assert.match(result.stdout, /voice/i);
  });
});

test('mode-tracker /darkman-x-voice off exits 0', () => {
  withTempClaudeDir((dir) => {
    fs.writeFileSync(path.join(dir, '.darkman-x-voice'), 'on');
    const result = spawnSync(process.execPath, [trackerPath], {
      input: JSON.stringify({ prompt: '/darkman-x-voice off' }),
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    });
    assert.equal(result.status, 0);
    assert.equal(fs.readFileSync(path.join(dir, '.darkman-x-voice'), 'utf8').trim(), 'off');
  });
});

test('speak --dry-run reports default model and voice', () => {
  const result = spawnSync(
    process.execPath,
    [speakPath, '--dry-run', '--no-play', 'Port taken. Server dead.'],
    { encoding: 'utf8', timeout: 5000, env: { ...process.env, FISH_API_KEY: 'test-key' } }
  );
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.model, 's2.1-pro');
  assert.equal(data.voice, '552fdfe0e4f542c1bb381d1006c1ac9b');
  assert.equal(data.apiKey, 'set');
  assert.match(data.textPreview, /Port taken/);
});

test('speak without key exits 2', () => {
  const env = { ...process.env };
  delete env.FISH_API_KEY;
  delete env.FISH_AUDIO_API_KEY;
  const result = spawnSync(
    process.execPath,
    [speakPath, '--no-play', 'hello'],
    { encoding: 'utf8', timeout: 5000, env }
  );
  assert.equal(result.status, 2);
});
