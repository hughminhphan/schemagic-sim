import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  STATIC_OFFLINE_AUDIT_LIMITATIONS,
  auditStaticOfflineNetworkFiles as auditProductionStaticOfflineNetworkFiles,
} from "./static-offline-audit.mjs";

const CATALOG_PREFIX = "https://github.com/hughminhphan/schemagic-sim/tree/main/packages/model-library/models/";
const LCSC_SEARCH_PREFIX = "https://www.lcsc.com/search?q=";
const LCSC_SEARCH_URL = `${LCSC_SEARCH_PREFIX}TPS54302DDCR`;
const MODEL_SOURCE_URL = "https://vendor.example/models/demo";
const PROFILE_EVIDENCE_URL = "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-Data-Sheet-DS20005604D.pdf";
const UNRELATED_PROFILE_URL = "https://vendor.example/datasheets/unreviewed-part.pdf";
const REVIEWED_PROFILE_GEOMETRY_BINDINGS = Object.freeze([
  Object.freeze({
    url: "https://webench.ti.com/cad/TI_BXL/DRV8262_DDV_44.bxl",
    sourceId: "ti-drv8262-webench-bxl",
    evidenceContentHash: "sha256:932f211c9de4d7628b9483dfd8b5d8162cfbf2c7a0d6271cd2acda89e93827d3",
    profilePath: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
    profileContentHash: "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a",
  }),
  Object.freeze({
    url: "https://webench.ti.com/cad/TI_BXL/DRV8876_PWP_16.bxl",
    sourceId: "ti-drv8876-webench-bxl",
    evidenceContentHash: "sha256:d70487e2803882279c0fc0a967275b77d381c1d557403f65d5b905dd5f9279a3",
    profilePath: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json",
    profileContentHash: "sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b",
  }),
  Object.freeze({
    url: "https://webench.ti.com/cad/TI_BXL/TPS54302_DDC_6.bxl",
    sourceId: "ti-tps54302-webench-bxl",
    evidenceContentHash: "sha256:d877128565f6d15699b3079795906ec814f5722ccc3a9a5515bd5ee2919d8f1c",
    profilePath: "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json",
    profileContentHash: "sha256:23903b656e2998ce13e9c4bc79badaa7e0fd28242f0398941392d99da87f299c",
  }),
]);
const MOTOR_MODE_EVIDENCE_URL = "https://www.ti.com/lit/ds/symlink/drv8876.pdf";
const MOTOR_MODE_EVIDENCE_SOURCE_HASH = "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032";
const MOTOR_MODE_EVIDENCE_PROFILE_HASH = "sha256:1786e77a459d8efbc83693b2c79770a3673d6b28e093b3f4f655468156850ef5";
const MOTOR_MODE_EVIDENCE_REFRESHED_PROFILE_HASH = "sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b";
const MOTOR_LOCAL_NOMINAL_EVIDENCE_URL = "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info/print_pdf";
const MOTOR_LOCAL_NOMINAL_EVIDENCE_SOURCE_HASH = "sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12";
const MOTOR_LOCAL_NOMINAL_PROFILE_HASH = "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6";
const MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL = "https://www.ti.com/lit/ds/symlink/drv8262.pdf";
const MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_HASH = "sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7";
const MOTOR_DRV8262_COMPANION_GATE_PROFILE_ID = "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
const MOTOR_DRV8262_COMPANION_GATE_PROFILE_HASH = "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a";
const MOTOR_DIRECT_GATE_EVIDENCE_URL = "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-85V-Full-Bridge-MOSFET-Drivers-with-Adaptive-Dead-Time-and-Shoot-Through-Protection-DS20005604.pdf";
const MOTOR_DIRECT_GATE_EVIDENCE_SOURCE_HASH = "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135";
const MOTOR_DIRECT_GATE_EVIDENCE_PROFILE_HASH = "sha256:1fd9a7097dd7359f39cfd1fa285671d830ba9e544d16e37a34d28854efbb2f47";
const MOTOR_DIRECT_GATE_PREDECESSOR_HASH = "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187";
const MOTOR_TVS_EVIDENCE_URL = "https://www.diodes.com/datasheet/download/ds40742.pdf";
const MOTOR_TVS_EVIDENCE_SOURCE_ID = "diodes-incorporated-3-0smcj-automotive-ds40742";
const MOTOR_TVS_EVIDENCE_SOURCE_HASH = "sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24";
const MOTOR_TVS_EVIDENCE_PROFILE_HASH = "sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474";
const MOTOR_TVS_PREDECESSOR_HASH = "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320";
const MOTOR_TVS_REVIEWED_PROFILE_ID = "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";
const MOTOR_TVS_REVIEWED_PROFILE_SOURCE_PATH = `../../../../${MOTOR_TVS_REVIEWED_PROFILE_ID}`;
const MOTOR_TVS_REVIEWED_CATALOG_VERSION = "2026-08-27.2";
const MOTOR_TVS_REVIEWED_CATALOG_HASH = "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e";
const MOTOR_CAPACITOR_ROLE_PROFILE_HASHES = Object.freeze([
  "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
  "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
  "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
]);
const MOTOR_CAPACITOR_ROLE_EXCLUDED_PROFILE_HASH = "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6";
const REVIEWED_RELEASE_SOURCE = readFileSync(
  new URL("../../../packages/design-library/src/bundled-reviewed-release.ts", import.meta.url),
  "utf8",
);
const MOTOR_TVS_REVIEWED_PROFILE_SOURCE = readFileSync(
  new URL("../../../packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%252E0SMCJ33CAQ.json", import.meta.url),
  "utf8",
);

function file(path, source = "") {
  return { path, bytes: Buffer.from(source) };
}

function mapFile(sources) {
  return JSON.stringify({
    version: 3,
    file: "app.js",
    sources: sources.map(([path]) => path),
    sourcesContent: sources.map(([, source]) => source),
    names: [],
    mappings: "",
  });
}

function fixture() {
  const sources = [
    ["../../src/entry.ts", 'navigator.serviceWorker.register("/sw.js");'],
    ["../../src/main.ts", "export {};"],
    [
      "../../../../packages/sim-engine/src/client.ts",
      'new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "opencircuit-sim" });',
    ],
    ["../../../../packages/sim-engine/src/worker.ts", "export {};"],
    [
      "../../../../tools/ngspice-wasm-build/dist/ngspice.mjs",
      'async function load(url) { await fetch(url, { credentials: "same-origin" }); return new XMLHttpRequest(); }',
    ],
    [
      "../../../../tools/ngspice-wasm-build/dist-loader/index.mjs",
      'const wasmUrl = new URL("../dist/ngspice.wasm", import.meta.url); const options = { locateFile: (path) => path.endsWith(".wasm") ? wasmUrl.href : path };',
    ],
    [
      "../../src/catalog.ts",
      `const prefix = "${CATALOG_PREFIX}"; const link = 'target="_blank" rel="noreferrer"';`,
    ],
    [
      "../../../../packages/model-library/models/acme/demo/sources.json",
      JSON.stringify([{ kind: "vendor", url: MODEL_SOURCE_URL }]),
    ],
    [
      "../../../../node_modules/fflate/esm/browser.js",
      "new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([workerCode]))));",
    ],
  ];
  const javascript = [
    'navigator.serviceWorker.register("/sw.js");',
    'new Worker(new URL("/assets/app.js",import.meta.url),{type:"module",name:"opencircuit-sim"});',
    "new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([workerCode]))));",
    'const wasmUrl="/assets/ngspice.wasm";fetch(wasmUrl,{credentials:"same-origin"});new XMLHttpRequest();',
    'const deps=["assets/chunk.js"],rel=document.createElement("link").relList;function polyfill(e){const t={};t.credentials="same-origin";fetch(e.href,t)}function base(e){return"/"+e}function preload(e){e=base(e);const n=document.createElement("link");n.rel="modulepreload";n.href=e;return e.endsWith(".css")}',
    `const provenance="${MODEL_SOURCE_URL}";`,
    "//# sourceMappingURL=app.js.map",
  ].join("\n");
  const serviceWorker = [
    'const SHELL = ["/", "/index.html"];',
    'self.addEventListener("install", event => event.waitUntil(caches.open("shell").then(cache => cache.addAll(SHELL))));',
    'self.addEventListener("fetch", event => {',
    '  if (event.request.method !== "GET") return;',
    "  const url = new URL(event.request.url);",
    "  if (url.origin !== self.location.origin) return;",
    "  event.respondWith(caches.match(event.request).then(cached => cached ?? fetch(event.request)));",
    "});",
  ].join("\n");
  return [
    file("index.html", '<!doctype html><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>'),
    file("sw.js", serviceWorker),
    file("assets/app.css", "body { color: #111; }"),
    file("assets/app.js", javascript),
    file("assets/app.js.map", mapFile(sources)),
    file("assets/ngspice.wasm", Buffer.from([0, 97, 115, 109])),
  ];
}

function replace(files, path, mutate) {
  return files.map((entry) => entry.path === path
    ? { ...entry, bytes: Buffer.from(mutate(entry.bytes.toString("utf8"))) }
    : entry);
}

function codes(report) {
  return report.findings.map((entry) => entry.code);
}

