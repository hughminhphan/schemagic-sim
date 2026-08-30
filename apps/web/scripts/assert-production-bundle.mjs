import { readdirSync, readFileSync } from "node:fs";

const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const files = readdirSync(assetsDirectory)
  .filter((name) => name.endsWith(".js") || name.endsWith(".js.map"))
  .sort();
const forbiddenRuntime = [
  { label: "fixture module", pattern: /\/fixtures(?:\.ts|\/)/ },
  { label: "V2 test capability module", pattern: /\/v2-testing\.ts/ },
  { label: "test generator", pattern: /generate[A-Za-z0-9_]*ForTesting/ },
  { label: "test-only capability", pattern: /\btestOnly\b/ },
  { label: "synthetic Designer catalog", pattern: /SYNTHETIC_(?:MOTOR_CATALOG|BUCK_TEST_CATALOG)/ },
  { label: "synthetic manufacturer", pattern: /schemagic-synthetic/i },
  { label: "synthetic manufacturer part number", pattern: /SYNTHETIC-[A-Z0-9_-]+/ },
  { label: "synthetic evidence source", pattern: /synthetic:[A-Za-z0-9_.:-]+/i },
  { label: "synthetic test-fixture state", pattern: /synthetic_test_fixture/i },
  { label: "Motor legacy catalog source", pattern: /packages\/motor-designer\/src\/(?:analysis|catalog|evidence|materialize|recipes)\.ts/ },
  { label: "Power legacy catalog source", pattern: /packages\/power-designer\/src\/(?:catalog|circuit|evidence|library|recipe)\.ts/ },
];
const violations = [];

for (const name of files.filter((entry) => entry.endsWith(".js"))) {
  const source = readFileSync(new URL(name, assetsDirectory), "utf8");
  for (const rule of forbiddenRuntime) {
    if (rule.pattern.test(source)) violations.push(`${name}: ${rule.label}`);
  }
}

