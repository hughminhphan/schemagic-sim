import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The generator imports workspace TypeScript sources, so it is bundled the same
// way the verifier is instead of depending on a published dist build.
const projectRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const temporary = await mkdtemp(resolve(tmpdir(), "schemagic-example-build-"));
const bundle = resolve(temporary, "build-examples.mjs");
const esbuild = resolve(projectRoot, "node_modules/.bin/esbuild");
const worker = resolve(projectRoot, "examples/tools/build-examples.worker.mjs");
try {
  const build = spawnSync(esbuild, [worker, "--bundle", "--platform=node", "--format=esm", `--outfile=${bundle}`], { cwd: projectRoot, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
  const run = spawnSync(process.execPath, [bundle], { cwd: projectRoot, stdio: "inherit" });
  if (run.status !== 0) process.exitCode = run.status ?? 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