function withDesignerExampleFetch(files, mutateSource = (source) => source) {
  const gallerySource = mutateSource([
    'const manifest = { url: "/designer-examples/manifest.json" };',
    'const artifact = `/designer-examples/${example.artifact.path}`;',
    'const init = { credentials: "same-origin", mode: "same-origin", redirect: "error", cache: "no-cache" };',
    "const response = fetcher ? await fetcher(url, init) : await fetch(url, init);",
  ].join("\n"));
  let updated = replace(files, "assets/app.js.map", (source) => {
    const map = JSON.parse(source);
    map.sources.push("../../src/features/designer/ExampleGallery.ts");
    map.sourcesContent.push(gallerySource);
    return JSON.stringify(map);
  });
  updated = replace(updated, "assets/app.js", (source) => source.replace(
    "//# sourceMappingURL=app.js.map",
    'fetch("/designer-examples/manifest.json",{credentials:"same-origin",mode:"same-origin",redirect:"error",cache:"no-cache"});\n//# sourceMappingURL=app.js.map',
  ));
  updated.push(file("designer-examples/manifest.json", "{}"));
  return updated;
}

function withLcscExternalNavigation(
  files,
  {
    url = LCSC_SEARCH_URL,
    sourceExtra = "",
    emittedExtra = "",
  } = {},
) {
  const viewSource = [
    `const LCSC_SEARCH_PREFIX = "${url}";`,
    'const link = `<a href="${LCSC_SEARCH_PREFIX}" target="_blank" rel="noopener noreferrer">Search LCSC</a>`;',
    sourceExtra,
  ].filter(Boolean).join("\n");
  let updated = replace(files, "assets/app.js.map", (source) => {
    const map = JSON.parse(source);
    map.sources.push("../../src/features/designer/ImportedResultView.ts");
    map.sourcesContent.push(viewSource);
    return JSON.stringify(map);
  });
  updated = replace(updated, "assets/app.js", (source) => source.replace(
    "//# sourceMappingURL=app.js.map",
    `const lcsc="${url}";const link='<a href="'+lcsc+'" target="_blank" rel="noopener noreferrer">Search LCSC</a>';${emittedExtra}\n//# sourceMappingURL=app.js.map`,
  ));
  return updated;
}

function withMotorModeEvidence(
  files,
  {
    url = MOTOR_MODE_EVIDENCE_URL,
    sourceHash = MOTOR_MODE_EVIDENCE_SOURCE_HASH,
    profileHash = MOTOR_MODE_EVIDENCE_PROFILE_HASH,
    sourcePath = "../../../../packages/design-recipes/src/motor-integrated-v32-mode-qualified.ts",
    version = "3.2.3",
    predecessorImport = "",
    sourceExtra = "",
    emittedExtra = "",
  } = {},
) {
  const recipeSource = [
    predecessorImport,
    `const profileHash = "${profileHash}";`,
    `const sourceHash = "${sourceHash}";`,
    'const sourceId = "ti-drv8876-slvsds7b";',
    `const release = { version: "${version}" };`,
    `const evidence = { url: "${url}", sourceId, contentHash: sourceHash, profileHash };`,
    sourceExtra,
  ].filter(Boolean).join("\n");
  let updated = replace(files, "assets/app.js.map", (source) => {
    const map = JSON.parse(source);
    map.sources.push(sourcePath);
    map.sourcesContent.push(recipeSource);
    return JSON.stringify(map);
  });
  updated = replace(updated, "assets/app.js", (source) => source.replace(
    "//# sourceMappingURL=app.js.map",
    `const motorEvidence="${url}";${emittedExtra}\n//# sourceMappingURL=app.js.map`,
  ));
  return updated;
}

function withMotorLocalNominalEvidence(
  files,
  {
    localUrl = MOTOR_LOCAL_NOMINAL_EVIDENCE_URL,
    localSourceHash = MOTOR_LOCAL_NOMINAL_EVIDENCE_SOURCE_HASH,
    localProfileHash = MOTOR_LOCAL_NOMINAL_PROFILE_HASH,
    predecessorImport = 'import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED } from "./motor-integrated-v32-mode-qualified-binding-refreshed";',
    sourceExtra = "",
    emittedExtra = "",
  } = {},
) {
  return withMotorModeEvidence(files, {
    profileHash: MOTOR_MODE_EVIDENCE_REFRESHED_PROFILE_HASH,
    sourcePath: "../../../../packages/design-recipes/src/motor-integrated-v32-local-capacitance-recommendation-qualified.ts",
    version: "3.2.5",
    predecessorImport,
    sourceExtra: [
      `const localProfileHash = "${localProfileHash}";`,
      `const localSourceHash = "${localSourceHash}";`,
      'const localSourceId = "tdk-c1608x7r1h104k080aa-product-pdf";',
      `const localEvidence = { url: "${localUrl}", sourceId: localSourceId, contentHash: localSourceHash, profileHash: localProfileHash };`,
      sourceExtra,
    ].filter(Boolean).join("\n"),
    emittedExtra: `const motorLocalEvidence="${localUrl}";${emittedExtra}`,
  });
}

function withMotorDrv8262CompanionGateEvidence(
  files,
  {
    url = MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL,
    sourceHash = MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_HASH,
    profileId = MOTOR_DRV8262_COMPANION_GATE_PROFILE_ID,
    profileHash = MOTOR_DRV8262_COMPANION_GATE_PROFILE_HASH,
    version = "3.2.6",
    sourceExtra = "",
    emittedExtra = "",
  } = {},
) {
  const recipeSource = [
    'import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED } from "./motor-integrated-v32-local-capacitance-recommendation-qualified";',
    `const profileId = "${profileId}";`,
    `const profileHash = "${profileHash}";`,
    `const sourceHash = "${sourceHash}";`,
    'const sourceId = "ti-drv8262-slvsfv5c";',
    `const evidence = { url: "${url}", sourceId, contentHash: sourceHash };`,
    `const release = { version: "${version}" };`,
    'const ruleId = "motor.integrated.companion-network-representability";',
    'const binding = { stage: "match_before_component_materialization", distinctVmBypassPositions: [{ componentId: "CVM1", from: "VM", to: "PGND12" }, { componentId: "CVM2", from: "VM", to: "PGND34" }], chargePumpOrRegulatorComponentsRepresented: false, disposition: "reject_before_candidate_component_materialization_and_customization_witness" };',
    "const delegated = MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.match(option, environment);",
    sourceExtra,
  ].filter(Boolean).join("\n");
  const javascript = `const sourceId="ti-drv8262-slvsfv5c",sourceHash="${sourceHash}",profileId="${profileId}",profileHash="${profileHash}",evidence={url:"${url}",sourceId,contentHash:sourceHash};${emittedExtra}\n//# sourceMappingURL=motor-drv8262-gate.js.map`;
  return [
    ...files,
    file("assets/motor-drv8262-gate.js", javascript),
    file("assets/motor-drv8262-gate.js.map", mapFile([[
      "../../../../packages/design-recipes/src/motor-integrated-v32-companion-network-gated.ts",
      recipeSource,
    ]])),
  ];
}

function withReviewedProfileGeometryEvidence(
  files,
  {
    bindings = REVIEWED_PROFILE_GEOMETRY_BINDINGS,
    releaseSource = REVIEWED_RELEASE_SOURCE,
    releaseSourcePath = "../../../../packages/design-library/src/bundled-reviewed-release.ts",
    additionalSources = [],
    emittedExtra = "",
  } = {},
) {
  const evidence = bindings.flatMap((binding) => Array.from({ length: 4 }, () => ({
    url: binding.url,
    sourceId: binding.sourceId,
    contentHash: binding.evidenceContentHash,
    profilePath: binding.profilePath,
  })));
  const profileHashes = bindings.flatMap((binding) => [
    binding.profileContentHash,
    binding.profileContentHash,
  ]);
  const javascript = [
    `const reviewedProfileGeometry=${JSON.stringify(evidence)};`,
    `const reviewedProfileHashes=${JSON.stringify(profileHashes)};`,
    emittedExtra,
    "//# sourceMappingURL=reviewed.js.map",
  ].filter(Boolean).join("\n");
  const sources = [
    [releaseSourcePath, releaseSource],
    ...additionalSources,
  ];
  return [
    ...files,
    file("assets/reviewed.js", javascript),
    file("assets/reviewed.js.map", mapFile(sources)),
  ];
}

