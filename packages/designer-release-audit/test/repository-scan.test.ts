import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  scanDesignerReleaseFileInputsV1,
  scanDesignerReleaseRepositoryV1,
} from "../src/repository-scan";

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("Designer release repository safety scan", () => {
  it("is deterministic, content-addressed, detached, and catches high-confidence release leaks", () => {
    const clean = scanDesignerReleaseFileInputsV1([
      { path: "packages/example/src/index.ts", bytes: bytes('export const state = "disabled_pending_approval";\n') },
      { path: "apps/web/public/example.bin", bytes: new Uint8Array([0, 1, 2, 3]) },
    ]);
    const reordered = scanDesignerReleaseFileInputsV1([
      { path: "apps/web/public/example.bin", bytes: new Uint8Array([0, 1, 2, 3]) },
      { path: "packages/example/src/index.ts", bytes: bytes('export const state = "disabled_pending_approval";\n') },
    ]);
    expect(reordered).toEqual(clean);
    expect(clean).toMatchObject({ status: "pass", candidateFileCount: 2, scannedTextFileCount: 1, skippedBinaryFileCount: 1 });
    expect(Object.isFrozen(clean)).toBe(true);
    expect(Object.isFrozen(clean.findings)).toBe(true);

    const privateKeyMarker = ["-----BEGIN", "PRIVATE", "KEY-----"].join(" ");
    const blocked = scanDesignerReleaseFileInputsV1([
      { path: "packages/power-designer/vendor-sources/source.html", bytes: bytes("<html>vendor capture</html>") },
      { path: "docs/vendor.pdf", bytes: bytes("%PDF fixture") },
      { path: "config/.env", bytes: bytes("TOKEN=value") },
      { path: "src/key.ts", bytes: bytes(`export const value = \`${privateKeyMarker}\`;`) },
    ]);
    expect(blocked.status).toBe("blocked");
    expect(blocked.findings.map((finding) => finding.ruleId)).toEqual([
      "environment_secret_file",
      "prohibited_vendor_or_credential_artifact",
      "repository_local_vendor_capture",
      "private_key_material",
    ]);

    const assignedCredential = ["api", "_key = \"", "live-credential-value-123456", "\""].join("");
    expect(scanDesignerReleaseFileInputsV1([
      { path: "src/config.ts", bytes: bytes(assignedCredential) },
    ]).findings).toEqual([{ ruleId: "credential_assignment", path: "src/config.ts", line: 1 }]);
  });

  it("passes the current tracked plus unignored release-candidate file set", () => {
    const report = scanDesignerReleaseRepositoryV1(fileURLToPath(new URL("../../..", import.meta.url)));
    expect(report.status).toBe("pass");
    expect(report.candidateFileCount).toBeGreaterThan(1_000);
    expect(report.findings).toEqual([]);
  });
});
