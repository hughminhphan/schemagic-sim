"""Native ngspice binary resolution.

The fitter used to hard-code /opt/homebrew/bin/ngspice, so a CI image or a Linux
build silently had no simulator at all. Resolution is now ordered and every
failure is explicit, because falling back to a different ngspice build would
change every fitted number without changing any recorded provenance.
"""
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "python"))

import native_ngspice  # noqa: E402


def _fake_executable(directory, name="ngspice"):
    path = Path(directory) / name
    path.write_text("#!/bin/sh\nexit 0\n")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return str(path)


class ResolveNgspiceTest(unittest.TestCase):
    def test_ngspice_bin_wins_over_path_and_homebrew(self):
        with tempfile.TemporaryDirectory() as override_dir, tempfile.TemporaryDirectory() as path_dir:
            override = _fake_executable(override_dir)
            _fake_executable(path_dir)
            resolved = native_ngspice.resolve_ngspice({"NGSPICE_BIN": override, "PATH": path_dir})
            self.assertEqual(resolved, override)

    def test_path_is_used_when_no_override_is_set(self):
        with tempfile.TemporaryDirectory() as path_dir:
            expected = _fake_executable(path_dir)
            resolved = native_ngspice.resolve_ngspice({"PATH": path_dir})
            self.assertEqual(os.path.realpath(resolved), os.path.realpath(expected))

    def test_homebrew_path_is_the_last_resort(self):
        if not os.access(native_ngspice.HOMEBREW_NGSPICE, os.X_OK):
            self.skipTest("no Homebrew ngspice on this machine")
        with tempfile.TemporaryDirectory() as empty:
            resolved = native_ngspice.resolve_ngspice({"PATH": empty})
            self.assertEqual(resolved, native_ngspice.HOMEBREW_NGSPICE)

    def test_a_broken_override_fails_loudly_instead_of_falling_back(self):
        with tempfile.TemporaryDirectory() as path_dir:
            _fake_executable(path_dir)
            with self.assertRaises(RuntimeError) as caught:
                native_ngspice.resolve_ngspice({"NGSPICE_BIN": "/nonexistent/ngspice", "PATH": path_dir})
            self.assertIn("NGSPICE_BIN", str(caught.exception))

    def test_a_non_executable_override_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            plain = Path(directory) / "ngspice"
            plain.write_text("not executable\n")
            with self.assertRaises(RuntimeError):
                native_ngspice.resolve_ngspice({"NGSPICE_BIN": str(plain), "PATH": directory})

    def test_missing_everywhere_names_the_whole_search_order(self):
        original = native_ngspice.HOMEBREW_NGSPICE
        native_ngspice.HOMEBREW_NGSPICE = "/nonexistent/homebrew/ngspice"
        try:
            with tempfile.TemporaryDirectory() as empty:
                with self.assertRaises(RuntimeError) as caught:
                    native_ngspice.resolve_ngspice({"PATH": empty})
            message = str(caught.exception)
            self.assertIn("NGSPICE_BIN", message)
            self.assertIn("PATH", message)
        finally:
            native_ngspice.HOMEBREW_NGSPICE = original

    def test_the_repository_default_still_resolves_on_this_machine(self):
        self.assertTrue(os.access(native_ngspice.cached_ngspice(), os.X_OK))


if __name__ == "__main__":
    unittest.main()