for (const name of files.filter((entry) => entry.endsWith(".js.map"))) {
  const map = JSON.parse(readFileSync(new URL(name, assetsDirectory), "utf8"));
  for (const sourcePath of map.sources ?? []) {
    if (/\/(?:fixtures|v2-testing)\.ts$/.test(sourcePath)
      || /\/(?:test|tests)\//.test(sourcePath)
      || /\.test\.[cm]?[jt]sx?$/.test(sourcePath)) {
      violations.push(`${name}: forbidden test source ${sourcePath}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Production bundle exposes forbidden Designer capability:\n${violations.join("\n")}`);
}

function chunkForSource(sourceSuffix) {
  for (const name of files.filter((entry) => entry.endsWith(".js.map"))) {
    const map = JSON.parse(readFileSync(new URL(name, assetsDirectory), "utf8"));
    if (map.sources?.some((source) => source.endsWith(sourceSuffix))) return name.replace(/\.map$/, "");
  }
  return undefined;
}

const simulatorChunk = chunkForSource("src/main.ts");
const catalogChunk = chunkForSource("src/catalog.ts");
const designerChunk = chunkForSource("src/features/designer/DesignerRoute.ts");
const motorGeneratorChunk = chunkForSource("packages/motor-designer/src/v2.ts");
const powerGeneratorChunk = chunkForSource("packages/power-designer/src/v2.ts");
const motorConstraintObservationChunk = chunkForSource("packages/motor-designer/src/v3.ts");
const powerConstraintObservationChunk = chunkForSource("packages/power-designer/src/v3.ts");
const productionExportChunk = chunkForSource("packages/design-export/src/production-artifact-v2.ts");
const applicationsChunk = chunkForSource("src/features/designer/applications.ts");
const customizedTargetArtifactRuntimeChunk = chunkForSource(
  "src/features/designer/PrimaryPartCustomizedArtifactRuntime.ts",
);
const customizedTargetExportChunk = chunkForSource(
  "packages/design-export/src/primary-part-customized-artifact-v1.ts",
);
const installedCustomizedTargetOwnerChunk = chunkForSource(
  "packages/design-export/src/primary-part-customized-installed-artifact-v1.ts",
);
const customizedTargetInspectionReceiptChunk = chunkForSource(
  "packages/design-export/src/customized-target-inspection-receipt-v1.ts",
);
const sourcingRequestPacketChunk = chunkForSource(
  "packages/sourcing-schema/src/request-packet-v1.ts",
);
if (!simulatorChunk || !catalogChunk || !designerChunk || simulatorChunk === catalogChunk) {
  throw new Error("Production Simulator and reviewed model catalog must remain separate chunks.");
}
if (!motorGeneratorChunk || motorGeneratorChunk === designerChunk) {
  throw new Error("Production Motor generation must remain in its own lazy chunk.");
}
if (!powerGeneratorChunk || powerGeneratorChunk === designerChunk || powerGeneratorChunk === motorGeneratorChunk) {
  throw new Error("Production Power generation must remain in its own lazy chunk.");
}
if (
  !motorConstraintObservationChunk
  || motorConstraintObservationChunk === designerChunk
  || motorConstraintObservationChunk === motorGeneratorChunk
) {
  throw new Error("Installed Motor V3 constraint observation must remain in its own lazy chunk.");
}
if (
  !powerConstraintObservationChunk
  || powerConstraintObservationChunk === designerChunk
  || powerConstraintObservationChunk === powerGeneratorChunk
  || powerConstraintObservationChunk === motorConstraintObservationChunk
) {
  throw new Error("Installed Power V3 constraint observation must remain in its own lazy chunk.");
}
if (
  !productionExportChunk
  || productionExportChunk === designerChunk
  || productionExportChunk === motorGeneratorChunk
  || productionExportChunk === powerGeneratorChunk
) {
  throw new Error("Production context-bound exports must remain in their own lazy chunk.");
}
if (
  !customizedTargetArtifactRuntimeChunk
  || !customizedTargetExportChunk
  || !applicationsChunk
  || customizedTargetExportChunk !== customizedTargetArtifactRuntimeChunk
) {
  throw new Error(
    "Customized-target BOM/SVG replay must remain private to the guarded artifact runtime chunk.",
  );
}
if (
  !installedCustomizedTargetOwnerChunk
  || installedCustomizedTargetOwnerChunk !== customizedTargetArtifactRuntimeChunk
) {
  throw new Error(
    "Installed customized-target contextual authority must be private to the guarded artifact runtime chunk.",
  );
}
if (
  !customizedTargetInspectionReceiptChunk
  || customizedTargetInspectionReceiptChunk !== customizedTargetArtifactRuntimeChunk
) {
  throw new Error("Customized-target inspection receipt authority must remain private to the guarded artifact runtime chunk.");
}
if (
  !sourcingRequestPacketChunk
  || sourcingRequestPacketChunk === designerChunk
  || sourcingRequestPacketChunk === motorGeneratorChunk
  || sourcingRequestPacketChunk === powerGeneratorChunk
  || sourcingRequestPacketChunk === motorConstraintObservationChunk
  || sourcingRequestPacketChunk === powerConstraintObservationChunk
  || sourcingRequestPacketChunk === productionExportChunk
  || sourcingRequestPacketChunk === customizedTargetArtifactRuntimeChunk
) {
  throw new Error("Provider-neutral sourcing request packets must remain in their own lazy chunk.");
}
const simulatorSource = readFileSync(new URL(simulatorChunk, assetsDirectory), "utf8");
if (!/import\(["']\.\/catalog-[^"']+\.js["']\)/.test(simulatorSource)) {
  throw new Error("Production model catalog must remain behind a dynamic import boundary.");
}
const maximumEagerSimulatorBytes = 512 * 1024;
if (Buffer.byteLength(simulatorSource) > maximumEagerSimulatorBytes) {
  throw new Error(`Production Simulator chunk exceeds ${maximumEagerSimulatorBytes} bytes before its lazy catalog.`);
}
const designerSource = readFileSync(new URL(designerChunk, assetsDirectory), "utf8");
const maximumDesignerBytes = 256 * 1024;
if (Buffer.byteLength(designerSource) > maximumDesignerBytes) {
  throw new Error(`Production Designer chunk exceeds ${maximumDesignerBytes} bytes.`);
}
const motorGeneratorSource = readFileSync(new URL(motorGeneratorChunk, assetsDirectory), "utf8");
const maximumMotorGeneratorBytes = 1024 * 1024;
if (Buffer.byteLength(motorGeneratorSource) > maximumMotorGeneratorBytes) {
  throw new Error(`Production Motor generator chunk exceeds ${maximumMotorGeneratorBytes} bytes.`);
}
const powerGeneratorSource = readFileSync(new URL(powerGeneratorChunk, assetsDirectory), "utf8");
const maximumPowerGeneratorBytes = 1024 * 1024;
if (Buffer.byteLength(powerGeneratorSource) > maximumPowerGeneratorBytes) {
  throw new Error(`Production Power generator chunk exceeds ${maximumPowerGeneratorBytes} bytes.`);
}

function staticChunkImports(chunkName) {
  const source = readFileSync(new URL(chunkName, assetsDirectory), "utf8");
  return [
    ...source.matchAll(/from["']\.\/([^"']+\.js)["']/g),
    ...source.matchAll(/import["']\.\/([^"']+\.js)["']/g),
  ].map((match) => match[1]);
}

function dynamicChunkImports(chunkName) {
  const source = readFileSync(new URL(chunkName, assetsDirectory), "utf8");
  return [...source.matchAll(/import\(["']\.\/([^"']+\.js)["']\)/g)]
    .map((match) => match[1]);
}

function reachableChunkClosure(rootChunk) {
  const reachable = new Set();
  const pending = [rootChunk];
  while (pending.length > 0) {
    const chunk = pending.pop();
    if (reachable.has(chunk)) continue;
    if (!files.includes(chunk)) {
      throw new Error(`${rootChunk} statically imports missing production chunk ${chunk}.`);
    }
    reachable.add(chunk);
    pending.push(...staticChunkImports(chunk));
  }
  return [...reachable].sort();
}

function closureEvidence(rootChunk) {
  const chunks = reachableChunkClosure(rootChunk);
  const sourceMaps = chunks.map((chunk) => ({
    chunk,
    map: JSON.parse(readFileSync(new URL(`${chunk}.map`, assetsDirectory), "utf8")),
  }));
  return {
    chunks,
    bytes: chunks.reduce(
      (total, chunk) => total + Buffer.byteLength(readFileSync(new URL(chunk, assetsDirectory), "utf8")),
      0,
    ),
    emittedSource: chunks
      .map((chunk) => readFileSync(new URL(chunk, assetsDirectory), "utf8"))
      .join("\n"),
    sources: sourceMaps.flatMap(({ map }) => map.sources ?? []),
    sourceMaps,
  };
}

function sourceContentForSuffix(evidence, sourceSuffix) {
  const matches = evidence.sourceMaps.flatMap(({ chunk, map }) => (map.sources ?? []).flatMap((sourcePath, index) => (
    sourcePath.endsWith(sourceSuffix)
      ? [{ chunk, content: map.sourcesContent?.[index] }]
      : []
  )));
  if (matches.length !== 1 || typeof matches[0].content !== "string") {
    throw new Error(`${evidence.chunks[0]} closure must include exactly one source ${sourceSuffix}.`);
  }
  return matches[0].content;
}

function relativeModuleImports(source) {
  return [...source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)]
    .map((match) => match[1])
    .sort();
}

const motorEvidence = closureEvidence(motorGeneratorChunk);
const powerEvidence = closureEvidence(powerGeneratorChunk);
const motorConstraintObservationEvidence = closureEvidence(motorConstraintObservationChunk);
const powerConstraintObservationEvidence = closureEvidence(powerConstraintObservationChunk);
const productionExportEvidence = closureEvidence(productionExportChunk);
const applicationsEvidence = closureEvidence(applicationsChunk);
const customizedTargetArtifactRuntimeEvidence = closureEvidence(customizedTargetArtifactRuntimeChunk);
const sourcingRequestPacketEvidence = closureEvidence(sourcingRequestPacketChunk);
const customizedTargetPrivateClosureSourceMaps = customizedTargetArtifactRuntimeEvidence.sourceMaps
  .filter(({ chunk }) => !applicationsEvidence.chunks.includes(chunk));
const customizedTargetPrivateClosureEvidence = {
  chunks: customizedTargetPrivateClosureSourceMaps.map(({ chunk }) => chunk),
  emittedSource: customizedTargetPrivateClosureSourceMaps
    .map(({ chunk }) => readFileSync(new URL(chunk, assetsDirectory), "utf8"))
    .join("\n"),
  sources: customizedTargetPrivateClosureSourceMaps.flatMap(({ map }) => map.sources ?? []),
  sourceMaps: customizedTargetPrivateClosureSourceMaps,
};
const maximumGeneratorClosureBytes = 2 * 1024 * 1024;
const maximumProductionExportClosureBytes = 2 * 1024 * 1024;
const maximumCustomizedTargetArtifactRuntimeClosureBytes = 2 * 1024 * 1024;
const maximumSourcingRequestPacketClosureBytes = 64 * 1024;
if (motorEvidence.bytes > maximumGeneratorClosureBytes) {
  throw new Error(`Production Motor generator closure exceeds ${maximumGeneratorClosureBytes} bytes.`);
}
if (powerEvidence.bytes > maximumGeneratorClosureBytes) {
  throw new Error(`Production Power generator closure exceeds ${maximumGeneratorClosureBytes} bytes.`);
}
if (motorConstraintObservationEvidence.bytes > maximumGeneratorClosureBytes) {
  throw new Error(`Installed Motor V3 constraint-observation closure exceeds ${maximumGeneratorClosureBytes} bytes.`);
}
if (powerConstraintObservationEvidence.bytes > maximumGeneratorClosureBytes) {
  throw new Error(`Installed Power V3 constraint-observation closure exceeds ${maximumGeneratorClosureBytes} bytes.`);
}
if (productionExportEvidence.bytes > maximumProductionExportClosureBytes) {
  throw new Error(`Production export closure exceeds ${maximumProductionExportClosureBytes} bytes.`);
}
if (customizedTargetArtifactRuntimeEvidence.bytes > maximumCustomizedTargetArtifactRuntimeClosureBytes) {
  throw new Error(
    `Guarded customized-target artifact runtime closure exceeds ${maximumCustomizedTargetArtifactRuntimeClosureBytes} bytes.`,
  );
}
if (sourcingRequestPacketEvidence.bytes > maximumSourcingRequestPacketClosureBytes) {
  throw new Error(
    `Sourcing request packet closure exceeds ${maximumSourcingRequestPacketClosureBytes} bytes.`,
  );
}

for (const [label, evidence] of [
  ["Designer", closureEvidence(designerChunk)],
  ["Designer applications", applicationsEvidence],
  ["Motor generator", motorEvidence],
  ["Power generator", powerEvidence],
  ["Motor V3 observation", motorConstraintObservationEvidence],
  ["Power V3 observation", powerConstraintObservationEvidence],
  ["ordinary production export", productionExportEvidence],
  ["sourcing request", sourcingRequestPacketEvidence],
]) {
  if (evidence.chunks.includes(customizedTargetArtifactRuntimeChunk)) {
    throw new Error(`${label} must not statically reach the guarded customized-target artifact runtime root.`);
  }
}
for (const [label, rootChunk] of [
  ["Designer", designerChunk],
  ["Motor generator", motorGeneratorChunk],
  ["Power generator", powerGeneratorChunk],
  ["Motor V3 observation", motorConstraintObservationChunk],
  ["Power V3 observation", powerConstraintObservationChunk],
  ["ordinary production export", productionExportChunk],
  ["sourcing request", sourcingRequestPacketChunk],
]) {
  if (customizedTargetArtifactRuntimeEvidence.chunks.includes(rootChunk)) {
    throw new Error(`Guarded customized-target artifact runtime must not statically reach the ${label} root.`);
  }
}
if (!customizedTargetArtifactRuntimeEvidence.chunks.includes(applicationsChunk)) {
  throw new Error(
    "Guarded customized-target artifact runtime must retain only its intentional read-only applications back-edge.",
  );
}

for (const [label, evidence] of [
  ["Designer", closureEvidence(designerChunk)],
  ["Motor generator", motorEvidence],
  ["Power generator", powerEvidence],
  ["Motor V3 observation", motorConstraintObservationEvidence],
  ["Power V3 observation", powerConstraintObservationEvidence],
  ["ordinary production export", productionExportEvidence],
  ["guarded customized-target artifact runtime", customizedTargetArtifactRuntimeEvidence],
]) {
  if (evidence.chunks.includes(sourcingRequestPacketChunk)) {
    throw new Error(`${label} must not statically reach the sourcing request packet root.`);
  }
}
for (const [label, rootChunk] of [
  ["Designer", designerChunk],
  ["Motor generator", motorGeneratorChunk],
  ["Power generator", powerGeneratorChunk],
  ["Motor V3 observation", motorConstraintObservationChunk],
  ["Power V3 observation", powerConstraintObservationChunk],
  ["ordinary production export", productionExportChunk],
  ["Designer applications", applicationsChunk],
  ["guarded customized-target artifact runtime", customizedTargetArtifactRuntimeChunk],
]) {
  if (sourcingRequestPacketEvidence.chunks.includes(rootChunk)) {
    throw new Error(`Sourcing request packet closure must not statically reach the ${label} root.`);
  }
}

const standaloneRawCustomizedTargetAuthorityAssets = files.filter((entry) => (
  /(?:^|-)(?:primary-part-customized-(?:installed-)?artifact-v1|customized-target-inspection-receipt-v1)(?:-|\.)/.test(entry)
));
const installedCustomizedTargetRuntimeExports = files
  .filter((entry) => entry.endsWith(".js"))
  .filter((entry) => {
    const emittedSource = readFileSync(new URL(entry, assetsDirectory), "utf8");
    return emittedSource.includes("_exportPrimaryPartCustomizedInstalledArtifactV1")
      || emittedSource.includes("_verifyPrimaryPartCustomizedInstalledArtifactV1");
  });
if (
  standaloneRawCustomizedTargetAuthorityAssets.length !== 0
  || installedCustomizedTargetRuntimeExports.length !== 0
) {
  throw new Error(
    "Installed customized-target contextual authority must have no standalone asset or named runtime export.",
  );
}
const customizedTargetArtifactRuntimeDynamicImporters = files
  .filter((entry) => entry.endsWith(".js"))
  .filter((entry) => dynamicChunkImports(entry).includes(customizedTargetArtifactRuntimeChunk));
const customizedTargetArtifactRuntimeStaticImporters = files
  .filter((entry) => entry.endsWith(".js"))
  .filter((entry) => staticChunkImports(entry).includes(customizedTargetArtifactRuntimeChunk));
if (
  applicationsChunk === customizedTargetArtifactRuntimeChunk
  || customizedTargetArtifactRuntimeDynamicImporters.length !== 1
  || customizedTargetArtifactRuntimeDynamicImporters[0] !== applicationsChunk
  || customizedTargetArtifactRuntimeStaticImporters.length !== 0
  || dynamicChunkImports(customizedTargetArtifactRuntimeChunk).length !== 0
) {
  throw new Error(
    "Only Designer applications may dynamically import the guarded customized-target artifact runtime, which must have no other importer or outgoing dynamic edge.",
  );
}
const sourcingRequestPacketDynamicImporters = files
  .filter((entry) => entry.endsWith(".js"))
  .filter((entry) => dynamicChunkImports(entry).includes(sourcingRequestPacketChunk))
  .sort();
const expectedSourcingRequestPacketDynamicImporters = [applicationsChunk, designerChunk]
  .filter((entry) => entry !== undefined)
  .filter((entry, index, entries) => entries.indexOf(entry) === index)
  .sort();
if (
  !applicationsChunk
  || applicationsChunk === sourcingRequestPacketChunk
  || designerChunk === sourcingRequestPacketChunk
  || JSON.stringify(sourcingRequestPacketDynamicImporters)
    !== JSON.stringify(expectedSourcingRequestPacketDynamicImporters)
) {
  throw new Error(
    "Only the exact installed Designer application boundary and route verifier may dynamically import the sourcing request packet root.",
  );
}
if (
  JSON.stringify(sourcingRequestPacketEvidence.chunks)
  !== JSON.stringify([sourcingRequestPacketChunk])
  || sourcingRequestPacketEvidence.chunks.some((chunk) => dynamicChunkImports(chunk).length !== 0)
) {
  throw new Error(
    "The sourcing request packet root must be a one-chunk static leaf with no outgoing dynamic imports.",
  );
}
const designerRouteSource = sourceContentForSuffix(
  closureEvidence(designerChunk),
  "src/features/designer/DesignerRoute.ts",
);
const sourcingRequestTransferSource = sourceContentForSuffix(
  closureEvidence(designerChunk),
  "src/features/designer/SourcingRequestTransfer.ts",
);
const installedApplicationsSource = sourceContentForSuffix(
  applicationsEvidence,
  "src/features/designer/applications.ts",
);
const exactRouteVerifierCall = "await verifyExactSourcingRequestPacketArtifactV1(artifact, exactInput)";
const routeVerifierIndex = designerRouteSource.indexOf(exactRouteVerifierCall);
const routeAfterVerifier = routeVerifierIndex === -1
  ? ""
  : designerRouteSource.slice(routeVerifierIndex + exactRouteVerifierCall.length);
const staleRouteCheckIndex = routeAfterVerifier.indexOf("epoch !== this.#sourcingRequestEpoch");
const routeDownloadIndex = routeAfterVerifier.indexOf("download(artifact.filename, artifact.content, artifact.mimeType)");
const routeAuthorityBeforeDownload = routeDownloadIndex === -1
  ? ""
  : routeAfterVerifier.slice(0, routeDownloadIndex);
if (
  routeVerifierIndex === -1
  || staleRouteCheckIndex === -1
  || routeDownloadIndex === -1
  || staleRouteCheckIndex > routeDownloadIndex
  || [
    "this.#sourcingRequestBuildQuantity !== buildQuantity",
    "this.#sourcingRequestRegion !== region",
    "this.#sourcingRequestCurrency !== currency",
    "adapter.authorizesProductionGeneration?.(source) !== true",
  ].some((requiredCheck) => !routeAuthorityBeforeDownload.includes(requiredCheck))
) {
  throw new Error(
    "The Designer route must exact-verify packet bytes and recheck stale authority before download.",
  );
}
for (const requiredRouteVerifierContract of [
  '"@opencircuit/sourcing-schema/request-packet-v1"',
  "verifySourcingRequestPacketV1(artifact.content, exactInput)",
  "JSON.stringify(verified) !== presentedPacket",
]) {
  if (!sourcingRequestTransferSource.includes(requiredRouteVerifierContract)) {
    throw new Error(
      `The Designer sourcing request transfer verifier is missing ${requiredRouteVerifierContract}.`,
    );
  }
}
for (const requiredInstalledBoundaryContract of [
  "serializeSourcingRequestPacketV1(input)",
  "verifySourcingRequestPacketV1(content, input)",
  "if (!productionBoundary.authorizesProductionGeneration(source))",
  "serializeDesignResultV2(source.result) !== sourceResultBytesBefore",
  "JSON.stringify(policy) !== policyFingerprintBefore",
]) {
  if (!installedApplicationsSource.includes(requiredInstalledBoundaryContract)) {
    throw new Error(
      `The installed sourcing request application boundary is missing ${requiredInstalledBoundaryContract}.`,
    );
  }
}
for (const requiredInspectionReceiptBoundaryContract of [
  'await import("./PrimaryPartCustomizedArtifactRuntime")',
  "exportAuthorizedPrimaryPartCustomizedFileV1(",
  "verifyCustomizedTargetInspectionReceiptBytesV1(",
  "installedRuntime.assert(receipt.customizedResult, exactSource(source))",
  "receipt.customizedResult.source.candidateId !== sourceCandidateId",
  "authorizations.set(asserted",
]) {
  if (!installedApplicationsSource.includes(requiredInspectionReceiptBoundaryContract)) {
    throw new Error(
      `The installed customized-target inspection receipt boundary is missing ${requiredInspectionReceiptBoundaryContract}.`,
    );
  }
}
for (const requiredInstalledCustomizedTargetArtifactBoundaryContract of [
  'await import("./PrimaryPartCustomizedArtifactRuntime")',
  "const installedArtifactContext = isPrimaryPartCustomizedReplayableArtifactKindV1(kind)",
  ": installedRuntime.installedArtifactContext()",
  "...(installedArtifactContext === undefined ? {} : { installedArtifactContext })",
  "authorizePrimaryPartCustomizedFileRequestV1({",
  "exportAuthorizedPrimaryPartCustomizedFileV1(",
  "assertExportAuthorizationCurrent()",
]) {
  if (!installedApplicationsSource.includes(requiredInstalledCustomizedTargetArtifactBoundaryContract)) {
    throw new Error(
      `The installed customized-target contextual artifact boundary is missing ${requiredInstalledCustomizedTargetArtifactBoundaryContract}.`,
    );
  }
}
for (const forbiddenRawArtifactCall of [
  "_exportPrimaryPartCustomizedInstalledArtifactV1(",
  "_verifyPrimaryPartCustomizedInstalledArtifactV1(",
  "exportPrimaryPartCustomizedArtifactV1(",
  "createCustomizedTargetInspectionReceiptV1(",
  "parseCustomizedTargetInspectionReceiptV1Bytes(",
]) {
  if (installedApplicationsSource.includes(forbiddenRawArtifactCall)) {
    throw new Error(`Designer applications must not call raw customized-target authority ${forbiddenRawArtifactCall}.`);
  }
}
const restoreInspectionReceiptSource = installedApplicationsSource.slice(
  installedApplicationsSource.indexOf("async restoreInspectionReceipt("),
);
const receiptParseIndex = restoreInspectionReceiptSource.indexOf(
  "verifyCustomizedTargetInspectionReceiptBytesV1(",
);
const receiptInstalledAssertIndex = restoreInspectionReceiptSource.indexOf(
  "installedRuntime.assert(receipt.customizedResult, exactSource(source))",
);
const receiptFinalSourceCheckIndex = restoreInspectionReceiptSource.lastIndexOf(
  "productionBoundary.authorizesProductionGeneration(source)",
);
const receiptAuthorizationIndex = restoreInspectionReceiptSource.indexOf("authorizations.set(asserted");
const receiptReturnIndex = restoreInspectionReceiptSource.indexOf("return asserted;");
if (
  !restoreInspectionReceiptSource.startsWith("async restoreInspectionReceipt(")
  || receiptParseIndex === -1
  || receiptInstalledAssertIndex <= receiptParseIndex
  || receiptFinalSourceCheckIndex <= receiptInstalledAssertIndex
  || receiptAuthorizationIndex <= receiptFinalSourceCheckIndex
  || receiptReturnIndex <= receiptAuthorizationIndex
) {
  throw new Error(
    "The installed receipt replay must guarded-verify/replay, installed-assert, recheck source authority, and only then WeakMap-authorize the returned asserted object.",
  );
}

const customizedTargetArtifactRuntimeSource = sourceContentForSuffix(
  customizedTargetArtifactRuntimeEvidence,
  "src/features/designer/PrimaryPartCustomizedArtifactRuntime.ts",
);
const expectedCustomizedTargetRuntimeRelativeImports = [
  "../../../../../packages/design-export/src/customized-target-inspection-receipt-v1",
  "../../../../../packages/design-export/src/primary-part-customized-artifact-v1",
  "../../../../../packages/design-export/src/primary-part-customized-installed-artifact-v1",
  "./applications",
].sort();
const actualCustomizedTargetRuntimeRelativeImports = relativeModuleImports(
  customizedTargetArtifactRuntimeSource,
);
if (
  JSON.stringify(actualCustomizedTargetRuntimeRelativeImports)
  !== JSON.stringify(expectedCustomizedTargetRuntimeRelativeImports)
) {
  throw new Error(
    `Guarded customized-target artifact runtime contains an unexpected source import surface: ${actualCustomizedTargetRuntimeRelativeImports.join(", ")}`,
  );
}
const customizedTargetRuntimeOwnSources = customizedTargetArtifactRuntimeEvidence.sourceMaps
  .find(({ chunk }) => chunk === customizedTargetArtifactRuntimeChunk)?.map.sources ?? [];
const expectedCustomizedTargetRuntimeOwnSourceSuffixes = [
  "packages/design-export/src/customized-target-inspection-receipt-v1.ts",
  "packages/design-export/src/primary-part-customized-artifact-v1.ts",
  "packages/design-export/src/primary-part-customized-installed-artifact-v1.ts",
  "src/features/designer/PrimaryPartCustomizedArtifactRuntime.ts",
].sort();
const actualCustomizedTargetRuntimeOwnSourceSuffixes = customizedTargetRuntimeOwnSources
  .map((sourcePath) => expectedCustomizedTargetRuntimeOwnSourceSuffixes.find((suffix) => sourcePath.endsWith(suffix)))
  .filter((sourcePath) => sourcePath !== undefined)
  .sort();
if (
  customizedTargetRuntimeOwnSources.length !== expectedCustomizedTargetRuntimeOwnSourceSuffixes.length
  || JSON.stringify(actualCustomizedTargetRuntimeOwnSourceSuffixes)
    !== JSON.stringify(expectedCustomizedTargetRuntimeOwnSourceSuffixes)
) {
  throw new Error(
    `Guarded customized-target artifact root owns an unexpected source set: ${customizedTargetRuntimeOwnSources.join(", ")}`,
  );
}
const customizedTargetArtifactRuntimeEmittedSource = readFileSync(
  new URL(customizedTargetArtifactRuntimeChunk, assetsDirectory),
  "utf8",
);
const customizedTargetRuntimeExportStatements = [
  ...customizedTargetArtifactRuntimeEmittedSource.matchAll(/\bexport\{([^}]*)\}/g),
];
const customizedTargetRuntimeNamedExports = customizedTargetRuntimeExportStatements
  .flatMap((match) => match[1].split(","))
  .map((entry) => entry.trim().split(/\s+as\s+/).at(-1))
  .sort();
