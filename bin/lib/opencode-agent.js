'use strict';

// OpenCode's agent frontmatter schema wants `tools` omitted or as an
// object, not a YAML array — strip it rather than pull in a YAML parser
// dependency for one field.
function stripOpencodeAgentTools(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return content;

  const frontmatter = match[1];
  const lines = frontmatter.split('\n');
  const out = [];
  let skipping = false;

  for (const line of lines) {
    if (skipping) {
      if (/^\s+-\s/.test(line) || /^\s*$/.test(line)) {
        if (/^\s+-\s/.test(line)) continue;
      } else {
        skipping = false;
      }
      if (skipping) continue;
    }
    if (/^tools:\s*$/.test(line)) {
      skipping = true;
      continue;
    }
    if (/^tools:\s*\[.*\]\s*$/.test(line)) {
      continue;
    }
    out.push(line);
  }

  const newFrontmatter = out.join('\n');
  return content.slice(0, match.index) +
    '---\n' + newFrontmatter + '\n---' +
    content.slice(match.index + match[0].length);
}

module.exports = { stripOpencodeAgentTools };
