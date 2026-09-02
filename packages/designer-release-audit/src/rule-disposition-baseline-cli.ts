import { writeFileSync } from "node:fs";
import {
  DESIGNER_RULE_DISPOSITION_BASELINE_PATH_V1,
  assessDesignerRuleDispositionsV1,
  buildDesignerRuleDispositionBaselineV1,
  collectDesignerRuleDispositionsV1,
  loadDesignerRuleDispositionBaselineV1,
} from "./rule-disposition-baseline";

const write = process.argv.slice(2).includes("--write");
if (write) {
  const baseline = buildDesignerRuleDispositionBaselineV1();
  writeFileSync(DESIGNER_RULE_DISPOSITION_BASELINE_PATH_V1, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  process.stdout.write(`Designer rule-disposition baseline ${baseline.contentHash} written\n`);
} else {
  const assessment = assessDesignerRuleDispositionsV1(
    collectDesignerRuleDispositionsV1(),
    loadDesignerRuleDispositionBaselineV1(),
  );
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  if (assessment.stale || assessment.regressions.length > 0) process.exitCode = 1;
}
