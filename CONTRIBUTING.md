# Contributing

## Dev setup

```bash
git clone <repo>
cd darkman-x
npm test
# optional: python3 -m pytest tests/test_detect.py tests/test_validate_inline.py
```

No npm dependencies are required to run or test the core installer/hooks — they're pure Node stdlib by design. Python 3 is only needed for `darkman-x-compress` and its tests.

## Where the source of truth lives

Edit these — never the mirrors:
- `skills/*/SKILL.md`, `skills/*/README.md` — the LLM-facing skill bodies. This is the product.
- `agents/*.md` — xcrew subagent definitions.
- `src/rules/*.md` — standalone-install rule bodies (used by `src/tools/darkman-x-init.js`).
- `bin/install.js`, `bin/lib/*.js` — the installer.
- `src/hooks/*.js` — Claude Code hooks.

`plugins/darkman-x/` is a **CI-generated mirror** (see `.github/workflows/sync-skill.yml`). Never hand-edit it — your changes will be overwritten on the next sync. Edit the source of truth above instead.

## Pull requests

- Keep dual command formats (`commands/*.md` + `commands/*.toml`) content-aligned — they must describe the same behavior.
- Hooks must silent-fail. A hook that throws or blocks session start is a bug, full stop.
- No invented agents outside the `PROVIDERS` matrix pattern in `bin/install.js`.
- No fabricated benchmark numbers — see `docs/HONEST-NUMBERS.md`.
- Run `npm test` before opening a PR.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`.
