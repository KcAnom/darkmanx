#!/usr/bin/env python3
"""
Runs each line of evals/prompts/en.txt through a model twice — default voice
and darkman-x `full` voice — and writes both raw responses to
evals/snapshots/results.json for measure.py to score.

Usage:
    ANTHROPIC_API_KEY=sk-... python3 evals/llm_run.py [--model claude-sonnet-5]
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_PATH = REPO_ROOT / "skills" / "darkman-x" / "SKILL.md"
PROMPTS_PATH = REPO_ROOT / "evals" / "prompts" / "en.txt"
SNAPSHOT_PATH = REPO_ROOT / "evals" / "snapshots" / "results.json"


def load_darkman_x_rules():
    if not SKILL_PATH.exists():
        raise SystemExit(f"missing {SKILL_PATH}")
    text = SKILL_PATH.read_text(encoding="utf-8")
    return re.sub(r"^---\n.*?\n---\n", "", text, flags=re.DOTALL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="claude-sonnet-5")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    try:
        import anthropic
    except ImportError:
        print("pip install -r benchmarks/requirements.txt", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    rules = load_darkman_x_rules()
    prompts = [line.strip() for line in PROMPTS_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]

    results = []
    for prompt in prompts:
        baseline = client.messages.create(
            model=args.model, max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        compressed = client.messages.create(
            model=args.model, max_tokens=1024, system=rules,
            messages=[{"role": "user", "content": prompt}],
        )
        results.append({
            "prompt": prompt,
            "baseline_text": baseline.content[0].text,
            "baseline_output_tokens": baseline.usage.output_tokens,
            "darkman_x_text": compressed.content[0].text,
            "darkman_x_output_tokens": compressed.usage.output_tokens,
        })
        print(f"ran: {prompt[:60]}...")

    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(
        json.dumps({"generated": None, "model": args.model, "results": results}, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {SNAPSHOT_PATH}")


if __name__ == "__main__":
    main()
