#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const { getSpawnOptions } = require('./spawn-options');
const { compressDescriptionsInPlace } = require('./compress');

function usage() {
  process.stderr.write(
    'Usage: darkman-x-shrink <upstream-command> [...upstream-args]\n' +
      'Example: darkman-x-shrink npx @modelcontextprotocol/server-filesystem /tmp\n'
  );
}

function debugLog(...args) {
  if (process.env.DARKMANX_SHRINK_DEBUG === '1') {
    try {
      console.error('[darkman-x-shrink]', ...args);
    } catch {
      /* stderr unavailable */
    }
  }
}

function hasCompressibleFields(parsed) {
  const result = parsed && parsed.result;
  if (!result || typeof result !== 'object') return false;
  return (
    Array.isArray(result.tools) ||
    Array.isArray(result.prompts) ||
    Array.isArray(result.resources) ||
    Array.isArray(result.resourceTemplates)
  );
}

function main() {
  const [upstreamCommand, ...upstreamArgs] = process.argv.slice(2);
  if (!upstreamCommand) {
    usage();
    process.exit(1);
    return;
  }

  const child = spawn(upstreamCommand, upstreamArgs, getSpawnOptions());

  process.stdin.pipe(child.stdin);

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      handleLine(line);
    }
  });

  child.stdout.on('end', () => {
    if (buffer.length > 0) {
      handleLine(buffer);
      buffer = '';
    }
  });

  function handleLine(line) {
    if (line.trim().length === 0) {
      process.stdout.write(line + '\n');
      return;
    }
    try {
      const parsed = JSON.parse(line);
      if (!hasCompressibleFields(parsed)) {
        process.stdout.write(line + '\n');
        return;
      }
      const before = line.length;
      compressDescriptionsInPlace(parsed);
      const rewritten = JSON.stringify(parsed);
      debugLog(`compressed ${before} -> ${rewritten.length} bytes`);
      process.stdout.write(rewritten + '\n');
    } catch {
      process.stdout.write(line + '\n');
    }
  }

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code === null ? 0 : code);
  });

  child.on('error', (err) => {
    process.stderr.write(`darkman-x-shrink: failed to spawn upstream: ${err.message}\n`);
    process.exit(1);
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      child.kill(sig);
    });
  }
}

main();
