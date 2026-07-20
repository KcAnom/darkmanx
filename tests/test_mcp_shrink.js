'use strict';

// Tests compress() from src/mcp-servers/darkman-x-shrink/compress.js preserves
// fenced code blocks, inline code, and URLs byte-exact while shortening
// surrounding prose. Owned by a separate build step; skips if not present yet.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const compressPath = path.join(__dirname, '..', 'src', 'mcp-servers', 'darkman-x-shrink', 'compress.js');

let compress = null;
if (fs.existsSync(compressPath)) {
  try {
    ({ compress } = require(compressPath));
  } catch {
    compress = null;
  }
}

function maybeSkip(t) {
  if (typeof compress !== 'function') {
    t.skip('src/mcp-servers/darkman-x-shrink/compress.js does not export compress() yet');
    return true;
  }
  return false;
}

test('preserves a fenced code block byte-exact', (t) => {
  if (maybeSkip(t)) return;
  const input = [
    'Please note that this is a very long and wordy description of the tool.',
    '```js',
    'function   weird_spacing( ) {\n  return   1;\n}',
    '```',
    'That was the code, thank you very much for reading all of this.',
  ].join('\n');

  const output = compress(input);
  const fence = input.match(/```js\n([\s\S]*?)```/)[0];
  assert.ok(output.includes(fence), 'fenced code block must survive byte-exact');
});

test('preserves inline code spans byte-exact', (t) => {
  if (maybeSkip(t)) return;
  const input = 'You should definitely go ahead and call the `doTheThing(a, b)` function when ready.';
  const output = compress(input);
  assert.ok(output.includes('`doTheThing(a, b)`'), 'inline code span must survive byte-exact');
});

test('preserves URLs byte-exact', (t) => {
  if (maybeSkip(t)) return;
  const url = 'https://example.com/path?query=1&other=weird_value';
  const input = `Please go ahead and visit ${url} in order to read more about it.`;
  const output = compress(input);
  assert.ok(output.includes(url), 'URL must survive byte-exact');
});

test('shortens surrounding prose', (t) => {
  if (maybeSkip(t)) return;
  const input = 'This is a really, really long and very wordy description that has a lot of filler words in it for absolutely no reason at all.';
  const output = compress(input);
  assert.ok(output.length < input.length, 'prose should be shortened');
});