const expectedCustomizedTargetRuntimeNamedExports = [
  "exportAuthorizedPrimaryPartCustomizedFileV1",
  "verifyCustomizedTargetInspectionReceiptBytesV1",
].sort();
if (
  customizedTargetRuntimeExportStatements.length !== 1
  || JSON.stringify(customizedTargetRuntimeNamedExports)
    !== JSON.stringify(expectedCustomizedTargetRuntimeNamedExports)
) {
  throw new Error(
    `Guarded customized-target artifact runtime exposes unexpected ESM exports: ${customizedTargetRuntimeNamedExports.join(", ")}`,
  );
}
for (const requiredGuardedRuntimeContract of [
  "export function exportAuthorizedPrimaryPartCustomizedFileV1(",
  "export function verifyCustomizedTargetInspectionReceiptBytesV1(",
  "_consumeAuthorizedPrimaryPartCustomizedFileRequestV1(authorizationToken)",
  "_exportPrimaryPartCustomizedInstalledArtifactV1(",
  "_verifyPrimaryPartCustomizedInstalledArtifactV1(",
  "verifyCustomizedTargetInspectionReceiptV1(",
  "parseCustomizedTargetInspectionReceiptV1Bytes(receiptBytes)",
]) {
  if (!customizedTargetArtifactRuntimeSource.includes(requiredGuardedRuntimeContract)) {
    throw new Error(`Guarded customized-target artifact runtime is missing ${requiredGuardedRuntimeContract}.`);
  }
}
for (const requiredOneShotConsumerContract of [
  "const authorizedPrimaryPartCustomizedFileRequests = new WeakMap<",
  "function authorizePrimaryPartCustomizedFileRequestV1(",
  "export function _consumeAuthorizedPrimaryPartCustomizedFileRequestV1(",
  "authorizedPrimaryPartCustomizedFileRequests.delete(token)",
  "request.assertCurrent()",
]) {
  if (!installedApplicationsSource.includes(requiredOneShotConsumerContract)) {
    throw new Error(`Designer applications guarded artifact handoff is missing ${requiredOneShotConsumerContract}.`);
  }
}
if (
  installedApplicationsSource.includes("export function authorizePrimaryPartCustomizedFileRequestV1(")
  || customizedTargetArtifactRuntimeSource.includes("authorizedPrimaryPartCustomizedFileRequests.set(")
  || customizedTargetArtifactRuntimeSource.includes("authorizePrimaryPartCustomizedFileRequestV1(")
) {
  throw new Error("Guarded customized-target runtime must expose no registrar, setter, or token-minting capability.");
}

