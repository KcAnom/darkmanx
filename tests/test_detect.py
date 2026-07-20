"""
Tests skills/darkman-x-compress/scripts/detect.py against the contract in
RECREATION-PROMPT.md: compressible extensions (.md/.txt/...), skip code/config
files, content heuristics for extensionless files, and should_compress()
skipping `*.original.md` backups.

Owned by a separate build step. Skips the whole module if not present yet.
"""
import os
import sys
import tempfile
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "skills", "darkman-x-compress", "scripts")

detect = None
if os.path.isdir(SCRIPTS_DIR):
    sys.path.insert(0, SCRIPTS_DIR)
    try:
        import detect  # type: ignore
    except ImportError:
        detect = None


@unittest.skipUnless(detect is not None, "skills/darkman-x-compress/scripts/detect.py not present yet")
class TestDetect(unittest.TestCase):
    def test_markdown_is_compressible(self):
        self.assertTrue(detect.should_compress("CLAUDE.md"))

    def test_plain_text_is_compressible(self):
        self.assertTrue(detect.should_compress("notes.txt"))

    def test_code_file_is_not_compressible(self):
        self.assertFalse(detect.should_compress("index.js"))

    def test_config_file_is_not_compressible(self):
        self.assertFalse(detect.should_compress("package.json"))

    def test_original_backup_is_skipped(self):
        self.assertFalse(detect.should_compress("CLAUDE.original.md"))
        self.assertFalse(detect.should_compress("notes.original.md"))

    def test_extensionless_file_uses_content_heuristic(self):
        # A README-like extensionless file with prose should be compressible.
        prose = "# Notes\n\nThis is a long paragraph of natural language prose describing the project in detail."
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "README")
            with open(path, "w", encoding="utf-8") as f:
                f.write(prose)
            self.assertTrue(detect.should_compress(path))

    def test_extensionless_code_like_content_is_not_compressible(self):
        codeish = "\n".join(
            "def f{0}(a, b): return {{a: b}};".format(i) for i in range(20)
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "weirdfile")
            with open(path, "w", encoding="utf-8") as f:
                f.write(codeish)
            self.assertFalse(detect.should_compress(path))


if __name__ == "__main__":
    unittest.main()
