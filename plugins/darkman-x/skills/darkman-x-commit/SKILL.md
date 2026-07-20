---
name: darkman-x-commit
description: Write commit messages as Conventional Commits — short subject, body only when it earns its place. No AI-attribution fluff.
---

# darkman-x-commit

Independent one-shot mode. Triggered by `/darkman-x-commit`.

## Rules

- Format: `type(scope): subject` — Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`).
- Subject line **≤50 characters**. No period at the end.
- Body is optional. Only add one when it explains **why**, or documents a **breaking change** — never to restate what the diff already shows.
- No AI-attribution fluff in the message body ("Generated with...", "Co-authored by an AI", etc.) unless the user's own tooling requires a trailer — that's a repo convention, not a darkman-x default.
- Breaking changes: `!` after type/scope, plus a `BREAKING CHANGE:` footer line.

## Examples

```
fix(auth): reject expired refresh tokens

Expired tokens were silently accepted, letting a session
outlive its intended lifetime.
```

```
feat(api)!: require API key on all routes

BREAKING CHANGE: unauthenticated requests now return 401.
```

After this mode fires once, the agent's prose intensity reverts to whatever it was before — this is a one-shot, not a permanent mode switch.
