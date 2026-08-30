import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDesignerReleaseRepositoryV1 } from "./repository-scan";

const repositoryRoot = dirname(fileURLToPath(new URL("../../../package.json", import.meta.url)));
const report = scanDesignerReleaseRepositoryV1(repositoryRoot);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== "pass") process.exitCode = 1;