function withMotorDirectGateEvidence(
  files,
  {
    url = MOTOR_DIRECT_GATE_EVIDENCE_URL,
    sourceHash = MOTOR_DIRECT_GATE_EVIDENCE_SOURCE_HASH,
    profileHash = MOTOR_DIRECT_GATE_EVIDENCE_PROFILE_HASH,
    predecessorHash = MOTOR_DIRECT_GATE_PREDECESSOR_HASH,
    capacitorProfileHashes = MOTOR_CAPACITOR_ROLE_PROFILE_HASHES,
    excludedCapacitorProfileHash = undefined,
    version = "3.1.7",
    sourceExtra = "",
    emittedExtra = "",
  } = {},
) {
  const recipeSource = [
    `const profileHash = "${profileHash}";`,
    `const sourceHash = "${sourceHash}";`,
    `const predecessorHash = "${predecessorHash}";`,
    `const tvsUrl = "${MOTOR_TVS_EVIDENCE_URL}";`,
    `const tvsSourceHash = "${MOTOR_TVS_EVIDENCE_SOURCE_HASH}";`,
    `const tvsProfileHash = "${MOTOR_TVS_EVIDENCE_PROFILE_HASH}";`,
    `const tvsPredecessorHash = "${MOTOR_TVS_PREDECESSOR_HASH}";`,
    'const tvsSourceId = "diodes-incorporated-3-0smcj-automotive-ds40742";',
    'const sourceId = "microchip-mic4606-ds20005604h";',
    `const release = { version: "${version}" };`,
    'const standOffAmbientEquation = "motor.external.facts-v3-1-role-qualified.tvs-stand-off-ambient-condition-gate.v1";',
    'const standOffCovered = conditionsCover(tvs.facts.standOffVoltage, ambientContext);',
    'const contract = { driverVoltageSemantics: "bridge_interface_qualified" };',
    'const voltageRules = ["motor.external.driver-switch-node-operating-minimum", "motor.external.driver-switch-node-operating-maximum", "motor.external.driver-switch-node-absolute-maximum", "motor.external.tvs-published-clamp-driver-switch-node-limit", "motor.external.tvs-published-clamp-mosfet-limit", "motor.external.tvs-coordination"];',
    'const biasBoundary = "does not implement a VDD driver-bias rail";',
    `const capacitorRoleBindings = { qualifiedProfiles: ${JSON.stringify(capacitorProfileHashes)}, bootstrap: { dataKey: "bootstrapProfileId", quantityPerAssembly: 2, documentedNominalMinimumF: 0.1e-6 }, local: { dataKey: "localProfileId", quantityPerAssembly: 1, documentedNominalMinimumF: 1e-6 } };`,
    ...(excludedCapacitorProfileHash === undefined ? [] : [`const excludedProfileHash = "${excludedCapacitorProfileHash}";`]),
    'const resistorRoleBindings = { seriesGate: { status: "omitted_for_exact_driver_direct_connection", profiles: [] } };',
    'const binding = { structuralConnections: [{ outputRole: "high-side-xHO", externalDampingResistor: "optional_unselected" }, { outputRole: "low-side-xLO", externalSeriesResistor: "not_recommended_unselected" }] };',
    `const evidence = { url: "${url}", sourceId, contentHash: sourceHash, profileHash, predecessorHash, release, standOffAmbientEquation, standOffCovered, contract, voltageRules, biasBoundary, binding, capacitorRoleBindings, resistorRoleBindings };`,
    sourceExtra,
  ].filter(Boolean).join("\n");
  const javascript = `const motorDirectGateEvidence="${url}";const motorTvsEvidence="${MOTOR_TVS_EVIDENCE_URL}";const motorTvsBinding={source:{url:motorTvsEvidence}};${emittedExtra}\n//# sourceMappingURL=motor-recipe.js.map`;
  return [
    ...files,
    file("assets/motor-recipe.js", javascript),
    file("assets/motor-recipe.js.map", mapFile([[
      "../../../../packages/design-recipes/src/motor-external-v2.ts",
      recipeSource,
    ]])),
  ];
}

function withReviewedMotorTvsProfileProjection(
  files,
  {
    url = MOTOR_TVS_EVIDENCE_URL,
    sourceId = MOTOR_TVS_EVIDENCE_SOURCE_ID,
    sourceHash = MOTOR_TVS_EVIDENCE_SOURCE_HASH,
    profileId = MOTOR_TVS_REVIEWED_PROFILE_ID,
    profileHash = MOTOR_TVS_EVIDENCE_PROFILE_HASH,
    manufacturerId = "diodes-incorporated",
    manufacturerPartNumber = "3.0SMCJ33CAQ",
    catalogVersion = MOTOR_TVS_REVIEWED_CATALOG_VERSION,
    catalogHash = MOTOR_TVS_REVIEWED_CATALOG_HASH,
    evidenceCount = 25,
    standOffVoltage = 33,
    releaseSource = REVIEWED_RELEASE_SOURCE,
    releaseSourcePath = "../../../../packages/design-library/src/bundled-reviewed-release.ts",
    additionalSources = [],
    includeProfileSource = false,
    profileSource = MOTOR_TVS_REVIEWED_PROFILE_SOURCE,
    emittedExtra = "",
  } = {},
) {
  const profile = JSON.parse(MOTOR_TVS_REVIEWED_PROFILE_SOURCE);
  profile.part.manufacturerId = manufacturerId;
  profile.part.manufacturerPartNumber = manufacturerPartNumber;
  profile.facts.standOffVoltage.value.value = standOffVoltage;
  let evidenceIndex = 0;
  const rewriteEvidence = (value) => {
    if (Array.isArray(value)) {
      for (const nested of value) rewriteEvidence(nested);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (value.sourceId === MOTOR_TVS_EVIDENCE_SOURCE_ID
      && value.contentHash === MOTOR_TVS_EVIDENCE_SOURCE_HASH
      && value.url === MOTOR_TVS_EVIDENCE_URL) {
      const preserveExactTuple = evidenceIndex < evidenceCount;
      value.sourceId = sourceId === MOTOR_TVS_EVIDENCE_SOURCE_ID && !preserveExactTuple
        ? `${MOTOR_TVS_EVIDENCE_SOURCE_ID}-changed`
        : sourceId;
      value.contentHash = sourceHash === MOTOR_TVS_EVIDENCE_SOURCE_HASH && !preserveExactTuple
        ? "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        : sourceHash;
      value.url = url === MOTOR_TVS_EVIDENCE_URL && !preserveExactTuple
        ? "https://www.diodes.com/datasheet/download/ds40742-changed.pdf"
        : url;
      evidenceIndex += 1;
    }
    for (const nested of Object.values(value)) rewriteEvidence(nested);
  };
  rewriteEvidence(profile);
  const profileBindings = [
    "tvsFormat",
    "tvsSchemaVersion",
    "tvsPartClass",
    "tvsPart",
    "tvsFactsSchemaVersion",
    "tvsCommonFacts",
    "tvsFacts",
    "tvsProfile",
  ];
  const emittedProfileProjection = [
    `${profileBindings[0]}=${JSON.stringify(profile.format)}`,
    `${profileBindings[1]}=${JSON.stringify(profile.schemaVersion)}`,
    `${profileBindings[2]}=${JSON.stringify(profile.partClass)}`,
    `${profileBindings[3]}=${JSON.stringify(profile.part)}`,
    `${profileBindings[4]}=${JSON.stringify(profile.factsSchemaVersion)}`,
    `${profileBindings[5]}=${JSON.stringify(profile.commonFacts)}`,
    `${profileBindings[6]}=JSON.parse(\`${JSON.stringify(profile.facts)}\`)`,
    `${profileBindings[7]}={format:${profileBindings[0]},schemaVersion:${profileBindings[1]},partClass:${profileBindings[2]},part:${profileBindings[3]},factsSchemaVersion:${profileBindings[4]},commonFacts:${profileBindings[5]},facts:${profileBindings[6]}}`,
  ].join(",");
  const catalogProfile = {
    profileId,
    profilePath: profileId,
    partClass: "motor.supply-tvs-diode",
    part: { manufacturerId, manufacturerPartNumber },
    profileContentHash: profileHash,
  };
  const javascript = [
    `const catalogVersion="${catalogVersion}";`,
    `const catalogHash="${catalogHash}";`,
    `const catalogProfile=${JSON.stringify(catalogProfile)};`,
    `const admissionProfilePath="${profileId}";`,
    `const releasedProfiles={"${profileId}":${profileBindings[7]}};`,
    `const admissionProfileHash="${profileHash}";`,
    `${emittedProfileProjection},nextProfile="schemagic-design-profile",nextSchemaVersion="1.0.0";`,
    emittedExtra,
    "//# sourceMappingURL=reviewed-tvs.js.map",
  ].filter(Boolean).join("\n");
  const sources = [
    [releaseSourcePath, releaseSource],
    ...(includeProfileSource ? [[MOTOR_TVS_REVIEWED_PROFILE_SOURCE_PATH, profileSource]] : []),
    ...additionalSources,
  ];
  return [
    ...files,
    file("assets/reviewed-tvs.js", javascript),
    file("assets/reviewed-tvs.js.map", mapFile(sources)),
  ];
}

function artifactHash(files, path) {
  const artifact = files.find((entry) => entry.path === path);
  assert.ok(artifact, `Missing synthetic artifact ${path}`);
  return `sha256:${createHash("sha256").update(artifact.bytes).digest("hex")}`;
}

function artifactSetHash(files) {
  const inventory = [...files]
    .map((entry) => ({
      path: entry.path,
      bytes: Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes),
    }))
    .sort((left, right) => left.path === right.path ? 0 : left.path < right.path ? -1 : 1);
  const payload = inventory.map((entry) => [
    entry.path,
    `sha256:${createHash("sha256").update(entry.bytes).digest("hex")}`,
    entry.bytes.byteLength,
  ].join("\0")).join("\n");
  return `sha256:${createHash("sha256").update(Buffer.from(payload)).digest("hex")}`;
}

