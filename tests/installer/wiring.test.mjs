import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function listFiles(root, base = root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '__pycache__') continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(absolute, base));
    else out.push(path.relative(base, absolute));
  }
  return out.sort();
}

test('package omits removed Pi integration', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.pi, undefined);
  assert.equal(pkg.peerDependencies?.['@earendil-works/pi-coding-agent'], undefined);
  assert.ok(!pkg.keywords.includes('pi-package'));
  assert.ok(pkg.files.every((resource) => !resource.startsWith('.pi/')));
  assert.ok(!fs.existsSync(path.join(repoRoot, '.pi')));
  assert.ok(!pkg.files.includes('dist/darkman-x.skill'), 'ignored CI artifact must not be declared in fresh packages');

  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'sync-skill.yml'), 'utf8');
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /path: dist\/darkman-x\.skill/);
});

test('Claude plugin manifest declares its resources', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.equal(plugin.skills, './skills');
  assert.equal(plugin.commands, './commands');
  // agents is deliberately NOT declared: the schema rejects both a directory
  // string and an array of directories, and an array of .md files validates but
  // loads zero agents. Auto-discovery of ./agents is the only form that works.
  assert.equal(plugin.agents, undefined);
  assert.ok(fs.existsSync(path.join(repoRoot, 'agents')));

  const marketplace = readJson('.claude-plugin/marketplace.json');
  assert.equal(marketplace.plugins[0].source, './');
  assert.equal(marketplace.plugins[0].category, 'productivity');
});

test('plugin hooks resolve through CLAUDE_PLUGIN_ROOT, never a checkout path', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  const events = Object.keys(plugin.hooks);
  assert.deepEqual(events.sort(), ['SessionStart', 'UserPromptSubmit']);
  for (const event of events) {
    for (const group of plugin.hooks[event]) {
      for (const hook of group.hooks) {
        assert.equal(hook.type, 'command', event);
        assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}/, event);
        assert.doesNotMatch(hook.command, /\/Users\/|~\//, event);
        assert.ok(Number.isInteger(hook.timeout), event);
      }
    }
  }
});

test('declared plugin resources exist on disk', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  for (const declared of [plugin.skills, plugin.commands]) {
    assert.ok(fs.existsSync(path.join(repoRoot, declared)), `declared but missing: ${declared}`);
  }
  // Every Claude slash command needs its .toml twin (maintainer rule 4).
  const commands = fs.readdirSync(path.join(repoRoot, 'commands'));
  const markdown = commands.filter((f) => f.endsWith('.md'));
  assert.ok(markdown.length > 0);
  for (const command of markdown) {
    const toml = command.replace(/\.md$/, '.toml');
    assert.ok(commands.includes(toml), `missing ${toml} for ${command}`);
  }
  assert.ok(
    !fs.existsSync(path.join(repoRoot, 'plugins', 'darkman-x', 'commands')),
    'mirror must not ship a second copy of commands/',
  );
});

test('installer never fakes a Claude plugin install', () => {
  const installer = fs.readFileSync(path.join(repoRoot, 'bin', 'install.js'), 'utf8');
  const installClaude = installer.match(/function installClaude\([\s\S]*?\n}\n/);
  assert.ok(installClaude, 'installClaude not found');

  // The old stub wrote ~/.claude/plugins/darkman-x.json, a file Claude never
  // reads. uninstallClaude still deletes it to clean up pre-fix installs, so
  // this assertion is scoped to the install path only.
  assert.doesNotMatch(installClaude[0], /darkman-x\.json/);
  assert.doesNotMatch(installClaude[0], /installedAt/);

  // Plugin detection must read the registry Claude actually maintains.
  assert.match(installer, /installed_plugins\.json/);
  assert.match(installer, /plugin marketplace add KcAnom\/darkmanx/);
});

test('public install surfaces point at the real GitHub repository', () => {
  const files = [
    'README.md',
    'INSTALL.md',
    'install.sh',
    'install.ps1',
    'bin/install.js',
    'docs/index.html',
    'docs/install-windows.md',
  ];
  for (const file of files) {
    const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    assert.doesNotMatch(content, /OWNER\/darkman-x/, file);
  }
});

test('skills lock contains current source metadata and concrete hashes', () => {
  const lock = readJson('skills-lock.json');
  assert.equal(lock.version, 1);
  assert.equal(Object.keys(lock.skills).length, 7);
  for (const [name, entry] of Object.entries(lock.skills)) {
    assert.equal(entry.source, 'KcAnom/darkmanx', name);
    assert.equal(entry.sourceType, 'github', name);
    assert.match(entry.skillPath, new RegExp(`^skills/${name}/SKILL\\.md$`), name);
    assert.match(entry.computedHash, /^[a-f0-9]{64}$/, name);
  }
});

test('generated skill and agent mirrors match their canonical sources', () => {
  const skillNames = [
    'darkman-x',
    'darkman-x-commit',
    'darkman-x-compress',
    'darkman-x-help',
    'darkman-x-review',
    'darkman-x-stats',
    'xcrew',
  ];
  for (const name of skillNames) {
    const source = path.join(repoRoot, 'skills', name);
    const mirror = path.join(repoRoot, 'plugins', 'darkman-x', 'skills', name);
    assert.deepEqual(listFiles(mirror), listFiles(source), `${name} file list`);
    for (const relative of listFiles(source)) {
      assert.deepEqual(
        fs.readFileSync(path.join(mirror, relative)),
        fs.readFileSync(path.join(source, relative)),
        `${name}/${relative}`,
      );
    }
  }
  for (const name of ['xcrew-builder.md', 'xcrew-investigator.md', 'xcrew-reviewer.md']) {
    assert.deepEqual(
      fs.readFileSync(path.join(repoRoot, 'plugins', 'darkman-x', 'agents', name)),
      fs.readFileSync(path.join(repoRoot, 'agents', name)),
      name,
    );
  }
});

test('hook checksum manifest matches every listed hook', () => {
  const hooksDir = path.join(repoRoot, 'src', 'hooks');
  const lines = fs.readFileSync(path.join(hooksDir, 'checksums.sha256'), 'utf8').trim().split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `invalid checksum line: ${line}`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(hooksDir, match[2]))).digest('hex');
    assert.equal(actual, match[1], match[2]);
  }
});
