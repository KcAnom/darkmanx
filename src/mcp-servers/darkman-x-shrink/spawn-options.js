'use strict';

/**
 * Spawn options for launching the upstream MCP server as a child process.
 * Windows needs shell:true to resolve .cmd/.bat shims (e.g. npx.cmd);
 * everywhere else runs the binary directly, no shell.
 */
function getSpawnOptions() {
  if (process.platform === 'win32') {
    return { shell: true, stdio: ['pipe', 'pipe', 'inherit'] };
  }
  return { shell: false, stdio: ['pipe', 'pipe', 'inherit'] };
}

module.exports = { getSpawnOptions };
