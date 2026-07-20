#!/usr/bin/env python3
"""
Scores each darkman-x-compressed response in evals/snapshots/results.json
against its baseline: output-token reduction, plus a crude preservation
check (does the compressed answer still mention the key nouns/identifiers
from the baseline?). Prints a summary; does not fabricate a single overall
score if there's no data to measure.
"""
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_PATH = REPO_ROOT / "evals" / "snapshots" / "results.json"


def key_terms(text):
    # crude: pull identifier-like tokens (code symbols, CapWords, snake_case)
    return set(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{3,}", text))


def main():
    if not SNAPSHOT_PATH.exists():
        print(f"missing {SNAPSHOT_PATH} — run evals/llm_run.py first", file=sys.stderr)
        sys.exit(1)

    data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    results = data.get("results", [])
    if not results:
        print("No results in snapshot yet — run evals/llm_run.py first.")
        return

    for r in results:
        baseline_tokens = r["baseline_output_tokens"]
        compressed_tokens = r["darkman_x_output_tokens"]
        reduction_pct = round(100 * (1 - compressed_tokens / baseline_tokens), 1) if baseline_tokens else 0.0

        baseline_terms = key_terms(r["baseline_text"])
        compressed_terms = key_terms(r["darkman_x_text"])
        overlap = len(baseline_terms & compressed_terms) / len(baseline_terms) if baseline_terms else 1.0

        print(f"{r['prompt'][:50]!r}")
        print(f"  output tokens: {baseline_tokens} -> {compressed_tokens} ({reduction_pct}% reduction)")
        print(f"  key-term overlap: {round(overlap * 100, 1)}%")


if __name__ == "__main__":
    main()
