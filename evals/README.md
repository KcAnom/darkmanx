# evals

Lightweight evaluation harness, separate from `benchmarks/` (which measures token counts). This measures whether darkman-x-compressed output still preserves meaning and required content.

- `llm_run.py` — runs prompts from `prompts/en.txt` through a model, with and without darkman-x rules.
- `measure.py` — scores each pair (does the compressed answer preserve the key facts / code / instructions from the baseline?) and writes `snapshots/results.json`.
- `plot.py` — renders a simple chart of output-token reduction vs. a preservation score, from the latest snapshot.

```bash
ANTHROPIC_API_KEY=sk-... python3 evals/llm_run.py
python3 evals/measure.py
python3 evals/plot.py
```

`snapshots/results.json` ships as an empty structure — it's a stub until evals are actually run and regenerated; see `RECREATION-PROMPT.md` section (i).
