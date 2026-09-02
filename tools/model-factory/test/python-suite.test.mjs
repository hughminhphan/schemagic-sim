import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The factory is half Python. Running the Python unit tests from the Node runner keeps
// one command ("node --test test/*.test.mjs") answering for the whole factory, so a
// Python-side regression cannot pass unnoticed because nobody ran the other suite.
const here = path.dirname(fileURLToPath(import.meta.url));
const factoryRoot = path.resolve(here, "..");
const venvPython = path.join(factoryRoot, ".venv", "bin", "python");
const skip = fs.existsSync(venvPython) ? false : "requires tools/model-factory/.venv";

test("the Python unit suite passes", { skip, timeout: 600_000 }, () => {
  // -t test/python, not -t . : the repository's own "test" directory would otherwise
  // shadow CPython's stdlib "test" package and discovery would fail to import anything.
  const result = spawnSync(venvPython, ["-m", "unittest", "discover", "-s", "test/python", "-t", "test/python", "-v"], {
    cwd: factoryRoot,
    encoding: "utf8",
    timeout: 600_000,
  });
  assert.equal(result.status, 0, `Python unit suite failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /\bOK\b/);
});
