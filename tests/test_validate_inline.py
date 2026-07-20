"""
Tests skills/darkman-x-compress/scripts/validate.py against the contract in
RECREATION-PROMPT.md: compare headings, fenced code exact, URLs, paths,
bullets, inline code between original and rewritten text, returning a
ValidationResult.

Owned by a separate build step. Skips the whole module if not present yet.
"""
import os
import sys
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "skills", "darkman-x-compress", "scripts")

validate = None
if os.path.isdir(SCRIPTS_DIR):
    sys.path.insert(0, SCRIPTS_DIR)
    try:
        import validate  # type: ignore
    except ImportError:
        validate = None


def _is_valid(result):
    # Accommodate either a boolean-ish attribute name.
    for attr in ("ok", "valid", "is_valid", "passed"):
        if hasattr(result, attr):
            return bool(getattr(result, attr))
    return bool(result)


@unittest.skipUnless(validate is not None, "skills/darkman-x-compress/scripts/validate.py not present yet")
class TestValidateInline(unittest.TestCase):
    def test_identical_text_is_valid(self):
        text = "# Title\n\nSome `inline code` and a [link](https://example.com/path)."
        result = validate.validate(text, text)
        self.assertTrue(_is_valid(result))

    def test_rewritten_prose_with_same_structure_is_valid(self):
        original = "# Title\n\nThis is a very long winded paragraph with lots of filler words in it.\n\n- one\n- two"
        rewritten = "# Title\n\nShort paragraph, cut filler.\n\n- one\n- two"
        result = validate.validate(original, rewritten)
        self.assertTrue(_is_valid(result))

    def test_mangled_fenced_code_is_invalid(self):
        original = "Some text.\n\n```js\nfunction f() { return 1; }\n```\n"
        mangled = "Some text.\n\n```js\nfunction f() { return 2; }\n```\n"
        result = validate.validate(original, mangled)
        self.assertFalse(_is_valid(result))

    def test_dropped_url_is_invalid(self):
        original = "Check https://example.com/docs for more info, please read carefully."
        rewritten = "Check the docs for more info."
        result = validate.validate(original, rewritten)
        self.assertFalse(_is_valid(result))

    def test_dropped_heading_is_invalid(self):
        original = "# Setup\n\nSome text.\n\n## Usage\n\nMore text."
        rewritten = "# Setup\n\nSome text."
        result = validate.validate(original, rewritten)
        self.assertFalse(_is_valid(result))

    def test_mangled_inline_code_is_invalid(self):
        original = "Run `npm test` to check."
        rewritten = "Run `npm run test` to check."
        result = validate.validate(original, rewritten)
        self.assertFalse(_is_valid(result))

    def test_mangled_bare_path_is_invalid(self):
        # Not wrapped in backticks — a plain-prose file path reference.
        original = "See src/hooks/darkman-x-config.js for flag writes."
        rewritten = "See src/hooks/CONFIG-RENAMED.js for flag writes."
        result = validate.validate(original, rewritten)
        self.assertFalse(_is_valid(result))

    def test_preserved_bare_path_is_valid(self):
        original = "See src/hooks/darkman-x-config.js for details on flag writes."
        rewritten = "See src/hooks/darkman-x-config.js — flag writes only."
        result = validate.validate(original, rewritten)
        self.assertTrue(_is_valid(result))


if __name__ == "__main__":
    unittest.main()
