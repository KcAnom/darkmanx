"""Core compress pipeline: refuse-sensitive -> backup -> strip frontmatter ->
rewrite -> validate (with retries) -> write or restore."""

import os
import re
import shutil
import time

from . import agent_cli
from . import detect
from . import validate as validate_mod

SENSITIVE_MARKERS = (
    "secret", "credential", "credentials", ".env", "id_rsa",
    ".pem", ".key", "password", "token",
)

FRONTMATTER_RE = re.compile(r"^(---\r?\n.*?\r?\n---\r?\n?)", re.DOTALL)

MAX_FIX_RETRIES = 2


class CompressRefused(Exception):
    pass


class CompressFailed(Exception):
    pass


def is_sensitive_path(path):
    lowered = path.lower()
    return any(marker in lowered for marker in SENSITIVE_MARKERS)


def backup_dir():
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~\\AppData\\Local")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return os.path.join(base, "darkman-x-compress", "backups")


def make_backup(path):
    d = backup_dir()
    os.makedirs(d, exist_ok=True)
    stamp = time.strftime("%Y%m%dT%H%M%S")
    dest = os.path.join(d, f"{os.path.basename(path)}.{stamp}.orig")
    shutil.copy2(path, dest)
    return dest


def split_frontmatter(text):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return "", text
    return m.group(1), text[m.end():]


REWRITE_INSTRUCTIONS = (
    "Rewrite the text below in darkman-x style: short, hard, rhythmic, "
    "zero filler. Drop articles, pleasantries, and hedging. Fragments are "
    "fine. Preserve byte-exact: fenced code blocks, inline code spans, "
    "URLs, file paths, heading structure, and bullet structure. Do not "
    "translate or change the language it's written in. Output ONLY the "
    "rewritten text, no preamble, no explanation, no surrounding quotes.\n\n"
    "---\n\n"
)


def call_agent_for_rewrite(text, agent_id=None):
    """Runs the rewrite through whichever agent CLI is configured/available
    (see agent_cli.py) — no API key. Spawns `claude`, `codex`, `grok`, or
    `pi` non-interactively using your existing logged-in subscription for
    that CLI, same as an interactive session would use."""
    prompt = REWRITE_INSTRUCTIONS + text
    return agent_cli.run_agent(prompt, agent_id=agent_id)


# Backward-compatible alias — the rewrite entry point used to be Claude-only.
call_claude_for_rewrite = call_agent_for_rewrite


def compress_file(path, rewrite_fn=None):
    """Compress `path` in place. Returns the final compressed body text.
    Raises CompressRefused / CompressFailed on refusal or unrecoverable failure."""
    rewrite_fn = rewrite_fn or call_agent_for_rewrite

    if is_sensitive_path(path):
        raise CompressRefused(f"refusing sensitive path: {path}")

    if not detect.should_compress(path):
        raise CompressRefused(f"not a natural-language compress target: {path}")

    with open(path, "r", encoding="utf-8") as f:
        original_full = f.read()

    backup_path = make_backup(path)

    frontmatter, body = split_frontmatter(original_full)

    attempt_input = body
    last_problems = []
    for attempt in range(MAX_FIX_RETRIES + 1):
        try:
            candidate = rewrite_fn(attempt_input)
        except Exception as e:  # noqa: BLE001 - any rewrite failure is a failed attempt, not a crash
            last_problems = [f"rewrite call raised: {e}"]
            attempt_input = body
            continue
        result = validate_mod.validate(body, candidate)
        if result.ok:
            final = frontmatter + candidate
            with open(path, "w", encoding="utf-8") as f:
                f.write(final)
            return final
        last_problems = result.problems
        attempt_input = body  # retry from the original, not the failed candidate

    # All attempts failed (validation or rewrite errors) — restore original,
    # do not leave a partial rewrite in place.
    shutil.copy2(backup_path, path)
    raise CompressFailed(
        f"failed after {MAX_FIX_RETRIES} retries: {last_problems}; "
        f"original restored from {backup_path}"
    )
