#!/usr/bin/env python3
"""
Real, reproducible output-token benchmark for darkman-x.

Runs each prompt in benchmarks/prompts.json twice against the configured
model: once with default voice, once with the darkman-x `full` system
rules prepended (loaded from skills/darkman-x/SKILL.md). Reports the
measured output-token delta. No fabricated numbers — if ANTHROPIC_API_KEY
isn't set, this refuses to run rather than printing placeholder results.

Usage:
    ANTHROPIC_API_KEY=sk-... python3 benchmarks/run.py [--model claude-sonnet-5]
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_PATH = REPO_ROOT / "skills" / "darkman-x" / "SKILL.md"
PROMPTS_PATH = REPO_ROOT / "benchmarks" / "prompts.json"
RESULTS_DIR = REPO_ROOT / "benchmarks" / "results"


def load_darkman_x_rules():
    if not SKILL_PATH.exists():
        raise SystemExit(f"missing {SKILL_PATH} — build the core skill before benchmarking")
    text = SKILL_PATH.read_text(encoding="utf-8")
    # Strip YAML frontmatter.
    return re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="claude-sonnet-5")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set — refusing to fabricate benchmark numbers.", file=sys.stderr)
        print("Set ANTHROPIC_API_KEY and re-run to get real measurements.", file=sys.stderr)
        sys.exit(1)

    try:
        import anthropic
    except ImportError:
        print("pip install -r benchmarks/requirements.txt", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    rules = load_darkman_x_rules()
    prompts = json.loads(PROMPTS_PATH.read_text(encoding="utf-8"))["prompts"]

    results = []
    for item in prompts:
        baseline = client.messages.create(
            model=args.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": item["prompt"]}],
        )
        compressed = client.messages.create(
            model=args.model,
            max_tokens=1024,
            system=rules,
            messages=[{"role": "user", "content": item["prompt"]}],
        )
        baseline_tokens = baseline.usage.output_tokens
        compressed_tokens = compressed.usage.output_tokens
        delta_pct = round(100 * (1 - compressed_tokens / baseline_tokens), 1) if baseline_tokens else 0.0
        results.append({
            "id": item["id"],
            "baseline_output_tokens": baseline_tokens,
            "darkman_x_output_tokens": compressed_tokens,
            "output_token_reduction_pct": delta_pct,
        })
        print(f"{item['id']}: {baseline_tokens} -> {compressed_tokens} tokens ({delta_pct}% reduction)")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / f"{args.model}.json"
    out_path.write_text(json.dumps({"model": args.model, "results": results}, indent=2), encoding="utf-8")
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
