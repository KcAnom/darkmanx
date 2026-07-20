---
name: darkman-x-compress
description: Rewrite a natural-language memory/doc file into darkman-x style, byte-exact on code/URLs/paths, with an out-of-tree backup and automatic revert on failure. Triggered by /darkman-x-compress <file>.
---

# darkman-x-compress

Independent one-shot mode. Compresses **style**, never **substance** or **language**.

## Usage

From this skill's directory:

```bash
python3 -m scripts <absolute-path-to-file>
```

## What it guarantees

- Backs up the original file, out-of-tree, before touching it.
- Only rewrites files `detect.py` classifies as natural-language (markdown/text/docs) — never code, config, or lockfiles.
- Preserves exactly: fenced code blocks, inline code spans, URLs, file paths, heading structure, bullet structure.
- Validates the rewrite against the original (`validate.py`) before accepting it. Up to 2 automatic retry-fixes. If validation still fails, the original file is restored untouched.
- Refuses to run on sensitive files (paths/basenames suggesting secrets, credentials, `.env`, private keys) — see [`SECURITY.md`](./SECURITY.md).

## What it does NOT do

- Does not compress code comments or docstrings inside source files.
- Does not translate or change the file's language — only its verbosity.
- Does not run automatically — always an explicit, one-shot invocation.