const SYNTHETIC_MOTOR_TVS_RECIPE_HASH = artifactHash(
  withMotorDirectGateEvidence(fixture()),
  "assets/motor-recipe.js",
);
const SYNTHETIC_MOTOR_TVS_REVIEWED_HASH = artifactHash(
  withReviewedMotorTvsProfileProjection(fixture()),
  "assets/reviewed-tvs.js",
);
const SYNTHETIC_MOTOR_DRV8262_COMPANION_GATE_HASH = artifactHash(
  withMotorDrv8262CompanionGateEvidence(fixture()),
  "assets/motor-drv8262-gate.js",
);
const PRODUCTION_MOTOR_TVS_RECIPE_HASH = "sha256:d59838d4a5ac6c5851ffdc2bc17d3c282df266319214bdc4ae5290049eda2042";
const PRODUCTION_MOTOR_TVS_REVIEWED_HASH = "sha256:dfb283349e730cf7284f4c94ab6308b470896b30d65ceed356381990330dff05";
const PRODUCTION_MOTOR_DRV8262_COMPANION_GATE_HASH = "sha256:d59838d4a5ac6c5851ffdc2bc17d3c282df266319214bdc4ae5290049eda2042";
const auditModuleSource = readFileSync(new URL("./static-offline-audit.mjs", import.meta.url), "utf8");
assert.equal(auditModuleSource.split(PRODUCTION_MOTOR_TVS_RECIPE_HASH).length, 3);
assert.equal(auditModuleSource.split(PRODUCTION_MOTOR_TVS_REVIEWED_HASH).length, 2);
const syntheticAuditModuleSource = auditModuleSource
  .replace(
    `const MOTOR_TVS_RECIPE_EMITTED_ARTIFACT_HASH = "${PRODUCTION_MOTOR_TVS_RECIPE_HASH}";`,
    `const MOTOR_TVS_RECIPE_EMITTED_ARTIFACT_HASH = "${SYNTHETIC_MOTOR_TVS_RECIPE_HASH}";`,
  )
  .replace(PRODUCTION_MOTOR_TVS_REVIEWED_HASH, SYNTHETIC_MOTOR_TVS_REVIEWED_HASH)
  .replace(
    `const MOTOR_DRV8262_COMPANION_GATE_EMITTED_ARTIFACT_HASH = "${PRODUCTION_MOTOR_DRV8262_COMPANION_GATE_HASH}";`,
    `const MOTOR_DRV8262_COMPANION_GATE_EMITTED_ARTIFACT_HASH = "${SYNTHETIC_MOTOR_DRV8262_COMPANION_GATE_HASH}";`,
  );
const { auditStaticOfflineNetworkFiles: auditSyntheticMotorTvsFiles } = await import(
  `data:text/javascript;base64,${Buffer.from(syntheticAuditModuleSource).toString("base64")}`
);

function auditStaticOfflineNetworkFiles(files, options) {
  const containsSyntheticMotorTvsArtifact = files.some((entry) => entry.path === "assets/motor-recipe.js"
    || entry.path === "assets/reviewed-tvs.js"
    || entry.path === "assets/motor-drv8262-gate.js");
  return containsSyntheticMotorTvsArtifact
    ? auditSyntheticMotorTvsFiles(files, options)
    : auditProductionStaticOfflineNetworkFiles(files, options);
}

