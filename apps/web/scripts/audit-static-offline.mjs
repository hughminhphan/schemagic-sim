import { auditStaticOfflineNetworkBuild } from "./static-offline-audit.mjs";

const report = auditStaticOfflineNetworkBuild(new URL("../dist/", import.meta.url));
if (report.status !== "pass") {
  throw new Error(`Production static offline/network audit blocked:\n${report.findings
    .map((entry) => `${entry.path}: ${entry.code}: ${entry.detail}`)
    .join("\n")}`);
}

console.log(
  `Production static offline/network audit passed (${report.evidence.artifactCount} artifacts; `
  + `${report.evidence.javascriptAssetCount} JavaScript assets; `
  + `${report.evidence.externalNavigationUrlCount} inventoried external navigation URLs; `
  + `${report.artifactSetHash}).`,
);
console.log(`Static audit limitation: ${report.limitations[0]}`);
