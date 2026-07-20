"""Measure real compression ratio for darkman-x-compress on a set of files.

No fabricated numbers: this only reports what it actually measured on the
files it was given. Word count is used as a free, dependency-free proxy for
token count; pass --tokenizer to plug in a real tokenizer if you have one.
"""

import argparse
import json
import sys

from . import compress


def word_count(text):
    return len(text.split())


def measure(paths, rewrite_fn=None):
    results = []
    for path in paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                before = f.read()
        except OSError as e:
            results.append({"path": path, "error": str(e)})
            continue

        try:
            after = compress.compress_file(path, rewrite_fn=rewrite_fn)
        except (compress.CompressRefused, compress.CompressFailed) as e:
            results.append({"path": path, "error": str(e)})
            continue

        before_wc = word_count(before)
        after_wc = word_count(after)
        savings = 1 - (after_wc / before_wc) if before_wc else 0.0
        results.append({
            "path": path,
            "before_words": before_wc,
            "after_words": after_wc,
            "savings_ratio": round(savings, 4),
        })
    return results


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    parser = argparse.ArgumentParser(description="Measure darkman-x-compress savings on real files.")
    parser.add_argument("files", nargs="+", help="Files to compress and measure.")
    args = parser.parse_args(argv)

    results = measure(args.files)
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