describe("static offline/network production audit", () => {
  it("accepts the pinned local service-worker, module-worker, Blob-worker and WASM boundaries deterministically", () => {
    const files = fixture();
    const first = auditStaticOfflineNetworkFiles(files);
    const reordered = auditStaticOfflineNetworkFiles([...files].reverse());

    assert.deepEqual(first, reordered);
    assert.equal(first.status, "pass", JSON.stringify(first.findings, null, 2));
    assert.deepEqual(first.evidence.serviceWorkerShell, ["/", "/index.html"]);
    assert.equal(first.evidence.externalNavigationUrlCount, 1);
    assert.deepEqual(first.evidence.externalNavigationOrigins, ["https://vendor.example"]);
    assert.deepEqual(first.evidence.sourceCapabilities, {
      dedicated_worker: 2,
      fetch: 1,
      service_worker_register: 1,
      xml_http_request: 1,
    });
    assert.deepEqual(first.limitations, STATIC_OFFLINE_AUDIT_LIMITATIONS);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.evidence), true);
    assert.equal(Object.isFrozen(first.limitations), true);
  });

  it("accounts for Vite's split same-origin preload helper without authorizing external preload targets", () => {
    const helper = 'const p="modulepreload",v=function(e){return"/"+e};function preload(e){e=v(e);const n=document.createElement("link");n.rel=p;n.href=e;return e.endsWith(".css")}';
    const acceptedFiles = fixture();
    acceptedFiles.push(file("assets/preload-helper.js", `${helper}\n//# sourceMappingURL=preload-helper.js.map`));
    acceptedFiles.push(file("assets/preload-helper.js.map", mapFile([])));
    const accepted = auditStaticOfflineNetworkFiles(acceptedFiles);

    const changed = auditStaticOfflineNetworkFiles(replace(
      acceptedFiles,
      "assets/preload-helper.js",
      (source) => source.replace('return"/"+e', 'return"https://cdn.example/"+e'),
    ));

    assert.equal(accepted.status, "pass", JSON.stringify(accepted.findings, null, 2));
    assert.equal(changed.status, "blocked");
    assert.ok(codes(changed).includes("emitted_network_capability_unaccounted"));
    assert.ok(codes(changed).includes("runtime_external_endpoint_unapproved"));
  });

  it("blocks active external and network-relative HTML/CSS resources", () => {
    let files = replace(fixture(), "index.html", (source) => `${source}<script src="https://cdn.example/app.js"></script>`);
    files = replace(files, "assets/app.css", (source) => `${source}\n@import url(//cdn.example/app.css);`);
    const report = auditStaticOfflineNetworkFiles(files);

    assert.equal(report.status, "blocked");
    assert.ok(codes(report).includes("active_external_endpoint"));
    assert.ok(codes(report).includes("external_css_import"));
  });

  it("blocks an emitted network call that has no corresponding approved source capability", () => {
    const files = replace(fixture(), "assets/app.js", (source) => source.replace(
      "//# sourceMappingURL=app.js.map",
      'fetch("/unmapped-runtime-call");\n//# sourceMappingURL=app.js.map',
    ));
    const report = auditStaticOfflineNetworkFiles(files);

    assert.equal(report.status, "blocked");
    assert.ok(report.findings.some((entry) => entry.code === "emitted_network_capability_unaccounted"
      && entry.detail === "fetch: emitted 3, accounted 2"));
  });

  it("blocks unapproved source-authored browser network primitives", () => {
    const files = replace(fixture(), "assets/app.js.map", (source) => {
      const map = JSON.parse(source);
      const worker = map.sources.findIndex((entry) => entry.endsWith("/packages/sim-engine/src/worker.ts"));
      map.sourcesContent[worker] = 'new WebSocket("wss://socket.example");';
      return JSON.stringify(map);
    });
    const report = auditStaticOfflineNetworkFiles(files);

    assert.equal(report.status, "blocked");
    assert.ok(codes(report).includes("source_network_capability_unapproved"));
  });

  it("accounts for only the bounded same-origin Designer demonstration fetch source", () => {
    const accepted = auditStaticOfflineNetworkFiles(withDesignerExampleFetch(fixture()));
    const changed = auditStaticOfflineNetworkFiles(withDesignerExampleFetch(
      fixture(),
      (source) => source.replace('credentials: "same-origin"', 'credentials: "omit"'),
    ));

    assert.equal(accepted.status, "pass", JSON.stringify(accepted.findings, null, 2));
    assert.equal(accepted.evidence.sourceCapabilities.fetch, 2);
    assert.equal(accepted.evidence.emittedCapabilities.fetch, 3);
    assert.equal(changed.status, "blocked");
    assert.ok(codes(changed).includes("source_network_capability_unapproved"));
    assert.ok(codes(changed).includes("emitted_network_capability_unaccounted"));
  });

  it("inventories only the source-scoped safe-tab LCSC exact-MPN search as user-initiated navigation", () => {
    const report = auditStaticOfflineNetworkFiles(withLcscExternalNavigation(fixture()));

    assert.equal(report.status, "pass", JSON.stringify(report.findings, null, 2));
    assert.equal(report.evidence.externalNavigationUrlCount, 2);
    assert.equal(report.evidence.userInitiatedExternalNavigationUrlCount, 1);
    assert.deepEqual(report.evidence.userInitiatedExternalNavigationUrls, [LCSC_SEARCH_URL]);
    assert.deepEqual(report.evidence.userInitiatedExternalNavigationOrigins, ["https://www.lcsc.com"]);
  });

  it("does not let the approved LCSC URL authorize another source or chunk", () => {
    const sameChunk = replace(withLcscExternalNavigation(fixture()), "assets/app.js.map", (source) => {
      const map = JSON.parse(source);
      map.sources.push("../../src/features/designer/OtherView.ts");
      map.sourcesContent.push(`const lcsc = "${LCSC_SEARCH_URL}";`);
      return JSON.stringify(map);
    });
    const sameChunkReport = auditStaticOfflineNetworkFiles(sameChunk);
    assert.equal(sameChunkReport.status, "blocked");
    assert.ok(sameChunkReport.findings.some((entry) => entry.code === "lcsc_external_navigation_source_unapproved"
      && entry.detail.endsWith("/src/features/designer/OtherView.ts")));

    const anotherChunk = withLcscExternalNavigation(fixture());
    anotherChunk.push(file("assets/other.js", `const lcsc="${LCSC_SEARCH_URL}";\n//# sourceMappingURL=other.js.map`));
    anotherChunk.push(file("assets/other.js.map", mapFile([["../../src/other.ts", `const lcsc = "${LCSC_SEARCH_URL}";`]])));
    const anotherChunkReport = auditStaticOfflineNetworkFiles(anotherChunk);
    assert.equal(anotherChunkReport.status, "blocked");
    assert.ok(anotherChunkReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === LCSC_SEARCH_URL));
  });

  it("blocks alternate LCSC paths and origins even with safe-tab markers", () => {
    for (const url of [
      "https://www.lcsc.com/product-detail/TPS54302DDCR.html",
      "https://lcsc.com/search?q=TPS54302DDCR",
      "https://api.lcsc.com/v1/parts/TPS54302DDCR",
    ]) {
      const report = auditStaticOfflineNetworkFiles(withLcscExternalNavigation(fixture(), { url }));
      assert.equal(report.status, "blocked", url);
      assert.ok(codes(report).includes("lcsc_external_navigation_boundary_changed"), url);
      assert.ok(report.findings.some((entry) => entry.code === "runtime_external_endpoint_unapproved"
        && entry.detail === url), url);
    }
  });

  it("keeps fetch, XHR, beacon, and provider-style LCSC access fail-closed", () => {
    const activeAccessCases = [
      {
        sourceExtra: "fetch(LCSC_SEARCH_PREFIX);",
        emittedExtra: "fetch(lcsc);",
        capability: "fetch",
      },
      {
        sourceExtra: "new XMLHttpRequest();",
        emittedExtra: "new XMLHttpRequest();",
        capability: "xml_http_request",
      },
      {
        sourceExtra: 'navigator.sendBeacon(LCSC_SEARCH_PREFIX, "audit");',
        emittedExtra: 'navigator.sendBeacon(lcsc,"audit");',
        capability: "send_beacon",
      },
      {
        sourceExtra: "lcscProvider.lookup(LCSC_SEARCH_PREFIX);",
        emittedExtra: "lcscProvider.lookup(lcsc);",
        capability: "provider_client_access",
      },
    ];
    for (const access of activeAccessCases) {
      const report = auditStaticOfflineNetworkFiles(withLcscExternalNavigation(fixture(), access));
      assert.equal(report.status, "blocked", access.capability);
      assert.ok(report.findings.some((entry) => entry.code === "source_network_capability_unapproved"
        && entry.detail.endsWith(`: ${access.capability}`)), access.capability);
      assert.ok(codes(report).includes("emitted_network_capability_unaccounted"), access.capability);
    }

    const providerReport = auditStaticOfflineNetworkFiles(withLcscExternalNavigation(fixture(), {
      sourceExtra: 'const providerEndpoint = "https://api.lcsc.com/v1/search";',
      emittedExtra: 'const providerEndpoint="https://api.lcsc.com/v1/search";',
    }));
    assert.equal(providerReport.status, "blocked");
    assert.ok(codes(providerReport).includes("lcsc_external_navigation_boundary_changed"));
    assert.ok(providerReport.findings.some((entry) => entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === "https://api.lcsc.com/v1/search"));
  });

  it("keeps automatic LCSC navigation and embedded-resource sinks fail-closed", () => {
    for (const sourceExtra of [
      "window.open(LCSC_SEARCH_PREFIX, '_blank');",
      "location.assign(LCSC_SEARCH_PREFIX);",
      "window.location.href = LCSC_SEARCH_PREFIX;",
      "navigation.navigate(LCSC_SEARCH_PREFIX);",
      'const frame = document.createElement("iframe"); frame.src = LCSC_SEARCH_PREFIX;',
      'const form = `<form action="${LCSC_SEARCH_PREFIX}"></form>`;',
    ]) {
      const report = auditStaticOfflineNetworkFiles(withLcscExternalNavigation(fixture(), { sourceExtra }));
      assert.equal(report.status, "blocked", sourceExtra);
      assert.ok(codes(report).includes("lcsc_external_navigation_boundary_changed"), sourceExtra);
    }
  });

  it("blocks changed emitted service-worker and module-worker targets", () => {
    const files = replace(fixture(), "assets/app.js", (source) => source
      .replace('register("/sw.js")', 'register("/other-sw.js")')
      .replace('new URL("/assets/app.js",import.meta.url)', 'new URL("//worker.example/app.js",import.meta.url)'));
    const report = auditStaticOfflineNetworkFiles(files);

    assert.equal(report.status, "blocked");
    assert.ok(codes(report).includes("emitted_service_worker_target_unapproved"));
    assert.ok(codes(report).includes("emitted_worker_target_unapproved"));
    assert.ok(codes(report).includes("runtime_network_relative_endpoint"));
  });

  it("blocks a service worker that fetches outside its guarded request", () => {
    const files = replace(fixture(), "sw.js", (source) => source.replace(
      "fetch(event.request)",
      'fetch("https://telemetry.example/collect")',
    ));
    const report = auditStaticOfflineNetworkFiles(files);

    assert.equal(report.status, "blocked");
    assert.ok(codes(report).includes("service_worker_fetch_target_unbounded"));
    assert.ok(codes(report).includes("service_worker_external_endpoint"));
  });

  it("does not let a catalog URL authorize the same endpoint in another chunk", () => {
    const files = fixture();
    files.push(file("assets/other.js", `const endpoint="${MODEL_SOURCE_URL}";\n//# sourceMappingURL=other.js.map`));
    files.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));
    const report = auditStaticOfflineNetworkFiles(files);

    assert.equal(report.status, "blocked");
    assert.ok(report.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === MODEL_SOURCE_URL));
  });

  it("inventories inert reviewed-profile evidence literals without authorizing another chunk", () => {
    let accepted = replace(fixture(), "assets/app.js.map", (source) => {
      const map = JSON.parse(source);
      map.sources.push("../../../../packages/design-library/src/bundled-reviewed-release.ts");
      map.sourcesContent.push(REVIEWED_RELEASE_SOURCE);
      return JSON.stringify(map);
    });
    accepted = replace(accepted, "assets/app.js", (source) => source.replace(
      "//# sourceMappingURL=app.js.map",
      `const evidence="${PROFILE_EVIDENCE_URL}";\n//# sourceMappingURL=app.js.map`,
    ));
    const acceptedReport = auditStaticOfflineNetworkFiles(accepted);
    assert.equal(acceptedReport.status, "pass", JSON.stringify(acceptedReport.findings, null, 2));

    const sameChunk = replace(accepted, "assets/app.js", (source) => source.replace(
      "//# sourceMappingURL=app.js.map",
      `const unrelated="${UNRELATED_PROFILE_URL}";\n//# sourceMappingURL=app.js.map`,
    ));
    const sameChunkReport = auditStaticOfflineNetworkFiles(sameChunk);
    assert.equal(sameChunkReport.status, "blocked");
    assert.ok(sameChunkReport.findings.some((entry) => entry.path === "assets/app.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === UNRELATED_PROFILE_URL));

    accepted.push(file("assets/other.js", `const endpoint="${PROFILE_EVIDENCE_URL}";\n//# sourceMappingURL=other.js.map`));
    accepted.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));
    const changedReport = auditStaticOfflineNetworkFiles(accepted);
    assert.ok(changedReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === PROFILE_EVIDENCE_URL));
  });

  it("allows only the exact hash-bound inert reviewed-profile geometry projection", () => {
    const report = auditStaticOfflineNetworkFiles(withReviewedProfileGeometryEvidence(fixture()));

    assert.equal(report.status, "pass", JSON.stringify(report.findings, null, 2));
    assert.ok(report.evidence.externalNavigationOrigins.includes("https://webench.ti.com"));
  });

  it("blocks reviewed-profile geometry identity tampering and active use", () => {
    const changedEvidenceHash = REVIEWED_PROFILE_GEOMETRY_BINDINGS.map((binding, index) => index === 0
      ? { ...binding, evidenceContentHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }
      : binding);
    const changedProfileHash = REVIEWED_PROFILE_GEOMETRY_BINDINGS.map((binding, index) => index === 1
      ? { ...binding, profileContentHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }
      : binding);
    const changedUrl = REVIEWED_PROFILE_GEOMETRY_BINDINGS.map((binding, index) => index === 0
      ? { ...binding, url: "https://vendor.example/cad/DRV8876_PWP_16-changed.bxl" }
      : binding);
    const unpinnedRelease = withReviewedProfileGeometryEvidence(fixture(), {
      releaseSource: `${REVIEWED_RELEASE_SOURCE}\n`,
    });
    const activeFetch = withReviewedProfileGeometryEvidence(fixture(), {
      emittedExtra: "fetch(reviewedProfileGeometry[0].url);",
    });
    const cases = [
      withReviewedProfileGeometryEvidence(fixture(), { bindings: changedEvidenceHash }),
      withReviewedProfileGeometryEvidence(fixture(), { bindings: changedProfileHash }),
      withReviewedProfileGeometryEvidence(fixture(), { bindings: changedUrl }),
      unpinnedRelease,
      activeFetch,
      withReviewedProfileGeometryEvidence(fixture(), {
        emittedExtra: "window.open(reviewedProfileGeometry[0].url, '_blank');",
      }),
    ];

    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("reviewed_profile_geometry_evidence_boundary_changed"));
    }
    assert.ok(codes(auditStaticOfflineNetworkFiles(unpinnedRelease)).includes("reviewed_release_projection_unpinned"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(activeFetch)).includes("emitted_network_capability_unaccounted"));
  });

  it("does not let reviewed-profile geometry evidence move to another source or chunk", () => {
    const sameChunk = withReviewedProfileGeometryEvidence(fixture(), {
      additionalSources: [[
        "../../src/features/designer/OtherView.ts",
        `const geometry = "${REVIEWED_PROFILE_GEOMETRY_BINDINGS[0].url}";`,
      ]],
    });
    const sameChunkReport = auditStaticOfflineNetworkFiles(sameChunk);
    assert.equal(sameChunkReport.status, "blocked");
    assert.ok(sameChunkReport.findings.some((entry) => entry.code === "reviewed_profile_geometry_evidence_source_unapproved"
      && entry.detail.endsWith("/src/features/designer/OtherView.ts")));

    const wrongReleaseSource = auditStaticOfflineNetworkFiles(withReviewedProfileGeometryEvidence(fixture(), {
      releaseSourcePath: "../../src/features/designer/OtherView.ts",
    }));
    assert.equal(wrongReleaseSource.status, "blocked");
    assert.ok(codes(wrongReleaseSource).includes("reviewed_profile_geometry_evidence_boundary_changed"));

    const anotherChunk = withReviewedProfileGeometryEvidence(fixture());
    const url = REVIEWED_PROFILE_GEOMETRY_BINDINGS[0].url;
    anotherChunk.push(file("assets/other.js", `const geometry="${url}";\n//# sourceMappingURL=other.js.map`));
    anotherChunk.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));
    const anotherChunkReport = auditStaticOfflineNetworkFiles(anotherChunk);
    assert.equal(anotherChunkReport.status, "blocked");
    assert.ok(anotherChunkReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === url));
  });

  it("allows only the exact inert Diodes TVS profile projection from catalog 2026-08-27.2", () => {
    const releaseOnly = auditStaticOfflineNetworkFiles(withReviewedMotorTvsProfileProjection(fixture()));
    const releaseWithExactProfileSource = auditStaticOfflineNetworkFiles(withReviewedMotorTvsProfileProjection(fixture(), {
      includeProfileSource: true,
    }));

    assert.equal(releaseOnly.status, "pass", JSON.stringify(releaseOnly.findings, null, 2));
    assert.equal(
      releaseWithExactProfileSource.status,
      "pass",
      JSON.stringify(releaseWithExactProfileSource.findings, null, 2),
    );
    assert.ok(releaseOnly.evidence.externalNavigationOrigins.includes("https://www.diodes.com"));
  });

  it("rejects changed Diodes TVS URL, evidence identity, profile binding, and catalog release", () => {
    const alteredUrl = withReviewedMotorTvsProfileProjection(fixture(), {
      url: "https://www.diodes.com/datasheet/download/ds40742-changed.pdf",
    });
    const driftedEmittedFacts = withReviewedMotorTvsProfileProjection(fixture(), {
      standOffVoltage: 34,
    });
    const cases = [
      alteredUrl,
      driftedEmittedFacts,
      withReviewedMotorTvsProfileProjection(fixture(), {
        sourceId: "diodes-incorporated-3-0smcj-automotive-ds40742-changed",
      }),
      withReviewedMotorTvsProfileProjection(fixture(), {
        sourceHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withReviewedMotorTvsProfileProjection(fixture(), {
        profileHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withReviewedMotorTvsProfileProjection(fixture(), { manufacturerId: "unreviewed-vendor" }),
      withReviewedMotorTvsProfileProjection(fixture(), { manufacturerPartNumber: "3.0SMCJ33CAQ-CHANGED" }),
      withReviewedMotorTvsProfileProjection(fixture(), { catalogVersion: "2026-08-26.19" }),
      withReviewedMotorTvsProfileProjection(fixture(), {
        catalogHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withReviewedMotorTvsProfileProjection(fixture(), { releaseSource: `${REVIEWED_RELEASE_SOURCE}\n` }),
      withReviewedMotorTvsProfileProjection(fixture(), { evidenceCount: 24 }),
    ];

    for (const [index, files] of cases.entries()) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked", `mutation ${index}: ${JSON.stringify(report.findings, null, 2)}`);
    }
    assert.ok(codes(auditStaticOfflineNetworkFiles(alteredUrl)).includes("runtime_external_endpoint_unapproved"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(driftedEmittedFacts)).includes("motor_tvs_reviewed_profile_projection_boundary_changed"));
    for (const files of cases.slice(1)) {
      assert.ok(codes(auditStaticOfflineNetworkFiles(files)).includes("motor_tvs_reviewed_profile_projection_boundary_changed"));
    }
  });

  it("does not let the Diodes TVS allowance move to or multiply in another source or chunk", () => {
    const unrelatedSource = withReviewedMotorTvsProfileProjection(fixture(), {
      additionalSources: [[
        "../../src/features/designer/OtherView.ts",
        `const endpoint = "${MOTOR_TVS_EVIDENCE_URL}";`,
      ]],
    });
    const wrongProfileSource = withReviewedMotorTvsProfileProjection(fixture(), {
      additionalSources: [[
        "../../../../packages/design-library/parts/motor.supply-tvs-diode/other/Other.json",
        MOTOR_TVS_REVIEWED_PROFILE_SOURCE,
      ]],
    });
    const changedProfileSource = withReviewedMotorTvsProfileProjection(fixture(), {
      includeProfileSource: true,
      profileSource: `${MOTOR_TVS_REVIEWED_PROFILE_SOURCE}\n`,
    });
    const duplicateProjection = withReviewedMotorTvsProfileProjection(fixture(), {
      emittedExtra: `const duplicateEvidence = "${MOTOR_TVS_EVIDENCE_URL}";`,
    });
    const anotherChunk = withReviewedMotorTvsProfileProjection(fixture());
    anotherChunk.push(file("assets/other.js", `const endpoint="${MOTOR_TVS_EVIDENCE_URL}";\n//# sourceMappingURL=other.js.map`));
    anotherChunk.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));

    const unrelatedSourceReport = auditStaticOfflineNetworkFiles(unrelatedSource);
    assert.ok(unrelatedSourceReport.findings.some((entry) => entry.code === "motor_tvs_reviewed_profile_source_unapproved"
      && entry.detail.endsWith("/src/features/designer/OtherView.ts")));
    assert.ok(codes(auditStaticOfflineNetworkFiles(wrongProfileSource)).includes("motor_tvs_reviewed_profile_source_unapproved"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(changedProfileSource)).includes("motor_tvs_reviewed_profile_source_changed"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(duplicateProjection)).includes("motor_tvs_reviewed_profile_projection_boundary_changed"));
    const anotherChunkReport = auditStaticOfflineNetworkFiles(anotherChunk);
    assert.ok(anotherChunkReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === MOTOR_TVS_EVIDENCE_URL));
  });

  it("keeps Diodes TVS fetch, navigation, embedded-resource, and broader-domain use fail-closed", () => {
    const cases = [
      withReviewedMotorTvsProfileProjection(fixture(), {
        emittedExtra: "fetch(tvsEvidence[0].url);",
      }),
      withReviewedMotorTvsProfileProjection(fixture(), {
        emittedExtra: "window.open(tvsEvidence[0].url, '_blank');",
      }),
      withReviewedMotorTvsProfileProjection(fixture(), {
        emittedExtra: 'document.createElement("img").src=tvsEvidence[0].url;',
      }),
      withReviewedMotorTvsProfileProjection(fixture(), {
        emittedExtra: 'const broaderDiodesEndpoint="https://www.diodes.com/unreviewed";',
      }),
    ];

    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("motor_tvs_reviewed_profile_projection_boundary_changed"));
    }
    assert.ok(codes(auditStaticOfflineNetworkFiles(cases[0])).includes("emitted_network_capability_unaccounted"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(cases.at(-1))).includes("runtime_external_endpoint_unapproved"));
  });

  it("allows only the exact hash-bound inert Motor mode evidence source", () => {
    const predecessor = auditStaticOfflineNetworkFiles(withMotorModeEvidence(fixture()));
    const bindingRefreshedPredecessor = auditStaticOfflineNetworkFiles(withMotorModeEvidence(fixture(), {
      profileHash: MOTOR_MODE_EVIDENCE_REFRESHED_PROFILE_HASH,
      sourcePath: "../../../../packages/design-recipes/src/motor-integrated-v32-mode-qualified-binding-refreshed.ts",
      version: "3.2.4",
      predecessorImport: 'import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED } from "./motor-integrated-v32-mode-qualified";',
    }));
    const successor = auditStaticOfflineNetworkFiles(withMotorLocalNominalEvidence(fixture()));

    assert.equal(predecessor.status, "pass", JSON.stringify(predecessor.findings, null, 2));
    assert.equal(bindingRefreshedPredecessor.status, "pass", JSON.stringify(bindingRefreshedPredecessor.findings, null, 2));
    assert.equal(successor.status, "pass", JSON.stringify(successor.findings, null, 2));
    assert.ok(successor.evidence.externalNavigationOrigins.includes("https://www.ti.com"));
    assert.ok(successor.evidence.externalNavigationOrigins.includes("https://product.tdk.com"));
  });

  it("fails closed when the installed Motor 3.2.5 local recommendation identity drifts", () => {
    const cases = [
      withMotorLocalNominalEvidence(fixture(), {
        localSourceHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withMotorLocalNominalEvidence(fixture(), {
        localProfileHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withMotorLocalNominalEvidence(fixture(), {
        localUrl: "https://product.tdk.com/changed",
      }),
      withMotorLocalNominalEvidence(fixture(), {
        predecessorImport: 'import { changed } from "./motor-integrated-v32-mode-qualified-binding-refreshed";',
      }),
    ];

    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("motor_mode_evidence_boundary_changed"));
    }
  });

  it("allows only the exact inert Motor 3.2.6 DRV8262 companion-network rejection evidence", () => {
    const report = auditStaticOfflineNetworkFiles(withMotorDrv8262CompanionGateEvidence(fixture()));

    assert.equal(report.status, "pass", JSON.stringify(report.findings, null, 2));
    assert.ok(report.evidence.externalNavigationOrigins.includes("https://www.ti.com"));
  });

  it("fails closed when the Motor 3.2.6 DRV8262 gate binding, source, or inert projection drifts", () => {
    const cases = [
      withMotorDrv8262CompanionGateEvidence(fixture(), {
        sourceHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withMotorDrv8262CompanionGateEvidence(fixture(), {
        profileHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
      withMotorDrv8262CompanionGateEvidence(fixture(), {
        profileId: "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262-CHANGED.json",
      }),
      withMotorDrv8262CompanionGateEvidence(fixture(), { version: "3.2.7" }),
      withMotorDrv8262CompanionGateEvidence(fixture(), {
        url: "https://www.ti.com/lit/ds/symlink/drv8262-changed.pdf",
      }),
      withMotorDrv8262CompanionGateEvidence(fixture(), {
        sourceExtra: "fetch(evidence.url);",
        emittedExtra: "fetch(evidence.url);",
      }),
      withMotorDrv8262CompanionGateEvidence(fixture(), {
        emittedExtra: "window.open(evidence.url, '_blank');",
      }),
    ];

    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
    }
    assert.ok(codes(auditStaticOfflineNetworkFiles(cases[0]))
      .includes("motor_drv8262_companion_gate_evidence_boundary_changed"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(cases.at(-1)))
      .includes("motor_drv8262_companion_gate_projection_boundary_changed"));
  });

  it("does not let the DRV8262 companion-gate URL authorize another source or chunk", () => {
    const sameChunk = withMotorDrv8262CompanionGateEvidence(fixture(), {
      sourceExtra: `const duplicateEndpoint = "${MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL}";`,
    });
    const sameChunkReport = auditStaticOfflineNetworkFiles(sameChunk);
    assert.equal(sameChunkReport.status, "blocked");
    assert.ok(codes(sameChunkReport).includes("motor_drv8262_companion_gate_evidence_boundary_changed"));

    const anotherChunk = withMotorDrv8262CompanionGateEvidence(fixture());
    anotherChunk.push(file(
      "assets/other.js",
      `const endpoint="${MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL}";\n//# sourceMappingURL=other.js.map`,
    ));
    anotherChunk.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));
    const anotherChunkReport = auditStaticOfflineNetworkFiles(anotherChunk);
    assert.equal(anotherChunkReport.status, "blocked");
    assert.ok(anotherChunkReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL));
  });

  it("does not let the Motor mode evidence URL authorize another source or chunk", () => {
    const sameChunk = replace(withMotorModeEvidence(fixture()), "assets/app.js.map", (source) => {
      const map = JSON.parse(source);
      map.sources.push("../../src/features/designer/OtherView.ts");
      map.sourcesContent.push(`const endpoint = "${MOTOR_MODE_EVIDENCE_URL}";`);
      return JSON.stringify(map);
    });
    const sameChunkReport = auditStaticOfflineNetworkFiles(sameChunk);
    assert.equal(sameChunkReport.status, "blocked");
    assert.ok(sameChunkReport.findings.some((entry) => entry.code === "motor_mode_evidence_source_unapproved"
      && entry.detail.endsWith("/src/features/designer/OtherView.ts")));

    const anotherChunk = withMotorModeEvidence(fixture());
    anotherChunk.push(file("assets/other.js", `const endpoint="${MOTOR_MODE_EVIDENCE_URL}";\n//# sourceMappingURL=other.js.map`));
    anotherChunk.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));
    const anotherChunkReport = auditStaticOfflineNetworkFiles(anotherChunk);
    assert.equal(anotherChunkReport.status, "blocked");
    assert.ok(anotherChunkReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === MOTOR_MODE_EVIDENCE_URL));
  });

  it("blocks changed Motor evidence identity, URL, and active access or navigation", () => {
    const cases = [
      withMotorModeEvidence(fixture(), { sourceHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }),
      withMotorModeEvidence(fixture(), { url: "https://www.ti.com/lit/ds/symlink/changed.pdf" }),
      withMotorModeEvidence(fixture(), {
        sourceExtra: "fetch(evidence.url);",
        emittedExtra: "fetch(motorEvidence);",
      }),
      withMotorModeEvidence(fixture(), {
        sourceExtra: "window.open(evidence.url, '_blank');",
        emittedExtra: "window.open(motorEvidence,'_blank');",
      }),
    ];

    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("motor_mode_evidence_boundary_changed"));
    }
    const fetchReport = auditStaticOfflineNetworkFiles(cases[2]);
    assert.ok(codes(fetchReport).includes("source_network_capability_unapproved"));
    assert.ok(codes(fetchReport).includes("emitted_network_capability_unaccounted"));
  });

  it("allows only the exact inert MIC4606 Rev-H direct-gate and split capacitor-role source", () => {
    const report = auditStaticOfflineNetworkFiles(withMotorDirectGateEvidence(fixture()));

    assert.equal(report.status, "pass", JSON.stringify(report.findings, null, 2));
    assert.ok(report.evidence.externalNavigationOrigins.includes("https://ww1.microchip.com"));
  });

  it("rejects emitted-only Diodes TVS navigation, resource, transform, and accounted-fetch destinations", () => {
    const cases = [
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: "window.open(motorTvsEvidence, '_blank');",
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: "location.href=motorTvsEvidence;",
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: "const tvsImage=new Image();tvsImage.src=motorTvsEvidence;",
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'const rewritten=motorTvsEvidence.replace("www.diodes.com","evil.example");location.href=rewritten;',
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'globalThis["fetch"](motorTvsBinding.source.url);',
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'window["open"](motorTvsBinding.source.url,"_blank");',
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'document["createElement"]("img")["src"]=motorTvsBinding.source.url;',
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'window["location"]["href"]=motorTvsBinding.source.url;',
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: "globalThis.fetch.call(globalThis,motorTvsBinding.source.url);",
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: "Reflect.apply(globalThis.fetch,globalThis,[motorTvsBinding.source.url]);",
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'navigator["sendBeacon"](motorTvsBinding.source.url);',
      }),
      withMotorDirectGateEvidence(fixture(), {
        emittedExtra: 'globalThis["fetch"](motorTvsBinding.source.url.split("www.diodes.com").join("evil.example"));',
      }),
    ];
    const replacedInertBinding = replace(
      withMotorDirectGateEvidence(fixture()),
      "assets/motor-recipe.js",
      (source) => source.replace(
        "const motorTvsBinding={source:{url:motorTvsEvidence}};",
        "window.open(motorTvsEvidence, '_blank');",
      ),
    );
    cases.push(replacedInertBinding);

    let accountedFetch = replace(
      withMotorDirectGateEvidence(fixture()),
      "assets/motor-recipe.js.map",
      (source) => {
        const map = JSON.parse(source);
        map.sources.push("../../../../tools/ngspice-wasm-build/dist/ngspice.mjs");
        map.sourcesContent.push('async function load(url) { await fetch(url, { credentials: "same-origin" }); return new XMLHttpRequest(); }');
        map.sources.push("../../../../tools/ngspice-wasm-build/dist-loader/index.mjs");
        map.sourcesContent.push('const wasmUrl = new URL("../dist/ngspice.wasm", import.meta.url); const options = { locateFile: (path) => path.endsWith(".wasm") ? wasmUrl.href : path };');
        return JSON.stringify(map);
      },
    );
    accountedFetch = replace(accountedFetch, "assets/motor-recipe.js", (source) => source.replace(
      "//# sourceMappingURL=motor-recipe.js.map",
      'fetch(motorTvsEvidence,{credentials:"same-origin"});new XMLHttpRequest();\n//# sourceMappingURL=motor-recipe.js.map',
    ));
    cases.push(accountedFetch);

    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("motor_tvs_emitted_artifact_hash_changed"));
    }
    assert.ok(codes(auditStaticOfflineNetworkFiles(cases[0])).includes("motor_tvs_recipe_projection_boundary_changed"));
    const accountedFetchReport = auditStaticOfflineNetworkFiles(accountedFetch);
    assert.ok(!codes(accountedFetchReport).includes("emitted_network_capability_unaccounted"));
  });

  it("blocks changed MIC4606 direct-gate or capacitor-role identity, release, source placement, and active access", () => {
    const cases = [
      withMotorDirectGateEvidence(fixture(), { sourceHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }),
      withMotorDirectGateEvidence(fixture(), { profileHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }),
      withMotorDirectGateEvidence(fixture(), { predecessorHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }),
      withMotorDirectGateEvidence(fixture(), { version: "3.1.4" }),
      withMotorDirectGateEvidence(fixture(), {
        capacitorProfileHashes: MOTOR_CAPACITOR_ROLE_PROFILE_HASHES.slice(1),
      }),
      withMotorDirectGateEvidence(fixture(), {
        excludedCapacitorProfileHash: MOTOR_CAPACITOR_ROLE_EXCLUDED_PROFILE_HASH,
      }),
      withMotorDirectGateEvidence(fixture(), { url: "https://ww1.microchip.com/changed.pdf" }),
      withMotorDirectGateEvidence(fixture(), {
        sourceExtra: "fetch(evidence.url);",
        emittedExtra: "fetch(motorDirectGateEvidence);",
      }),
    ];
    for (const files of cases) {
      const report = auditStaticOfflineNetworkFiles(files);
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("motor_direct_gate_evidence_boundary_changed"));
    }

    const anotherSource = replace(withMotorDirectGateEvidence(fixture()), "assets/app.js.map", (source) => {
      const map = JSON.parse(source);
      map.sources.push("../../src/features/designer/OtherView.ts");
      map.sourcesContent.push(`const endpoint = "${MOTOR_DIRECT_GATE_EVIDENCE_URL}";`);
      return JSON.stringify(map);
    });
    const anotherSourceReport = auditStaticOfflineNetworkFiles(anotherSource);
    assert.equal(anotherSourceReport.status, "blocked");
    assert.ok(anotherSourceReport.findings.some((entry) => entry.code === "motor_direct_gate_evidence_source_unapproved"
      && entry.detail.endsWith("/src/features/designer/OtherView.ts")));

    const anotherChunk = withMotorDirectGateEvidence(fixture());
    anotherChunk.push(file("assets/other.js", `const endpoint="${MOTOR_DIRECT_GATE_EVIDENCE_URL}";\n//# sourceMappingURL=other.js.map`));
    anotherChunk.push(file("assets/other.js.map", mapFile([["../../src/other.ts", "export {};"]])));
    const anotherChunkReport = auditStaticOfflineNetworkFiles(anotherChunk);
    assert.equal(anotherChunkReport.status, "blocked");
    assert.ok(anotherChunkReport.findings.some((entry) => entry.path === "assets/other.js"
      && entry.code === "runtime_external_endpoint_unapproved"
      && entry.detail === MOTOR_DIRECT_GATE_EVIDENCE_URL));

    const fetchReport = auditStaticOfflineNetworkFiles(cases.at(-1));
    assert.ok(codes(fetchReport).includes("source_network_capability_unapproved"));
    assert.ok(codes(fetchReport).includes("emitted_network_capability_unaccounted"));
  });

  it("pins the aggregate production artifact set against consumer mutation, stale maps, add/remove, and swaps", () => {
    const baseline = withReviewedMotorTvsProfileProjection(withMotorDirectGateEvidence(fixture()));
    const expectedArtifactSetHash = artifactSetHash(baseline);
    const accepted = auditStaticOfflineNetworkFiles(baseline, { expectedArtifactSetHash });
    const reordered = auditStaticOfflineNetworkFiles([...baseline].reverse(), { expectedArtifactSetHash });
    assert.equal(accepted.status, "pass", JSON.stringify(accepted.findings, null, 2));
    assert.equal(reordered.status, "pass", JSON.stringify(reordered.findings, null, 2));
    assert.equal(accepted.artifactSetHash, expectedArtifactSetHash);

    const consumerMutation = replace(baseline, "assets/app.js", (source) => source.replace(
      "//# sourceMappingURL=app.js.map",
      'globalThis["fetch"](releaseDocuments.profiles[0].facts.standOffVoltage.evidence[0].url);\n//# sourceMappingURL=app.js.map',
    ));
    const staleRecipeMap = replace(baseline, "assets/motor-recipe.js", (source) => source.replace(
      "//# sourceMappingURL=motor-recipe.js.map",
      'window["open"](motorTvsBinding.source.url,"_blank");\n//# sourceMappingURL=motor-recipe.js.map',
    ));
    const postInitializationProfileMutation = replace(baseline, "assets/reviewed-tvs.js", (source) => source.replace(
      ',nextProfile="schemagic-design-profile"',
      ';tvsFacts.standOffVoltage.value.value=34;const nextProfile="schemagic-design-profile"',
    ));
    const addedArtifact = [...baseline, file("notices/unreviewed-extra.txt", "unexpected")];
    const removedArtifact = baseline.filter((entry) => entry.path !== "assets/app.css");
    const recipeBytes = baseline.find((entry) => entry.path === "assets/motor-recipe.js")?.bytes;
    const reviewedBytes = baseline.find((entry) => entry.path === "assets/reviewed-tvs.js")?.bytes;
    assert.ok(recipeBytes);
    assert.ok(reviewedBytes);
    const swappedArtifacts = baseline.map((entry) => entry.path === "assets/motor-recipe.js"
      ? { ...entry, bytes: reviewedBytes }
      : entry.path === "assets/reviewed-tvs.js"
        ? { ...entry, bytes: recipeBytes }
        : entry);

    for (const files of [
      consumerMutation,
      staleRecipeMap,
      postInitializationProfileMutation,
      addedArtifact,
      removedArtifact,
      swappedArtifacts,
    ]) {
      const report = auditStaticOfflineNetworkFiles(files, { expectedArtifactSetHash });
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("production_artifact_set_changed"));
    }
    assert.ok(codes(auditStaticOfflineNetworkFiles(staleRecipeMap, { expectedArtifactSetHash }))
      .includes("motor_tvs_emitted_artifact_hash_changed"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(postInitializationProfileMutation, { expectedArtifactSetHash }))
      .includes("motor_tvs_emitted_artifact_hash_changed"));
    assert.throws(
      () => auditStaticOfflineNetworkFiles(baseline, { expectedArtifactSetHash: "untrusted" }),
      /sha256 identity/u,
    );
  });

  it("hashes exact raw artifact paths and rejects noncanonical aliases and identity collisions", () => {
    const baseline = fixture();
    const expectedArtifactSetHash = artifactSetHash(baseline);
    const renamePath = (from, to) => baseline.map((entry) => entry.path === from
      ? { ...entry, path: to }
      : entry);
    const renamedPaths = [
      ["index.html", "index.html?missing"],
      ["sw.js", "sw.js#missing"],
      ["assets/app.js", "assets\\app.js"],
      ["sw.js", "assets/%2e%2e/sw.js"],
    ];

    for (const [from, to] of renamedPaths) {
      const report = auditStaticOfflineNetworkFiles(renamePath(from, to), { expectedArtifactSetHash });
      assert.equal(report.status, "blocked");
      assert.notEqual(report.artifactSetHash, expectedArtifactSetHash);
      assert.ok(codes(report).includes("artifact_path_noncanonical"));
      assert.ok(codes(report).includes("production_artifact_set_changed"));
    }

    const noncanonicalPaths = [
      "/index.html",
      "assets/",
      "assets//app.js",
      "./index.html",
      "assets/./app.js",
      "assets/chunk/../app.js",
      "assets/%2e/app.js",
      "assets/%2Fapp.js",
      "assets/app.js%23fragment",
      "C:/dist/index.html",
    ];
    for (const path of noncanonicalPaths) {
      const report = auditStaticOfflineNetworkFiles([...baseline, file(path)], { expectedArtifactSetHash });
      assert.equal(report.status, "blocked");
      assert.ok(codes(report).includes("artifact_path_noncanonical"));
      assert.ok(codes(report).includes("production_artifact_set_changed"));
    }

    const rawDuplicate = auditStaticOfflineNetworkFiles(
      [...baseline, file("assets/app.css", "duplicate")],
      { expectedArtifactSetHash },
    );
    assert.equal(rawDuplicate.status, "blocked");
    assert.ok(codes(rawDuplicate).includes("artifact_path_duplicate"));
    assert.ok(codes(rawDuplicate).includes("production_artifact_set_changed"));

    const normalizedDuplicate = auditStaticOfflineNetworkFiles(
      [...baseline, file("assets\\app.css", "duplicate")],
      { expectedArtifactSetHash },
    );
    assert.equal(normalizedDuplicate.status, "blocked");
    assert.ok(codes(normalizedDuplicate).includes("artifact_path_noncanonical"));
    assert.ok(codes(normalizedDuplicate).includes("artifact_path_identity_collision"));
    assert.ok(codes(normalizedDuplicate).includes("production_artifact_set_changed"));
  });

  it("fails closed when source maps or referenced local artifacts are absent", () => {
    const noMap = fixture().filter((entry) => entry.path !== "assets/app.js.map");
    const missingAsset = replace(fixture(), "index.html", (source) => source.replace("app.css", "missing.css"));

    assert.ok(codes(auditStaticOfflineNetworkFiles(noMap)).includes("source_map_missing"));
    assert.ok(codes(auditStaticOfflineNetworkFiles(missingAsset)).includes("local_artifact_reference_missing"));
  });
});
