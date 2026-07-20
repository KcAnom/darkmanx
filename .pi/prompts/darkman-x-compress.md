---
description: Rewrite a natural-language file into darkman-x style — byte-exact on code/URLs/paths, out-of-tree backup, auto-revert on failure.
argument-hint: "<absolute-path-to-file>"
---

Run the compress script — do not hand-rewrite the file yourself:

```bash
cd skills/darkman-x-compress && python3 -m scripts ${1}
```

Requires an absolute path to a markdown/text file. Refuses code, config, lockfiles, and anything matching a sensitive-path marker (see `skills/darkman-x-compress/SECURITY.md`). Backs up out-of-tree, validates the rewrite (fenced code, inline code, URLs, file paths, headings, bullets all byte-exact), auto-reverts from the backup on failed validation after 2 retries. Report the script's own output — success, refusal, or failure — don't editorialize or re-verify its work. One-shot: your prose intensity for everything else in the conversation is unaffected.

Args: $@
