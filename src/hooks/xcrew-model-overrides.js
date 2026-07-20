'use strict';

// Best-effort patcher: rewrites the `model:` frontmatter field of the xcrew
// subagents based on env vars, so any agent can be pinned to any model id —
// Claude Code's own (haiku/sonnet/opus/full ids) or any other framework's.
// Never throws; missing env var or missing file is a silent no-op.

const fs = require('fs');
const path = require('path');

const AGENT_ENV_MAP = {
  'xcrew-investigator.md': 'XCREW_INVESTIGATOR_MODEL',
  'xcrew-builder.md': 'XCREW_BUILDER_MODEL',
  'xcrew-reviewer.md': 'XCREW_REVIEWER_MODEL',
};

function debugLog(...args) {
  if (process.env.DARKMANX_DEBUG === '1') {
    try {
      process.stderr.write('[darkman-x] ' + args.join(' ') + '\n');
    } catch (_) {
      // stderr unavailable
    }
  }
}

function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch (_) {
    return false;
  }
}

function candidateAgentDirs() {
  const dirs = [];
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    dirs.push(path.join(pluginRoot, 'agents'));
    dirs.push(path.join(pluginRoot, 'plugins', 'darkman-x', 'agents'));
  }
  dirs.push(path.join(__dirname, '..', '..', 'agents'));
  dirs.push(path.join(__dirname, '..', '..', 'plugins', 'darkman-x', 'agents'));

  const seen = new Set();
  return dirs.filter((d) => {
    const resolved = path.resolve(d);
    if (seen.has(resolved)) return false;
    seen.add(resolved);
    return fs.existsSync(resolved);
  });
}

function patchFrontmatterModel(content, modelValue) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const modelLine = 'model: ' + modelValue;
  let newFrontmatter;

  if (/^model:.*$/m.test(frontmatter)) {
    newFrontmatter = frontmatter.replace(/^model:.*$/m, modelLine);
  } else {
    newFrontmatter = frontmatter + '\n' + modelLine;
  }

  if (newFrontmatter === frontmatter) return content;

  return content.slice(0, match.index) +
    '---\n' + newFrontmatter + '\n---' +
    content.slice(match.index + match[0].length);
}

function patchOneFile(filePath, modelValue) {
  try {
    if (isSymlink(filePath)) {
      debugLog('refusing symlinked agent file', filePath);
      return false;
    }
    if (!fs.existsSync(filePath)) return false;

    const original = fs.readFileSync(filePath, 'utf8');
    const patched = patchFrontmatterModel(original, modelValue);
    if (patched === null || patched === original) return false;

    fs.writeFileSync(filePath, patched, { mode: 0o600 });
    debugLog('patched model override', filePath, '->', modelValue);
    return true;
  } catch (err) {
    debugLog('patchOneFile failed for', filePath, '-', err.message);
    return false;
  }
}

function applyOverrides() {
  const results = [];
  try {
    const dirs = candidateAgentDirs();
    for (const filename of Object.keys(AGENT_ENV_MAP)) {
      const envVar = AGENT_ENV_MAP[filename];
      const modelValue = process.env[envVar];
      if (!modelValue) continue;
      for (const dir of dirs) {
        const filePath = path.join(dir, filename);
        if (patchOneFile(filePath, modelValue)) {
          results.push({ file: filePath, model: modelValue });
        }
      }
    }
  } catch (err) {
    debugLog('applyOverrides failed -', err.message);
  }
  return results;
}

module.exports = {
  AGENT_ENV_MAP,
  applyOverrides,
  patchFrontmatterModel,
};
