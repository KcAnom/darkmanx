"""Entry point: python3 -m scripts <file>"""

import io
import sys

from . import compress


def _reconfigure_utf8():
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
        else:
            setattr(sys, stream_name, io.TextIOWrapper(stream.buffer, encoding="utf-8"))


def main(argv=None):
    _reconfigure_utf8()
    argv = argv if argv is not None else sys.argv[1:]

    if not argv:
        print("usage: python3 -m scripts <file>", file=sys.stderr)
        return 2

    path = argv[0]
    try:
        compress.compress_file(path)
    except compress.CompressRefused as e:
        print(f"refused: {e}", file=sys.stderr)
        return 1
    except compress.CompressFailed as e:
        print(f"failed: {e}", file=sys.stderr)
        return 1

    print(f"compressed: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
