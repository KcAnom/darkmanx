#!/usr/bin/env python3
"""
Renders a simple text bar chart of output-token reduction per prompt from
the latest evals/snapshots/results.json. No matplotlib dependency required —
keeps this runnable with stdlib only.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_PATH = REPO_ROOT / "evals" / "snapshots" / "results.json"


def bar(pct, width=40):
    filled = round(width * max(0, min(100, pct)) / 100)
    return "#" * filled + "-" * (width - filled)


def main():
    if not SNAPSHOT_PATH.exists():
        print(f"missing {SNAPSHOT_PATH}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    results = data.get("results", [])
    if not results:
        print("No results yet — run evals/llm_run.py first.")
        return

    print(f"model: {data.get('model')}\n")
    for r in results:
        baseline = r["baseline_output_tokens"]
        compressed = r["darkman_x_output_tokens"]
        pct = round(100 * (1 - compressed / baseline), 1) if baseline else 0.0
        label = r["prompt"][:28].ljust(28)
        print(f"{label} [{bar(pct)}] {pct}%")


if __name__ == "__main__":
    main()
