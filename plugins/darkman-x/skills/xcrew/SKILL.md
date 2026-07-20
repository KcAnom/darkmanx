---
name: xcrew
description: When and how to spawn the xcrew subagents (investigator, builder, reviewer) — output contracts, chaining pattern, and how to point each one at any model you've configured.
---

# xcrew

Three read-heavy, single-purpose subagents. Spawn the smallest one that answers the question.

## When to spawn which

- **xcrew-investigator** — locate before touching anything. Read-only: defs, refs, call sites. Spawn first whenever the target isn't already pinned down.
- **xcrew-builder** — make the edit, once the target is known. Caps at 2 files per call; refuses (`too-big.`) rather than guessing at wider scope.
- **xcrew-reviewer** — pass over a finished change or diff. Read-only, one line per finding.

## Chaining pattern

```
xcrew-investigator  →  xcrew-builder  →  xcrew-reviewer
   (locate)              (edit ≤2 files)     (check)
```

Skip a stage when its input is already known — e.g. skip the investigator if the file:line is already in hand from a prior message.

## Output contracts

**investigator**
```
Defs
  path:line — `symbol` — ≤6 word note
Refs
  path:line — `symbol` — ≤6 word note
```
`No match.` if nothing found.

**builder**
```
<path:line-range> — <change ≤10 words>
verified: <what you checked>
```
Terminal refusals (exact string, nothing else): `too-big.` `needs-confirm.` `ambiguous.` `regressed.`

**reviewer**
```
path:line: emoji severity: problem. fix.
```
🔴 bug · 🟡 risk · 🔵 nit · ❓ question, then `N bugs, N risks, N nits, N questions`.

## Model configuration

Each xcrew agent's model is just a frontmatter field (`agents/xcrew-*.md`) — set it directly, or override at runtime with an env var. The override is a plain string swap: works with Claude Code model ids (`haiku`, `sonnet`, `opus`, or a full id like `claude-sonnet-5`) or any other agent framework's model id you've configured elsewhere. No fixed list is enforced.

| Env var | Patches |
|---|---|
| `XCREW_INVESTIGATOR_MODEL` | `agents/xcrew-investigator.md` |
| `XCREW_BUILDER_MODEL` | `agents/xcrew-builder.md` |
| `XCREW_REVIEWER_MODEL` | `agents/xcrew-reviewer.md` |

Applied by `src/hooks/xcrew-model-overrides.js`'s `applyOverrides()`, best-effort at SessionStart. Missing env var or missing file → no-op, never an error. Defaults if unset: investigator and reviewer run on `haiku` (cheap, read-only); builder inherits whatever model the parent session is running.