const expectedCustomizedTargetDesignExportSources = [
  "packages/design-export/src/bom-v2.ts",
  "packages/design-export/src/circuit-svg-v2.ts",
  "packages/design-export/src/csv-repeated-prefix-byte-limit-internal.ts",
  "packages/design-export/src/primary-part-customized-artifact-v1.ts",
].sort();
const customizedTargetMetadataSource = sourceContentForSuffix(
  customizedTargetArtifactRuntimeEvidence,
  "packages/design-export/src/primary-part-customized-artifact-v1.ts",
);
const expectedCustomizedTargetReplayableRelativeImports = [
  "./bom-v2",
  "./circuit-svg-v2",
  "./csv-repeated-prefix-byte-limit-internal",
].sort();
const actualCustomizedTargetReplayableRelativeImports = relativeModuleImports(customizedTargetMetadataSource);
if (
  JSON.stringify(actualCustomizedTargetReplayableRelativeImports)
  !== JSON.stringify(expectedCustomizedTargetReplayableRelativeImports)
) {
  throw new Error(
    `Customized-target BOM/SVG replay module contains an unexpected relative import surface: ${actualCustomizedTargetReplayableRelativeImports.join(", ")}`,
  );
}
for (const requiredSource of [
  ...expectedCustomizedTargetDesignExportSources,
  "packages/design-schema/src/primary-part-customization.ts",
  "packages/design-schema/src/primary-part-customized-result.ts",
  "packages/design-schema/src/v2-canonical.ts",
  "packages/design-schema/src/v2-result.ts",
  "packages/design-schema/src/v3-constraint.ts",
  "packages/design-schema/src/v3-constraint-types.ts",
]) {
  sourceContentForSuffix(customizedTargetArtifactRuntimeEvidence, requiredSource);
}

