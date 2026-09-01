import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runDesignerCleanCheckoutCommandV1 } from "./clean-checkout-runner-command";

const repositoryRoot = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
const output = runDesignerCleanCheckoutCommandV1(
  process.argv.slice(2),
  repositoryRoot,
  process.cwd(),
);
process.stdout.write(
  `Designer clean-checkout report ${output.report.contentHash} written to ${output.outputPath}\n`,
);
