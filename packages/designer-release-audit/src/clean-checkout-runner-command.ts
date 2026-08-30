import { existsSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import {
  runDesignerCleanCheckoutMatrixV1,
  type DesignerCleanCheckoutExecutorV1,
} from "./clean-checkout-runner";
import type { DesignerCleanCheckoutReportV1 } from "./clean-checkout-audit";

export interface DesignerCleanCheckoutCommandOutputV1 {
  outputPath: string;
  report: DesignerCleanCheckoutReportV1;
}

function outputArgument(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--output") {
    throw new TypeError("usage:clean-checkout-runner --output <external-report-path>");
  }
  const value = argv[1];
  if (value === undefined || value.length === 0 || value.trim() !== value || value.includes("\0")) {
    throw new TypeError("--output:missing_or_invalid_value");
  }
  return value;
}

function externalOutputPath(repositoryRoot: string, cwd: string, input: string): string {
  const requested = resolve(cwd, input);
  const parent = realpathSync(dirname(requested));
  if (!statSync(parent).isDirectory()) throw new TypeError("--output:parent_not_directory");
  const output = join(parent, basename(requested));
  if (output === repositoryRoot || output.startsWith(`${repositoryRoot}${sep}`)) {
    throw new TypeError("--output:must_be_outside_repository");
  }
  if (existsSync(output)) throw new TypeError("--output:already_exists");
  return output;
}

export function runDesignerCleanCheckoutCommandV1(
  argv: readonly string[],
  repositoryRootInput: string,
  cwd: string,
  executor?: DesignerCleanCheckoutExecutorV1,
): DesignerCleanCheckoutCommandOutputV1 {
  const repositoryRoot = realpathSync(resolve(repositoryRootInput));
  const outputPath = externalOutputPath(repositoryRoot, cwd, outputArgument(argv));
  const report = executor === undefined
    ? runDesignerCleanCheckoutMatrixV1(repositoryRoot)
    : runDesignerCleanCheckoutMatrixV1(repositoryRoot, executor);
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return { outputPath, report };
}