const expectedCustomizedTargetArtifactRuntimeDesignExportSources = [
  ...expectedCustomizedTargetDesignExportSources,
  "packages/design-export/src/customized-target-inspection-receipt-v1.ts",
  "packages/design-export/src/kicad-schematic-v2.ts",
  "packages/design-export/src/primary-part-customized-installed-artifact-v1.ts",
  "packages/design-export/src/printable-report-v2.ts",
  "packages/design-export/src/spice-v2.ts",
].sort();
const actualCustomizedTargetArtifactRuntimeDesignExportSources =
  customizedTargetArtifactRuntimeEvidence.sources
    .map((sourcePath) => {
      const packagePath = "packages/design-export/src/";
      const packageIndex = sourcePath.indexOf(packagePath);
      return packageIndex === -1 ? undefined : sourcePath.slice(packageIndex);
    })
    .filter((sourcePath) => sourcePath !== undefined)
    .sort();
if (
  JSON.stringify(actualCustomizedTargetArtifactRuntimeDesignExportSources)
  !== JSON.stringify(expectedCustomizedTargetArtifactRuntimeDesignExportSources)
) {
  throw new Error(
    `Guarded customized-target artifact runtime closure contains an unexpected design-export surface: ${actualCustomizedTargetArtifactRuntimeDesignExportSources.join(", ")}`,
  );
}
for (const requiredSource of [
  ...expectedCustomizedTargetArtifactRuntimeDesignExportSources,
  "packages/circuit-schema/src/v2-netlist.ts",
  "packages/design-engine/src/v2-context.ts",
  "packages/design-engine/src/v2-generate.ts",
  "packages/design-engine/src/v2-types.ts",
  "packages/design-schema/src/primary-part-customization.ts",
  "packages/design-schema/src/primary-part-customized-result.ts",
  "packages/design-schema/src/v2-canonical.ts",
  "packages/design-schema/src/v2-result.ts",
  "packages/design-schema/src/v3-constraint.ts",
  "packages/design-schema/src/v3-constraint-types.ts",
]) {
  sourceContentForSuffix(customizedTargetArtifactRuntimeEvidence, requiredSource);
}
const customizedTargetInstalledArtifactSource = sourceContentForSuffix(
  customizedTargetArtifactRuntimeEvidence,
  "packages/design-export/src/primary-part-customized-installed-artifact-v1.ts",
);
const customizedTargetSpiceSeamSource = sourceContentForSuffix(
  customizedTargetArtifactRuntimeEvidence,
  "packages/design-export/src/spice-v2.ts",
);
for (const requiredContract of [
  "PrimaryPartCustomizedInstalledRenderContextV1",
  "_exportPrimaryPartCustomizedInstalledArtifactV1",
  "_verifyPrimaryPartCustomizedInstalledArtifactV1",
  "_renderCandidatePrintableReportV2FromProjection",
  "_renderCandidateKicadSchematicV2FromProjection",
  "_renderBehavioralScenarioSpiceV2FromProjection",
  "candidate.circuit.defaultScenarioId",
  "generated.omissions.length !== 0",
  "projection.scenario.omissionCount !== 0",
]) {
  if (!customizedTargetInstalledArtifactSource.includes(requiredContract)) {
    throw new Error(`Installed customized-target contextual artifact source is missing ${requiredContract}.`);
  }
}
if (customizedTargetInstalledArtifactSource.includes("allowIncomplete")) {
  throw new Error("Installed customized-target contextual artifacts must not expose an incomplete SPICE bypass.");
}
for (const requiredMetadataContract of [
  "_primaryPartCustomizedArtifactMetadataForV1",
  "_parsePrimaryPartCustomizedResultForArtifactV1",
  "_assertPrimaryPartCustomizedArtifactByteLimitV1",
  'simulationExecution: "not_performed"',
  'externalKicadOpenVerification: "unverified"',
  'commercialAuthority: "not_added"',
  'releaseAuthority: "not_added"',
]) {
  if (!customizedTargetMetadataSource.includes(requiredMetadataContract)) {
    throw new Error(`Customized-target metadata helper source is missing ${requiredMetadataContract}.`);
  }
}
const customizedTargetSpiceSeamStart = customizedTargetSpiceSeamSource.indexOf(
  "export function _assertBehavioralScenarioSpiceGateV2(",
);
const customizedTargetSpiceSeamEnd = customizedTargetSpiceSeamSource.indexOf(
  "export function exportDesignResultScenarioSpiceV2(",
  customizedTargetSpiceSeamStart,
);
const customizedTargetSpiceSeam = customizedTargetSpiceSeamStart === -1
  || customizedTargetSpiceSeamEnd <= customizedTargetSpiceSeamStart
  ? ""
  : customizedTargetSpiceSeamSource.slice(customizedTargetSpiceSeamStart, customizedTargetSpiceSeamEnd);
