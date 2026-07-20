"""Decide whether a file is a natural-language target for compression."""

import os

COMPRESSIBLE_EXTENSIONS = {".md", ".markdown", ".txt", ".rst", ".adoc"}

CODE_OR_CONFIG_EXTENSIONS = {
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".sh", ".ps1", ".bat", ".rb", ".go", ".rs", ".java",
    ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".lock",
}

BACKUP_SUFFIX = ".original.md"


def should_compress(path):
    """Return True if `path` is a natural-language file safe to compress."""
    base = os.path.basename(path)

    if base.endswith(BACKUP_SUFFIX):
        return False

    _, ext = os.path.splitext(path)
    ext = ext.lower()

    if ext in CODE_OR_CONFIG_EXTENSIONS:
        return False

    if ext in COMPRESSIBLE_EXTENSIONS:
        return True

    if ext == "":
        return _looks_like_natural_language(path)

    return False


def _looks_like_natural_language(path):
    """Heuristic for extensionless files (e.g. README, CHANGELOG)."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            sample = f.read(4096)
    except OSError:
        return False

    if not sample.strip():
        return False

    # Code-ish signals: braces/semicolons dominating, shebang lines.
    if sample.lstrip().startswith("#!"):
        return False

    code_markers = sample.count("{") + sample.count(";") + sample.count("def ") + sample.count("function ")
    words = len(sample.split())
    if words == 0:
        return False

    return (code_markers / max(words, 1)) < 0.15
