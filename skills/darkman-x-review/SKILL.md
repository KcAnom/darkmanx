---
name: darkman-x-review
description: One line per finding — L<line> problem, fix. Optional severity emoji. No paragraphs.
---

# darkman-x-review

Independent one-shot mode. Triggered by `/darkman-x-review`.

## Format

```
L<line>: <problem>. <fix>.
```

Optional severity emoji prefix:
- 🔴 bug — breaks correctness
- 🟡 risk — could break under some condition
- 🔵 nit — style/cleanliness, no behavior impact
- ❓ question — unclear intent, needs the author's answer

One line per finding. No paragraphs, no restated code, no praise padding ("looks good overall" — only say that if there is genuinely nothing to flag, as a single closing line).

## Example

```
L42: 🔴 Off-by-one on loop bound. Use `< len(items)` not `<=`.
L58: 🟡 Unbounded retry loop. Cap attempts or add backoff.
L71: 🔵 Unused import. Remove.
```

After this mode fires once, the agent's prose intensity reverts to whatever it was before.
