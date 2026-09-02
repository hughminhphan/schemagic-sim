import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STATIC_OFFLINE_AUDIT_LIMITATIONS = Object.freeze([
  "Static artifact and source-map inspection does not execute the service worker or prove cache population, navigation fallback, storage persistence or eviction, deployed routes, response headers, CDN behavior, or browser-specific offline behavior.",
  "User-initiated external catalog provenance and shipped documentation links are inventoried but remain outside same-origin offline availability.",
  "Pattern inspection cannot prove behavior after runtime DOM mutation, browser-extension interference, origin compromise, or code that is absent from the shipped production artifacts and source maps.",
]);

const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map", ".md", ".txt", ".webmanifest", ".xml"]);
const LCSC_SEARCH_PREFIX = "https://www.lcsc.com/search?q=";
const MOTOR_MODE_EVIDENCE_URL = "https://www.ti.com/lit/ds/symlink/drv8876.pdf";
const MOTOR_MODE_EVIDENCE_SOURCE_ID = "ti-drv8876-slvsds7b";
const MOTOR_MODE_EVIDENCE_SOURCE_HASH = "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032";
const MOTOR_MODE_EVIDENCE_PROFILE_HASH = "sha256:1786e77a459d8efbc83693b2c79770a3673d6b28e093b3f4f655468156850ef5";
const MOTOR_MODE_EVIDENCE_RECIPE_SOURCE = "/packages/design-recipes/src/motor-integrated-v32-mode-qualified.ts";
const MOTOR_MODE_EVIDENCE_REFRESHED_PROFILE_HASH = "sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b";
const MOTOR_MODE_EVIDENCE_BINDING_REFRESHED_RECIPE_SOURCE = "/packages/design-recipes/src/motor-integrated-v32-mode-qualified-binding-refreshed.ts";
const MOTOR_LOCAL_NOMINAL_RECIPE_SOURCE = "/packages/design-recipes/src/motor-integrated-v32-local-capacitance-recommendation-qualified.ts";
const MOTOR_LOCAL_NOMINAL_EVIDENCE_URL = "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info/print_pdf";
const MOTOR_LOCAL_NOMINAL_EVIDENCE_SOURCE_ID = "tdk-c1608x7r1h104k080aa-product-pdf";
const MOTOR_LOCAL_NOMINAL_EVIDENCE_SOURCE_HASH = "sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12";
const MOTOR_LOCAL_NOMINAL_PROFILE_HASH = "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6";
const MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL = "https://www.ti.com/lit/ds/symlink/drv8262.pdf";
const MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_ID = "ti-drv8262-slvsfv5c";
const MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_HASH = "sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7";
const MOTOR_DRV8262_COMPANION_GATE_PROFILE_ID = "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
const MOTOR_DRV8262_COMPANION_GATE_PROFILE_HASH = "sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a";
const MOTOR_DRV8262_COMPANION_GATE_RECIPE_SOURCE = "/packages/design-recipes/src/motor-integrated-v32-companion-network-gated.ts";
const MOTOR_DIRECT_GATE_EVIDENCE_URL = "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-85V-Full-Bridge-MOSFET-Drivers-with-Adaptive-Dead-Time-and-Shoot-Through-Protection-DS20005604.pdf";
const MOTOR_DIRECT_GATE_EVIDENCE_SOURCE_ID = "microchip-mic4606-ds20005604h";
const MOTOR_DIRECT_GATE_EVIDENCE_SOURCE_HASH = "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135";
const MOTOR_DIRECT_GATE_EVIDENCE_PROFILE_HASH = "sha256:1fd9a7097dd7359f39cfd1fa285671d830ba9e544d16e37a34d28854efbb2f47";
const MOTOR_DIRECT_GATE_PREDECESSOR_HASH = "sha256:ef1b07d8b547bf4d46ce2bc76943059e8fa597d52d63e4b62d9d5c4de0bc2187";
const MOTOR_TVS_EVIDENCE_URL = "https://www.diodes.com/datasheet/download/ds40742.pdf";
const MOTOR_TVS_EVIDENCE_SOURCE_ID = "diodes-incorporated-3-0smcj-automotive-ds40742";
const MOTOR_TVS_EVIDENCE_SOURCE_HASH = "sha256:129ff67711acc37fafc6f23d448cfb28e66d98ac7a43fa3a723ad33a736c4a24";
const MOTOR_TVS_EVIDENCE_PROFILE_HASH = "sha256:f67d5716b2900039b09040038e3e5c8c059bf19edd12cf3776145c9f46097474";
const MOTOR_TVS_PREDECESSOR_HASH = "sha256:93e6306249d0b8376a214c8b8a2dd6c7058e17cf9fb907e91ac8082552a05320";
const MOTOR_TVS_REVIEWED_PROFILE_SOURCE = "/packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";
const MOTOR_TVS_REVIEWED_PROFILE_ID = "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";
const MOTOR_TVS_REVIEWED_PROFILE_SOURCE_HASH = "sha256:39ee49a9b53ff19a4855bb39b4a9015328c05627481f640632c06a564f89f0c6";
const MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT = 25;
const MOTOR_TVS_REVIEWED_PROFILE_PATH_COUNT = 4;
const MOTOR_TVS_REVIEWED_PROFILE_HASH_COUNT = 2;
const MOTOR_TVS_REVIEWED_CATALOG_VERSION = "2026-08-27.2";
const MOTOR_TVS_REVIEWED_CATALOG_HASH = "sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e";
const MOTOR_TVS_RECIPE_EMITTED_ARTIFACT_HASH = "sha256:2c8e772db242f29e0b0250d869484fe3d87b8e67928f078b2067ce6fece6baea";
const MOTOR_TVS_REVIEWED_EMITTED_ARTIFACT_HASH = "sha256:20a413e5544e573fb49646087da46738868edad4e5f6d78488400cab7171da8d";
const MOTOR_DRV8262_COMPANION_GATE_EMITTED_ARTIFACT_HASH = "sha256:2c8e772db242f29e0b0250d869484fe3d87b8e67928f078b2067ce6fece6baea";
const PRODUCTION_ARTIFACT_SET_HASH = "sha256:32902477068389d8cd8478dd1ed2b817b1b52e55620f100d3bf7eda8eee311a3";
const MOTOR_CAPACITOR_ROLE_PROFILE_HASHES = Object.freeze([
  "sha256:8169f8d3935539ae0d5725266cef8d18726340facc59f372a85f4d0df341a992",
  "sha256:a182dcfcbf2383bbb1820e3c9577915ba2d7ef1981a1f4f57d05cbb621856c99",
  "sha256:5c644b5acd334650b9d79dc0158a102d3d99144c43e2385718d789b69bffd6dd",
]);
const MOTOR_CAPACITOR_ROLE_EXCLUDED_PROFILE_HASH = "sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6";
const MOTOR_DIRECT_GATE_EVIDENCE_RECIPE_SOURCE = "/packages/design-recipes/src/motor-external-v2.ts";
const BUNDLED_REVIEWED_RELEASE_SOURCE_HASH = "sha256:a8881cf53afb18c75bc9ebdf077a4c563e20fed215adba720488f6072e82c116";
const REVIEWED_PROFILE_EVIDENCE_URLS = Object.freeze([
  "https://industrial.panasonic.com/cdbs/www-data/pdf/RDA0000/AOA0000C304.pdf",
  "https://industrial.panasonic.com/cdbs/www-data/pdf/RDD0000/DMD0000COL4.pdf",
  "https://industrial.panasonic.com/cdbs/www-data/pdf/RDD0000/RDD0000C1244.pdf",
  "https://industrial.panasonic.com/cdbs/www-data/pdf/RDM0000/DMM0000COL17.pdf",
  "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1003V",
  "https://pim.murata.com/asset/pim4/inductor/JELF243B-0047_PDF_INDUCTOR?lastModifiedDatetime=20260706104530",
  "https://pim.murata.com/asset/pim4/ceramicCapacitorSMD/GRM32ER71E226KE15-04CA-EN_PDF_CERAMICCAPACITORSMD?lastModifiedDatetime=20260730173647",
  "https://product.samsungsem.com/mlcc/CL31A106KBHNNN.do",
  "https://product.samsungsem.com/resources/file/product-catalog/MLCC_2512.pdf",
  "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info/print_pdf",
  "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM31CR61H106KA12-01.pdf",
  "https://st.com/resource/en/datasheet/stspin840.pdf",
  "https://ww1.microchip.com/downloads/aemDocuments/documents/APID/ProductDocuments/DataSheets/MIC4606-Data-Sheet-DS20005604D.pdf",
  "https://www.belfuse.com/media/datasheets/products/chokes-coils-inductors/ds-ST-F1F2-0804-series.pdf",
  "https://www.bourns.com/docs/Product-Datasheets/CRA.pdf",
  "https://www.bourns.com/docs/product-datasheets/CRxxxxx.pdf",
  "https://www.bourns.com/docs/product-datasheets/ptvs10-0xxc-sh.pdf",
  "https://www.diodes.com/datasheet/download/1N4148W.pdf",
  "https://www.nichicon.com/en-us/part/ucm1v331mns1gs/2539/",
  "https://www.nichicon.com/getmedia/8caebfb7-5464-4cb6-b2d9-dad04ab4cc75/e-guide_all.pdf",
  "https://www.nichicon.com/getmedia/f527b3ab-1197-491e-9b2c-7ca4b61e1e20/e-ucm5-11.pdf",
  "https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf",
  "https://www.ti.com/lit/ds/symlink/drv8262.pdf",
  MOTOR_MODE_EVIDENCE_URL,
  "https://www.ti.com/lit/ds/symlink/tps54302.pdf",
  "https://www.ti.com/product/TPS54302",
  "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
]);
const REVIEWED_PROFILE_GEOMETRY_EVIDENCE_BINDINGS = Object.freeze([
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
const REQUIRED_SOURCE_BOUNDARIES = Object.freeze([
  "/src/entry.ts",
  "/src/main.ts",
  "/packages/sim-engine/src/client.ts",
  "/packages/sim-engine/src/worker.ts",
  "/tools/ngspice-wasm-build/dist/ngspice.mjs",
  "/tools/ngspice-wasm-build/dist-loader/index.mjs",
  "/src/catalog.ts",
]);

const CAPABILITY_RULES = Object.freeze([
  { id: "service_worker_register", pattern: /\bserviceWorker\s*\.\s*register\s*\(/gu },
  { id: "shared_worker", pattern: /\bnew\s+SharedWorker\s*\(/gu },
  { id: "dedicated_worker", pattern: /\bnew\s+Worker\s*\(/gu },
  { id: "fetch", pattern: /\bfetch\s*\(/gu },
  { id: "xml_http_request", pattern: /\bXMLHttpRequest\b/gu },
  { id: "web_socket", pattern: /\bWebSocket\b/gu },
  { id: "event_source", pattern: /\bEventSource\b/gu },
  { id: "send_beacon", pattern: /\bsendBeacon\s*\(/gu },
  {
    id: "provider_client_access",
    pattern: /\b(?:lcsc|provider|sourcing)[A-Za-z0-9_$]*\s*\.\s*(?:execute|fetch|lookup|query|request|search)\s*\(/giu,
  },
  { id: "web_transport", pattern: /\bWebTransport\b/gu },
  { id: "rtc_peer_connection", pattern: /\bRTCPeerConnection\b/gu },
  { id: "import_scripts", pattern: /\bimportScripts\s*\(/gu },
  { id: "dynamic_link_element", pattern: /\bcreateElement\s*\(\s*["']link["']\s*\)/gu },
  { id: "dynamic_script_element", pattern: /\bcreateElement\s*\(\s*["']script["']\s*\)/gu },
]);

const AUTOMATIC_EXTERNAL_NAVIGATION_RULES = Object.freeze([
  /\b(?:window\s*\.\s*)?open\s*\(/u,
  /\b(?:window\s*\.\s*)?location\s*\.\s*(?:assign|replace)\s*\(/u,
  /\b(?:(?:window|document)\s*\.\s*)?location(?:\s*\.\s*href)?\s*=/u,
  /\bnavigation\s*\.\s*navigate\s*\(/u,
  /\bcreateElement\s*\(\s*["'](?:form|iframe|img|script|link)["']/u,
  /<(?:form|iframe|script|link)\b/iu,
]);
const INERT_EVIDENCE_EMITTED_SINK_RULES = Object.freeze([
  ...AUTOMATIC_EXTERNAL_NAVIGATION_RULES,
  /\bnew\s+Image\s*\(/u,
  /\.\s*(?:src|href|action|poster)\s*=/u,
  /\.\s*(?:replace|replaceAll)\s*\(/u,
  /\bnew\s+URL\s*\(/u,
]);

function compareText(left, right) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function normalizedPath(value) {
  return value.replaceAll("\\", "/").replace(/[?#].*$/u, "");
}

function extension(path) {
  const match = path.match(/(\.[a-z0-9]+)$/iu);
  return match?.[1]?.toLowerCase() ?? "";
}

function artifactPathViolation(path) {
  if (typeof path !== "string") return "Artifact path must be a string.";
  if (path.length === 0) return "Artifact path must not be empty.";
  if (path.startsWith("/") || /^[A-Za-z]:\//u.test(path)) return "Artifact path must be relative.";
  if (path.endsWith("/")) return "Artifact path must not end with a slash.";
  if (path.includes("\\")) return "Artifact path must use POSIX separators.";
  if (/[?#]/u.test(path)) return "Artifact path must not contain URL query or fragment delimiters.";
  if (path.includes("%")) return "Artifact path must not contain percent-encoded path tokens.";
  if (/[\u0000-\u001f\u007f]/u.test(path)) return "Artifact path must not contain control characters.";
  const segments = path.split("/");
  if (segments.includes("")) return "Artifact path must not contain empty segments.";
  if (segments.includes(".") || segments.includes("..")) return "Artifact path must not contain dot segments.";
  return undefined;
}

function normalizedArtifactIdentity(path) {
  return posix.normalize(normalizedPath(path).replace(/^\/+|^\.\//gu, ""));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function freeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}

function finding(path, code, detail) {
  return Object.freeze({ path, code, detail });
}

function countMatches(source, pattern) {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags))].length;
}

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function escapedRegexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function countQuotedLiteral(source, literal) {
  return countMatches(source, new RegExp(`(["'])${escapedRegexLiteral(literal)}\\1`, "gu"));
}

function splitTopLevelCommaDelimited(source) {
  const values = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "{") braces += 1;
    else if (character === "}") braces -= 1;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;
    else if (character === "," && braces === 0 && brackets === 0 && parentheses === 0) {
      values.push(source.slice(start, index));
      start = index + 1;
    }
    if (braces < 0 || brackets < 0 || parentheses < 0) return null;
  }
  if (quote !== null || braces !== 0 || brackets !== 0 || parentheses !== 0) return null;
  values.push(source.slice(start));
  return values;
}

function parseEmittedObjectLiteral(source) {
  if (!source.startsWith("{") || !source.endsWith("}")) return null;
  let json = "";
  let quote = null;
  let escaped = false;
  let expectsKey = false;
  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (quote !== null) {
      json += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === '"') {
      quote = character;
      json += character;
      index += 1;
      continue;
    }
    if (character === "{" || character === ",") {
      expectsKey = true;
      json += character;
      index += 1;
      continue;
    }
    if (expectsKey && /[A-Za-z_$]/u.test(character)) {
      let end = index + 1;
      while (end < source.length && /[\w$]/u.test(source[end])) end += 1;
      let colon = end;
      while (colon < source.length && /\s/u.test(source[colon])) colon += 1;
      if (source[colon] === ":") {
        json += `"${source.slice(index, end)}"`;
        index = end;
        expectsKey = false;
        continue;
      }
    }
    if (!/\s/u.test(character) && character !== "}") expectsKey = false;
    json += character;
    index += 1;
  }
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseEmittedProfileValue(source) {
  try {
    if (source.startsWith('"')) return JSON.parse(source);
    if (source.startsWith("{")) return parseEmittedObjectLiteral(source);
    if (source.startsWith("JSON.parse(`") && source.endsWith("`)")) {
      return JSON.parse(source.slice("JSON.parse(`".length, -2));
    }
  } catch {
    return null;
  }
  return null;
}

function canonicalized(value) {
  if (Array.isArray(value)) return value.map(canonicalized);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, canonicalized(value[key])]));
  }
  return value;
}

function emittedMotorTvsProfileProjectionHash(source) {
  const boundaryPattern = /(?:^|[,;])\s*([A-Za-z_$][\w$]*)=["']schemagic-design-profile["']/gu;
  const boundaries = [...source.matchAll(boundaryPattern)];
  const hashes = [];
  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index];
    const start = (boundary.index ?? 0) + (/[,;]/u.test(source[boundary.index ?? 0]) ? 1 : 0);
    const end = boundaries[index + 1]?.index ?? source.length;
    const assignmentSources = splitTopLevelCommaDelimited(source.slice(start, end).trim());
    if (assignmentSources === null || assignmentSources.length !== 8) continue;
    const assignments = assignmentSources.map((assignmentSource) => {
      const match = assignmentSource.trim().match(/^([A-Za-z_$][\w$]*)=(.*)$/su);
      return match === null ? null : { name: match[1], source: match[2] };
    });
    if (assignments.some((assignment) => assignment === null)) continue;
    const [format, schemaVersion, partClass, part, factsSchemaVersion, commonFacts, facts, projection] = assignments;
    const profile = {
      format: parseEmittedProfileValue(format.source),
      schemaVersion: parseEmittedProfileValue(schemaVersion.source),
      partClass: parseEmittedProfileValue(partClass.source),
      part: parseEmittedProfileValue(part.source),
      factsSchemaVersion: parseEmittedProfileValue(factsSchemaVersion.source),
      commonFacts: parseEmittedProfileValue(commonFacts.source),
      facts: parseEmittedProfileValue(facts.source),
    };
    if (profile.part?.manufacturerId !== "diodes-incorporated"
      || profile.part?.manufacturerPartNumber !== "3.0SMCJ33CAQ") continue;
    const expectedProjection = `{format:${format.name},schemaVersion:${schemaVersion.name},partClass:${partClass.name},part:${part.name},factsSchemaVersion:${factsSchemaVersion.name},commonFacts:${commonFacts.name},facts:${facts.name}}`;
    if (projection.source.replace(/\s/gu, "") !== expectedProjection) continue;
    const releasedProfileBinding = new RegExp(
      `(["'])${escapedRegexLiteral(MOTOR_TVS_REVIEWED_PROFILE_ID)}\\1\\s*:\\s*${escapedRegexLiteral(projection.name)}(?![\\w$])`,
      "gu",
    );
    if (countMatches(source, releasedProfileBinding) !== 1) continue;
    hashes.push(sha256(Buffer.from(JSON.stringify(canonicalized(profile)))));
  }
  return hashes.length === 1 ? hashes[0] : null;
}

function capabilitiesIn(source) {
  return CAPABILITY_RULES.flatMap((rule) => {
    const count = countMatches(source, rule.pattern);
    return count === 0 ? [] : [{ id: rule.id, count }];
  });
}

function cleanUrlToken(token) {
  return token.replace(/[),.;\]}>]+$/u, "");
}

function networkUrls(source) {
  return [...source.matchAll(/\b(?:https?|wss?):\/\/[^\s"'`<>\\]+/giu)]
    .map((match) => cleanUrlToken(match[0]))
    .filter((value) => {
      try {
        const hostname = new URL(value).hostname;
        return hostname.startsWith("[")
          || /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/iu.test(hostname);
      } catch {
        return false;
      }
    })
    .filter(Boolean);
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

function isNamespaceOrLoopback(value) {
  if (value === "http://www.w3.org/2000/svg" || value === "http://www.w3.org/1999/xhtml") return true;
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

function isModelLibrarySource(sourcePath) {
  return sourcePath.includes("/packages/model-library/models/");
}

function isDesignLibraryProfileSource(sourcePath) {
  return /\/packages\/design-library\/parts\/.+\.json$/u.test(sourcePath);
}

function reviewedProfileGeometryBindingForUrl(url) {
  return REVIEWED_PROFILE_GEOMETRY_EVIDENCE_BINDINGS.find((binding) => binding.url === url);
}

function isReviewedProfileGeometryEvidenceUrl(url) {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".bxl");
  } catch {
    return false;
  }
}

function isPinnedInertReviewedProfileGeometryProjection(source, binding) {
  return countLiteral(source, binding.url) === 4
    && countLiteral(source, binding.sourceId) === 4
    && countLiteral(source, binding.evidenceContentHash) === 4
    && countLiteral(source, binding.profilePath) === 4
    && countLiteral(source, binding.profileContentHash) === 2
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorModeEvidenceSource(sourcePath, source) {
  const externalUrls = networkUrls(source).filter((url) => !isNamespaceOrLoopback(url));
  const isFrozenPredecessor = sourcePath.endsWith(MOTOR_MODE_EVIDENCE_RECIPE_SOURCE)
    && source.includes(`"${MOTOR_MODE_EVIDENCE_PROFILE_HASH}"`)
    && source.includes('version: "3.2.3"');
  const isBindingRefreshedPredecessor = sourcePath.endsWith(MOTOR_MODE_EVIDENCE_BINDING_REFRESHED_RECIPE_SOURCE)
    && source.includes(`"${MOTOR_MODE_EVIDENCE_REFRESHED_PROFILE_HASH}"`)
    && source.includes('version: "3.2.4"')
    && source.includes("MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED")
    && source.includes('from "./motor-integrated-v32-mode-qualified"');
  const isLocalNominalSuccessor = sourcePath.endsWith(MOTOR_LOCAL_NOMINAL_RECIPE_SOURCE)
    && source.includes(`"${MOTOR_MODE_EVIDENCE_REFRESHED_PROFILE_HASH}"`)
    && source.includes(`"${MOTOR_LOCAL_NOMINAL_PROFILE_HASH}"`)
    && source.includes(`"${MOTOR_LOCAL_NOMINAL_EVIDENCE_URL}"`)
    && source.includes(`"${MOTOR_LOCAL_NOMINAL_EVIDENCE_SOURCE_ID}"`)
    && source.includes(`"${MOTOR_LOCAL_NOMINAL_EVIDENCE_SOURCE_HASH}"`)
    && source.includes('version: "3.2.5"')
    && source.includes("MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_MODE_QUALIFIED_BINDING_REFRESHED")
    && source.includes('from "./motor-integrated-v32-mode-qualified-binding-refreshed"');
  const hasExactEvidenceUrls = isLocalNominalSuccessor
    ? externalUrls.length === 2
      && externalUrls.includes(MOTOR_MODE_EVIDENCE_URL)
      && externalUrls.includes(MOTOR_LOCAL_NOMINAL_EVIDENCE_URL)
    : externalUrls.length === 1 && externalUrls[0] === MOTOR_MODE_EVIDENCE_URL;
  return (isFrozenPredecessor || isBindingRefreshedPredecessor || isLocalNominalSuccessor)
    && source.includes(`"${MOTOR_MODE_EVIDENCE_URL}"`)
    && source.includes(`"${MOTOR_MODE_EVIDENCE_SOURCE_ID}"`)
    && source.includes(`"${MOTOR_MODE_EVIDENCE_SOURCE_HASH}"`)
    && hasExactEvidenceUrls
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorDirectGateEvidenceSource(sourcePath, source) {
  const externalUrls = networkUrls(source).filter((url) => !isNamespaceOrLoopback(url));
  return sourcePath.endsWith(MOTOR_DIRECT_GATE_EVIDENCE_RECIPE_SOURCE)
    && source.includes(`"${MOTOR_DIRECT_GATE_EVIDENCE_URL}"`)
    && source.includes(`"${MOTOR_DIRECT_GATE_EVIDENCE_SOURCE_ID}"`)
    && source.includes(`"${MOTOR_DIRECT_GATE_EVIDENCE_SOURCE_HASH}"`)
    && source.includes(`"${MOTOR_DIRECT_GATE_EVIDENCE_PROFILE_HASH}"`)
    && source.includes(`"${MOTOR_DIRECT_GATE_PREDECESSOR_HASH}"`)
    && source.includes(`"${MOTOR_TVS_EVIDENCE_URL}"`)
    && source.includes(`"${MOTOR_TVS_EVIDENCE_SOURCE_ID}"`)
    && source.includes(`"${MOTOR_TVS_EVIDENCE_SOURCE_HASH}"`)
    && source.includes(`"${MOTOR_TVS_EVIDENCE_PROFILE_HASH}"`)
    && source.includes(`"${MOTOR_TVS_PREDECESSOR_HASH}"`)
    && MOTOR_CAPACITOR_ROLE_PROFILE_HASHES.every((contentHash) => source.includes(`"${contentHash}"`))
    && !source.includes(`"${MOTOR_CAPACITOR_ROLE_EXCLUDED_PROFILE_HASH}"`)
    && !source.includes('manufacturerPartNumber: "C1608X7R1H104K080AA"')
    && source.includes('version: "3.1.7"')
    && source.includes('"motor.external.facts-v3-1-role-qualified.tvs-stand-off-ambient-condition-gate.v1"')
    && source.includes("conditionsCover(tvs.facts.standOffVoltage, ambientContext)")
    && source.includes('driverVoltageSemantics: "bridge_interface_qualified"')
    && source.includes('"motor.external.driver-switch-node-operating-minimum"')
    && source.includes('"motor.external.driver-switch-node-operating-maximum"')
    && source.includes('"motor.external.driver-switch-node-absolute-maximum"')
    && source.includes('"motor.external.tvs-published-clamp-driver-switch-node-limit"')
    && source.includes('"motor.external.tvs-published-clamp-mosfet-limit"')
    && source.includes('"motor.external.tvs-coordination"')
    && source.includes("does not implement a VDD driver-bias rail")
    && source.includes('dataKey: "bootstrapProfileId"')
    && source.includes('documentedNominalMinimumF: 0.1e-6')
    && source.includes('dataKey: "localProfileId"')
    && source.includes('documentedNominalMinimumF: 1e-6')
    && source.includes('status: "omitted_for_exact_driver_direct_connection"')
    && source.includes('outputRole: "high-side-xHO"')
    && source.includes('externalDampingResistor: "optional_unselected"')
    && source.includes('outputRole: "low-side-xLO"')
    && source.includes('externalSeriesResistor: "not_recommended_unselected"')
    && externalUrls.length === 2
    && externalUrls.includes(MOTOR_DIRECT_GATE_EVIDENCE_URL)
    && externalUrls.includes(MOTOR_TVS_EVIDENCE_URL)
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorDrv8262CompanionGateSource(sourcePath, source) {
  const externalUrls = networkUrls(source).filter((url) => !isNamespaceOrLoopback(url));
  return sourcePath.endsWith(MOTOR_DRV8262_COMPANION_GATE_RECIPE_SOURCE)
    && source.includes(`"${MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL}"`)
    && source.includes(`"${MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_ID}"`)
    && source.includes(`"${MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_HASH}"`)
    && source.includes(`"${MOTOR_DRV8262_COMPANION_GATE_PROFILE_ID}"`)
    && source.includes(`"${MOTOR_DRV8262_COMPANION_GATE_PROFILE_HASH}"`)
    && source.includes('version: "3.2.6"')
    && source.includes('"motor.integrated.companion-network-representability"')
    && source.includes('stage: "match_before_component_materialization"')
    && source.includes('disposition: "reject_before_candidate_component_materialization_and_customization_witness"')
    && source.includes('distinctVmBypassPositions')
    && source.includes('{ componentId: "CVM1", from: "VM", to: "PGND12"')
    && source.includes('{ componentId: "CVM2", from: "VM", to: "PGND34"')
    && source.includes('chargePumpOrRegulatorComponentsRepresented: false')
    && source.includes("MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_LOCAL_CAPACITANCE_RECOMMENDATION_QUALIFIED.match")
    && externalUrls.length === 1
    && externalUrls[0] === MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorDrv8262CompanionGateProjection(source) {
  return countQuotedLiteral(source, MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL) === 1
    && countQuotedLiteral(source, MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_ID) === 1
    && countQuotedLiteral(source, MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_SOURCE_HASH) === 1
    && countQuotedLiteral(source, MOTOR_DRV8262_COMPANION_GATE_PROFILE_ID) === 1
    && countQuotedLiteral(source, MOTOR_DRV8262_COMPANION_GATE_PROFILE_HASH) === 1
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorTvsReviewedProfileSource(sourcePath, source) {
  return sourcePath.endsWith(MOTOR_TVS_REVIEWED_PROFILE_SOURCE)
    && sha256(Buffer.from(source)) === MOTOR_TVS_REVIEWED_PROFILE_SOURCE_HASH
    && countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_URL) === MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_SOURCE_ID) === MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_SOURCE_HASH) === MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorTvsRecipeProjection(source) {
  const declarationPattern = new RegExp(
    `(?:^|[,;])\\s*(?:(?:const|let|var)\\s+)?([A-Za-z_$][\\w$]*)\\s*=\\s*(["'])${escapedRegexLiteral(MOTOR_TVS_EVIDENCE_URL)}\\2`,
    "gu",
  );
  const declarations = [...source.matchAll(declarationPattern)];
  if (declarations.length !== 1 || countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_URL) !== 1) return false;
  const identifier = declarations[0]?.[1];
  if (identifier === undefined) return false;
  const identifierPattern = new RegExp(`(?<![\\w$])${escapedRegexLiteral(identifier)}(?![\\w$])`, "gu");
  const inertUrlBinding = new RegExp(`["']?url["']?\\s*:\\s*${escapedRegexLiteral(identifier)}(?![\\w$])`, "gu");
  return countMatches(source, identifierPattern) === 2
    && countMatches(source, inertUrlBinding) === 1
    && capabilitiesIn(source).length === 0
    && INERT_EVIDENCE_EMITTED_SINK_RULES.every((pattern) => !pattern.test(source));
}

function isPinnedInertMotorTvsReviewedReleaseProjection(source) {
  const property = (name) => `["']?${name}["']?\\s*:\\s*`;
  const quoted = (value) => `["']${escapedRegexLiteral(value)}["']`;
  const catalogBinding = new RegExp([
    property("profileId"), quoted(MOTOR_TVS_REVIEWED_PROFILE_ID), "\\s*,\\s*",
    property("profilePath"), quoted(MOTOR_TVS_REVIEWED_PROFILE_ID), "\\s*,\\s*",
    property("partClass"), quoted("motor.supply-tvs-diode"), "\\s*,\\s*",
    property("part"), "\\{\\s*",
    property("manufacturerId"), quoted("diodes-incorporated"), "\\s*,\\s*",
    property("manufacturerPartNumber"), quoted("3.0SMCJ33CAQ"), "\\s*\\}\\s*,\\s*",
    property("profileContentHash"), quoted(MOTOR_TVS_EVIDENCE_PROFILE_HASH),
  ].join(""), "u");
  const diodesUrls = networkUrls(source).filter((url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === "diodes.com" || hostname.endsWith(".diodes.com");
    } catch {
      return false;
    }
  });
  return countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_URL) === MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_SOURCE_ID) === MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_SOURCE_HASH) === MOTOR_TVS_REVIEWED_PROFILE_EVIDENCE_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_REVIEWED_PROFILE_ID) === MOTOR_TVS_REVIEWED_PROFILE_PATH_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_EVIDENCE_PROFILE_HASH) === MOTOR_TVS_REVIEWED_PROFILE_HASH_COUNT
    && countQuotedLiteral(source, MOTOR_TVS_REVIEWED_CATALOG_VERSION) === 1
    && countQuotedLiteral(source, MOTOR_TVS_REVIEWED_CATALOG_HASH) === 1
    && catalogBinding.test(source)
    && emittedMotorTvsProfileProjectionHash(source) === MOTOR_TVS_EVIDENCE_PROFILE_HASH
    && diodesUrls.every((url) => url === MOTOR_TVS_EVIDENCE_URL
      || url === "https://www.diodes.com/datasheet/download/1N4148W.pdf")
    && capabilitiesIn(source).length === 0
    && INERT_EVIDENCE_EMITTED_SINK_RULES.every((pattern) => !pattern.test(source));
}

function isReviewedReleaseModule(sourcePath, source) {
  return sourcePath.endsWith("/packages/design-library/src/bundled-reviewed-release.ts")
    && sha256(Buffer.from(source)) === BUNDLED_REVIEWED_RELEASE_SOURCE_HASH
    && source.includes('from "../reviewed-admission.json"')
    && source.includes('from "../catalog-release.json"')
    && source.includes('from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json"')
    && source.includes('from "../parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json"')
    && source.includes('"packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json": tiDrv8262ddvr')
    && source.includes(`"${MOTOR_TVS_REVIEWED_PROFILE_ID}": diodes30Smcj33caq`)
    && /from "\.\.\/parts\/.+\.json"/u.test(source)
    && !source.includes('from "../admission.json"')
    && !source.includes("bundled-release")
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source));
}

function isCatalogSource(sourcePath) {
  return sourcePath.endsWith("/src/catalog.ts");
}

function isImportedResultViewSource(sourcePath) {
  return sourcePath.endsWith("/src/features/designer/ImportedResultView.ts");
}

function isLcscUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "lcsc.com" || hostname.endsWith(".lcsc.com");
  } catch {
    return false;
  }
}

function importedResultLcscNavigationIsBounded(source) {
  return source.includes(LCSC_SEARCH_PREFIX)
    && /target\s*=\s*["']_blank["']/u.test(source)
    && /rel\s*=\s*["']noopener noreferrer["']/u.test(source)
    && capabilitiesIn(source).length === 0
    && AUTOMATIC_EXTERNAL_NAVIGATION_RULES.every((pattern) => !pattern.test(source))
    && networkUrls(source).filter(isLcscUrl).every((url) => url.startsWith(LCSC_SEARCH_PREFIX));
}

function emittedExternalNavigationIsSafe(source) {
  return /target\s*=\s*["']_blank["']/u.test(source)
    && /rel\s*=\s*["']noopener noreferrer["']/u.test(source);
}

function serviceWorkerRegistrationIsLocal(source) {
  const matches = [...source.matchAll(/\bserviceWorker\s*\.\s*register\s*\(([^)]*)\)/gu)];
  return matches.length > 0 && matches.every((match) => /^\s*["']\/sw\.js["']\s*$/u.test(match[1] ?? ""));
}

function dedicatedSimulationWorkerIsLocal(source) {
  return /new\s+Worker\s*\(\s*new\s+URL\s*\(\s*["']\.\/worker\.ts["']\s*,\s*import\.meta\.url\s*\)\s*,\s*\{[^}]*type\s*:\s*["']module["']/su.test(source);
}

function emittedServiceWorkerRegistrationsAreLocal(source) {
  const matches = [...source.matchAll(/\bserviceWorker\s*\.\s*register\s*\(([^)]*)\)/gu)];
  return matches.length > 0
    && matches.every((match) => /^\s*["']\/sw\.js["'](?:\s*,\s*\{[^}]*\})?\s*$/su.test(match[1] ?? ""));
}

function emittedDedicatedWorkersAreLocal(source) {
  const workerCount = countMatches(source, /\bnew\s+Worker\s*\(/gu);
  const localModuleWorkers = countMatches(
    source,
    /\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*["'](?:\/assets\/|\.\/)[A-Za-z0-9_.-]+\.js["']\s*,\s*import\.meta\.url\s*\)\s*,\s*\{[^}]*type\s*:\s*["']module["'][^}]*\}\s*\)/gsu,
  );
  const directBlobWorkers = countMatches(
    source,
    /\bnew\s+Worker\s*\(\s*URL\.createObjectURL\s*\(\s*new\s+Blob\s*\(/gu,
  );
  const cachedBlobWorkers = countMatches(
    source,
    /\bnew\s+Worker\s*\(\s*([A-Za-z_$][\w$]*\[[^\]]+\])\s*\|\|\s*\(\s*\1\s*=\s*URL\.createObjectURL\s*\(\s*new\s+Blob\s*\(/gu,
  );
  return workerCount > 0 && workerCount === localModuleWorkers + directBlobWorkers + cachedBlobWorkers;
}

function fflateWorkerIsBlobLocal(source) {
  return /new\s+Worker\s*\(\s*ch2\[id\]\s*\|\|\s*\(ch2\[id\]\s*=\s*URL\.createObjectURL\s*\(\s*new\s+Blob\s*\(/su.test(source);
}

function ngspiceFetchesAreSameOrigin(source) {
  const fetchCount = countMatches(source, /\bfetch\s*\(/gu);
  const credentialCount = countMatches(source, /credentials\s*:\s*["']same-origin["']/gu);
  return fetchCount > 0 && credentialCount >= fetchCount && networkUrls(source).every(isNamespaceOrLoopback);
}

function ngspiceLoaderPinsLocalWasm(source) {
  return /new\s+URL\s*\(\s*["']\.\.\/dist\/ngspice\.wasm["']\s*,\s*import\.meta\.url\s*\)/u.test(source)
    && /locateFile\s*:\s*\([^)]*\)\s*=>\s*[^?]+\?\s*wasmUrl\.href\s*:/u.test(source);
}

function designerExampleFetchIsLocalAndBounded(source) {
  return countMatches(source, /\bfetch\s*\(/gu) === 1
    && source.includes('url: "/designer-examples/manifest.json"')
    && source.includes('`/designer-examples/${example.artifact.path}`')
    && source.includes('credentials: "same-origin"')
    && source.includes('mode: "same-origin"')
    && source.includes('redirect: "error"')
    && source.includes('cache: "no-cache"')
    && networkUrls(source).every(isNamespaceOrLoopback);
}

function allowedSourceCapability(sourcePath, source, capability) {
  if (capability === "service_worker_register"
    && (sourcePath.endsWith("/src/entry.ts") || sourcePath.endsWith("/src/main.ts"))) {
    return serviceWorkerRegistrationIsLocal(source);
  }
  if (capability === "dedicated_worker" && sourcePath.endsWith("/packages/sim-engine/src/client.ts")) {
    return dedicatedSimulationWorkerIsLocal(source);
  }
  if (capability === "dedicated_worker" && sourcePath.endsWith("/node_modules/fflate/esm/browser.js")) {
    return fflateWorkerIsBlobLocal(source);
  }
  if ((capability === "fetch" || capability === "xml_http_request")
    && sourcePath.endsWith("/tools/ngspice-wasm-build/dist/ngspice.mjs")) {
    return capability === "fetch" ? ngspiceFetchesAreSameOrigin(source) : true;
  }
  if (capability === "fetch" && sourcePath.endsWith("/src/features/designer/ExampleGallery.ts")) {
    return designerExampleFetchIsLocalAndBounded(source);
  }
  // No source-authored capability is permitted merely because it shares a chunk
  // with an allowed source.
  return false;
}

function viteCapabilityAllowances(source, sourceMap) {
  const allowances = new Map();
  if (!source.includes("modulepreload")) return allowances;
  const dependencies = [...source.matchAll(/["']assets\/[^"']+["']/gu)].map((match) => match[0].slice(1, -1));
  const dependenciesAreLocal = dependencies.length > 0
    && dependencies.every((entry) => /^assets\/[A-Za-z0-9_.-]+\.(?:css|js)$/u.test(entry));
  const hasLocalPolyfill = dependenciesAreLocal
    && /createElement\s*\(\s*["']link["']\s*\)\.relList/u.test(source)
    && /fetch\s*\(\s*\w+\.href\s*,\s*\w+\s*\)/u.test(source)
    && /credentials\s*=\s*["']same-origin["']/u.test(source);
  if (hasLocalPolyfill) {
    allowances.set("fetch", 1);
    allowances.set("dynamic_link_element", 1);
  }

  const hasLocalPreloadHelper = /return["']\/["']\+\w+/u.test(source)
    && /\.endsWith\(\s*["']\.css["']\s*\)/u.test(source)
    && /createElement\s*\(\s*["']link["']\s*\)/u.test(source)
    && /\.href\s*=\s*\w+/u.test(source)
    && (dependenciesAreLocal || sourceMap.sources.length === 0);
  if (hasLocalPreloadHelper) {
    allowances.set(
      "dynamic_link_element",
      (allowances.get("dynamic_link_element") ?? 0) + 1,
    );
  }
  return allowances;
}

function serviceWorkerFindings(path, source) {
  const findings = [];
  const methodGuardAt = source.search(/event\.request\.method\s*!==\s*["']GET["']/u);
  const urlAt = source.search(/new\s+URL\s*\(\s*event\.request\.url\s*\)/u);
  const originGuardAt = source.search(/url\.origin\s*!==\s*self\.location\.origin/u);
  const firstFetchAt = source.search(/\bfetch\s*\(/u);
  if (methodGuardAt < 0) findings.push(finding(path, "service_worker_method_guard_missing", "GET method guard is absent."));
  if (urlAt < 0 || originGuardAt < 0 || originGuardAt < urlAt) {
    findings.push(finding(path, "service_worker_origin_guard_missing", "Request URL/origin guard is absent or malformed."));
  }
  if (firstFetchAt < 0 || methodGuardAt > firstFetchAt || originGuardAt > firstFetchAt) {
    findings.push(finding(path, "service_worker_guard_order_invalid", "Method and origin guards must precede every fetch."));
  }
  const fetches = [...source.matchAll(/\bfetch\s*\(([^)]*)\)/gu)];
  if (fetches.length === 0 || fetches.some((match) => (match[1] ?? "").trim() !== "event.request")) {
    findings.push(finding(path, "service_worker_fetch_target_unbounded", "Every service-worker fetch must use the guarded event.request."));
  }
  const shell = source.match(/\bSHELL\s*=\s*\[([^\]]*)\]/u)?.[1];
  const shellEntries = shell === undefined ? [] : [...shell.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]);
  if (shellEntries.length === 0 || shellEntries.some((entry) => !entry.startsWith("/") || entry.startsWith("//") || entry.includes(":"))) {
    findings.push(finding(path, "service_worker_shell_not_local", "Precache shell entries must be root-relative same-origin paths."));
  }
  if (!source.includes("caches.open(") || !source.includes("caches.match(")) {
    findings.push(finding(path, "service_worker_cache_boundary_missing", "Expected Cache Storage open/match boundary is absent."));
  }
  for (const capability of capabilitiesIn(source)) {
    if (capability.id !== "fetch") {
      findings.push(finding(path, "service_worker_capability_forbidden", `Service worker contains ${capability.id}.`));
    }
  }
  for (const url of networkUrls(source)) {
    if (!isNamespaceOrLoopback(url)) findings.push(finding(path, "service_worker_external_endpoint", url));
  }
  return { findings, shellEntries };
}

function htmlAndCssFindings(file, source) {
  const findings = [];
  for (const url of networkUrls(source)) {
    if (!isNamespaceOrLoopback(url)) findings.push(finding(file.path, "active_external_endpoint", url));
  }
  if (/\b(?:src|href|action|poster)\s*=\s*["']\/\//iu.test(source)) {
    findings.push(finding(file.path, "network_relative_endpoint", "Network-relative resource reference is forbidden."));
  }
  if (file.path.endsWith(".css") && /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//iu.test(source)) {
    findings.push(finding(file.path, "external_css_import", "External CSS import is forbidden."));
  }
  return findings;
}

function localArtifactReferences(source) {
  return [...source.matchAll(/["'`](\/(?:assets|designer-examples|fonts|notices)\/[A-Za-z0-9_./-]+|\/sw\.js)["'`]/gu)]
    .map((match) => match[1]);
}

function inventoryHash(files) {
  const payload = files.map((file) => `${file.path}\0${sha256(file.bytes)}\0${file.bytes.byteLength}`).join("\n");
  return sha256(Buffer.from(payload));
}

export function auditStaticOfflineNetworkFiles(fileInputs, { expectedArtifactSetHash } = {}) {
  const files = [...fileInputs].map((file) => {
    if (typeof file.path !== "string") throw new TypeError("Artifact path must be a string");
    return {
      path: file.path,
      bytes: Buffer.isBuffer(file.bytes) ? file.bytes : Buffer.from(file.bytes),
    };
  }).sort((left, right) => compareText(left.path, right.path)
    || compareText(sha256(left.bytes), sha256(right.bytes))
    || left.bytes.byteLength - right.bytes.byteLength);
  const findings = [];
  const rawPathCounts = new Map();
  const normalizedIdentityPaths = new Map();
  for (const file of files) {
    const violation = artifactPathViolation(file.path);
    if (violation !== undefined) {
      findings.push(finding(typeof file.path === "string" && file.path.length > 0 ? file.path : "artifacts", "artifact_path_noncanonical", violation));
    }
    if (typeof file.path !== "string") continue;
    rawPathCounts.set(file.path, (rawPathCounts.get(file.path) ?? 0) + 1);
  }
  for (const [path, count] of rawPathCounts) {
    if (count > 1) findings.push(finding(path || "artifacts", "artifact_path_duplicate", `${count} artifacts share this exact raw path.`));
    const identity = normalizedArtifactIdentity(path);
    const paths = normalizedIdentityPaths.get(identity) ?? new Set();
    paths.add(path);
    normalizedIdentityPaths.set(identity, paths);
  }
  for (const [identity, paths] of normalizedIdentityPaths) {
    if (paths.size > 1) {
      findings.push(finding(
        "artifacts",
        "artifact_path_identity_collision",
        `${JSON.stringify([...paths].sort(compareText))} normalize to ${JSON.stringify(identity)}.`,
      ));
    }
  }
  const byPath = new Map(files.map((file) => [file.path, file]));
  const sourcePaths = new Set();
  const documentationUrls = new Set();
  const userInitiatedExternalNavigationUrls = new Set();
  const observedSourceCapabilities = new Map();
  const emittedCapabilities = new Map();
  const artifactSetHash = inventoryHash(files);
  if (expectedArtifactSetHash !== undefined) {
    if (!/^sha256:[a-f0-9]{64}$/u.test(expectedArtifactSetHash)) {
      throw new TypeError("Expected production artifact-set hash must be a sha256 identity");
    }
    if (artifactSetHash !== expectedArtifactSetHash) {
      findings.push(finding(
        "artifacts",
        "production_artifact_set_changed",
        `expected ${expectedArtifactSetHash}; observed ${artifactSetHash}`,
      ));
    }
  }
  let sourceMapCount = 0;
  let sourceEntryCount = 0;

  for (const required of ["index.html", "sw.js"]) {
    if (!byPath.has(required)) findings.push(finding(required, "required_artifact_missing", `${required} is absent from the production build.`));
  }
  const javascriptFiles = files.filter((file) => file.path.endsWith(".js") && file.path !== "sw.js");
  if (javascriptFiles.length === 0) findings.push(finding("assets", "javascript_assets_missing", "No production JavaScript asset was found."));

  for (const javascript of javascriptFiles) {
    const mapPath = `${javascript.path}.map`;
    const mapFile = byPath.get(mapPath);
    const source = javascript.bytes.toString("utf8");
    if (!mapFile) {
      findings.push(finding(javascript.path, "source_map_missing", `Expected ${mapPath}.`));
      continue;
    }
    if (!source.includes(`sourceMappingURL=${mapPath.split("/").at(-1)}`)) {
      findings.push(finding(javascript.path, "source_map_link_missing", "JavaScript does not reference its shipped source map."));
    }
    let map;
    try {
      map = JSON.parse(mapFile.bytes.toString("utf8"));
    } catch {
      findings.push(finding(mapPath, "source_map_invalid", "Source map is not valid JSON."));
      continue;
    }
    sourceMapCount += 1;
    if (!Array.isArray(map.sources) || !Array.isArray(map.sourcesContent) || map.sources.length !== map.sourcesContent.length) {
      findings.push(finding(mapPath, "source_map_incomplete", "Every source entry must have shipped sourcesContent."));
      continue;
    }
    const mapAllowedCapabilities = new Map();
    const mapAllowedRuntimeUrls = new Set();
    let mapAllowsCatalogGithubPrefix = false;
    let mapAllowsImportedResultLcscPrefix = false;
    const mapAllowedReviewedProfileEvidenceUrls = new Set();
    let pinnedMotorTvsRecipeSourceCount = 0;
    let pinnedMotorDrv8262CompanionGateSourceCount = 0;
    let pinnedReviewedReleaseModuleCount = 0;
    let loaderSource;
    let containsNgspice = false;
    for (let index = 0; index < map.sources.length; index += 1) {
      const sourcePath = normalizedPath(String(map.sources[index]));
      const sourceContent = map.sourcesContent[index];
      sourceEntryCount += 1;
      sourcePaths.add(sourcePath);
      if (typeof sourceContent !== "string") {
        findings.push(finding(mapPath, "source_content_missing", sourcePath));
        continue;
      }
      if (sourcePath.endsWith("/tools/ngspice-wasm-build/dist-loader/index.mjs")) loaderSource = sourceContent;
      if (sourcePath.endsWith("/tools/ngspice-wasm-build/dist/ngspice.mjs")) containsNgspice = true;
      const isMotorTvsReviewedProfileSource = sourcePath.endsWith(MOTOR_TVS_REVIEWED_PROFILE_SOURCE);
      if (isMotorTvsReviewedProfileSource) {
        if (!isPinnedInertMotorTvsReviewedProfileSource(sourcePath, sourceContent)) {
          findings.push(finding(mapPath, "motor_tvs_reviewed_profile_source_changed", sourcePath));
        }
      } else if (isModelLibrarySource(sourcePath) || isDesignLibraryProfileSource(sourcePath)) {
        for (const url of networkUrls(sourceContent)) {
          if (url !== MOTOR_TVS_EVIDENCE_URL
            && !isReviewedProfileGeometryEvidenceUrl(url)) mapAllowedRuntimeUrls.add(url);
        }
      }
      for (const url of new Set(networkUrls(sourceContent))) {
        if (!isReviewedProfileGeometryEvidenceUrl(url)) continue;
        const binding = reviewedProfileGeometryBindingForUrl(url);
        findings.push(finding(
          mapPath,
          binding === undefined
            ? "reviewed_profile_geometry_evidence_boundary_changed"
            : "reviewed_profile_geometry_evidence_source_unapproved",
          sourcePath,
        ));
      }
      const containsMotorModeEvidenceUrl = networkUrls(sourceContent).includes(MOTOR_MODE_EVIDENCE_URL);
      if (sourcePath.endsWith(MOTOR_MODE_EVIDENCE_RECIPE_SOURCE)
        || sourcePath.endsWith(MOTOR_MODE_EVIDENCE_BINDING_REFRESHED_RECIPE_SOURCE)
        || sourcePath.endsWith(MOTOR_LOCAL_NOMINAL_RECIPE_SOURCE)) {
        if (isPinnedInertMotorModeEvidenceSource(sourcePath, sourceContent)) {
          mapAllowedRuntimeUrls.add(MOTOR_MODE_EVIDENCE_URL);
          if (sourcePath.endsWith(MOTOR_LOCAL_NOMINAL_RECIPE_SOURCE)) {
            mapAllowedRuntimeUrls.add(MOTOR_LOCAL_NOMINAL_EVIDENCE_URL);
          }
        } else {
          findings.push(finding(mapPath, "motor_mode_evidence_boundary_changed", sourcePath));
        }
      } else if (containsMotorModeEvidenceUrl
        && !isModelLibrarySource(sourcePath)
        && !isDesignLibraryProfileSource(sourcePath)) {
        findings.push(finding(mapPath, "motor_mode_evidence_source_unapproved", sourcePath));
      }
      const containsMotorDirectGateEvidenceUrl = networkUrls(sourceContent).includes(MOTOR_DIRECT_GATE_EVIDENCE_URL);
      if (sourcePath.endsWith(MOTOR_DIRECT_GATE_EVIDENCE_RECIPE_SOURCE)) {
        if (isPinnedInertMotorDirectGateEvidenceSource(sourcePath, sourceContent)) {
          pinnedMotorTvsRecipeSourceCount += 1;
          mapAllowedRuntimeUrls.add(MOTOR_DIRECT_GATE_EVIDENCE_URL);
          mapAllowedRuntimeUrls.add(MOTOR_TVS_EVIDENCE_URL);
        } else {
          findings.push(finding(mapPath, "motor_direct_gate_evidence_boundary_changed", sourcePath));
        }
      } else if (containsMotorDirectGateEvidenceUrl
        && !isModelLibrarySource(sourcePath)
        && !isDesignLibraryProfileSource(sourcePath)) {
        findings.push(finding(mapPath, "motor_direct_gate_evidence_source_unapproved", sourcePath));
      }
      const containsMotorDrv8262CompanionGateEvidenceUrl = networkUrls(sourceContent)
        .includes(MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL);
      if (sourcePath.endsWith(MOTOR_DRV8262_COMPANION_GATE_RECIPE_SOURCE)) {
        if (isPinnedInertMotorDrv8262CompanionGateSource(sourcePath, sourceContent)) {
          pinnedMotorDrv8262CompanionGateSourceCount += 1;
          mapAllowedRuntimeUrls.add(MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL);
        } else {
          findings.push(finding(mapPath, "motor_drv8262_companion_gate_evidence_boundary_changed", sourcePath));
        }
      } else if (containsMotorDrv8262CompanionGateEvidenceUrl
        && !isModelLibrarySource(sourcePath)
        && !isDesignLibraryProfileSource(sourcePath)) {
        findings.push(finding(mapPath, "motor_drv8262_companion_gate_evidence_source_unapproved", sourcePath));
      }
      const containsMotorTvsEvidenceUrl = networkUrls(sourceContent).includes(MOTOR_TVS_EVIDENCE_URL);
      if (containsMotorTvsEvidenceUrl
        && !sourcePath.endsWith(MOTOR_DIRECT_GATE_EVIDENCE_RECIPE_SOURCE)
        && !isMotorTvsReviewedProfileSource) {
        findings.push(finding(mapPath, "motor_tvs_reviewed_profile_source_unapproved", sourcePath));
      }
      if (sourcePath.endsWith("/packages/design-library/src/bundled-reviewed-release.ts")) {
        if (isReviewedReleaseModule(sourcePath, sourceContent)) {
          pinnedReviewedReleaseModuleCount += 1;
          for (const url of REVIEWED_PROFILE_EVIDENCE_URLS) mapAllowedReviewedProfileEvidenceUrls.add(url);
        }
        else findings.push(finding(mapPath, "reviewed_release_projection_unpinned", sourcePath));
      }
      if (isCatalogSource(sourcePath)) {
        const prefix = "https://github.com/hughminhphan/schemagic-sim/tree/main/packages/model-library/models/";
        if (!sourceContent.includes(prefix)
          || !sourceContent.includes('target="_blank" rel="noreferrer"')) {
          findings.push(finding(mapPath, "catalog_external_navigation_boundary_changed", sourcePath));
        }
        mapAllowsCatalogGithubPrefix = sourceContent.includes(prefix);
      }
      const lcscUrls = networkUrls(sourceContent).filter(isLcscUrl);
      if (isImportedResultViewSource(sourcePath)) {
        if (lcscUrls.length > 0 && !importedResultLcscNavigationIsBounded(sourceContent)) {
          findings.push(finding(mapPath, "lcsc_external_navigation_boundary_changed", sourcePath));
        }
        mapAllowsImportedResultLcscPrefix = lcscUrls.length > 0
          && importedResultLcscNavigationIsBounded(sourceContent);
      } else if (lcscUrls.length > 0) {
        findings.push(finding(mapPath, "lcsc_external_navigation_source_unapproved", sourcePath));
      }
      for (const capability of capabilitiesIn(sourceContent)) {
        if (!allowedSourceCapability(sourcePath, sourceContent, capability.id)) {
          findings.push(finding(mapPath, "source_network_capability_unapproved", `${sourcePath}: ${capability.id}`));
          continue;
        }
        mapAllowedCapabilities.set(
          capability.id,
          (mapAllowedCapabilities.get(capability.id) ?? 0) + capability.count,
        );
        observedSourceCapabilities.set(capability.id, (observedSourceCapabilities.get(capability.id) ?? 0) + capability.count);
      }
    }
    if (containsNgspice && (typeof loaderSource !== "string" || !ngspiceLoaderPinsLocalWasm(loaderSource))) {
      findings.push(finding(mapPath, "local_wasm_loader_unpinned", "ngspice network capability is not paired with the pinned import.meta.url WASM locator."));
    }
    const hasPinnedReviewedReleaseModule = pinnedReviewedReleaseModuleCount === 1;

    if (networkUrls(source).includes(MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL)
      && pinnedMotorDrv8262CompanionGateSourceCount > 0) {
      const emittedArtifactHash = sha256(javascript.bytes);
      const exactSourceBoundary = pinnedMotorDrv8262CompanionGateSourceCount === 1;
      const exactArtifact = emittedArtifactHash === MOTOR_DRV8262_COMPANION_GATE_EMITTED_ARTIFACT_HASH;
      mapAllowedRuntimeUrls.delete(MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL);
      if (exactSourceBoundary
        && exactArtifact
        && isPinnedInertMotorDrv8262CompanionGateProjection(source)) {
        mapAllowedRuntimeUrls.add(MOTOR_DRV8262_COMPANION_GATE_EVIDENCE_URL);
      } else {
        findings.push(finding(
          javascript.path,
          "motor_drv8262_companion_gate_projection_boundary_changed",
          `recipe sources: ${pinnedMotorDrv8262CompanionGateSourceCount}; expected ${MOTOR_DRV8262_COMPANION_GATE_EMITTED_ARTIFACT_HASH}; observed ${emittedArtifactHash}`,
        ));
      }
    }

    if (networkUrls(source).includes(MOTOR_TVS_EVIDENCE_URL)) {
      const expectedEmittedArtifact = pinnedMotorTvsRecipeSourceCount === 1 && pinnedReviewedReleaseModuleCount === 0
        ? { kind: "motor_external_v2_recipe", contentHash: MOTOR_TVS_RECIPE_EMITTED_ARTIFACT_HASH }
        : pinnedReviewedReleaseModuleCount === 1 && pinnedMotorTvsRecipeSourceCount === 0
          ? { kind: "bundled_reviewed_release", contentHash: MOTOR_TVS_REVIEWED_EMITTED_ARTIFACT_HASH }
          : null;
      const emittedArtifactHash = sha256(javascript.bytes);
      const emittedArtifactIsPinned = expectedEmittedArtifact !== null
        && emittedArtifactHash === expectedEmittedArtifact.contentHash;
      if (expectedEmittedArtifact === null) {
        findings.push(finding(
          javascript.path,
          "motor_tvs_emitted_artifact_source_boundary_unpinned",
          `recipe sources: ${pinnedMotorTvsRecipeSourceCount}; reviewed release sources: ${pinnedReviewedReleaseModuleCount}`,
        ));
      } else if (!emittedArtifactIsPinned) {
        findings.push(finding(
          javascript.path,
          "motor_tvs_emitted_artifact_hash_changed",
          `${expectedEmittedArtifact.kind}: expected ${expectedEmittedArtifact.contentHash}; observed ${emittedArtifactHash}`,
        ));
      }
      const hasPinnedRecipeSource = pinnedMotorTvsRecipeSourceCount === 1
        && mapAllowedRuntimeUrls.delete(MOTOR_TVS_EVIDENCE_URL);
      if (hasPinnedRecipeSource) {
        if (emittedArtifactIsPinned && isPinnedInertMotorTvsRecipeProjection(source)) {
          mapAllowedRuntimeUrls.add(MOTOR_TVS_EVIDENCE_URL);
        } else {
          findings.push(finding(
            javascript.path,
            "motor_tvs_recipe_projection_boundary_changed",
            MOTOR_TVS_EVIDENCE_URL,
          ));
        }
      }
      if (hasPinnedReviewedReleaseModule) {
        if (emittedArtifactIsPinned && isPinnedInertMotorTvsReviewedReleaseProjection(source)) {
          mapAllowedReviewedProfileEvidenceUrls.add(MOTOR_TVS_EVIDENCE_URL);
        } else {
          findings.push(finding(
            javascript.path,
            "motor_tvs_reviewed_profile_projection_boundary_changed",
            MOTOR_TVS_EVIDENCE_URL,
          ));
        }
      }
      if (!hasPinnedRecipeSource && !hasPinnedReviewedReleaseModule) {
        findings.push(finding(
          javascript.path,
          "motor_tvs_reviewed_profile_projection_boundary_changed",
          MOTOR_TVS_EVIDENCE_URL,
        ));
      }
    }

    for (const url of new Set(networkUrls(source).filter(isReviewedProfileGeometryEvidenceUrl))) {
      const binding = reviewedProfileGeometryBindingForUrl(url);
      if (binding !== undefined
        && hasPinnedReviewedReleaseModule
        && isPinnedInertReviewedProfileGeometryProjection(source, binding)) {
        mapAllowedReviewedProfileEvidenceUrls.add(url);
      } else {
        findings.push(finding(javascript.path, "reviewed_profile_geometry_evidence_boundary_changed", url));
      }
    }

    const generatedCapabilities = capabilitiesIn(source);
    const viteAllowances = viteCapabilityAllowances(source, map);
    for (const capability of generatedCapabilities) {
      emittedCapabilities.set(capability.id, (emittedCapabilities.get(capability.id) ?? 0) + capability.count);
      const viteAllowance = viteAllowances.get(capability.id) ?? 0;
      const accountedCount = (mapAllowedCapabilities.get(capability.id) ?? 0) + viteAllowance;
      if (capability.count > accountedCount) {
        findings.push(finding(
          javascript.path,
          "emitted_network_capability_unaccounted",
          `${capability.id}: emitted ${capability.count}, accounted ${accountedCount}`,
        ));
      }
    }
    if (generatedCapabilities.some((capability) => capability.id === "service_worker_register")
      && !emittedServiceWorkerRegistrationsAreLocal(source)) {
      findings.push(finding(javascript.path, "emitted_service_worker_target_unapproved", "Every registration must target /sw.js."));
    }
    if (generatedCapabilities.some((capability) => capability.id === "dedicated_worker")
      && !emittedDedicatedWorkersAreLocal(source)) {
      findings.push(finding(javascript.path, "emitted_worker_target_unapproved", "Every Worker must use a local module asset or directly constructed Blob URL."));
    }
    if (/["'`]\/\/[^/]/u.test(source)) {
      findings.push(finding(javascript.path, "runtime_network_relative_endpoint", "Network-relative JavaScript endpoint is forbidden."));
    }
    for (const url of networkUrls(source)) {
      if (isNamespaceOrLoopback(url)) continue;
      const githubPrefix = "https://github.com/hughminhphan/schemagic-sim/tree/main/packages/model-library/models/";
      if (mapAllowedRuntimeUrls.has(url)
        || mapAllowedReviewedProfileEvidenceUrls.has(url)) continue;
      if (mapAllowsCatalogGithubPrefix && url.startsWith(githubPrefix)) {
        userInitiatedExternalNavigationUrls.add(url);
        continue;
      }
      if (mapAllowsImportedResultLcscPrefix
        && url.startsWith(LCSC_SEARCH_PREFIX)
        && emittedExternalNavigationIsSafe(source)) {
        userInitiatedExternalNavigationUrls.add(url);
        continue;
      }
      findings.push(finding(javascript.path, "runtime_external_endpoint_unapproved", url));
    }
  }

  const index = byPath.get("index.html");
  if (index) findings.push(...htmlAndCssFindings(index, index.bytes.toString("utf8")));
  for (const css of files.filter((file) => file.path.endsWith(".css"))) {
    findings.push(...htmlAndCssFindings(css, css.bytes.toString("utf8")));
  }

  let shellEntries = [];
  const serviceWorker = byPath.get("sw.js");
  if (serviceWorker) {
    const result = serviceWorkerFindings(serviceWorker.path, serviceWorker.bytes.toString("utf8"));
    findings.push(...result.findings);
    shellEntries = result.shellEntries;
    emittedCapabilities.set("service_worker_fetch", countMatches(serviceWorker.bytes.toString("utf8"), /\bfetch\s*\(/gu));
  }

  for (const file of files.filter((entry) => [".md", ".txt"].includes(extension(entry.path)))) {
    for (const url of networkUrls(file.bytes.toString("utf8"))) documentationUrls.add(url);
  }

  for (const file of files.filter((entry) => TEXT_EXTENSIONS.has(extension(entry.path)))) {
    const source = file.bytes.toString("utf8");
    for (const reference of localArtifactReferences(source)) {
      const target = reference.slice(1);
      if (!byPath.has(target)) findings.push(finding(file.path, "local_artifact_reference_missing", reference));
    }
  }

  for (const boundary of REQUIRED_SOURCE_BOUNDARIES) {
    if (![...sourcePaths].some((sourcePath) => sourcePath.endsWith(boundary))) {
      findings.push(finding("assets", "required_runtime_boundary_unmapped", boundary));
    }
  }

  const runtimeExternalUrls = new Set(javascriptFiles.flatMap((file) => networkUrls(file.bytes.toString("utf8")))
    .filter((url) => !isNamespaceOrLoopback(url)));
  const externalOrigins = [...new Set([...runtimeExternalUrls].map(originOf))].sort(compareText);
  const userInitiatedExternalNavigationOrigins = [...new Set(
    [...userInitiatedExternalNavigationUrls].map(originOf),
  )].sort(compareText);
  const insecureCount = [...runtimeExternalUrls].filter((url) => url.startsWith("http://")).length;
  const sortedFindings = findings.sort((left, right) => compareText(left.path, right.path)
    || compareText(left.code, right.code)
    || compareText(left.detail, right.detail));
  const report = {
    format: "schemagic-static-offline-network-audit",
    schemaVersion: 1,
    status: sortedFindings.length === 0 ? "pass" : "blocked",
    scope: "production_build_static_artifacts",
    artifactSetHash,
    evidence: {
      artifactCount: files.length,
      javascriptAssetCount: javascriptFiles.length,
      sourceMapCount,
      sourceEntryCount,
      serviceWorkerShell: [...shellEntries].sort(compareText),
      sourceCapabilities: Object.fromEntries([...observedSourceCapabilities].sort(([left], [right]) => compareText(left, right))),
      emittedCapabilities: Object.fromEntries([...emittedCapabilities].sort(([left], [right]) => compareText(left, right))),
      externalNavigationUrlCount: runtimeExternalUrls.size,
      externalNavigationOrigins: externalOrigins,
      insecureExternalNavigationUrlCount: insecureCount,
      userInitiatedExternalNavigationUrlCount: userInitiatedExternalNavigationUrls.size,
      userInitiatedExternalNavigationUrls: [...userInitiatedExternalNavigationUrls].sort(compareText),
      userInitiatedExternalNavigationOrigins,
      documentationUrlCount: documentationUrls.size,
    },
    limitations: [...STATIC_OFFLINE_AUDIT_LIMITATIONS],
    findings: sortedFindings,
  };
  return freeze(report);
}

function walk(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(root, absolute);
    if (!entry.isFile()) return [];
    return [{ path: relative(root, absolute), bytes: readFileSync(absolute) }];
  });
}

export function auditStaticOfflineNetworkBuild(
  distDirectory,
  { expectedArtifactSetHash = PRODUCTION_ARTIFACT_SET_HASH } = {},
) {
  const absolute = distDirectory instanceof URL ? fileURLToPath(distDirectory) : resolve(distDirectory);
  if (!statSync(absolute).isDirectory()) throw new TypeError("Production dist path must be a directory");
  return auditStaticOfflineNetworkFiles(walk(absolute), { expectedArtifactSetHash });
}