for (const requiredSpiceSeamContract of [
  "scenarioId !== candidate.circuit.defaultScenarioId",
  "coverage.length !== 1",
  'coverage[0]!.modelTier !== "behavioral"',
  "_assertBehavioralScenarioSpiceGateV2(candidate, scenarioId)",
  "generateScenarioNetlist(candidate.circuit, scenarioId",
  "generated.omissions.length !== 0",
  'coverageTier: "behavioral" as const',
  "omissionCount: 0 as const",
]) {
  if (!customizedTargetSpiceSeam.includes(requiredSpiceSeamContract)) {
    throw new Error(`Customized-target behavioral SPICE seam is missing ${requiredSpiceSeamContract}.`);
  }
}
if (customizedTargetSpiceSeam.includes("allowIncomplete")) {
  throw new Error("Customized-target behavioral SPICE seam must not expose an incomplete-mode option.");
}
const forbiddenCustomizedTargetInstalledArtifactSourceRules = [
  /\/(?:test|tests|fixtures)\//,
  /\/fixtures(?:\.ts|\/)/,
  /\.test\.[cm]?[jt]sx?$/,
  /packages\/design-engine\/src\/(?:index|v2-installed-all|commercial|commercial-types)\.ts$/,
  /packages\/design-recipes\//,
  /packages\/(?:motor|power)-designer\//,
  /packages\/sim-engine\//,
  /packages\/sourcing-(?:core|providers?)\//,
  /\/(?:provider|providers|service|services)(?:\.ts|\/)/,
];
for (const sourcePath of customizedTargetPrivateClosureEvidence.sources) {
  if (forbiddenCustomizedTargetInstalledArtifactSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(
      `${installedCustomizedTargetOwnerChunk} closure: forbidden installed customized-target contextual artifact source ${sourcePath}`,
    );
  }
}
const expectedCustomizedTargetInstalledArtifactSourcingSchemaSources = [
  "packages/sourcing-schema/src/commercial-primitives-v2.ts",
  "packages/sourcing-schema/src/ids.ts",
  "packages/sourcing-schema/src/metrics.ts",
  "packages/sourcing-schema/src/migration-v2.ts",
  "packages/sourcing-schema/src/policy.ts",
  "packages/sourcing-schema/src/v2.ts",
  "packages/sourcing-schema/src/validation-v2.ts",
  "packages/sourcing-schema/src/validation.ts",
].sort();
const actualCustomizedTargetInstalledArtifactSourcingSchemaSources =
  customizedTargetArtifactRuntimeEvidence.sources
    .map((sourcePath) => {
      const packagePath = "packages/sourcing-schema/src/";
      const packageIndex = sourcePath.indexOf(packagePath);
      return packageIndex === -1 ? undefined : sourcePath.slice(packageIndex);
    })
    .filter((sourcePath) => sourcePath !== undefined)
    .sort();
