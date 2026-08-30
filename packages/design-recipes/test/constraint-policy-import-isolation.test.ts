import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as combinedPolicyModule from "../src/production-constraint-policies-v3";
import * as motorPolicyLeaf from "../src/motor-constraint-policy-engine-internal";
import * as powerPolicyLeaf from "../src/power-constraint-policy-engine-internal";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("production V3 constraint policy import isolation", () => {
  it("exposes application-specific package leaves with the same catalog objects", () => {
    expect(Object.keys(motorPolicyLeaf).sort()).toEqual([
      "MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3",
      "PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY",
    ]);
    expect(Object.keys(powerPolicyLeaf).sort()).toEqual([
      "POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3",
      "PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY",
    ]);
    expect(motorPolicyLeaf.MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3)
      .toBe(combinedPolicyModule.MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3);
    expect(powerPolicyLeaf.POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3)
      .toBe(combinedPolicyModule.POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3);
  });

  it("keeps each leaf statically independent from the other application catalog", () => {
    const motorSource = source("../src/motor-constraint-policy-engine-internal.ts");
    const powerSource = source("../src/power-constraint-policy-engine-internal.ts");
    expect(motorSource).not.toMatch(/power-constraint-policy|POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3/);
    expect(powerSource).not.toMatch(/motor-constraint-policy|MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3/);
    expect(motorSource).not.toContain("./production-constraint-policies-v3");
    expect(powerSource).not.toContain("./production-constraint-policies-v3");
  });

  it("keeps the legacy combined export and publishes both narrow subpaths", () => {
    const manifest = JSON.parse(source("../package.json")) as {
      exports: Record<string, string>;
    };
    expect(manifest.exports["./constraint-policies-engine-internal"])
      .toBe("./src/production-constraint-policies-v3.ts");
    expect(manifest.exports["./motor-constraint-policy-engine-internal"])
      .toBe("./src/motor-constraint-policy-engine-internal.ts");
    expect(manifest.exports["./power-constraint-policy-engine-internal"])
      .toBe("./src/power-constraint-policy-engine-internal.ts");
  });
});
