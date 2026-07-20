"""Validate that a compressed rewrite preserved everything that must not change."""

import re
from dataclasses import dataclass, field

FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
URL_RE = re.compile(r"https?://[^\s)\]}\"'>]+")
PATH_RE = re.compile(r"(?:\.{0,2}/)?(?:[\w.-]+/)+[\w.-]+")
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$", re.MULTILINE)
BULLET_RE = re.compile(r"^(\s*)([-*+]|\d+\.)\s", re.MULTILINE)


@dataclass
class ValidationResult:
    ok: bool
    problems: list = field(default_factory=list)


def _extract(pattern, text):
    return pattern.findall(text)


def validate(original, compressed):
    """Compare `original` and `compressed` text; return a ValidationResult."""
    problems = []

    orig_fences = _extract(FENCE_RE, original)
    comp_fences = _extract(FENCE_RE, compressed)
    if orig_fences != comp_fences:
        problems.append("fenced code blocks changed")

    orig_inline = sorted(_extract(INLINE_CODE_RE, original))
    comp_inline = sorted(_extract(INLINE_CODE_RE, compressed))
    if orig_inline != comp_inline:
        problems.append("inline code spans changed")

    orig_urls = sorted(_extract(URL_RE, original))
    comp_urls = sorted(_extract(URL_RE, compressed))
    if orig_urls != comp_urls:
        problems.append("URLs changed or dropped")

    orig_headings = [(len(h[0]), h[1].strip()) for h in HEADING_RE.findall(original)]
    comp_headings = [(len(h[0]), h[1].strip()) for h in HEADING_RE.findall(compressed)]
    if orig_headings != comp_headings:
        problems.append("heading structure changed")

    orig_bullets = len(BULLET_RE.findall(original))
    comp_bullets = len(BULLET_RE.findall(compressed))
    if orig_bullets != comp_bullets:
        problems.append(f"bullet count changed ({orig_bullets} -> {comp_bullets})")

    return ValidationResult(ok=not problems, problems=problems)