if (
  JSON.stringify(actualCustomizedTargetInstalledArtifactSourcingSchemaSources)
  !== JSON.stringify(expectedCustomizedTargetInstalledArtifactSourcingSchemaSources)
) {
  throw new Error(
    `Installed customized-target contextual artifact closure contains unexpected sourcing-schema code: ${actualCustomizedTargetInstalledArtifactSourcingSchemaSources.join(", ")}`,
  );
}
const customizedTargetPrivateNetworkSurfaces = [
  ["guarded runtime root", customizedTargetArtifactRuntimeEmittedSource],
  ["guarded runtime closure excluding exact applications closure", customizedTargetPrivateClosureEvidence.emittedSource],
].map(([label, source]) => [label, source.replaceAll("http://www.w3.org/2000/svg", "")]);
for (const forbiddenCapability of [
  /\bfetch\s*\(/u,
  /\bXMLHttpRequest\b/u,
  /\bWebSocket\b/u,
  /\bEventSource\b/u,
  /\bsendBeacon\s*\(/u,
  /\bimportScripts\s*\(/u,
]) {
  for (const [label, source] of customizedTargetPrivateNetworkSurfaces) {
    if (forbiddenCapability.test(source)) {
      violations.push(
        `${customizedTargetArtifactRuntimeChunk} ${label}: forbidden network/provider capability ${forbiddenCapability}`,
      );
    }
  }
}

const customizedTargetInspectionReceiptSource = sourceContentForSuffix(
  customizedTargetArtifactRuntimeEvidence,
  "packages/design-export/src/customized-target-inspection-receipt-v1.ts",
);
const customizedTargetInspectionReceiptRelativeImports = relativeModuleImports(
  customizedTargetInspectionReceiptSource,
);
if (
  JSON.stringify(customizedTargetInspectionReceiptRelativeImports)
  !== JSON.stringify(["./primary-part-customized-artifact-v1"])
) {
  throw new Error(
    `Customized-target inspection receipt contains an unexpected relative import surface: ${customizedTargetInspectionReceiptRelativeImports.join(", ")}`,
  );
}
for (const requiredContract of [
  'purpose: "inspection_only"',
  'artifactReplay: "required"',
  'parseAndSelfHash: "integrity_only"',
  'installedContextAuthority: "not_conferred"',
  'attestation: "none"',
  'new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })',
  "verifyCustomizedTargetInspectionReceiptV1",
  "exportPrimaryPartCustomizedArtifactV1(customizedResult, kind)",
]) {
  if (!customizedTargetInspectionReceiptSource.includes(requiredContract)) {
    throw new Error(`Customized-target inspection receipt source is missing ${requiredContract}.`);
  }
}
for (const forbiddenInstalledReceiptKind of [
  "customized_target_engineering_report_html",
  "customized_target_structural_kicad",
  "customized_target_behavioral_scenario_spice",
]) {
  if (customizedTargetInspectionReceiptSource.includes(forbiddenInstalledReceiptKind)) {
    throw new Error(`Customized-target inspection receipt must remain exactly two-kind; found ${forbiddenInstalledReceiptKind}.`);
  }
}

const expectedSourcingRequestPacketSources = [
  "packages/sourcing-schema/src/canonical.ts",
  "packages/sourcing-schema/src/request-packet-v1.ts",
].sort();
const actualSourcingRequestPacketSources = sourcingRequestPacketEvidence.sources
  .map((sourcePath) => (
    expectedSourcingRequestPacketSources.find((expectedSource) => sourcePath.endsWith(expectedSource))
    ?? sourcePath
  ))
  .sort();
if (
  JSON.stringify(actualSourcingRequestPacketSources)
  !== JSON.stringify(expectedSourcingRequestPacketSources)
) {
  throw new Error(
    `Sourcing request packet closure contains an unexpected sourcing-schema surface: ${actualSourcingRequestPacketSources.join(", ")}`,
  );
}
for (const requiredSource of expectedSourcingRequestPacketSources) {
  sourceContentForSuffix(sourcingRequestPacketEvidence, requiredSource);
}
const sourcingRequestPacketSource = sourceContentForSuffix(
  sourcingRequestPacketEvidence,
  "packages/sourcing-schema/src/request-packet-v1.ts",
);
for (const requiredContract of [
  "verifySourcingRequestPacketV1",
  'purpose: "provider_neutral_sourcing_request"',
  'providerSelection: "not_included"',
  'providerAccess: "not_authorized"',
]) {
  if (!sourcingRequestPacketSource.includes(requiredContract)) {
    throw new Error(`Sourcing request packet source is missing ${requiredContract}.`);
  }
}
const forbiddenSourcingRequestPacketSourceRules = [
  /\/(?:test|tests|fixtures)\//,
  /\.test\.[cm]?[jt]sx?$/,
  /apps\/sourcing-service\//,
  /packages\/sourcing-core\//,
  /packages\/design-(?:engine|export|recipes)\//,
  /packages\/(?:motor|power)-designer\//,
  /packages\/sim-engine\//,
  /\/(?:provider|providers|service|services)(?:\.ts|\/)/,
];
for (const sourcePath of sourcingRequestPacketEvidence.sources) {
  if (forbiddenSourcingRequestPacketSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(`${sourcingRequestPacketChunk} closure: forbidden sourcing request source ${sourcePath}`);
  }
}
for (const forbiddenCapability of [
  /\bfetch\s*\(/u,
  /\bXMLHttpRequest\b/u,
  /\bWebSocket\b/u,
  /\bEventSource\b/u,
  /\bsendBeacon\s*\(/u,
  /\bimportScripts\s*\(/u,
  /https?:\/\//u,
]) {
  if (forbiddenCapability.test(sourcingRequestPacketEvidence.emittedSource)) {
    violations.push(`${sourcingRequestPacketChunk} closure: forbidden network/provider capability ${forbiddenCapability}`);
  }
}

for (const requiredSource of [
  "packages/design-export/src/production-artifact-v2.ts",
  "packages/design-export/src/bom-v2.ts",
  "packages/design-export/src/circuit-svg-v2.ts",
  "packages/design-export/src/csv-repeated-prefix-byte-limit-internal.ts",
  "packages/design-export/src/printable-report-v2.ts",
  "packages/design-export/src/kicad-schematic-v2.ts",
  "packages/design-export/src/spice-v2.ts",
  "packages/design-engine/src/v2-generate.ts",
]) {
  sourceContentForSuffix(productionExportEvidence, requiredSource);
}
const forbiddenProductionExportSourceRules = [
  /\/(?:test|tests|fixtures)\//,
  /\.test\.[cm]?[jt]sx?$/,
  /packages\/design-engine\/src\/(?:index|v2-installed-all|commercial|commercial-types)\.ts$/,
  /packages\/design-export\/src\/(?:index|commercial-v2|simulation-csv-v2)\.ts$/,
  /packages\/design-recipes\//,
  /packages\/(?:motor|power)-designer\//,
  /packages\/sim-engine\//,
  /packages\/sourcing-(?:core|providers?)\//,
  /\/(?:provider|providers)\//,
];
for (const sourcePath of productionExportEvidence.sources) {
  if (forbiddenProductionExportSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(`${productionExportChunk} closure: forbidden production export source ${sourcePath}`);
  }
}

const forbiddenMotorSourceRules = [
  /packages\/design-library\/src\/(?:bundled-release|fixtures|index)\.ts$/,
  /packages\/design-engine\/src\/(?:index|v2-installed-all|commercial|commercial-types)\.ts$/,
  /packages\/design-recipes\/src\/(?:index|power(?:-[^/]+)?)\.ts$/,
  /packages\/sourcing-(?:core|providers?)\//,
  /\/(?:provider|providers)\//,
];
for (const sourcePath of motorEvidence.sources) {
  if (forbiddenMotorSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(`${motorGeneratorChunk} closure: forbidden Motor runtime source ${sourcePath}`);
  }
}
const forbiddenPowerSourceRules = [
  /packages\/design-library\/src\/(?:bundled-release|fixtures|index)\.ts$/,
  /packages\/design-engine\/src\/(?:index|v2-installed-all|commercial|commercial-types)\.ts$/,
  /packages\/design-recipes\/src\/(?:index|motor(?:-[^/]+)?)\.ts$/,
  /packages\/motor-designer\/src\/(?!(?:v2-status|v3-status)\.ts$)/,
  /packages\/sourcing-(?:core|providers?)\//,
  /\/(?:provider|providers)\//,
];
sourceContentForSuffix(powerEvidence, "packages/design-recipes/src/power-external-v3.ts");
for (const sourcePath of powerEvidence.sources) {
  if (forbiddenPowerSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(`${powerGeneratorChunk} closure: forbidden Power runtime source ${sourcePath}`);
  }
}

const forbiddenMotorConstraintObservationSourceRules = [
  /\/(?:test|tests|fixtures)\//,
  /\.test\.[cm]?[jt]sx?$/,
  /packages\/design-recipes\/src\/(?:production-constraint-policies-v3|power-constraint-policy-engine-internal)\.ts$/,
  /packages\/power-designer\/src\/(?!v[23]-status\.ts$)/,
  /packages\/sourcing-(?:core|providers?)\//,
  /\/(?:provider|providers)\//,
];
for (const sourcePath of motorConstraintObservationEvidence.sources) {
  if (forbiddenMotorConstraintObservationSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(`${motorConstraintObservationChunk} closure: forbidden Motor V3 observation source ${sourcePath}`);
  }
}
const forbiddenPowerConstraintObservationSourceRules = [
  /\/(?:test|tests|fixtures)\//,
  /\.test\.[cm]?[jt]sx?$/,
  /packages\/design-recipes\/src\/(?:production-constraint-policies-v3|motor-constraint-policy-engine-internal)\.ts$/,
  /packages\/motor-designer\/src\/(?!v[23]-status\.ts$)/,
  /packages\/sourcing-(?:core|providers?)\//,
  /\/(?:provider|providers)\//,
];
for (const sourcePath of powerConstraintObservationEvidence.sources) {
  if (forbiddenPowerConstraintObservationSourceRules.some((pattern) => pattern.test(sourcePath))) {
    violations.push(`${powerConstraintObservationChunk} closure: forbidden Power V3 observation source ${sourcePath}`);
  }
}
if (violations.length > 0) {
  throw new Error(`Production Designer generator bundles are not isolated:\n${violations.join("\n")}`);
}

for (const [label, evidence, requiredSources] of [
  ["Motor", motorConstraintObservationEvidence, [
    "packages/motor-designer/src/v3.ts",
    "packages/design-engine/src/v3-motor-runtime.ts",
    "packages/design-engine/src/v3-constraint-sidecar.ts",
    "packages/design-recipes/src/motor-constraint-policy-engine-internal.ts",
    "packages/design-recipes/src/production-constraint-policy-v3-common.ts",
  ]],
  ["Power", powerConstraintObservationEvidence, [
    "packages/power-designer/src/v3.ts",
    "packages/design-engine/src/v3-power-runtime.ts",
    "packages/design-engine/src/v3-constraint-sidecar.ts",
    "packages/design-recipes/src/power-constraint-policy-engine-internal.ts",
    "packages/design-recipes/src/production-constraint-policy-v3-common.ts",
  ]],
]) {
  for (const requiredSource of requiredSources) sourceContentForSuffix(evidence, requiredSource);
  if (evidence.sources.some((sourcePath) => sourcePath.endsWith("packages/design-recipes/src/production-constraint-policies-v3.ts"))) {
    throw new Error(`Installed ${label} V3 observation must not import the combined Motor/Power policy catalog.`);
  }
}

const reviewedReleaseSource = sourceContentForSuffix(
  motorEvidence,
  "packages/design-library/src/bundled-reviewed-release.ts",
);
const powerReviewedReleaseSource = sourceContentForSuffix(
  powerEvidence,
  "packages/design-library/src/bundled-reviewed-release.ts",
);
if (powerReviewedReleaseSource !== reviewedReleaseSource) {
  throw new Error("Production Motor and Power generators must share the same reviewed release source.");
}
const importedProfilePaths = [...reviewedReleaseSource.matchAll(/from "\.\.\/parts\/([^"\n]+\.json)"/g)]
  .map((match) => `packages/design-library/parts/${match[1]}`)
  .sort();
const release = JSON.parse(readFileSync(new URL("../../../packages/design-library/catalog-release.json", import.meta.url), "utf8"));
const expectedProfilePaths = release.profiles.map((profile) => profile.profilePath).sort();
if (JSON.stringify(importedProfilePaths) !== JSON.stringify(expectedProfilePaths)) {
  throw new Error("Production Motor generator profile imports must equal the exact reviewed catalog release.");
}
const admission = JSON.parse(readFileSync(new URL("../../../packages/design-library/admission.json", import.meta.url), "utf8"));
const nonReviewedMpns = admission.entries
  .filter((entry) => entry.state !== "reviewed")
  .map((entry) => entry.part.manufacturerPartNumber);
for (const [label, evidence] of [["Motor", motorEvidence], ["Power", powerEvidence]]) {
  const leakedMpns = nonReviewedMpns.filter((mpn) => evidence.emittedSource.includes(mpn));
  if (leakedMpns.length > 0) {
    throw new Error(`Production ${label} generator contains non-reviewed admission identities: ${leakedMpns.join(", ")}`);
  }
}
if (!reviewedReleaseSource.includes('from "../reviewed-admission.json"')
  || reviewedReleaseSource.includes('from "../admission.json"')
  || reviewedReleaseSource.includes("bundled-release")
  || reviewedReleaseSource.includes("v2-testing")
  || reviewedReleaseSource.includes("/fixtures")) {
  throw new Error("Production Motor generator reviewed release imports a forbidden capability.");
}

const designerExampleFiles = [
  "manifest.json",
  "artifacts/m1-compact.json",
  "artifacts/m2-power.json",
  "artifacts/p1-compact.json",
  "artifacts/p2-high-voltage.json",
];
for (const path of designerExampleFiles) {
  const emitted = readFileSync(new URL(`../dist/designer-examples/${path}`, import.meta.url));
  const authoredPath = path === "manifest.json" ? "artifacts/manifest.json" : path;
  const authored = readFileSync(new URL(`../../../packages/designer-examples/${authoredPath}`, import.meta.url));
  if (!emitted.equals(authored)) {
    throw new Error(`Production Designer demonstration asset is not an exact checked-in artifact: ${path}`);
  }
}

console.log(`Production bundle capability and route-budget scan passed (${files.length} JavaScript/source-map assets; ${Buffer.byteLength(simulatorSource)}-byte Simulator chunk; ${Buffer.byteLength(designerSource)}-byte Designer chunk; ${Buffer.byteLength(motorGeneratorSource)}-byte lazy Motor V2 root/${motorEvidence.bytes}-byte closure; ${Buffer.byteLength(readFileSync(new URL(motorConstraintObservationChunk, assetsDirectory), "utf8"))}-byte lazy Motor V3 root/${motorConstraintObservationEvidence.bytes}-byte closure; ${Buffer.byteLength(powerGeneratorSource)}-byte lazy Power V2 root/${powerEvidence.bytes}-byte closure; ${Buffer.byteLength(readFileSync(new URL(powerConstraintObservationChunk, assetsDirectory), "utf8"))}-byte lazy Power V3 root/${powerConstraintObservationEvidence.bytes}-byte closure; ${Buffer.byteLength(readFileSync(new URL(productionExportChunk, assetsDirectory), "utf8"))}-byte lazy production-export root/${productionExportEvidence.bytes}-byte closure; ${Buffer.byteLength(customizedTargetArtifactRuntimeEmittedSource)}-byte lazy guarded customized-target artifact root/${customizedTargetArtifactRuntimeEvidence.bytes}-byte closure with ${customizedTargetRuntimeNamedExports.length} guarded exports; ${Buffer.byteLength(readFileSync(new URL(sourcingRequestPacketChunk, assetsDirectory), "utf8"))}-byte lazy sourcing-request root/${sourcingRequestPacketEvidence.bytes}-byte closure; ${importedProfilePaths.length} release-pinned profiles; ${designerExampleFiles.length} detached demonstration assets).`);
