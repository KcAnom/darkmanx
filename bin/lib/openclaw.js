'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SENTINEL = 'Respond terse like Darkman X — short, hard, exact';

function workspaceDir() {
  return process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace');
}

function bootstrapSection(repoRoot) {
  const bootstrapPath = path.join(repoRoot, 'src', 'rules', 'darkman-x-openclaw-bootstrap.md');
  if (fs.existsSync(bootstrapPath)) {
    return fs.readFileSync(bootstrapPath, 'utf8').trim();
  }
  return [
    '<!-- darkman-x-begin -->',
    '## darkman-x',
    '',
    SENTINEL + '.',
    '<!-- darkman-x-end -->',
  ].join('\n');
}

function mergeSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return '---\nversion: 1\nalways: true\n---\n\n' + content;
  }
  let frontmatter = match[1];
  if (!/^version:/m.test(frontmatter)) frontmatter += '\nversion: 1';
  if (/^always:/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(/^always:.*$/m, 'always: true');
  } else {
    frontmatter += '\nalways: true';
  }
  return content.slice(0, match.index) +
    '---\n' + frontmatter + '\n---' +
    content.slice(match.index + match[0].length);
}

function install(repoRoot) {
  const workspace = workspaceDir();
  const skillSrc = path.join(repoRoot, 'skills', 'darkman-x', 'SKILL.md');
  const skillDestDir = path.join(workspace, 'skills', 'darkman-x');
  const soulFile = path.join(workspace, 'SOUL.md');

  fs.mkdirSync(skillDestDir, { recursive: true });

  if (fs.existsSync(skillSrc)) {
    const raw = fs.readFileSync(skillSrc, 'utf8');
    fs.writeFileSync(path.join(skillDestDir, 'SKILL.md'), mergeSkillFrontmatter(raw));
  }

  const section = bootstrapSection(repoRoot);
  const currentSoul = fs.existsSync(soulFile) ? fs.readFileSync(soulFile, 'utf8') : '';
  let nextSoul;
  if (currentSoul.includes('<!-- darkman-x-begin -->')) {
    nextSoul = currentSoul.replace(
      /<!-- darkman-x-begin -->[\s\S]*?<!-- darkman-x-end -->/,
      section
    );
  } else {
    const sep = currentSoul.length && !currentSoul.endsWith('\n') ? '\n\n' : (currentSoul.length ? '\n' : '');
    nextSoul = currentSoul + sep + section + '\n';
  }
  fs.mkdirSync(path.dirname(soulFile), { recursive: true });
  fs.writeFileSync(soulFile, nextSoul);

  return { workspace, skillDestDir, soulFile };
}

function uninstall() {
  const workspace = workspaceDir();
  const skillDestDir = path.join(workspace, 'skills', 'darkman-x');
  const soulFile = path.join(workspace, 'SOUL.md');

  if (fs.existsSync(skillDestDir)) {
    fs.rmSync(skillDestDir, { recursive: true, force: true });
  }

  if (fs.existsSync(soulFile)) {
    const current = fs.readFileSync(soulFile, 'utf8');
    // Strip exactly the marked block, paired begin/end, leave everything
    // else untouched.
    const stripped = current.replace(
      /\n?<!-- darkman-x-begin -->[\s\S]*?<!-- darkman-x-end -->\n?/,
      '\n'
    );
    fs.writeFileSync(soulFile, stripped);
  }

  return { workspace, skillDestDir, soulFile };
}

function isInstalled() {
  const soulFile = path.join(workspaceDir(), 'SOUL.md');
  if (!fs.existsSync(soulFile)) return false;
  return fs.readFileSync(soulFile, 'utf8').includes(SENTINEL);
}

module.exports = {
  SENTINEL,
  workspaceDir,
  install,
  uninstall,
  isInstalled,
};
