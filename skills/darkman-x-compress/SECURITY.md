# Security notes — darkman-x-compress

- **Refuses sensitive files.** Any path or basename containing markers like `secret`, `credential`, `.env`, `id_rsa`, `.pem`, `.key` is rejected before any read/write happens.
- **Backups are out-of-tree.** Originals are copied to `$XDG_DATA_HOME/darkman-x-compress/backups` (or `%LOCALAPPDATA%\darkman-x-compress\backups` on Windows) — never inside the project directory, so a backup can't accidentally get committed or glob-matched by other tooling.
- **Validate-or-revert.** The rewrite is only kept if `validate.py` confirms code fences, URLs, paths, and structure are unchanged. Up to 2 retry-fixes are attempted; if validation still fails, the original file is restored from the out-of-tree backup and the rewrite is discarded.
- **No API keys, no direct network calls.** The rewrite is delegated to a locally-installed, already-authenticated CLI (`claude`, `codex`, `grok`, or `pi` — see `agent_cli.py`) spawned as a subprocess. Whatever network access that CLI's own subscription login uses is between it and its provider; this script never holds or transmits an API key itself.
- **Frontmatter is preserved as-is.** YAML frontmatter is stripped before rewrite and restored unchanged after — it is never sent through the compression rewrite.
