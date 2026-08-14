import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stageCard, stageTestgen, stageValidate } from "../factory.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const localTmpRoot = path.resolve(here, "../tmp/conveyor-syntax");
const conveyorFitRoot = path.resolve(here, "../tmp/conveyor-fit");
const reviewedLibraryRoot = path.resolve(here, "../../../packages/model-library/models");

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const safe = (value) => String(value).trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "") || "part";
const slugManufacturer = (value) => safe(String(value).toLowerCase().replace(/\b(technologies|technology|semiconductor|semiconductors|incorporated|inc|corp|corporation|intertechnology)\b/g, "").trim());
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const fmt = (value) => Number(value).toExponential(10).replace("e+", "e");
const NGSPICE_VT_25C = 8.617333262e-5 * 298.15;

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function hintNumber(part, target, fallback) {
  const hint = part.seed_hints?.find((candidate) => candidate.factory_target === target);
  if (!hint) return fallback;
  const match = String(hint.raw_value).replace(/,/g, "").match(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?\s*(meg|[pnumkµ])?/i);
  if (!match) return fallback;
  const multipliers = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, meg: 1e6 };
  return Number(match[0].match(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)[0]) * (multipliers[(match[1] || "").toLowerCase()] ?? 1);
}

function polarityFor(part, extraction) {
  const stated = extraction?.specs?.polarity;
  if (stated === "p" || stated === "pnp") return "p";
  if (stated === "n" || stated === "npn") return "n";
  return /p-channel|pmos|pnp/i.test(`${part.subcategory} ${part.description} ${part.attributes?.Type ?? ""}`) ? "p" : "n";
}

function zenerInputs(extraction) {
  if (extraction?.specs?.variant !== "zener") return null;
  const voltage = normalizeEvidence(extraction.specs.breakdown_voltage);
  const current = normalizeEvidence(extraction.specs.breakdown_current);
  const BV = Number(voltage?.value);
  const IBV = Number(current?.value);
  return voltage?.unit === "V" && current?.unit === "A"
    && Number.isFinite(BV) && BV > 0 && Number.isFinite(IBV) && IBV > 0
    ? { BV, IBV, NBV: 1 }
    : null;
}

function diodeFit(part, extraction, forceF1 = false) {
  const scalarPoints = extraction?.specs?.forward_voltage_points ?? [];
  const scalarPoint = scalarPoints.find((point) => !["minimum", "maximum"].includes(point?.voltage?.source_kind)
    && Number(point?.voltage?.value) > 0 && Number(point?.current?.value) > 0)
    ?? scalarPoints.find((point) => Number(point?.voltage?.value) > 0 && Number(point?.current?.value) > 0);
  const voltage = scalarPoint ? normalizeEvidence(scalarPoint.voltage) : null;
  const forwardCurrent = scalarPoint ? normalizeEvidence(scalarPoint.current) : null;
  const vf = voltage?.unit === "V" ? Number(voltage.value) : hintNumber(part, "diode.forward_voltage", 0.7);
  const current = forwardCurrent?.unit === "A" ? Number(forwardCurrent.value) : 0.01;
  const N = /schottky/i.test(`${part.subcategory} ${part.description}`) ? 1.1 : 1.8;
  const RS = 1e-4;
  const maximum = scalarPoint?.voltage?.source_kind === "maximum";
  const calibrationCurrent = maximum ? current * 0.95 : current;
  const calibrationVoltage = maximum ? vf * 0.97 : vf;
  const junctionVoltage = Math.max(NGSPICE_VT_25C, calibrationVoltage - calibrationCurrent * RS);
  const IS = calibrationCurrent / Math.expm1(junctionVoltage / (N * NGSPICE_VT_25C));
  return { fidelity: "F1", parameters: { IS, N, RS }, worst: null, points: [] };
}

function bjtFit(part, extraction, forceF1 = false) {
  const gainPoints = extraction?.specs?.gain_points ?? [];
  const typicalGains = gainPoints
    .filter((point) => !["minimum", "maximum"].includes(point.hfe?.source_kind))
    .map((point) => Number(point.hfe?.value))
    .filter((value) => value > 0);
  const minimumGains = gainPoints
    .filter((point) => point.hfe?.source_kind === "minimum")
    .map((point) => Number(point.hfe?.value))
    .filter((value) => value > 0);
  // A published maximum is an inclusive bound, not a representative F1 target.
  const BF = typicalGains.length ? Math.max(...typicalGains)
    // A minimum remains a hard inclusive package check. Give the first-order F1 model
    // one percent parameter headroom so finite VCE and series resistance do not land just below it.
    : minimumGains.length ? Math.max(...minimumGains) * 1.01
      : hintNumber(part, "bjt.dc_current_gain", 100);
  return { fidelity: "F1", parameters: { IS: 1e-14, BF: Math.max(1, BF), VAF: 100, IKF: 1e3, RB: 10, RC: 0.1, RE: 0.05, CJE: 1e-12, CJC: 1e-12, TF: 1e-9 }, worst: null, points: [] };
}

function evidenceTemperature(...values) {
  const text = values.filter(Boolean).map((value) => value?.conditions ?? value).join(" ");
  const matches = [...text.matchAll(/([+-]?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c|\bc\b)/gi)]
    .map((match) => Number(match[1])).filter(Number.isFinite);
  if (!matches.length) return null;
  const first = matches[0];
  if (matches.some((value) => Math.abs(value - first) > 1e-9)) throw new Error(`MOSFET evidence mixes temperatures in one condition: ${text}`);
  return first;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function identityHash(prefix, value) {
  return `${prefix}:${crypto.createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function withoutKeys(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) <= Math.max(Math.abs(left), Math.abs(right), 1) * 1e-9;
}

function sourceHashFor(part, extraction) {
  const explicit = extraction?.datasheet_identity?.source_sha256 ?? extraction?.datasheet_identity?.sha256
    ?? extraction?.source_sha256 ?? part?.source_sha256 ?? part?.datasheet_sha256;
  if (typeof explicit === "string" && /^(?:sha256:)?[0-9a-f]{64}$/i.test(explicit.trim())) {
    return explicit.trim().replace(/^sha256:/i, "").toLowerCase();
  }
  if (part?.datasheet_path && fs.existsSync(part.datasheet_path)) return sha256(part.datasheet_path);
  throw new Error("MOSFET critical evidence requires the real datasheet source SHA-256");
}

function citationIdentity(pageReference, { sourceSha256, sourceRevision, label, curveName = null, defaultRow = null, defaultColumn = null } = {}) {
  const citation = String(pageReference ?? "").trim();
  if (!citation || /pending|placeholder|unknown|tbd|n\/a/i.test(citation)) throw new Error(`${label} prohibits placeholder citations`);
  const pageMatch = citation.match(/(?:\bp(?:age)?\.?\s*|\bpage\s*)(\d+)/i);
  if (!pageMatch) throw new Error(`${label} must carry an exact primary datasheet page citation`);
  const tableMatch = citation.match(/(?:^|[,;(])\s*([^,;()]*?\btable)\b/i);
  const rowMatch = citation.match(/\brow\s*[:=]?\s*([^,;()]+)/i);
  const figureMatch = citation.match(/\bfigure\s*([A-Za-z0-9.-]+)/i) ?? String(curveName ?? "").match(/\bfigure\s*([A-Za-z0-9.-]+)/i);
  const curveMatch = citation.match(/\bcurve\s*[:=#]?\s*([^,;()]+)/i) ?? String(curveName ?? "").match(/\bcurve\s*[:=#]?\s*([^,;()]+)/i);
  const traceMatch = citation.match(/\btrace\s*[:=#]?\s*([^,;()]+)/i) ?? String(curveName ?? "").match(/\btrace\s*[:=#]?\s*([^,;()]+)/i);
  const sectionMatch = citation.match(/\bsection\s*[:=]?\s*([^,;()]+)/i);
  const columnMatch = citation.match(/\bcolumn\s*[:=]?\s*([^,;()]+)/i);
  const row = rowMatch?.[1]?.trim() ?? defaultRow;
  const column = columnMatch?.[1]?.trim() ?? defaultColumn;
  const table = tableMatch?.[1]?.trim();
  const figure = figureMatch?.[1]?.trim();
  const curve = curveMatch?.[1]?.trim() ?? (figure && curveName ? String(curveName).trim() : undefined);
  const trace = traceMatch?.[1]?.trim();
  if (table && !row) throw new Error(`${label} table citation must name its row`);
  if (figure && !curve && !trace) throw new Error(`${label} figure citation must name its curve or trace`);
  if ((!table || !row) && (!figure || (!curve && !trace))) {
    throw new Error(`${label} citation must identify table and row or figure and curve/trace`);
  }
  const identity = {
    source_sha256: sourceSha256,
    ...(sourceRevision ? { source_revision: sourceRevision } : {}),
    page: Number(pageMatch[1]),
    ...(sectionMatch ? { section: sectionMatch[1].trim() } : {}),
    ...(table ? { table, row } : { figure, ...(curve ? { curve } : { trace }) }),
    ...(column ? { column } : {}),
  };
  return { ...identity, citation_id: identityHash("sha256", identity) };
}

function conditionVoltage(text, symbol, fallback = null) {
  const normalized = String(text ?? "").replaceAll("_", "");
  const match = normalized.match(new RegExp(`${symbol}\\s*(?:magnitude)?\\s*=\\s*([0-9.eE+-]+)\\s*(m|u|µ|μ)?V`, "i"));
  if (!match || !Number.isFinite(Number(match[1]))) return fallback;
  return Math.abs(Number(match[1])) * ({ m: 1e-3, u: 1e-6, "µ": 1e-6, "μ": 1e-6 }[match[2]?.toLowerCase()] ?? 1);
}

function conditionDrainCurrent(text, fallback = null) {
  const normalized = String(text ?? "").replaceAll("_", "");
  const match = normalized.match(/(?:ID|drain\s*current)\|?\s*=\s*([0-9.eE+-]+)\s*(u|µ|μ|m)?A/i);
  if (!match || !Number.isFinite(Number(match[1]))) return fallback;
  return Math.abs(Number(match[1])) * ({ u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3 }[match[2]?.toLowerCase()] ?? 1);
}

function temperatureIdentity(text, label) {
  const conditionText = String(text ?? "").replaceAll("_", "");
  const matches = [...conditionText.matchAll(/\b(TJ|TA|TC|junction(?:\s+temperature)?|ambient(?:\s+temperature)?|case(?:\s+temperature)?)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c|\bc\b)/gi)];
  if (matches.length !== 1) throw new Error(`${label} must state exactly one temperature with junction, ambient, or case kind`);
  const token = matches[0][1].toLowerCase();
  const kind = token === "tj" || token.startsWith("junction") ? "junction" : token === "ta" || token.startsWith("ambient") ? "ambient" : "case";
  return { kind, value_c: Number(matches[0][2]) };
}

function timeSeconds(value, unit) {
  return Number(value) * ({ s: 1, ms: 1e-3, us: 1e-6, "µs": 1e-6, ns: 1e-9 }[String(unit).toLowerCase()] ?? NaN);
}

function testModeIdentity(text, label, { curve = false } = {}) {
  const conditionText = String(text ?? "").replaceAll("μ", "µ");
  const pulse = /\bpuls(?:e|ed)\b/i.test(conditionText);
  const width = conditionText.match(/pulse\s*width\s*(<=|≤|=|<)\s*([0-9.eE+-]+)\s*(s|ms|us|µs|ns)\b/i);
  const duty = conditionText.match(/duty\s*(?:cycle)?\s*(<=|≤|=|<)\s*([0-9.eE+-]+)\s*%/i);
  const period = conditionText.match(/(?:repetition\s*)?period\s*=\s*([0-9.eE+-]+)\s*(s|ms|us|µs|ns)\b/i);
  const frequency = conditionText.match(/(?:repetition\s*)?frequency\s*=\s*([0-9.eE+-]+)\s*(Hz|kHz|MHz)\b/i);
  if (pulse) {
    if (!width || !duty) throw new Error(`${label} pulsed evidence must state pulse width and duty cycle`);
    const qualifiers = [
      { key: "pulse_width_operator", value: width[1].replace("≤", "<=") },
      { key: "duty_cycle_operator", value: duty[1].replace("≤", "<=") },
    ];
    const mode = {
      kind: /single\s*pulse/i.test(conditionText) ? "single_pulse" : "pulsed",
      pulse_width_s: timeSeconds(width[2], width[3]),
      duty_cycle: Number(duty[2]) / 100,
      ...(period ? { repetition_period_s: timeSeconds(period[1], period[2]) } : {}),
      ...(frequency ? { repetition_frequency_hz: Number(frequency[1]) * ({ hz: 1, khz: 1e3, mhz: 1e6 }[frequency[2].toLowerCase()]) } : {}),
    };
    return { mode, qualifiers };
  }
  if (/\b(?:test\s*mode\s*=\s*)?continuous\b/i.test(conditionText)) return { mode: { kind: "continuous" }, qualifiers: [] };
  if (/\b(?:test\s*mode\s*=\s*)?dc\b/i.test(conditionText) || curve) return { mode: { kind: "dc" }, qualifiers: [] };
  throw new Error(`${label} must state its exact test mode`);
}

function normalizedQualifiers(text, testModeQualifiers) {
  const qualifiers = [...testModeQualifiers];
  if (/unless\s+otherwise\s+noted/i.test(text)) qualifiers.push({ key: "temperature_scope", value: "unless_otherwise_noted" });
  if (/electrical[-\s]characteristics\s+heading/i.test(text)) qualifiers.push({ key: "condition_source", value: "electrical_characteristics_heading" });
  return qualifiers.sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value));
}

function rejectUnknownQualifierSegments(text, label) {
  const segments = String(text ?? "").split(/[;,]/).map((segment) => segment.trim()).filter(Boolean);
  const recognized = [
    /\b(?:T_?J|T_?A|T_?C|junction|ambient|case)\b\s*=/i, /\bV_?DS\b\s*=\s*V_?GS/i,
    /\bV_?GS\b\s*=\s*V_?DS/i, /\bV_?GS\b\s*=/i, /\bV_?DS\b\s*=/i, /\bI_?D\b\s*=/i,
    /\btest\s*mode\s*=/i, /\bcontinuous\b/i, /\bDC\b/i, /\bpuls(?:e|ed)\b/i,
    /pulse\s*width/i, /duty\s*(?:cycle)?/i, /repetition\s*(?:period|frequency)/i,
    /unless\s+otherwise\s+noted/i, /electrical[-\s]characteristics\s+heading/i,
    /(?:source\s+)?(?:V_?GS|I_?D|RDS\(on\)|V_?GS\(th\)|value).*represented.*magnitude/i,
    /source\s+(?:V_?GS|I_?D|RDS\(on\)|V_?GS\(th\)|value)\s*=/i,
    /as\s+printed\s+in\s+figure/i, /associated\s+R_?DS\(on\)\s+test\s+point/i,
    /(?:T_?J|T_?A|T_?C)\s*=.*\bcurve\b/i, /p-channel\s+quantities\s+are\s+represented\s+as\s+magnitudes/i,
    /I_?D\s*=\s*f\(V_?GS\)/i, /\|?V_?DS\|?\s*>\s*2\s*\|?I_?D\|?\s*\/\s*R_?DS\(on\)/i, /^max\.?$/i,
    /converted\s+to/i, /per\s+Note\s+\d+/i,
  ];
  const unknown = segments.filter((segment) => !recognized.some((pattern) => pattern.test(segment)));
  if (unknown.length) throw new Error(`${label} has unknown residual qualifier tokens: ${unknown.join("; ")}`);
}

const ADJUDICATION_KIND = "opencircuit-condition-adjudication-supplement";
const ADJUDICATED_CHARACTERISTICS = new Set(["gate_threshold", "rds_on", "transfer_current", "output_current"]);
const NOT_STATED_MODE_CHARACTERISTICS = new Set(["gate_threshold", "transfer_current", "output_current"]);
const TEMPERATURE_PROVENANCE = new Set(["inline_condition", "table_heading", "figure_label", "footnote", "section_scope"]);
const TEST_MODE_KINDS = new Set(["dc", "continuous", "pulsed", "single_pulse", "not_stated"]);
const adjudicatedTargets = new WeakSet();
const adjudicatedExtractions = new WeakSet();
const adjudicatedSourceExtractions = new WeakMap();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireExactObjectKeys(value, required, optional, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const unknown = keys.filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) {
    throw new Error(`${label} has invalid fields${missing.length ? `; missing ${missing.join(", ")}` : ""}${unknown.length ? `; unknown ${unknown.join(", ")}` : ""}`);
  }
}

function finiteSemanticNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function validateVoltageCondition(value, label) {
  requireExactObjectKeys(value, ["kind"], ["value_v", "relation", "lower_v", "upper_v"], label);
  if (value.kind === "fixed") {
    requireExactObjectKeys(value, ["kind", "value_v"], [], label);
    finiteSemanticNumber(value.value_v, `${label}.value_v`);
  } else if (value.kind === "relation") {
    requireExactObjectKeys(value, ["kind", "relation"], [], label);
    if (typeof value.relation !== "string" || !value.relation.trim()) throw new Error(`${label}.relation must be a non-empty string`);
  } else if (value.kind === "range") {
    requireExactObjectKeys(value, ["kind", "lower_v", "upper_v"], [], label);
    const lower = finiteSemanticNumber(value.lower_v, `${label}.lower_v`);
    const upper = finiteSemanticNumber(value.upper_v, `${label}.upper_v`);
    if (!(lower < upper)) throw new Error(`${label} range must be increasing`);
  } else throw new Error(`${label}.kind is unknown`);
}

function validateCurrentCondition(value, label) {
  requireExactObjectKeys(value, ["kind"], ["value_a", "lower_a", "upper_a"], label);
  if (value.kind === "fixed") {
    requireExactObjectKeys(value, ["kind", "value_a"], [], label);
    finiteSemanticNumber(value.value_a, `${label}.value_a`);
  } else if (value.kind === "range") {
    requireExactObjectKeys(value, ["kind", "lower_a", "upper_a"], [], label);
    const lower = finiteSemanticNumber(value.lower_a, `${label}.lower_a`);
    const upper = finiteSemanticNumber(value.upper_a, `${label}.upper_a`);
    if (!(lower < upper)) throw new Error(`${label} range must be increasing`);
  } else throw new Error(`${label}.kind is unknown`);
}

function validateTypedTestMode(mode, characteristic, label) {
  requireExactObjectKeys(mode, ["kind"], ["pulse_width_s", "duty_cycle", "repetition_period_s", "repetition_frequency_hz"], label);
  if (!TEST_MODE_KINDS.has(mode.kind)) throw new Error(`${label}.kind is unknown`);
  for (const key of Object.keys(mode).filter((key) => key !== "kind")) {
    const numeric = finiteSemanticNumber(mode[key], `${label}.${key}`);
    if (!(numeric > 0) || (key === "duty_cycle" && numeric > 1)) throw new Error(`${label}.${key} is outside its physical range`);
  }
  if (["dc", "continuous", "not_stated"].includes(mode.kind) && Object.keys(mode).length !== 1) {
    throw new Error(`${label} ${mode.kind} mode cannot carry pulse fields`);
  }
  if (["pulsed", "single_pulse"].includes(mode.kind) && !Object.hasOwn(mode, "pulse_width_s")) {
    throw new Error(`${label} pulsed mode requires pulse_width_s`);
  }
  if (mode.kind === "not_stated" && !NOT_STATED_MODE_CHARACTERISTICS.has(characteristic)) {
    throw new Error(`${label} not_stated is not admitted for ${characteristic}`);
  }
}

function validateTypedTemperature(temperature, label) {
  requireExactObjectKeys(temperature, ["status"], ["kind", "value_c", "provenance"], label);
  if (temperature.status === "not_stated") {
    requireExactObjectKeys(temperature, ["status"], [], label);
    throw new Error(`${label} not_stated fails closed`);
  }
  if (temperature.status !== "stated") throw new Error(`${label}.status is unknown`);
  requireExactObjectKeys(temperature, ["status", "kind", "value_c", "provenance"], [], label);
  if (!["junction", "ambient", "case"].includes(temperature.kind)) throw new Error(`${label}.kind is unknown`);
  finiteSemanticNumber(temperature.value_c, `${label}.value_c`);
  if (!TEMPERATURE_PROVENANCE.has(temperature.provenance)) throw new Error(`${label}.provenance is unknown`);
  return { kind: temperature.kind, value_c: temperature.value_c };
}

function validateTypedCondition(condition, characteristic, label) {
  requireExactObjectKeys(condition, ["polarity", "magnitude_convention", "temperature", "electrical", "test_mode"], [], label);
  if (!["n", "p"].includes(condition.polarity)) throw new Error(`${label}.polarity is unknown`);
  if (!["signed", "absolute"].includes(condition.magnitude_convention)) throw new Error(`${label}.magnitude_convention is unknown`);
  const temperature = validateTypedTemperature(condition.temperature, `${label}.temperature`);
  requireExactObjectKeys(condition.electrical, ["vgs", "vds", "id"], [], `${label}.electrical`);
  validateVoltageCondition(condition.electrical.vgs, `${label}.electrical.vgs`);
  validateVoltageCondition(condition.electrical.vds, `${label}.electrical.vds`);
  validateCurrentCondition(condition.electrical.id, `${label}.electrical.id`);
  validateTypedTestMode(condition.test_mode, characteristic, `${label}.test_mode`);
  return { temperature };
}

function decodePointerToken(token) {
  if (/~(?:[^01]|$)/.test(token)) throw new Error(`invalid JSON pointer token ${token}`);
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function pointerTarget(root, pointer, label) {
  if (typeof pointer !== "string" || !pointer.startsWith("/") || pointer === "/") throw new Error(`${label} must be an absolute JSON pointer`);
  let value = root;
  for (const token of pointer.slice(1).split("/").map(decodePointerToken)) {
    if (Array.isArray(value)) {
      if (!/^(?:0|[1-9]\d*)$/.test(token) || Number(token) >= value.length) throw new Error(`${label} does not resolve`);
      value = value[Number(token)];
    } else if (value && typeof value === "object" && Object.hasOwn(value, token)) value = value[token];
    else throw new Error(`${label} does not resolve`);
  }
  return value;
}

function characteristicForPointer(pointer) {
  if (/^\/specs\/threshold_(?:min|typ|max)$/.test(pointer)) return "gate_threshold";
  if (/^\/specs\/rdson_points\/(?:0|[1-9]\d*)\/(?:vgs|current|resistance)$/.test(pointer)) return "rds_on";
  if (/^\/curves\/(?:0|[1-9]\d*)$/.test(pointer)) return null;
  throw new Error(`semantic adjudication target is outside the MOSFET evidence surface: ${pointer}`);
}

function normalizeSha256(value, label) {
  if (typeof value !== "string" || !/^(?:sha256:)?[0-9a-f]{64}$/i.test(value.trim())) throw new Error(`${label} must be a SHA-256 digest`);
  return value.trim().replace(/^sha256:/i, "").toLowerCase();
}

function validateAdjudicationSupplement(part, rawExtraction, supplement, extractionBytes) {
  requireExactObjectKeys(supplement, ["schema_version", "kind", "extraction_sha256", "source_sha256", "entries", "supplement_id"], [], "semantic adjudication supplement");
  if (supplement.schema_version !== "1.0.0" || supplement.kind !== ADJUDICATION_KIND) throw new Error("unsupported semantic adjudication supplement");
  if (!Buffer.isBuffer(extractionBytes)) throw new Error("semantic adjudication extraction bytes must be a Buffer");
  let extractionFromBytes;
  try {
    extractionFromBytes = JSON.parse(extractionBytes.toString("utf8"));
  } catch {
    throw new Error("semantic adjudication extraction bytes are not valid JSON");
  }
  if (identityHash("sha256", extractionFromBytes) !== identityHash("sha256", rawExtraction)) {
    throw new Error("semantic adjudication extraction bytes do not encode the supplied extraction object");
  }
  const extractionHash = crypto.createHash("sha256").update(extractionBytes).digest("hex");
  if (normalizeSha256(supplement.extraction_sha256, "semantic adjudication extraction_sha256") !== extractionHash) {
    throw new Error("semantic adjudication extraction hash does not match the immutable extraction bytes");
  }
  if (!part?.datasheet_path || !fs.existsSync(part.datasheet_path)) {
    throw new Error("semantic adjudication requires the canonical datasheet file");
  }
  const canonicalSourceHash = sha256(part.datasheet_path);
  if (normalizeSha256(supplement.source_sha256, "semantic adjudication source_sha256") !== canonicalSourceHash
      || sourceHashFor(part, rawExtraction) !== canonicalSourceHash) {
    throw new Error("semantic adjudication source hash does not match the canonical datasheet bytes");
  }
  if (supplement.supplement_id !== identityHash("sha256", withoutKeys(supplement, ["supplement_id"]))) {
    throw new Error("semantic adjudication supplement_id does not match canonical content");
  }
  if (!Array.isArray(supplement.entries) || !supplement.entries.length) throw new Error("semantic adjudication supplement requires entries");
  const seenPointers = new Set();
  const validated = [];
  for (const [entryIndex, entry] of supplement.entries.entries()) {
    const label = `semantic adjudication entries[${entryIndex}]`;
    requireExactObjectKeys(entry, ["targets", "characteristic", "condition", "disclosures"], [], label);
    if (!ADJUDICATED_CHARACTERISTICS.has(entry.characteristic)) throw new Error(`${label}.characteristic is unknown`);
    const { temperature } = validateTypedCondition(entry.condition, entry.characteristic, `${label}.condition`);
    if (entry.condition.polarity !== polarityFor(part, rawExtraction)) throw new Error(`${label}.condition.polarity contradicts the part`);
    if (!Array.isArray(entry.disclosures) || entry.disclosures.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error(`${label}.disclosures must contain only non-empty strings`);
    }
    if (!Array.isArray(entry.targets) || !entry.targets.length) throw new Error(`${label}.targets must be a non-empty array`);
    const targets = entry.targets.map((target, targetIndex) => {
      const targetLabel = `${label}.targets[${targetIndex}]`;
      requireExactObjectKeys(target, ["json_pointer", "target_sha256"], [], targetLabel);
      if (seenPointers.has(target.json_pointer)) throw new Error(`${targetLabel}.json_pointer is duplicated`);
      seenPointers.add(target.json_pointer);
      const pointerCharacteristic = characteristicForPointer(target.json_pointer);
      const originalTarget = pointerTarget(rawExtraction, target.json_pointer, `${targetLabel}.json_pointer`);
      const actualCharacteristic = pointerCharacteristic ?? curveCharacteristic(originalTarget);
      if (actualCharacteristic !== entry.characteristic) throw new Error(`${targetLabel} characteristic does not match its extraction target`);
      if (normalizeSha256(target.target_sha256, `${targetLabel}.target_sha256`) !== identityHash("sha256", originalTarget).slice(7)) {
        throw new Error(`${targetLabel}.target_sha256 does not match the immutable extraction subtree`);
      }
      return target.json_pointer;
    });
    validated.push({ ...entry, temperature, targets });
  }
  return validated;
}

export function applyConditionAdjudicationSupplement(part, rawExtraction, supplement, extractionBytes = Buffer.from(JSON.stringify(rawExtraction))) {
  const entries = validateAdjudicationSupplement(part, rawExtraction, supplement, extractionBytes);
  const sourceExtraction = deepFreeze(structuredClone(rawExtraction));
  const repaired = repairKnownEvidenceDefects(part, rawExtraction);
  for (const entry of entries) {
    for (const pointer of entry.targets) {
      const rawTarget = pointerTarget(rawExtraction, pointer, pointer);
      const target = pointerTarget(repaired, pointer, pointer);
      if (identityHash("sha256", rawTarget) !== identityHash("sha256", target)) {
        throw new Error(`${pointer} was changed by deterministic evidence repair and cannot be semantically adjudicated`);
      }
      target.condition_semantics = {
        schema_version: "1.0.0",
        characteristic: entry.characteristic,
        condition: structuredClone(entry.condition),
        disclosures: [...entry.disclosures],
        supplement_id: supplement.supplement_id,
      };
      adjudicatedTargets.add(target);
    }
  }
  deepFreeze(repaired);
  adjudicatedExtractions.add(repaired);
  adjudicatedSourceExtractions.set(repaired, sourceExtraction);
  return repaired;
}

function adjudicatedCondition(target, characteristic, label, context) {
  const semantics = target?.condition_semantics;
  if (!semantics) return null;
  if (!adjudicatedTargets.has(target)) throw new Error(`${label} condition semantics were not loaded from a validated supplement`);
  requireExactObjectKeys(semantics, ["schema_version", "characteristic", "condition", "disclosures", "supplement_id"], [], `${label}.condition_semantics`);
  if (semantics.schema_version !== "1.0.0" || semantics.characteristic !== characteristic) throw new Error(`${label} semantic characteristic mismatch`);
  if (!/^sha256:[0-9a-f]{64}$/.test(semantics.supplement_id)) throw new Error(`${label} semantic supplement ID is invalid`);
  const { temperature } = validateTypedCondition(semantics.condition, characteristic, `${label}.condition_semantics.condition`);
  if (semantics.condition.polarity !== context.polarity) throw new Error(`${label} semantic polarity mismatch`);
  if (!Array.isArray(semantics.disclosures) || semantics.disclosures.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} semantic disclosures must contain only non-empty strings`);
  }
  const sourceMode = semantics.condition.test_mode;
  if (["pulsed", "single_pulse"].includes(sourceMode.kind)) {
    throw new Error(`${label} is pulsed evidence and cannot enter a static DC MOSFET fit`);
  }
  const testMode = sourceMode.kind === "not_stated" ? { kind: "dc" } : structuredClone(sourceMode);
  const qualifiers = [
    { key: "semantic_adjudication", value: "content_addressed" },
    { key: "source_test_mode", value: sourceMode.kind },
    { key: "temperature_provenance", value: semantics.condition.temperature.provenance },
    ...(sourceMode.kind === "not_stated" ? [{ key: "static_characteristic_policy", value: characteristic }] : []),
  ].sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value));
  return {
    temperature,
    testMode,
    magnitudeConvention: semantics.condition.magnitude_convention,
    electrical: structuredClone(semantics.condition.electrical),
    qualifiers,
  };
}

function assertFixedSemanticValue(shape, expected, label, key) {
  if (shape?.kind !== "fixed" || !nearlyEqual(shape[key], expected)) throw new Error(`${label} typed electrical value disagrees with the immutable extraction`);
}

function assertRangeSemanticValue(shape, values, label, lowerKey, upperKey) {
  const lower = Math.min(...values);
  const upper = Math.max(...values);
  if (shape?.kind !== "range" || !nearlyEqual(shape[lowerKey], lower) || !nearlyEqual(shape[upperKey], upper)) {
    throw new Error(`${label} typed electrical range disagrees with the immutable extraction`);
  }
}

function completeConditionIdentity({ characteristic, polarity, magnitudeConvention, temperature, electrical, testMode, qualifiers }) {
  const identity = {
    schema_version: "1.0.0", characteristic, polarity,
    magnitude_convention: magnitudeConvention, temperature, electrical, test_mode: testMode,
    qualifiers: [...qualifiers].sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value)),
  };
  return { ...identity, condition_id: identityHash("sha256", identity) };
}

function citationCohortMaterial(characteristic, conditionId, citation) {
  return {
    characteristic,
    condition_id: conditionId,
    ...Object.fromEntries(
      ["source_sha256", "page", "table", "row", "figure", "curve", "trace"]
        .filter((key) => Object.hasOwn(citation, key))
        .map((key) => [key, citation[key]]),
    ),
  };
}

function evidenceIdentity(role, conditionIdentity, citationIdentityValue, quantity, valueSi, unitSi) {
  const characteristic = conditionIdentity.characteristic;
  const evidence = {
    characteristic,
    role,
    quantity,
    value_si: valueSi,
    unit_si: unitSi,
    condition_id: conditionIdentity.condition_id,
    citation_id: citationIdentityValue.citation_id,
  };
  return {
    evidence_id: identityHash("sha256", evidence),
    cohort_id: identityHash("sha256", citationCohortMaterial(characteristic, conditionIdentity.condition_id, citationIdentityValue)),
    role,
    condition_id: conditionIdentity.condition_id,
    citation_id: citationIdentityValue.citation_id,
  };
}

function evidenceBundle(role, conditionIdentity, citationIdentityValue, quantity, valueSi, unitSi) {
  return {
    condition_identity: conditionIdentity,
    citation_identity: citationIdentityValue,
    evidence_identity: evidenceIdentity(role, conditionIdentity, citationIdentityValue, quantity, valueSi, unitSi),
  };
}

function sameIdentity(left, right) {
  return left.condition_identity.condition_id === right.condition_identity.condition_id
    && left.evidence_identity.cohort_id === right.evidence_identity.cohort_id;
}

function validateThresholdEvidence(rawEvidence, sourceKind, label, context) {
  const evidence = normalizeEvidence(rawEvidence);
  const value = Math.abs(Number(evidence?.value));
  if (evidence?.unit !== "V" || !(value > 0) || evidence.source_kind !== sourceKind) {
    throw new Error(`${label} must be a positive finite ${sourceKind} threshold voltage`);
  }
  if (typeof evidence.conditions !== "string" || !evidence.conditions.trim()) throw new Error(`${label} must state its own operating conditions`);
  const adjudicated = adjudicatedCondition(rawEvidence, "gate_threshold", label, context);
  if (!adjudicated) rejectUnknownQualifierSegments(evidence.conditions, label);
  const current = conditionDrainCurrent(evidence.conditions, null);
  if (!(current > 0)) throw new Error(`${label} must state its own positive threshold drain current`);
  const normalized = evidence.conditions.replaceAll("_", "").replace(/\s+/g, "");
  if (!/(?:VDS=VGS|VGS=VDS)/i.test(normalized) || conditionVoltage(evidence.conditions, "VDS", null) != null || conditionVoltage(evidence.conditions, "VGS", null) != null) {
    throw new Error(`${label} must independently state the supported VDS = VGS relationship`);
  }
  const parsedTemperature = temperatureIdentity(evidence.conditions, label);
  const legacyTestMode = adjudicated ? null : testModeIdentity(evidence.conditions, label);
  const electrical = adjudicated?.electrical ?? {
    vgs: { kind: "relation", relation: "vds_equals_vgs" },
    vds: { kind: "relation", relation: "vds_equals_vgs" },
    id: { kind: "fixed", value_a: current },
  };
  if (adjudicated) {
    if (electrical.vgs?.kind !== "relation" || electrical.vgs.relation !== "vds_equals_vgs"
        || electrical.vds?.kind !== "relation" || electrical.vds.relation !== "vds_equals_vgs") {
      throw new Error(`${label} typed threshold semantics must preserve VDS = VGS`);
    }
    assertFixedSemanticValue(electrical.id, current, label, "value_a");
    if (adjudicated.temperature.kind !== parsedTemperature.kind || !nearlyEqual(adjudicated.temperature.value_c, parsedTemperature.value_c)) {
      throw new Error(`${label} typed temperature disagrees with the immutable extraction`);
    }
    if (Number(rawEvidence?.value) < 0 && adjudicated.magnitudeConvention !== "signed") {
      throw new Error(`${label} typed magnitude convention contradicts the signed source value`);
    }
  }
  const temperature = adjudicated?.temperature ?? parsedTemperature;
  const magnitudeConvention = adjudicated?.magnitudeConvention ?? (/-\s*\d/.test(evidence.conditions) || Number(rawEvidence?.value) < 0 ? "signed" : "absolute");
  const conditionIdentity = completeConditionIdentity({
    characteristic: "gate_threshold", polarity: context.polarity, magnitudeConvention, temperature,
    electrical,
    testMode: adjudicated?.testMode ?? legacyTestMode.mode,
    qualifiers: adjudicated?.qualifiers ?? normalizedQualifiers(evidence.conditions, legacyTestMode.qualifiers),
  });
  const citationIdentityValue = citationIdentity(evidence.page_reference, {
    ...context, label, defaultRow: "gate threshold voltage",
  });
  return {
    evidence, value, current, temperature: temperature.value_c, relationship: "VDS = VGS", citation: evidence.page_reference,
    ...evidenceBundle(
      sourceKind,
      conditionIdentity,
      citationIdentityValue,
      `threshold_${sourceKind}`,
      value,
      "V",
    ),
  };
}

function citedThresholdConstraint(specs, context) {
  if (!specs?.threshold_min && !specs?.threshold_max) return null;
  if (!specs?.threshold_min || !specs?.threshold_max) throw new Error("MOSFET F1 threshold evidence must provide both minimum and maximum for a two-sided interval");
  const minimum = validateThresholdEvidence(specs.threshold_min, "minimum", "MOSFET F1 threshold minimum", context);
  const maximum = validateThresholdEvidence(specs.threshold_max, "maximum", "MOSFET F1 threshold maximum", context);
  if (!(minimum.value < maximum.value)) throw new Error(`MOSFET F1 threshold interval is degenerate or reversed: ${minimum.value} to ${maximum.value} V`);
  if (!sameIdentity(minimum, maximum)) throw new Error("MOSFET F1 threshold bounds must independently resolve to the same condition and citation cohort identity");
  return {
    id: "threshold_interval_1", kind: "threshold_interval", minimum_v: minimum.value, maximum_v: maximum.value,
    current_a: minimum.current, temperature_c: minimum.temperature, vds_relationship: minimum.relationship, inclusive: true,
    conditions: minimum.evidence.conditions, citations: [minimum.citation, maximum.citation],
    condition_identity: minimum.condition_identity,
    citation_identities: [minimum.citation_identity, maximum.citation_identity],
    evidence_identities: [minimum.evidence_identity, maximum.evidence_identity],
    citation_cohort: citationCohort([minimum.citation_identity, maximum.citation_identity], minimum.condition_identity),
    evidence: [
      thresholdConstraintEvidence(minimum, "threshold_minimum", minimum.value),
      thresholdConstraintEvidence(maximum, "threshold_maximum", maximum.value),
    ],
    vds_relation: "vds_equals_vgs",
  };
}

function validateRdsonPoint(rawPoint, index, sourceKind, context) {
  const point = normalizeEvidence(rawPoint);
  const label = `MOSFET F1 RDS(on) ${sourceKind} ${index + 1}`;
  const resistance = Math.abs(Number(point?.resistance?.value));
  const vgs = Math.abs(Number(point?.vgs?.value));
  const current = Math.abs(Number(point?.current?.value));
  if (point?.resistance?.unit !== "ohm" || point?.vgs?.unit !== "V" || point?.current?.unit !== "A"
      || !(resistance > 0) || !(vgs > 0) || !(current > 0)) {
    throw new Error(`${label} lacks positive SI resistance, VGS, or ID evidence`);
  }
  if (point.resistance.source_kind !== sourceKind) throw new Error(`${label} resistance evidence must carry source_kind ${sourceKind}`);
  const role = sourceKind;
  const fields = [["VGS", "vgs", point.vgs], ["ID", "current", point.current], ["resistance", "resistance", point.resistance]].map(([field, rawKey, evidence]) => {
    const fieldLabel = `${label} ${field}`;
    if (typeof evidence?.conditions !== "string" || !evidence.conditions.trim()) throw new Error(`${fieldLabel} must state its own operating conditions`);
    const adjudicated = adjudicatedCondition(rawPoint?.[rawKey], "rds_on", fieldLabel, context);
    if (!adjudicated) rejectUnknownQualifierSegments(evidence.conditions, fieldLabel);
    const parsedVgs = conditionVoltage(evidence.conditions, "VGS", null);
    const parsedCurrent = conditionDrainCurrent(evidence.conditions, null);
    if (!(parsedVgs > 0) || !(parsedCurrent > 0)) throw new Error(`${fieldLabel} must state its own exact VGS and ID`);
    const parsedTemperature = temperatureIdentity(evidence.conditions, fieldLabel);
    const legacyTestMode = adjudicated ? null : testModeIdentity(evidence.conditions, fieldLabel);
    const electrical = adjudicated?.electrical ?? {
      vgs: { kind: "fixed", value_v: parsedVgs },
      vds: { kind: "relation", relation: "saturation_region" },
      id: { kind: "fixed", value_a: parsedCurrent },
    };
    if (adjudicated) {
      assertFixedSemanticValue(electrical.vgs, parsedVgs, fieldLabel, "value_v");
      assertFixedSemanticValue(electrical.id, parsedCurrent, fieldLabel, "value_a");
      if (electrical.vds?.kind !== "relation" || electrical.vds.relation !== "saturation_region") {
        throw new Error(`${fieldLabel} typed RDS(on) semantics must preserve the saturation-region relation`);
      }
      if (adjudicated.temperature.kind !== parsedTemperature.kind || !nearlyEqual(adjudicated.temperature.value_c, parsedTemperature.value_c)) {
        throw new Error(`${fieldLabel} typed temperature disagrees with the immutable extraction`);
      }
      if ((Number(rawPoint?.vgs?.value) < 0 || Number(rawPoint?.current?.value) < 0) && adjudicated.magnitudeConvention !== "signed") {
        throw new Error(`${fieldLabel} typed magnitude convention contradicts the signed source values`);
      }
    }
    const temperature = adjudicated?.temperature ?? parsedTemperature;
    const magnitudeConvention = adjudicated?.magnitudeConvention ?? (/-\s*\d/.test(evidence.conditions) || Number(rawPoint?.vgs?.value) < 0 || Number(rawPoint?.current?.value) < 0 ? "signed" : "absolute");
    const conditionIdentity = completeConditionIdentity({
      characteristic: "rds_on", polarity: context.polarity, magnitudeConvention, temperature,
      electrical,
      testMode: adjudicated?.testMode ?? legacyTestMode.mode,
      qualifiers: adjudicated?.qualifiers ?? normalizedQualifiers(evidence.conditions, legacyTestMode.qualifiers),
    });
    const citationIdentityValue = citationIdentity(evidence.page_reference, {
      ...context, label: fieldLabel, defaultRow: `rds_on_${index + 1}`, defaultColumn: field.toLowerCase(),
    });
    const quantity = field === "VGS" ? "vgs" : field === "ID" ? "drain_current" : `rds_on_${sourceKind}`;
    const valueSi = field === "VGS" ? vgs : field === "ID" ? current : resistance;
    const unitSi = field === "VGS" ? "V" : field === "ID" ? "A" : "ohm";
    return { parsedVgs, parsedCurrent, temperature: temperature.value_c, citation: evidence.page_reference, ...evidenceBundle(role, conditionIdentity, citationIdentityValue, quantity, valueSi, unitSi) };
  });
  if (!fields.slice(1).every((field) => sameIdentity(fields[0], field))) {
    throw new Error(`${label} VGS, ID, resistance, qualifiers, and citations must independently describe one condition and citation cohort identity`);
  }
  if (!nearlyEqual(vgs, fields[0].parsedVgs) || !nearlyEqual(current, fields[0].parsedCurrent)) {
    throw new Error(`${label} field values disagree with their own cited VGS or ID conditions`);
  }
  return {
    point, index, resistance, vgs, current, temperature: fields[0].temperature,
    citations: fields.map((field) => field.citation), conditions: point.resistance.conditions,
    condition_identity: fields[0].condition_identity,
    citation_identities: fields.map((field) => field.citation_identity),
    evidence_identities: fields.map((field) => field.evidence_identity),
    validated_fields: fields,
  };
}

function citedRdsonEvidence(specs, context) {
  const typical = [];
  const typicalErrors = [];
  const maximum = [];
  for (const [index, rawPoint] of (specs?.rdson_points ?? []).entries()) {
    const sourceKind = rawPoint?.resistance?.source_kind;
    if (sourceKind === "maximum") maximum.push(validateRdsonPoint(rawPoint, index, "maximum", context));
    else if (sourceKind === "typical") {
      try {
        const validated = validateRdsonPoint(rawPoint, index, "typical", context);
        if (Math.abs(validated.temperature - 25) <= 5) typical.push(validated);
      } catch (error) {
        typicalErrors.push(error);
      }
    } else if (sourceKind != null) throw new Error(`MOSFET RDS(on) point ${index + 1} has unsupported evidence role ${sourceKind}`);
  }
  return { typical, typicalErrors, maximum };
}

function citedRdsonConstraints(evidence) {
  return evidence.maximum.map((validated) => ({
    id: `rdson_maximum_${validated.index + 1}`, kind: "rdson_maximum", maximum_ohm: validated.resistance,
    vgs_v: validated.vgs, current_a: validated.current, temperature_c: validated.temperature,
    inclusive: true, conditions: validated.conditions, citations: validated.citations,
    condition_identity: validated.condition_identity, citation_identities: validated.citation_identities,
    evidence_identities: validated.evidence_identities,
    citation_cohort: citationCohort(validated.citation_identities, validated.condition_identity),
    evidence: [
      rdsonConstraintEvidence(validated.validated_fields[0], "vgs", validated.vgs, "V"),
      rdsonConstraintEvidence(validated.validated_fields[1], "drain_current", validated.current, "A"),
      rdsonConstraintEvidence(validated.validated_fields[2], "rds_on_maximum", validated.resistance, "ohm"),
    ],
    source_index: validated.index,
  }));
}

function curveCharacteristic(curve) {
  const x = String(curve?.x_axis?.quantity ?? "").toLowerCase();
  const y = String(curve?.y_axis?.quantity ?? "").toLowerCase();
  if (x.includes("gate") && x.includes("source") && y.includes("drain") && y.includes("current")) return "transfer_current";
  if (x.includes("drain") && x.includes("source") && y.includes("drain") && y.includes("current")) return "output_current";
  return null;
}

function normalizeMosfetCurve(curve, curveIndex, context) {
  if (curve?.condition_identity || curve?.citation_identity || curve?.curve_id || (curve?.points ?? []).some((point) => point?.evidence_identity)) {
    throw new Error(`MOSFET F2 curve ${curveIndex + 1} may not override canonical identity fields`);
  }
  const characteristic = curveCharacteristic(curve);
  if (!characteristic) return curve;
  const label = `MOSFET F2 ${characteristic} curve ${curveIndex + 1}`;
  const xUnit = siValue(1, curve?.x_axis?.unit).unit;
  const yUnit = siValue(1, curve?.y_axis?.unit).unit;
  if (xUnit !== "V" || yUnit !== "A") throw new Error(`${label} requires voltage and current axes with recognized SI units`);
  if (!Array.isArray(curve.points) || curve.points.length < 4) throw new Error(`${label} requires at least four ordered digitized points`);
  const conditions = String(curve.test_conditions ?? "");
  const adjudicated = adjudicatedCondition(curve, characteristic, label, context);
  if (!adjudicated) rejectUnknownQualifierSegments(conditions, label);
  const parsedTemperature = temperatureIdentity(conditions, label);
  const legacyTestMode = adjudicated ? null : testModeIdentity(conditions, label, { curve: false });
  const fixedVds = conditionVoltage(conditions, "VDS", null);
  const fixedVgs = conditionVoltage(conditions, "VGS", null);
  if (characteristic === "transfer_current" && !(fixedVds > 0)) {
    throw new Error(`${label} requires an explicit fixed VDS; a saturation inequality is not a fixed bias`);
  }
  if (characteristic === "output_current" && !(fixedVgs > 0)) throw new Error(`${label} requires an explicit fixed VGS trace identity`);
  let hasSignedCurveCoordinate = false;
  const rawPoints = curve.points.map((point, pointIndex) => {
    if (point?.condition_identity || point?.citation_identity || point?.evidence_identity) throw new Error(`${label} point ${pointIndex} may not override shared identities`);
    const x = siValue(point?.x, curve.x_axis.unit);
    const y = siValue(point?.y, curve.y_axis.unit);
    if (!Number.isFinite(x.value) || !Number.isFinite(y.value)) throw new Error(`${label} point ${pointIndex} is not finite`);
    if (x.value < 0 || y.value < 0) hasSignedCurveCoordinate = true;
    return { point_index: pointIndex, x_si: Math.abs(x.value), y_si: Math.abs(y.value) };
  });
  const derivedElectrical = characteristic === "transfer_current"
    ? {
      vgs: { kind: "range", lower_v: Math.min(...rawPoints.map((point) => point.x_si)), upper_v: Math.max(...rawPoints.map((point) => point.x_si)) },
      vds: { kind: "fixed", value_v: fixedVds }, id: { kind: "range", lower_a: Math.min(...rawPoints.map((point) => point.y_si)), upper_a: Math.max(...rawPoints.map((point) => point.y_si)) },
    }
    : {
      vgs: { kind: "fixed", value_v: fixedVgs },
      vds: { kind: "range", lower_v: Math.min(...rawPoints.map((point) => point.x_si)), upper_v: Math.max(...rawPoints.map((point) => point.x_si)) },
      id: { kind: "range", lower_a: Math.min(...rawPoints.map((point) => point.y_si)), upper_a: Math.max(...rawPoints.map((point) => point.y_si)) },
    };
  const electrical = adjudicated?.electrical ?? derivedElectrical;
  if (adjudicated) {
    if (characteristic === "transfer_current") {
      assertRangeSemanticValue(electrical.vgs, rawPoints.map((point) => point.x_si), label, "lower_v", "upper_v");
      assertFixedSemanticValue(electrical.vds, fixedVds, label, "value_v");
    } else {
      assertFixedSemanticValue(electrical.vgs, fixedVgs, label, "value_v");
      assertRangeSemanticValue(electrical.vds, rawPoints.map((point) => point.x_si), label, "lower_v", "upper_v");
    }
    assertRangeSemanticValue(electrical.id, rawPoints.map((point) => point.y_si), label, "lower_a", "upper_a");
    if (adjudicated.temperature.kind !== parsedTemperature.kind || !nearlyEqual(adjudicated.temperature.value_c, parsedTemperature.value_c)) {
      throw new Error(`${label} typed temperature disagrees with the immutable extraction`);
    }
    if (hasSignedCurveCoordinate && adjudicated.magnitudeConvention !== "signed") {
      throw new Error(`${label} typed magnitude convention contradicts signed curve coordinates`);
    }
  }
  const conditionIdentity = completeConditionIdentity({
    characteristic, polarity: context.polarity,
    magnitudeConvention: adjudicated?.magnitudeConvention ?? (/magnitude|\|V|\|I|p-channel/i.test(`${curve.x_axis.quantity} ${curve.y_axis.quantity} ${conditions}`) ? "absolute" : "signed"),
    temperature: adjudicated?.temperature ?? parsedTemperature, electrical,
    testMode: adjudicated?.testMode ?? legacyTestMode.mode,
    qualifiers: adjudicated?.qualifiers ?? normalizedQualifiers(conditions, legacyTestMode.qualifiers),
  });
  const citationIdentityValue = citationIdentity(curve.page_reference, { ...context, label, curveName: curve.name });
  const xAxis = { quantity: characteristic === "transfer_current" ? "vgs" : "vds", unit: "V" };
  const yAxis = { quantity: "id", unit: "A" };
  const curveHashInput = {
    schema_version: "1.0.0",
    characteristic,
    x_axis: xAxis,
    y_axis: yAxis,
    condition_id: conditionIdentity.condition_id,
    citation_id: citationIdentityValue.citation_id,
    points: rawPoints,
  };
  const curveId = identityHash("sha256", curveHashInput);
  const cohortInput = { characteristic, condition_id: conditionIdentity.condition_id, citation_id: citationIdentityValue.citation_id, curve_id: curveId };
  const cohortId = identityHash("sha256", cohortInput);
  const points = rawPoints.map((point) => {
    const evidenceInput = {
      characteristic, role: "digitized_typical_curve", ...point,
      condition_id: conditionIdentity.condition_id, citation_id: citationIdentityValue.citation_id,
      cohort_id: cohortId, curve_id: curveId,
    };
    return {
      ...point,
      evidence_identity: {
        evidence_id: identityHash("sha256", evidenceInput), cohort_id: cohortId, role: "digitized_typical_curve",
        condition_id: conditionIdentity.condition_id, citation_id: citationIdentityValue.citation_id,
        curve_id: curveId, point_index: point.point_index,
      },
    };
  });
  return {
    name: curve.name,
    page_reference: curve.page_reference,
    test_conditions: curve.test_conditions,
    curve_id: curveId,
    characteristic,
    x_axis: xAxis,
    y_axis: yAxis,
    condition_identity: conditionIdentity,
    citation_identity: citationIdentityValue,
    points,
  };
}

function normalizeMosfetExtractionForFit(part, extraction) {
  if (!extraction?.specs) throw new Error("MOSFET candidate fit requires a datasheet extraction");
  const context = mosfetEvidenceContext(part, extraction);
  const normalized = structuredClone(extraction);
  normalized.evidence_contract_version = "1.0.0";
  normalized.curves = (extraction.curves ?? []).map((curve, index) => normalizeMosfetCurve(curve, index, context));
  const specs = normalized.specs;
  const sourceSpecs = extraction.specs;
  const threshold = {};
  for (const [key, sourceKind] of [["threshold_min", "minimum"], ["threshold_typ", "typical"], ["threshold_max", "maximum"]]) {
    if (sourceSpecs[key]) threshold[key] = validateThresholdEvidence(sourceSpecs[key], sourceKind, `MOSFET F2 ${key}`, context);
  }
  if (Object.keys(threshold).length) {
    const identities = Object.values(threshold);
    if (!identities.slice(1).every((item) => sameIdentity(identities[0], item))) throw new Error("MOSFET F2 threshold fields do not share one condition and citation cohort");
    for (const [key, validated] of Object.entries(threshold)) specs[key] = { ...magnitudeQuantity(validated.evidence), condition_identity: validated.condition_identity, citation_identity: validated.citation_identity, evidence_identity: validated.evidence_identity };
  }
  const rdson = citedRdsonEvidence(sourceSpecs, context);
  const accepted = new Map([...rdson.typical, ...rdson.maximum].map((item) => [item.index, item]));
  if (rdson.typicalErrors.length) throw rdson.typicalErrors[0];
  specs.rdson_points = (specs.rdson_points ?? []).map((point, index) => {
    const validated = accepted.get(index);
    if (!validated) throw new Error(`MOSFET F2 RDS(on) point ${index + 1} lacks a supported evidence role`);
    return Object.fromEntries([["vgs", 0], ["current", 1], ["resistance", 2]].map(([key, fieldIndex]) => [key, {
      ...magnitudeQuantity(point[key]), condition_identity: validated.condition_identity,
      citation_identity: validated.citation_identities[fieldIndex], evidence_identity: validated.evidence_identities[fieldIndex],
    }]));
  });
  return normalized;
}

function legacyMosfetParameters(part, specs, threshold, rdson) {
  const ciss = Math.max(1e-15, Number.isFinite(Number(specs?.ciss?.value)) ? Number(specs.ciss.value) : hintNumber(part, "vdmos.ciss", 1e-9));
  const coss = Math.max(1e-15, Number.isFinite(Number(specs?.coss?.value)) ? Number(specs.coss.value) : hintNumber(part, "vdmos.coss", 2e-10));
  const crss = Math.max(1e-15, Number.isFinite(Number(specs?.crss?.value)) ? Number(specs.crss.value) : hintNumber(part, "vdmos.crss", 5e-11));
  return { VTO: threshold, KP: 2 / rdson, THETA: 0, LAMBDA: 0.003, RD: 0.55 * rdson, RS: 0.2 * rdson, RG: 1e-4, CGS: Math.max(1e-15, ciss - crss), CGDMAX: crss, CGDMIN: crss, CJO: Math.max(1e-15, coss - crss), IS: 1e-12, N: 1.5, RB: 0.2 * rdson };
}

function mosfetParameterMetadata(evidenceMode, specs) {
  const derived = Object.fromEntries(["VTO", "KP", "RD", "RS", "RB"].map((parameter) => [parameter, { status: `evidence-derived (${evidenceMode})`, evidence_mode: evidenceMode }]));
  return {
    ...derived,
    THETA: { status: "declared fixed F1 model constant" },
    LAMBDA: { status: "declared fixed F1 model constant" },
    RG: { status: "declared fixed F1 model constant" },
    CGS: { status: specs?.ciss && specs?.crss ? "derived from cited capacitances" : "declared fixed F1 model constant", evidence_mode: evidenceMode },
    CGDMAX: { status: specs?.crss ? "derived from cited reverse-transfer capacitance" : "declared fixed F1 model constant", evidence_mode: evidenceMode },
    CGDMIN: { status: specs?.crss ? "derived from cited reverse-transfer capacitance" : "declared fixed F1 model constant", evidence_mode: evidenceMode },
    CJO: { status: specs?.coss && specs?.crss ? "derived from cited capacitances" : "declared fixed F1 model constant", evidence_mode: evidenceMode },
    IS: { status: "declared fixed F1 model constant" },
    N: { status: "declared fixed F1 model constant" },
  };
}

function mosfetEvidenceContext(part, extraction) {
  return {
    polarity: polarityFor(part, extraction),
    sourceSha256: sourceHashFor(part, extraction),
    sourceRevision: extraction?.datasheet_identity?.revision,
  };
}

function citationCohort(validatedFields, conditionIdentity) {
  const identities = validatedFields.map((field) => withoutKeys(field, ["citation_id", "column"]));
  const unique = [...new Map(identities.map((identity) => [stableJson(identity), identity])).values()];
  if (unique.length !== 1) throw new Error("MOSFET evidence citation fields do not share one citation cohort");
  const identity = unique[0];
  const material = citationCohortMaterial(conditionIdentity.characteristic, conditionIdentity.condition_id, identity);
  return {
    cohort_id: identityHash("sha256", material),
    source_sha256: identity.source_sha256,
    page: identity.page,
    table: identity.table,
    row: identity.row,
  };
}

function thresholdConstraintEvidence(validated, quantity, value) {
  return {
    quantity, value_si: value, unit_si: "V",
    condition_identity: validated.condition_identity,
    citation_identity: validated.citation_identity,
    evidence_identity: validated.evidence_identity,
  };
}

function rdsonConstraintEvidence(validated, quantity, value, unit) {
  return {
    quantity, value_si: value, unit_si: unit,
    condition_identity: validated.condition_identity,
    citation_identity: validated.citation_identity,
    evidence_identity: validated.evidence_identity,
  };
}

function mosfetFit(part, extraction, forceF1 = false, constraintRunner = defaultMosfetConstraintRunner) {
  const specs = extraction?.specs;
  if (!specs) throw new Error("MOSFET F1 critical calibration requires a datasheet extraction; catalog hints are seeds only");
  const context = mosfetEvidenceContext(part, extraction);
  let thresholdTypical = null;
  let thresholdTypicalError = null;
  if (specs.threshold_typ) {
    try {
      thresholdTypical = validateThresholdEvidence(specs.threshold_typ, "typical", "MOSFET F1 threshold typical", context);
    } catch (error) {
      thresholdTypicalError = error;
    }
  }
  const thresholdConstraint = citedThresholdConstraint(specs, context);
  const rdsonEvidence = citedRdsonEvidence(specs, context);
  const rdsonTypical = rdsonEvidence.typical[0] ?? null;
  const rdsonConstraints = citedRdsonConstraints(rdsonEvidence);
  const hasThresholdTypical = Boolean(thresholdTypical);
  const hasRdsonTypical = Boolean(rdsonTypical);
  if (!hasThresholdTypical && !thresholdConstraint) {
    throw new Error(`MOSFET F1 critical threshold calibration has neither an admissible cited typical point nor a valid two-sided interval${thresholdTypicalError ? `: ${thresholdTypicalError.message}` : ""}`);
  }
  if (!hasRdsonTypical && !rdsonConstraints.length) {
    throw new Error(`MOSFET F1 critical RDS(on) calibration has neither an admissible cited typical point nor an inclusive maximum${rdsonEvidence.typicalErrors[0] ? `: ${rdsonEvidence.typicalErrors[0].message}` : ""}`);
  }

  const thresholdSeed = hasThresholdTypical
    ? thresholdTypical.value
    : 0.5 * (thresholdConstraint.minimum_v + thresholdConstraint.maximum_v);
  const rdsonSeed = hasRdsonTypical
    ? rdsonTypical.resistance
    : Math.min(...rdsonConstraints.map((constraint) => constraint.maximum_ohm));
  const parameters = legacyMosfetParameters(part, specs, thresholdSeed, Math.max(1e-4, rdsonSeed));
  const constraints = [thresholdConstraint, ...rdsonConstraints].filter(Boolean);
  const observations = [
    ...(hasThresholdTypical ? [{
      quantity: "gate_threshold", value: thresholdSeed, unit: "V", role: "typical_observation",
      citation: thresholdTypical.citation, citations: [thresholdTypical.citation],
      conditions: thresholdTypical.evidence.conditions, current_a: thresholdTypical.current,
      temperature_c: thresholdTypical.temperature, vds_relationship: thresholdTypical.relationship,
      condition_identity: thresholdTypical.condition_identity,
      citation_identity: thresholdTypical.citation_identity,
      evidence_identity: thresholdTypical.evidence_identity,
    }] : []),
    ...(hasRdsonTypical ? [{
      quantity: "rds_on", value: rdsonSeed, unit: "ohm", role: "typical_observation",
      citation: rdsonTypical.point.resistance.page_reference, citations: rdsonTypical.citations,
      conditions: rdsonTypical.conditions, vgs_v: rdsonTypical.vgs, current_a: rdsonTypical.current,
      temperature_c: rdsonTypical.temperature, condition_identity: rdsonTypical.condition_identity,
      citation_identities: rdsonTypical.citation_identities,
      evidence_identities: rdsonTypical.evidence_identities,
      evidence: [
        rdsonConstraintEvidence(rdsonTypical.validated_fields[0], "vgs", rdsonTypical.vgs, "V"),
        rdsonConstraintEvidence(rdsonTypical.validated_fields[1], "drain_current", rdsonTypical.current, "A"),
        rdsonConstraintEvidence(rdsonTypical.validated_fields[2], "rds_on_typical", rdsonTypical.resistance, "ohm"),
      ],
      source_index: rdsonTypical.index,
    }] : []),
  ];
  const seeds = [
    {
      parameter_coordinate: "VTO", value: thresholdSeed, unit: "V",
      evidence_role: hasThresholdTypical ? "typical_observation_seed" : "interval_midpoint_seed_only",
      scored_as_residual: hasThresholdTypical,
      ...(hasThresholdTypical
        ? {
            condition_identity: thresholdTypical.condition_identity,
            evidence: [thresholdConstraintEvidence(thresholdTypical, "threshold_typical", thresholdTypical.value)],
          }
        : { condition_identity: thresholdConstraint.condition_identity, evidence: thresholdConstraint.evidence }),
    },
    {
      parameter_coordinate: "rdson", value: rdsonSeed, unit: "ohm",
      evidence_role: hasRdsonTypical ? "typical_observation_seed" : "bound_value_seed_only",
      scored_as_residual: hasRdsonTypical,
      condition_identity: hasRdsonTypical ? rdsonTypical.condition_identity : rdsonConstraints.find((constraint) => constraint.maximum_ohm === rdsonSeed)?.condition_identity,
      evidence: hasRdsonTypical
        ? [rdsonConstraintEvidence(rdsonTypical.validated_fields[2], "rds_on_typical", rdsonTypical.resistance, "ohm")]
        : rdsonConstraints.find((constraint) => constraint.maximum_ohm === rdsonSeed)?.evidence,
    },
  ];

  if (hasThresholdTypical && hasRdsonTypical) {
    if (constraints.length) {
      const checked = constraintRunner({
        evidence_contract_version: "1.0.0", polarity: polarityFor(part, extraction), constraints, seed: { vto: thresholdSeed, rdson: Math.max(1e-4, rdsonSeed) },
        adjustable: { vto: false, rdson: false },
        fixed: { CGS: parameters.CGS, CGDMAX: parameters.CGDMAX, CGDMIN: parameters.CGDMIN, CJO: parameters.CJO },
      });
      if (JSON.stringify(checked.parameters) !== JSON.stringify(parameters)) throw new Error("typical-point MOSFET F1 constraint verification changed the legacy parameter vector");
      return { fidelity: "F1", parameters, worst: null, points: [], evidence_mode: "typ-point", parameter_metadata: mosfetParameterMetadata("typ-point", specs), calibration: { evidence_mode: "typ-point", observations, constraints: checked.constraint_results, seeds, residual_target_count: observations.length } };
    }
    return { fidelity: "F1", parameters, worst: null, points: [], evidence_mode: "typ-point", parameter_metadata: mosfetParameterMetadata("typ-point", specs), calibration: { evidence_mode: "typ-point", observations, constraints: [], seeds, residual_target_count: observations.length } };
  }

  const constrained = constraintRunner({
    evidence_contract_version: "1.0.0", polarity: polarityFor(part, extraction), constraints, seed: { vto: thresholdSeed, rdson: Math.max(1e-4, rdsonSeed) },
    adjustable: { vto: true, rdson: true },
    fixed: { CGS: parameters.CGS, CGDMAX: parameters.CGDMAX, CGDMIN: parameters.CGDMIN, CJO: parameters.CJO },
  });
  const finalSeedCoordinates = constrained.optimizer?.final_seed_coordinates ?? {};
  const intervalSeeds = seeds.map((seed) => {
    const finalCoordinate = seed.parameter_coordinate === "VTO"
      ? finalSeedCoordinates.vto
      : finalSeedCoordinates.rdson;
    const finalValue = Number(finalCoordinate);
    if (!Number.isFinite(finalValue)) return { ...seed, scored_as_residual: false };
    const displacementDelta = finalValue - seed.value;
    return {
      ...seed,
      scored_as_residual: false,
      final_value: finalValue,
      displaced: displacementDelta !== 0,
      displacement_delta: displacementDelta,
    };
  });
  return {
    fidelity: "F1", parameters: constrained.parameters, worst: null, points: [], evidence_mode: "interval-constrained",
    parameter_metadata: mosfetParameterMetadata("interval-constrained", specs),
    optimizer: { ...constrained.optimizer, seeds: intervalSeeds },
    calibration: { evidence_mode: "interval-constrained", observations, constraints: constrained.constraint_results, seeds: intervalSeeds, residual_target_count: 0 },
  };
}

function modelFor(part, fit) {
  const name = `OC_${safe(part.manufacturer).toUpperCase()}_${safe(part.mpn).toUpperCase()}`;
  const p = fit.parameters;
  if (part.conveyor_family === "diode") {
    const breakdown = Number(p.BV) > 0 && Number(p.IBV) > 0
      ? ` BV=${fmt(p.BV)} IBV=${fmt(p.IBV)} NBV=${fmt(p.NBV ?? 1)}`
      : "";
    return { name, text: `.model ${name} D(IS=${fmt(p.IS)} N=${fmt(p.N)} RS=${fmt(p.RS)}${breakdown})\n` };
  }
  if (part.conveyor_family === "bjt") {
    const polarity = fit.polarity === "p" ? "PNP" : "NPN";
    // ISE/NE carry the low-current roll-off of an F2 Gummel-Poon fit; the F1 path omits them.
    const recombination = Number(p.ISE) > 0 ? ` ISE=${fmt(p.ISE)} NE=${fmt(p.NE ?? 1.5)} NF=${fmt(p.NF ?? 1)}` : "";
    return { name, text: `.model ${name} ${polarity}(IS=${fmt(p.IS)} BF=${fmt(p.BF)} VAF=${fmt(p.VAF)} IKF=${fmt(p.IKF)}${recombination} RB=${fmt(p.RB)} RC=${fmt(p.RC)} RE=${fmt(p.RE)} CJE=${fmt(p.CJE)} CJC=${fmt(p.CJC)} TF=${fmt(p.TF)})\n` };
  }
  const pchan = fit.polarity === "p" ? " pchan" : "";
  const threshold = fit.polarity === "p" ? -Math.abs(p.VTO) : Math.abs(p.VTO);
  return { name, text: `.model ${name} VDMOS(${pchan} VTO=${fmt(threshold)} KP=${fmt(p.KP)} THETA=${fmt(p.THETA)} LAMBDA=${fmt(p.LAMBDA)} RD=${fmt(p.RD)} RS=${fmt(p.RS)} RG=${fmt(p.RG)} RDS=1e9 CGS=${fmt(p.CGS)} CGDMAX=${fmt(p.CGDMAX)} CGDMIN=${fmt(p.CGDMIN)} CJO=${fmt(p.CJO)} IS=${fmt(p.IS)} N=${fmt(p.N)} RB=${fmt(p.RB)})\n` };
}

export function defaultNgspiceRunner(modelText) {
  fs.mkdirSync(localTmpRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(localTmpRoot, "run-"));
  try {
    const netlist = path.join(directory, "syntax.cir");
    fs.writeFileSync(netlist, `OpenCircuit conveyor syntax gate\n${modelText}V1 n 0 0\n.op\n.end\n`);
    const result = spawnSync("ngspice", ["-b", netlist], { encoding: "utf8", timeout: 30_000 });
    if (result.error) throw result.error;
    if (result.status !== 0 || /unknown parameter|unrecognized parameter|fatal error/i.test(`${result.stdout}\n${result.stderr}`)) {
      throw new Error(`ngspice syntax gate failed: ${result.stdout}\n${result.stderr}`.trim());
    }
    return { pass: true };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const BJT_AC_DEFAULTS = { CJE: 1e-12, CJC: 1e-12, TF: 1e-9 };

function pythonInterpreter() {
  for (const candidate of [
    path.resolve(here, "../.venv/bin/python"),
    path.resolve(here, "../../../../../../tools/model-factory/.venv/bin/python"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "python3";
}

/**
 * Run the archetype-backed conveyor fitter.
 *
 * The F2 attempt lives in python/fit_conveyor.py because that is where the archetypes'
 * scipy optimiser and the native ngspice evaluation helper already live. The previous
 * in-file JS regressions selected curves by name, ignored declared units, and had no
 * reachable F2 path for BJTs or MOSFETs at all. See tools/conveyor/DIAGNOSIS.md.
 */
export function defaultFitRunner(payload) {
  fs.mkdirSync(conveyorFitRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(conveyorFitRoot, "fit-"));
  try {
    const input = path.join(directory, "payload.json");
    const output = path.join(directory, "fitted.json");
    fs.writeFileSync(input, json(payload));
    const pythonDir = path.resolve(here, "../python");
    const result = spawnSync(pythonInterpreter(), [path.join(pythonDir, "fit_conveyor.py"), input, output], {
      cwd: pythonDir, encoding: "utf8", timeout: 900_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0 || !fs.existsSync(output)) {
      throw new Error(`conveyor fitter failed: ${result.stdout}\n${result.stderr}`.trim());
    }
    return JSON.parse(fs.readFileSync(output, "utf8"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export function defaultMosfetConstraintRunner(payload) {
  fs.mkdirSync(conveyorFitRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(conveyorFitRoot, "mosfet-f1-"));
  try {
    const input = path.join(directory, "payload.json");
    const output = path.join(directory, "fitted.json");
    fs.writeFileSync(input, json(payload));
    const pythonDir = path.resolve(here, "../python");
    const result = spawnSync(pythonInterpreter(), [path.join(pythonDir, "fit_mosfet_f1_constraints.py"), input, output], {
      cwd: pythonDir, encoding: "utf8", timeout: 900_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0 || !fs.existsSync(output)) {
      throw new Error(`MOSFET F1 constraint fitter failed: ${result.stdout}\n${result.stderr}`.trim());
    }
    const fitted = JSON.parse(fs.readFileSync(output, "utf8"));
    if (!fitted.ok) throw new Error(`MOSFET F1 constraint set is infeasible: ${fitted.error}`);
    return fitted;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export function fitBulkPart(part, extraction, { ngspiceRunner = defaultNgspiceRunner, fitRunner = defaultFitRunner, mosfetConstraintRunner = defaultMosfetConstraintRunner, forceF1 = false } = {}) {
  const polarity = polarityFor(part, extraction);
  let fit;
  if (!forceF1 && extraction?.usable_curves) {
    const fitExtraction = part.conveyor_family === "mosfet" ? normalizeMosfetExtractionForFit(part, extraction) : extraction;
    const attempt = fitRunner({
      ...(part.conveyor_family === "mosfet" ? { evidence_contract_version: "1.0.0" } : {}),
      family: part.conveyor_family, extraction: fitExtraction, polarity,
      mpn: part.mpn, manufacturer: part.manufacturer, seed_hints: part.seed_hints ?? [],
    });
    if (attempt?.fidelity !== "F2") {
      throw new Error(attempt?.demotion_reason || `${part.conveyor_family} F2 fit produced no result`);
    }
    const parameters = part.conveyor_family === "bjt" ? { ...BJT_AC_DEFAULTS, ...attempt.parameters } : attempt.parameters;
    const attemptRows = attempt.residuals ?? [];
    if (part.conveyor_family === "mosfet") {
      if (attempt.evidence_contract_version !== "1.0.0") throw new Error("MOSFET F2 fitter result omitted evidence_contract_version 1.0.0");
      for (const row of attemptRows) {
        if (!row.condition_identity || !row.citation_identity || !row.evidence_identity) throw new Error("MOSFET F2 fitter result omitted complete evidence identities");
      }
    }
    const constraintRows = attemptRows.filter((row) => row.evidence_role === "inequality_constraint");
    const observationRows = attemptRows.filter((row) => row.evidence_role !== "inequality_constraint");
    fit = {
      fidelity: "F2", parameters, worst: attempt.worst?.value ?? null,
      worst_quantity: attempt.worst?.quantity ?? null, rms: attempt.rms ?? null, gate_pass: attempt.gate_pass,
      residuals: attemptRows, curves_used: attempt.curves_used ?? [],
      curves_rejected: attempt.curves_rejected ?? [], optimizer: attempt.optimizer ?? null,
      fitter: attempt.fitter ?? null, points: [], evidence_mode: "curve-fitted",
      evidence_contract_version: attempt.evidence_contract_version ?? null,
      evidence_curves: part.conveyor_family === "mosfet" ? fitExtraction.curves.filter((curve) => curve.characteristic) : [],
      parameter_metadata: Object.fromEntries(Object.keys(parameters).map((name) => {
        const held = (attempt.optimizer?.held_defaults ?? []).find((item) => item.parameter === name);
        return [name, held ? { status: `held default: ${held.reason}` } : { status: "evidence-derived (curve-fitted)", evidence_mode: "curve-fitted" }];
      })),
      calibration: { evidence_mode: "curve-fitted", observations: observationRows, constraints: constraintRows, seeds: [], residual_target_count: observationRows.length },
    };
  } else if (part.conveyor_family === "diode") fit = diodeFit(part, extraction, forceF1);
  else if (part.conveyor_family === "bjt") fit = bjtFit(part, extraction, forceF1);
  else if (part.conveyor_family === "mosfet") fit = mosfetFit(part, extraction, forceF1, mosfetConstraintRunner);
  else throw new Error(`Unsupported conveyor family: ${part.conveyor_family}`);
  fit.polarity = polarity;
  if (part.conveyor_family === "diode") {
    const breakdown = zenerInputs(extraction);
    if (breakdown) fit.parameters = { ...fit.parameters, ...breakdown };
  }
  const model = modelFor(part, fit);
  ngspiceRunner(model.text, { part, fit });
  return { ...fit, model };
}

function pinsFor(family, polarity) {
  if (family === "diode") return { pins: [{ name: "A", number: "1", role: "anode", node: "anode" }, { name: "K", number: "2", role: "cathode", node: "cathode" }], order: ["1", "2"], electrical: "diode" };
  if (family === "bjt") return { pins: [{ name: "B", number: "1", role: "base", node: "base" }, { name: "C", number: "2", role: "collector", node: "collector" }, { name: "E", number: "3", role: "emitter", node: "emitter" }], order: ["2", "1", "3"], electrical: polarity === "p" ? "bjt_pnp" : "bjt_npn" };
  return { pins: [{ name: "G", number: "1", role: "gate", node: "gate" }, { name: "D", number: "2", role: "drain", node: "drain" }, { name: "S", number: "3", role: "source", node: "source" }], order: ["2", "1", "3"], electrical: polarity === "p" ? "pmos" : "nmos" };
}

export function normalizedIdentity(part, extraction = null) {
  const original = String(part.mpn).trim();
  if (/nexperia/i.test(part.manufacturer) && original.includes(",")) {
    const canonical = original.split(",", 1)[0].trim();
    return { canonical, aliases: [original], packageSlug: safe(original.replace(",", "-")) };
  }
  const asciiParentheses = original.replaceAll("（", "(").replaceAll("）", ")");
  const ranged = /^([A-Za-z0-9][A-Za-z0-9._+/-]*)\(RANGE:[^)]+\)$/i.exec(asciiParentheses);
  if (ranged) return { canonical: ranged[1], aliases: [original], packageSlug: safe(original) };
  const notes = extraction?.extraction_notes?.join(" ") ?? "";
  const title = extraction?.datasheet_identity?.title ?? "";
  const documentedSuffix = /^([A-Za-z0-9][A-Za-z0-9._+/-]*)(?:\s+[A-Za-z0-9-]{1,8})?\((?:RANGE:[^)]+|[A-Za-z0-9-]{1,8})\)$/i.exec(asciiParentheses);
  const titleNames = (candidate) => new RegExp(`(^|[^A-Za-z0-9])${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i").test(title);
  const tapeReelSupplierTag = /^([A-Za-z0-9][A-Za-z0-9._+/-]*?)TR\([A-Za-z0-9-]{1,8}\)$/i.exec(asciiParentheses);
  if (tapeReelSupplierTag && titleNames(tapeReelSupplierTag[1])) {
    return { canonical: tapeReelSupplierTag[1], aliases: [original], packageSlug: safe(original) };
  }
  const commaOrderingCode = /^([A-Za-z0-9][A-Za-z0-9._+/-]*),([A-Za-z0-9-]{1,12})$/.exec(original);
  if (commaOrderingCode && titleNames(commaOrderingCode[1])
      && /(ordering(?:-code)?|order code|requested ordering code|identity (?:is )?preserved)/i.test(notes)) {
    return { canonical: commaOrderingCode[1], aliases: [original], packageSlug: safe(original.replace(",", "-")) };
  }
  const titleNamesBaseDevice = documentedSuffix && titleNames(documentedSuffix[1]);
  const rankedBase = documentedSuffix && /^(.+\d)[A-Z]$/i.exec(documentedSuffix[1]);
  // Some BJT catalog identities append both a one-letter gain rank and a parenthetical
  // package marking while the public datasheet title names the unranked base device.
  if (rankedBase && titleNames(rankedBase[1]) && /(identity preserved|classification|gain|rank|marking)/i.test(notes)) {
    return { canonical: rankedBase[1], aliases: [original], packageSlug: safe(original) };
  }
  // Catalog MPNs commonly append a short package marking or supplier tag in parentheses.
  // When the cited datasheet title independently names the base device, the suffix is an
  // ordering alias even if the extractor did not use the word "marking" in its notes.
  if (documentedSuffix && titleNamesBaseDevice
      && (/(marking|classification|rank|bin|range)/i.test(notes) || !/^range:/i.test(asciiParentheses.slice(asciiParentheses.lastIndexOf("(") + 1)))) {
    return { canonical: documentedSuffix[1], aliases: [original], packageSlug: safe(original) };
  }
  const marked = /^([A-Za-z0-9][A-Za-z0-9._+/-]*)\s+([A-Za-z0-9]{1,4})$/.exec(original);
  if (marked && /marking/i.test(notes) && title.toLowerCase().includes(marked[1].toLowerCase())) {
    return { canonical: marked[1], aliases: [original], packageSlug: safe(original) };
  }
  return { canonical: original, aliases: [], packageSlug: safe(original) };
}

export function libraryCollisionReason(part, libraryRoot = reviewedLibraryRoot, extraction = null) {
  const identity = normalizedIdentity(part, extraction);
  const candidateIdentifiers = new Set([identity.canonical, ...identity.aliases].map((value) => value.toLowerCase()));
  if (!fs.existsSync(libraryRoot)) return null;
  for (const manufacturer of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
    if (!manufacturer.isDirectory()) continue;
    const manufacturerDir = path.join(libraryRoot, manufacturer.name);
    for (const packageEntry of fs.readdirSync(manufacturerDir, { withFileTypes: true })) {
      if (!packageEntry.isDirectory()) continue;
      const componentPath = path.join(manufacturerDir, packageEntry.name, "component.json");
      if (!fs.existsSync(componentPath)) continue;
      const component = JSON.parse(fs.readFileSync(componentPath, "utf8"));
      const existing = [component.canonical_mpn, ...(component.ordering_code_aliases ?? [])]
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.toLowerCase());
      const collision = existing.find((value) => candidateIdentifiers.has(value));
      if (collision) return `library identity collision: ${collision} already represented by ${manufacturer.name}/${packageEntry.name}`;
    }
  }
  return null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

function legacyCoordinate(raw, quantityName) {
  if (raw?.kind === "fixed") return { kind: "fixed", [`value_${quantityName === "id" ? "a" : "v"}`]: Number(raw.value) };
  if (raw?.kind === "range") return { kind: "range", [`lower_${quantityName === "id" ? "a" : "v"}`]: Number(raw.minimum), [`upper_${quantityName === "id" ? "a" : "v"}`]: Number(raw.maximum) };
  if (raw?.kind === "equal_to_gate_source_voltage") return { kind: "relation", relation: "vds_equals_vgs" };
  if (raw?.kind === "swept") return { kind: "relation", relation: "measured_threshold" };
  if (raw?.kind === "measured_result") return { kind: "relation", relation: "measured_result" };
  throw new Error(`unsupported curated VDMOS ${quantityName} coordinate ${raw?.kind ?? "missing"}`);
}

function legacyTestMode(qualifiers) {
  const mode = qualifiers?.test_mode;
  if (mode === "electrical_characteristic") return { kind: "dc" };
  if (mode === "pulse") {
    const pulseWidth = Number(qualifiers?.pulse_width_maximum?.value);
    if (!(pulseWidth > 0)) throw new Error("curated VDMOS pulse evidence requires a positive pulse-width limit");
    return {
      kind: "pulsed",
      pulse_width_s: pulseWidth,
      ...(qualifiers?.duty_cycle_maximum == null ? {} : { duty_cycle: Number(qualifiers.duty_cycle_maximum.value) }),
    };
  }
  throw new Error(`unsupported curated VDMOS test mode ${mode ?? "missing"}`);
}

function canonicalCuratedCondition(identity, characteristic) {
  const condition = {
    schema_version: "1.0.0",
    characteristic,
    polarity: "n",
    magnitude_convention: "absolute",
    temperature: { kind: identity.temperature.kind, value_c: Number(identity.temperature.value) },
    electrical: {
      vgs: legacyCoordinate(identity.gate_source_voltage, "vgs"),
      vds: legacyCoordinate(identity.drain_source_voltage, "vds"),
      id: legacyCoordinate(identity.drain_current, "id"),
    },
    test_mode: legacyTestMode(identity.qualifiers),
    qualifiers: (identity.qualifiers?.tokens ?? []).map((token) => ({ key: "source_qualifier", value: String(token) }))
      .sort((left, right) => left.value.localeCompare(right.value)),
  };
  return { ...condition, condition_id: identityHash("sha256", condition) };
}

function canonicalCuratedCitation(citation, sourceSha256) {
  const page = Number(String(citation.page_reference).match(/\bp\.\s*(\d+)/i)?.[1]);
  if (!(page > 0)) throw new Error(`curated VDMOS citation lacks an exact page: ${citation.page_reference}`);
  const locator = citation.locator;
  const value = {
    source_sha256: sourceSha256,
    page,
    ...(locator.kind === "table_row"
      ? { table: "Electrical characteristics", row: locator.label }
      : locator.kind === "figure"
        ? { figure: String(locator.label).match(/Fig\.\s*([^,]+)/i)?.[1] ?? locator.label, curve: locator.label }
        : (() => { throw new Error(`unsupported curated VDMOS citation locator ${locator.kind}`); })()),
  };
  return { ...value, citation_id: identityHash("sha256", value) };
}

function canonicalCuratedDatum(datum, characteristic, quantityName, role, sourceSha256) {
  const condition = canonicalCuratedCondition(datum.identity, characteristic);
  const citation = canonicalCuratedCitation(datum.identity.citation, sourceSha256);
  const value = Number(datum.value);
  const evidence = {
    role,
    condition_id: condition.condition_id,
    citation_id: citation.citation_id,
    cohort_id: identityHash("sha256", citationCohortMaterial(characteristic, condition.condition_id, citation)),
  };
  return {
    value,
    unit: datum.unit,
    condition_identity: condition,
    citation_identity: citation,
    evidence_identity: {
      ...evidence,
      evidence_id: identityHash("sha256", { characteristic, role, quantity: quantityName, value_si: value, unit_si: datum.unit, condition_id: condition.condition_id, citation_id: citation.citation_id }),
    },
  };
}

function canonicalCuratedCurve(curve, characteristic, sourceSha256) {
  const condition = canonicalCuratedCondition(curve.condition_identity, characteristic);
  const citation = canonicalCuratedCitation(curve.citation_identity, sourceSha256);
  const points = curve.points.map(({ x_si, y_si, point_index }) => ({ x_si: Number(x_si), y_si: Number(y_si), point_index }));
  const xAxis = { quantity: characteristic === "transfer_current" ? "vgs" : "vds", unit: "V" };
  const yAxis = { quantity: "id", unit: "A" };
  const curveId = identityHash("sha256", { schema_version: "1.0.0", characteristic, x_axis: xAxis, y_axis: yAxis, condition_id: condition.condition_id, citation_id: citation.citation_id, points });
  const cohortId = identityHash("sha256", { characteristic, condition_id: condition.condition_id, citation_id: citation.citation_id, curve_id: curveId });
  return {
    name: curve.citation_identity.locator.label,
    curve_id: curveId,
    characteristic,
    x_axis: xAxis,
    y_axis: yAxis,
    condition_identity: condition,
    citation_identity: citation,
    points: points.map((point) => ({ ...point, evidence_identity: {
      role: "digitized_typical_curve",
      condition_id: condition.condition_id,
      citation_id: citation.citation_id,
      cohort_id: cohortId,
      curve_id: curveId,
      point_index: point.point_index,
      evidence_id: identityHash("sha256", { characteristic, role: "digitized_typical_curve", ...point, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: cohortId, curve_id: curveId }),
    } })),
  };
}

export function adaptCuratedVdmosFactsForPython(facts, sourceSha256) {
  if (!/^[0-9a-f]{64}$/.test(String(sourceSha256))) throw new Error("curated VDMOS adapter requires the real datasheet SHA-256");
  return {
    evidence_contract_version: "1.0.0",
    threshold: {
      minimum: canonicalCuratedDatum(facts.threshold.minimum, "gate_threshold", "threshold_minimum", "minimum", sourceSha256),
      maximum: canonicalCuratedDatum(facts.threshold.maximum, "gate_threshold", "threshold_maximum", "maximum", sourceSha256),
    },
    rdson_points: facts.rdson_points.map((point) => {
      const resistance = canonicalCuratedDatum(point.resistance, "rds_on", "rds_on_maximum", "maximum", sourceSha256);
      const condition = resistance.condition_identity;
      const citation = resistance.citation_identity;
      const datum = (source, quantityName) => {
        const value = Number(source.value);
        const evidence = { role: "maximum", condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: identityHash("sha256", citationCohortMaterial("rds_on", condition.condition_id, citation)) };
        return { value, unit: source.unit, condition_identity: condition, citation_identity: citation, evidence_identity: { ...evidence, evidence_id: identityHash("sha256", { characteristic: "rds_on", role: "maximum", quantity: quantityName, value_si: value, unit_si: source.unit, condition_id: condition.condition_id, citation_id: citation.citation_id }) } };
      };
      return { vgs: datum(point.vgs, "vgs"), current: datum(point.current, "drain_current"), resistance };
    }),
    transfer_curves: facts.transfer_curves.map((curve) => canonicalCuratedCurve(curve, "transfer_current", sourceSha256)),
    output_curves: facts.output_curves.map((curve) => canonicalCuratedCurve(curve, "output_current", sourceSha256)),
  };
}

export function parameterVectorKey(part, fit) {
  return JSON.stringify(stableValue({ family: part.conveyor_family, polarity: fit.polarity, parameters: fit.parameters }));
}

export function libraryDuplicateDieReason(part, fit, libraryRoot = reviewedLibraryRoot, ignorePackagePath = null) {
  const candidateKey = parameterVectorKey(part, fit);
  if (!fs.existsSync(libraryRoot)) return null;
  for (const manufacturer of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
    if (!manufacturer.isDirectory()) continue;
    const manufacturerDir = path.join(libraryRoot, manufacturer.name);
    for (const packageEntry of fs.readdirSync(manufacturerDir, { withFileTypes: true })) {
      if (!packageEntry.isDirectory()) continue;
      const packagePath = path.join(manufacturerDir, packageEntry.name);
      if (ignorePackagePath && path.resolve(packagePath) === path.resolve(ignorePackagePath)) continue;
      const componentPath = path.join(packagePath, "component.json");
      const fittedPath = path.join(packagePath, "fitted.json");
      if (!fs.existsSync(componentPath) || !fs.existsSync(fittedPath)) continue;
      const component = JSON.parse(fs.readFileSync(componentPath, "utf8"));
      const family = String(component.electrical_family ?? "").startsWith("bjt_") ? "bjt"
        : ["nmos", "pmos"].includes(component.electrical_family) ? "mosfet"
          : component.electrical_family === "diode" ? "diode" : null;
      if (family !== part.conveyor_family) continue;
      const polarity = ["bjt_pnp", "pmos"].includes(component.electrical_family) ? "p" : "n";
      const fitted = JSON.parse(fs.readFileSync(fittedPath, "utf8"));
      const existingKey = JSON.stringify(stableValue({ family, polarity, parameters: fitted.parameters }));
      if (existingKey === candidateKey) {
        return `duplicate fitted die vector already represented by ${manufacturer.name}/${packageEntry.name}; no independent parameterization or shared-die evidence was supplied`;
      }
    }
  }
  return null;
}

export function repairKnownEvidenceDefects(part, extraction) {
  const repaired = structuredClone(extraction);
  if (String(part.mpn).toUpperCase() !== "MMBT2222ALT1G") return repaired;
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (value.page_reference === "3") value.page_reference = "p. 3, Figure 3, DC Current Gain";
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(repaired);
  return repaired;
}

function quantity(value, unit, conditions, pageReference, sourceKind = "typical") {
  const citation = /^\d+$/.test(String(pageReference ?? "").trim()) ? `p. ${String(pageReference).trim()}` : pageReference;
  return { value: Number(value), unit, conditions, page_reference: citation, source_kind: sourceKind };
}

function siValue(value, unit) {
  const normalized = String(unit ?? "").trim().replaceAll("μ", "µ").replace("Ω", "ohm");
  const factors = {
    A: 1, mA: 1e-3, uA: 1e-6, "µA": 1e-6, nA: 1e-9, pA: 1e-12,
    V: 1, mV: 1e-3, uV: 1e-6, "µV": 1e-6,
    F: 1, mF: 1e-3, uF: 1e-6, "µF": 1e-6, nF: 1e-9, pF: 1e-12,
    s: 1, ms: 1e-3, us: 1e-6, "µs": 1e-6, ns: 1e-9, ps: 1e-12,
    Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9,
    ohm: 1, mohm: 1e-3, kohm: 1e3, Mohm: 1e6,
    "1": 1, degC: 1,
  };
  const factor = factors[normalized];
  return factor == null ? { value: Number(value), unit: normalized || unit } : { value: Number(value) * factor, unit: normalized.replace(/^(?:m|u|µ|n|p|k|M|G)(?=[AVFsH]|ohm)/, "") };
}

function magnitudeQuantity(value) {
  if (!value) return value;
  const { condition_semantics: _conditionSemantics, ...publicValue } = value;
  return { ...publicValue, value: Math.abs(Number(value.value)) };
}

function normalizeEvidence(value) {
  if (Array.isArray(value)) return value.map(normalizeEvidence);
  if (!value || typeof value !== "object") return value;
  if (Number.isFinite(Number(value.value)) && typeof value.unit === "string") {
    const converted = siValue(value.value, value.unit);
    return {
      ...value,
      value: converted.value,
      unit: converted.unit,
      page_reference: /^\d+$/.test(String(value.page_reference ?? "").trim()) ? `p. ${String(value.page_reference).trim()}` : value.page_reference,
    };
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeEvidence(child)]));
}

function conditionNumber(text, symbol, fallback = null) {
  const match = String(text ?? "").match(new RegExp(`${symbol}\\s*(?:magnitude)?\\s*=\\s*([0-9.+-]+)\\s*V`, "i"));
  return match && Number.isFinite(Number(match[1])) ? Math.abs(Number(match[1])) : fallback;
}

function conditionCurrent(text, fallback = null) {
  const match = String(text ?? "").replaceAll("_", "").match(/(?:I[DCR]|collector current|drain current)\|?\s*=\s*([0-9.eE+-]+)\s*(u|µ|μ|m)?A/i);
  if (!match) return fallback;
  return Math.abs(Number(match[1])) * ({ u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3 }[match[2]?.toLowerCase()] ?? 1);
}

function nominalCurve(extraction, predicate) {
  return (extraction.curves ?? []).find((curve) => {
    const text = `${curve.name} ${curve.test_conditions}`.toLowerCase();
    return predicate(curve, text) && (!/(-55|85|125|150)\s*(?:deg\s*c|degc|°c)/i.test(text) || /25\s*(?:deg\s*c|degc|°c)/i.test(text));
  });
}

function isNominalTemperatureEvidence(point) {
  const text = Object.values(point ?? {}).map((value) => value?.conditions ?? "").join(" ");
  const temperatures = [...text.matchAll(/([+-]?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c)/gi)].map((match) => Number(match[1]));
  return temperatures.length === 0 || temperatures.every((temperature) => Math.abs(temperature - 25) <= 5);
}

function acceptedRdsonFactPoints(specs, fit, part = null, extraction = null) {
  if (fit.fidelity === "F2" && !adjudicatedExtractions.has(extraction)) return specs.rdson_points ?? [];
  const evidence = citedRdsonEvidence(specs, mosfetEvidenceContext(part, extraction));
  const accepted = fit.fidelity === "F2"
    ? [...evidence.typical, ...evidence.maximum]
    : fit.evidence_mode === "typ-point"
      ? evidence.typical.filter((validated) => validated.index === fit.calibration?.observations?.find((observation) => observation.quantity === "rds_on")?.source_index)
      : [...evidence.typical, ...evidence.maximum];
  return accepted.map((validated) => Object.fromEntries(
    [["vgs", 0], ["current", 1], ["resistance", 2]].map(([key, fieldIndex]) => [key, {
      ...validated.point[key],
      condition_identity: validated.condition_identity,
      citation_identity: validated.citation_identities[fieldIndex],
      evidence_identity: validated.evidence_identities[fieldIndex],
    }]),
  ));
}

function identityDatum(validated, quantityLabel, sourceEvidence = validated.evidence) {
  return {
    ...magnitudeQuantity(normalizeEvidence(sourceEvidence)),
    quantity: quantityLabel,
    condition_identity: validated.condition_identity,
    citation_identity: validated.citation_identity,
    evidence_identity: validated.evidence_identity,
  };
}

function acceptedThresholdFacts(specs, fit, part, extraction) {
  const context = mosfetEvidenceContext(part, extraction);
  let typical = null;
  try {
    if (specs.threshold_typ) typical = validateThresholdEvidence(specs.threshold_typ, "typical", "MOSFET threshold facts typical", context);
  } catch {
    typical = null;
  }
  let minimum = null;
  let maximum = null;
  try {
    if (specs.threshold_min) minimum = validateThresholdEvidence(specs.threshold_min, "minimum", "MOSFET threshold facts minimum", context);
    if (specs.threshold_max) maximum = validateThresholdEvidence(specs.threshold_max, "maximum", "MOSFET threshold facts maximum", context);
    const cohort = [minimum, typical, maximum].filter(Boolean);
    if (cohort.length > 1 && !cohort.slice(1).every((item) => sameIdentity(cohort[0], item))) {
      throw new Error("MOSFET threshold facts do not share one condition and citation cohort");
    }
  } catch (error) {
    if (fit.fidelity !== "F2") throw error;
    minimum = null;
    maximum = null;
  }
  if (!minimum && !typical && !maximum) return null;
  return {
    minimum: minimum ? identityDatum(minimum, "threshold_minimum") : null,
    typical: typical ? identityDatum(typical, "threshold_typical") : null,
    maximum: maximum ? identityDatum(maximum, "threshold_maximum") : null,
  };
}

function bulkFactoryFacts(part, extraction, fit, identity, source, sourceExtraction = extraction) {
  const common = {
    schema_version: "1.0.0",
    extraction: sourceExtraction,
    catalog_seed_hints: part.seed_hints ?? [],
    identity: { canonical_mpn: identity.canonical, manufacturer: part.manufacturer, aliases: identity.aliases },
    source,
  };
  const specs = normalizeEvidence(extraction?.specs ?? {});
  if (part.conveyor_family === "diode") {
    const fitPoints = [];
    if (fit.fidelity === "F2" && fit.residuals?.length) {
      const curve = nominalCurve(extraction, (candidate) => {
        const x = candidate.x_axis?.quantity?.toLowerCase() ?? "";
        const y = candidate.y_axis?.quantity?.toLowerCase() ?? "";
        return x.includes("forward") && x.includes("voltage") && y.includes("forward") && y.includes("current");
      });
      for (const [index, row] of fit.residuals.entries()) {
        const current = Number(row.quantity.match(/at ([0-9.eE+-]+) A/)?.[1] ?? curve?.points?.[index]?.y);
        if (!Number.isFinite(current)) continue;
        const citation = row.citation;
        fitPoints.push({
          current: quantity(current, "A", curve?.test_conditions ?? "Nominal 25 degC fitted forward curve", citation, "digitized_typical_curve"),
          voltage: quantity(row.datasheet_value, "V", curve?.test_conditions ?? "Nominal 25 degC fitted forward curve", citation, "digitized_typical_curve"),
        });
      }
    }
    const scalarForwardPoints = specs.forward_voltage_points ?? [];
    if (fit.fidelity === "F1") {
      const typicalPoints = scalarForwardPoints.filter((point) => !["minimum", "maximum"].includes(point.voltage?.source_kind));
      const calibrationPoint = typicalPoints.find((point) => Number(point.voltage?.value) > 0 && Number(point.current?.value) > 0);
      const maximumPoints = scalarForwardPoints.filter((point) => point.voltage?.source_kind === "maximum").sort((left, right) => right.current.value - left.current.value);
      const conservativeMaximum = maximumPoints[0] ? {
        ...maximumPoints[0],
        current: {
          ...maximumPoints[0].current,
          value: maximumPoints[0].current.value * 0.95,
          conditions: `Conservative F1 package bench at 95% of the cited current; ${maximumPoints[0].current.conditions}`,
        },
      } : null;
      // F1 is calibrated to one representative point. Retaining an entire failed F2
      // curve as package expectations would silently make the same multi-point claim.
      fitPoints.push(...(calibrationPoint ? [calibrationPoint] : []), ...(conservativeMaximum ? [conservativeMaximum] : []));
    } else {
      fitPoints.push(...scalarForwardPoints);
    }
    const electricalLimits = {};
    if (fit.fidelity === "F2" && specs.reverse_current) {
      const reverseVoltage = conditionNumber(specs.reverse_current.conditions, "VR", null);
      if (reverseVoltage != null) electricalLimits[`reverse_current_${reverseVoltage}v`] = specs.reverse_current;
    }
    const derivedModelInputs = {};
    if (Number(fit.parameters?.BV) > 0 && Number(fit.parameters?.IBV) > 0) {
      derivedModelInputs.BV = specs.breakdown_voltage;
      derivedModelInputs.IBV = specs.breakdown_current;
      derivedModelInputs.NBV = quantity(1, "1", "First-order avalanche-knee default; no multi-point reverse-knee trace was available", "model-factory Zener F1 policy", "held_default");
    }
    return { ...common, fit_points: fitPoints, electrical_limits: electricalLimits, derived_model_inputs: derivedModelInputs };
  }
  if (part.conveyor_family === "bjt") {
    const gainPoints = [];
    if (fit.fidelity === "F2") {
      const curve = nominalCurve(extraction, (candidate) => {
        const x = candidate.x_axis?.quantity?.toLowerCase() ?? "";
        const y = candidate.y_axis?.quantity?.toLowerCase() ?? "";
        return x.includes("collector current") && (y.includes("gain") || y.includes("hfe")) && !y.includes("bandwidth");
      });
      const vce = conditionNumber(curve?.test_conditions, "VCE", fit.optimizer?.vce ?? 5);
      for (const point of curve?.points ?? []) {
        const collectorCurrent = siValue(point.x, curve.x_axis?.unit ?? "A");
        const gain = siValue(point.y, curve.y_axis?.unit ?? "1");
        gainPoints.push({
          collector_current: quantity(Math.abs(collectorCurrent.value), collectorCurrent.unit, curve.test_conditions, curve.page_reference, "digitized_typical_curve"),
          vce: quantity(vce, "V", curve.test_conditions, curve.page_reference, "digitized_typical_curve"),
          hfe: quantity(gain.value, gain.unit, curve.test_conditions, curve.page_reference, "digitized_typical_curve"),
        });
      }
    }
    const scalarGainPoints = (specs.gain_points ?? []).map((point) => ({
      ...point,
      collector_current: magnitudeQuantity(point.collector_current),
      vce: magnitudeQuantity(point.vce),
      hfe: magnitudeQuantity(point.hfe),
    }));
    if (fit.fidelity === "F1") {
      const boundedPoints = scalarGainPoints.filter((point) => point.hfe?.source_kind === "minimum");
      const typicalPoints = scalarGainPoints.filter((point) => !["minimum", "maximum"].includes(point.hfe?.source_kind));
      const referenceGain = Number(fit.parameters?.BF);
      const representative = typicalPoints
        .filter((point) => Number(point.hfe?.value) > 0)
        .sort((left, right) => Math.abs(left.hfe.value - referenceGain) - Math.abs(right.hfe.value - referenceGain))[0];
      gainPoints.push(...boundedPoints, ...(representative ? [representative] : []));
    } else {
      gainPoints.push(...scalarGainPoints);
    }
    const saturationPoints = (specs.saturation_points ?? []).map((point) => ({
      ...point,
      collector_current: magnitudeQuantity(point.collector_current),
      base_current: magnitudeQuantity(point.base_current),
      vce_sat: magnitudeQuantity(point.vce_sat),
      vbe_sat: magnitudeQuantity(point.vbe_sat),
    }));
    return { ...common, gain_points: gainPoints, saturation_points: fit.fidelity === "F2" || gainPoints.length === 0 ? saturationPoints : [] };
  }
  const factSpecs = adjudicatedExtractions.has(extraction)
    ? extraction.specs
    : fit.fidelity === "F2"
      ? normalizeMosfetExtractionForFit(part, extraction).specs
      : extraction.specs;
  const rdsonPoints = acceptedRdsonFactPoints(factSpecs, fit, part, extraction).map((point) => ({
    vgs: { ...magnitudeQuantity(normalizeEvidence(point.vgs)), quantity: "vgs" },
    current: { ...magnitudeQuantity(normalizeEvidence(point.current)), quantity: "drain_current" },
    resistance: {
      ...magnitudeQuantity(normalizeEvidence(point.resistance)),
      quantity: point.resistance.source_kind === "minimum" ? "rds_on_minimum" : point.resistance.source_kind === "maximum" ? "rds_on_maximum" : "rds_on_typical",
    },
  }));
  const threshold = acceptedThresholdFacts(factSpecs, fit, part, extraction);
  const contractCurve = (curve) => Object.fromEntries(Object.entries(curve).filter(([key]) => !["name", "page_reference", "test_conditions"].includes(key)));
  const transferCurves = (fit.evidence_curves ?? []).filter((curve) => curve.characteristic === "transfer_current").map(contractCurve);
  const outputCurves = (fit.evidence_curves ?? []).filter((curve) => curve.characteristic === "output_current").map(contractCurve);
  return {
    ...common,
    evidence_contract_version: "1.0.0",
    rdson_points: rdsonPoints,
    threshold,
    curves: [...transferCurves, ...outputCurves],
    transfer_curves: transferCurves,
    output_curves: outputCurves,
    transfer_points: [],
    output_points: [],
  };
}

function numericBound(quantityName, values, unit, conditions) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return null;
  return { quantity: quantityName, minimum: Math.min(...finite), maximum: Math.max(...finite), unit, conditions, placeholder: false };
}

function evidenceRef(row) {
  return {
    evidence_id: row.evidence.evidence_id,
    condition_id: row.condition.condition_id,
    citation_id: row.citation.citation_id,
    cohort_id: row.evidence.cohort_id,
  };
}

function strictMosfetEvidenceRows(facts) {
  const rows = [];
  for (const point of facts.rdson_points ?? []) {
    for (const datum of [point.vgs, point.current, point.resistance]) {
      rows.push({ condition: datum.condition_identity, citation: datum.citation_identity, evidence: datum.evidence_identity });
    }
  }
  for (const field of ["minimum", "typical", "maximum"]) {
    const datum = facts.threshold?.[field];
    if (datum) rows.push({ condition: datum.condition_identity, citation: datum.citation_identity, evidence: datum.evidence_identity });
  }
  for (const curve of facts.curves ?? []) {
    for (const point of curve.points ?? []) rows.push({ condition: curve.condition_identity, citation: curve.citation_identity, evidence: point.evidence_identity });
  }
  return rows;
}

function conditionValuesForRegion(condition, quantityName, temperatureKind = null) {
  if (quantityName === "temperature") return condition.temperature.kind === temperatureKind ? [condition.temperature.value_c] : [];
  const field = condition.electrical[quantityName];
  if (field.kind === "fixed") return [field[`value_${quantityName === "id" ? "a" : "v"}`]];
  if (field.kind === "range") return [field[`lower_${quantityName === "id" ? "a" : "v"}`], field[`upper_${quantityName === "id" ? "a" : "v"}`]];
  return [];
}

function strictMosfetBound(quantityName, rows, unit, { temperatureKind = null } = {}) {
  const selected = rows.filter((row) => conditionValuesForRegion(row.condition, quantityName, temperatureKind).length);
  if (!selected.length) return null;
  const values = selected.flatMap((row) => conditionValuesForRegion(row.condition, quantityName, temperatureKind));
  const refs = [...new Map(selected.map((row) => [row.evidence.evidence_id, evidenceRef(row)])).values()];
  const material = {
    quantity: quantityName,
    kind: "range",
    unit,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    evidence_refs: refs,
    condition_ids: [...new Set(refs.map((ref) => ref.condition_id))].sort(),
    citation_ids: [...new Set(refs.map((ref) => ref.citation_id))].sort(),
    derivation: "direct_evidence_union",
    ...(temperatureKind ? { temperature_kind: temperatureKind } : {}),
  };
  return { bound_id: identityHash("sha256", material), ...material, conditions: "Direct cited MOSFET evidence union", placeholder: false };
}

function strictMosfetOperatingRegion(facts) {
  const rows = strictMosfetEvidenceRows(facts);
  const bounds = [
    strictMosfetBound("vgs", rows, "V"),
    strictMosfetBound("vds", rows, "V"),
    strictMosfetBound("id", rows, "A"),
    ...["junction", "ambient", "case"].map((kind) => strictMosfetBound("temperature", rows, "degC", { temperatureKind: kind })),
  ].filter(Boolean);
  if (!bounds.some((bound) => bound.quantity === "vgs") || !bounds.some((bound) => bound.quantity === "id") || !bounds.some((bound) => bound.quantity === "temperature")) {
    throw new Error("MOSFET supported operating region lacks validated VGS, ID, or temperature evidence");
  }
  const summary = bounds.map((bound) => `${bound.quantity}${bound.temperature_kind ? `(${bound.temperature_kind})` : ""} ${bound.minimum} to ${bound.maximum} ${bound.unit}`).join("; ");
  return { contract_version: "1.0.0", summary: `Supported only over the direct cited evidence union: ${summary}.`, numeric_bounds: bounds };
}

function operatingRegion(part, facts) {
  if (part.conveyor_family === "mosfet" && facts.evidence_contract_version === "1.0.0") return strictMosfetOperatingRegion(facts);
  const bounds = [];
  if (part.conveyor_family === "diode") {
    const currents = facts.fit_points.map((point) => point.current.value);
    bounds.push(numericBound("forward_current", currents, "A", "Cited forward targets and fitted 25 degC curve span"));
    for (const [name] of Object.entries(facts.electrical_limits ?? {})) {
      const voltage = Number(name.match(/_([0-9.]+)v$/i)?.[1]);
      if (Number.isFinite(voltage)) bounds.push(numericBound("reverse_voltage", [0, voltage], "V", "Cited reverse-leakage test condition"));
    }
  } else if (part.conveyor_family === "bjt") {
    bounds.push(numericBound("collector_current", [
      ...facts.gain_points.map((point) => point.collector_current.value),
      ...facts.saturation_points.map((point) => point.collector_current.value),
    ], "A", "Cited gain and saturation characterization span at 25 degC"));
    bounds.push(numericBound("collector_emitter_voltage", [0, ...facts.gain_points.map((point) => point.vce.value)], "V", "Cited gain-curve and table bias conditions"));
  } else {
    bounds.push(numericBound("gate_source_voltage_magnitude", [
      ...facts.rdson_points.map((point) => point.vgs.value),
      facts.threshold?.minimum?.value,
      facts.threshold?.typical?.value,
      facts.threshold?.maximum?.value,
    ], "V", "Cited threshold and RDS(on) gate-bias conditions"));
    bounds.push(numericBound("drain_current_magnitude", facts.rdson_points.map((point) => point.current.value), "A", "Cited RDS(on) characterization currents"));
  }
  const citedTemperatures = part.conveyor_family === "mosfet" ? [
    ...facts.rdson_points.map((point) => evidenceTemperature(point.vgs, point.current, point.resistance)),
    ...(facts.threshold ? [evidenceTemperature(facts.threshold.minimum, facts.threshold.typical, facts.threshold.maximum, facts.threshold.test_current)] : []),
    ...(facts.transfer_curves ?? []).map((curve) => curve.condition_identity?.temperature?.value_c),
    ...(facts.output_curves ?? []).map((curve) => curve.condition_identity?.temperature?.value_c),
  ].filter(Number.isFinite) : [25];
  if (part.conveyor_family === "mosfet" && !citedTemperatures.length) throw new Error("MOSFET supported operating region has no validated cited temperature");
  bounds.push({ quantity: "ambient_temperature", minimum: Math.min(...citedTemperatures), maximum: Math.max(...citedTemperatures), unit: "degC", conditions: "Cited model and package benches", placeholder: false });
  const numericBounds = bounds.filter(Boolean);
  const named = numericBounds.filter((bound) => bound.quantity !== "ambient_temperature").map((bound) => `${bound.quantity} ${bound.minimum} to ${bound.maximum} ${bound.unit}`).join("; ");
  const temperatureSummary = citedTemperatures.every((value) => value === citedTemperatures[0]) ? `${citedTemperatures[0]} degC` : `${Math.min(...citedTemperatures)} to ${Math.max(...citedTemperatures)} degC`;
  return { summary: `Supported only over the cited ${temperatureSummary} electrical characterization region: ${named}.`, numeric_bounds: numericBounds };
}

function bulkContext(part, fit, identity, pinInfo, source, omissions, operating, packageDir, stagingRoot) {
  const pipeline = part.conveyor_family === "bjt" ? "bjt" : part.conveyor_family === "mosfet" ? "vdmos" : null;
  return {
    packageDir,
    workDir: path.join(stagingRoot, "factory-work", safe(part.lcsc_id ?? part.mpn)),
    part: {
      slug: identity.packageSlug,
      pipeline,
      source,
      identity: {
        canonical_mpn: identity.canonical,
        manufacturer: part.manufacturer,
        description: part.description || `${part.conveyor_family} from ${part.manufacturer}`,
        electrical_family: pinInfo.electrical,
      },
      component: {
        modelName: fit.model.name,
        ...(part.conveyor_family === "mosfet" ? { supported_operating_region: operating } : {}),
        fidelity_tier: fit.fidelity,
        domain_coverage: { dc: fit.fidelity === "F2" ? "fitted" : "approx", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" },
        omissions,
        numeric_bounds: operating.numeric_bounds,
        test_tolerances: fit.fidelity === "F2"
          ? { forward_voltage: 0.05, dc_current_gain: 0.20, saturation_voltage: 0.20, rds_on: 0.20, threshold: 0.35 }
          : { forward_voltage: 0.35, dc_current_gain: 0.75, saturation_voltage: 0.75, rds_on: 0.50, threshold: 0.50 },
      },
    },
  };
}

const MIT_LICENSE = `MIT License\n\nCopyright (c) 2026 OpenCircuit contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`;

export function pinPackageBenchTemperature(packageDir) {
  const testsDir = path.join(packageDir, "tests");
  for (const entry of fs.readdirSync(testsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".cir")) continue;
    const benchPath = path.join(testsDir, entry.name);
    const text = fs.readFileSync(benchPath, "utf8");
    if (/^\.temp\s+-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\s*$/mi.test(text)) continue;
    const lines = text.split("\n");
    const modelIndex = lines.findLastIndex((line) => /^\.model\b/i.test(line.trim()));
    if (modelIndex < 0) throw new Error(`${entry.name} has no .model card before temperature pinning`);
    let insertionIndex = modelIndex + 1;
    while (insertionIndex < lines.length && lines[insertionIndex] === "") insertionIndex += 1;
    lines.splice(insertionIndex, 0, ".temp 25");
    fs.writeFileSync(benchPath, lines.join("\n"));
  }
}

export function stageBulkPart(part, rawExtraction, fit, stagingRoot, { demotionReason = null, sourceExtraction = rawExtraction } = {}) {
  const extraction = adjudicatedExtractions.has(rawExtraction) ? rawExtraction : repairKnownEvidenceDefects(part, rawExtraction);
  const boundSourceExtraction = adjudicatedSourceExtractions.get(rawExtraction);
  if (boundSourceExtraction) {
    if (sourceExtraction !== rawExtraction
        && identityHash("sha256", sourceExtraction) !== identityHash("sha256", boundSourceExtraction)) {
      throw new Error("semantic adjudication source extraction no longer matches its validated snapshot");
    }
    sourceExtraction = boundSourceExtraction;
  }
  const identity = normalizedIdentity(part, extraction);
  const manufacturerSlug = slugManufacturer(part.manufacturer);
  const packageDir = path.join(stagingRoot, "packages", manufacturerSlug, identity.packageSlug);
  if (path.resolve(packageDir).includes(`${path.sep}packages${path.sep}model-library${path.sep}`)) throw new Error("Bulk staging may not target the reviewed model library");
  const buildDir = `${packageDir}.building-${process.pid}-${Date.now()}`;
  fs.rmSync(buildDir, { recursive: true, force: true });
  const pinInfo = pinsFor(part.conveyor_family, fit.polarity);
  const omissions = [
    "AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.",
    "Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.",
    "Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.",
    ...(demotionReason ? [`F2 evidence did not qualify; staged as F1: ${demotionReason}`] : []),
    ...(extraction?.omission_reason ? [extraction.omission_reason] : []),
    ...(part.conveyor_family === "diode" && fit.fidelity === "F1" && extraction?.specs?.reverse_current
      ? ["Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets."]
      : []),
    ...(part.conveyor_family === "mosfet" && fit.fidelity === "F1" && fit.evidence_mode !== "interval-constrained" && (extraction?.specs?.rdson_points ?? []).some(isNominalTemperatureEvidence) && (extraction?.specs?.threshold_min || extraction?.specs?.threshold_typ || extraction?.specs?.threshold_max)
      ? ["Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets."]
      : []),
    ...(part.conveyor_family === "bjt" && fit.fidelity === "F1" && (extraction?.specs?.saturation_points ?? []).length
      ? ["Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence."]
      : []),
    "Independent package promotion review remains pending.",
  ];
  const source = {
    kind: "datasheet",
    url: part.datasheet_url,
    revision: extraction?.datasheet_identity?.revision ?? "revision not stated in source",
    sha256: sha256(part.datasheet_path),
    accessed_date: new Date().toISOString().slice(0, 10),
    pages_referenced: extraction?.datasheet_identity?.pages_examined?.filter((page) => typeof page === "string" && page.trim()) ?? [],
    placeholder: false,
  };
  if (!source.pages_referenced.length) throw new Error(`${part.mpn} has no cited datasheet pages`);
  const facts = bulkFactoryFacts(part, extraction, fit, identity, source, sourceExtraction);
  const operating = operatingRegion(part, facts);
  const component = {
    schema_version: "1.0.0",
    ...(part.conveyor_family === "mosfet" ? { evidence_contract_version: "1.0.0" } : {}),
    canonical_mpn: identity.canonical,
    manufacturer: part.manufacturer,
    description: part.description || `${part.conveyor_family} from ${part.manufacturer}`,
    electrical_family: pinInfo.electrical,
    symbol_pins: pinInfo.pins.map(({ name, number, role }) => ({ name, number, role })),
    spice_pin_mapping: pinInfo.order.map((number, index) => ({ symbol_pin_number: number, subckt_node: pinInfo.pins.find((pin) => pin.number === number).node, order: index + 1 })),
    package_variants: [{ name: part.package || "catalog package", standard: part.package || "catalog package", pin_count: pinInfo.pins.length, pin_map: pinInfo.pins.map((pin) => ({ package_pin: pin.number, symbol_pin_number: pin.number })) }],
    ordering_code_aliases: identity.aliases,
    datasheet: { url: part.datasheet_url, revision: source.revision },
    model_type: "dot_model",
    fidelity_tier: fit.fidelity,
    domain_coverage: { dc: fit.fidelity === "F2" ? "fitted" : "approx", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" },
    supported_analyses: ["operating_point", "dc_sweep"],
    supported_operating_region: operating,
    known_omissions: omissions,
    licence: { spdx_id: "MIT", provenance_basis: "original_from_facts" },
    generator: { tool_or_agent: part.conveyor_family === "mosfet" ? "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0" : "opencircuit-model-factory-v0.1.0 bulk-adapter", date: new Date().toISOString().slice(0, 10) },
    reviewer: { tool_or_agent: "pending-independent-package-review", date: new Date().toISOString().slice(0, 10) },
    test_results: { status: "pending", pass_count: 0, fail_count: 0, total_count: 0, worst_observed_relative_fitting_error: null },
    validation_date: null,
  };
  const fitted = {
    schema_version: "1.0.0",
    fidelity_tier: fit.fidelity,
    evidence_mode: fit.evidence_mode ?? null,
    parameters: fit.parameters,
    parameter_metadata: fit.parameter_metadata ?? {},
    calibration: fit.calibration ?? null,
    fitter: fit.fitter ?? (fit.evidence_mode === "interval-constrained"
      ? "native-ngspice constrained MOSFET F1 feasibility projection"
      : fit.evidence_mode === "typ-point"
        ? "datasheet typical-point MOSFET F1 formula"
        : "catalog-parametric F1 fallback"),
    optimizer: fit.optimizer ?? null,
    held_defaults: fit.optimizer?.held_defaults ?? [],
    curves_used: fit.curves_used ?? [],
    ...(part.conveyor_family === "mosfet" ? { evidence_contract_version: fit.evidence_contract_version ?? "1.0.0" } : {}),
    evidence_curves: fit.evidence_curves ?? [],
    curves_rejected: fit.curves_rejected ?? [],
    residuals: fit.residuals ?? [],
    rms_relative_error: fit.rms ?? null,
    worst_relative_error: fit.worst == null ? null : { value: fit.worst, quantity: fit.worst_quantity ?? "bulk fit residual" },
    ...(part.conveyor_family === "mosfet" && fit.fidelity === "F2" ? { f2_gate_pass: fit.gate_pass } : {}),
  };
  try {
    write(path.join(buildDir, "component.json"), json(component));
    write(path.join(buildDir, "facts.json"), json(facts));
    write(path.join(buildDir, "fitted.json"), json(fitted));
    write(path.join(buildDir, "sources.json"), json([source]));
    write(path.join(buildDir, "model.cir"), `* OpenCircuit Model Factory v0.1.0 bulk adapter\n* Original work generated from public factual specifications.\n* This model is not copied or adapted from any vendor SPICE model.\n* Source: ${source.url}\n* Revision: ${source.revision}\n${fit.model.text}`);
    write(path.join(buildDir, "MODEL_CARD.md"), `# ${identity.canonical} model card\n\nPending factory bench generation and native/WASM validation.\n`);
    write(path.join(buildDir, "LICENSE"), MIT_LICENSE);
    const ctx = bulkContext(part, fit, identity, pinInfo, source, omissions, operating, buildDir, stagingRoot);
    fs.mkdirSync(ctx.workDir, { recursive: true });
    try {
      stageTestgen(ctx);
      pinPackageBenchTemperature(buildDir);
      stageValidate(ctx);
      stageCard(ctx);
    } catch (error) {
      const validationResults = path.join(buildDir, "validation-results.json");
      if (fs.existsSync(validationResults)) {
        fs.copyFileSync(validationResults, path.join(ctx.workDir, `${identity.packageSlug}-${fit.fidelity}-validation-results.json`));
        const report = JSON.parse(fs.readFileSync(validationResults, "utf8"));
        const failedChecks = (report.benches ?? []).flatMap((bench) => (bench.checks ?? [])
          .filter((check) => check.pass === false)
          .map((check) => {
            const expected = check.maximum != null ? `maximum ${check.maximum}` : check.minimum != null ? `minimum ${check.minimum}` : `allowed error ${check.allowed}`;
            return `${check.name} observed ${check.value} (${expected})`;
          }));
        if (failedChecks.length) throw new Error(`${error.message}; failed package checks: ${failedChecks.slice(0, 4).join(", ")}`);
      }
      throw error;
    }

    const backupDir = `${packageDir}.previous-${process.pid}-${Date.now()}`;
    let backedUp = false;
    try {
      if (fs.existsSync(packageDir)) {
        fs.renameSync(packageDir, backupDir);
        backedUp = true;
      }
      fs.renameSync(buildDir, packageDir);
      if (backedUp) fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (error) {
      if (!fs.existsSync(packageDir) && backedUp && fs.existsSync(backupDir)) fs.renameSync(backupDir, packageDir);
      throw error;
    }
    return packageDir;
  } finally {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
}

export function normalizeBulkManifest(manifest) {
  if (manifest?.kind !== "opencircuit-conveyor-batch" || manifest.schema_version !== "1.0.0" || !Array.isArray(manifest.parts)) throw new Error("Unsupported conveyor bulk manifest");
  return manifest.parts.map((part, index) => {
    for (const field of ["mpn", "manufacturer", "conveyor_family", "datasheet_path", "datasheet_url"]) if (!part[field]) throw new Error(`Bulk part ${index} missing ${field}`);
    if (!fs.existsSync(part.datasheet_path)) throw new Error(`Bulk part ${index} datasheet not found: ${part.datasheet_path}`);
    if (part.adjudication_supplement_path && !fs.existsSync(part.adjudication_supplement_path)) {
      throw new Error(`Bulk part ${index} adjudication supplement not found: ${part.adjudication_supplement_path}`);
    }
    return { ...part, seed_hints: Array.isArray(part.seed_hints) ? part.seed_hints : [] };
  });
}

export function runBulkManifest(manifestPath, stagingRoot, options = {}) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const parts = normalizeBulkManifest(manifest);
  const results = [];
  const batchVectors = new Map();
  const libraryRoot = options.libraryRoot ?? reviewedLibraryRoot;
  const identity = (part) => ({ ...(part.lcsc_id ? { lcsc_id: part.lcsc_id } : {}), mpn: part.mpn });

  const stageFit = (part, extraction, sourceExtraction, fit, demotionReason) => {
    const existingReason = libraryDuplicateDieReason(part, fit, libraryRoot);
    if (existingReason) {
      results.push({ ...identity(part), status: "skipped", stage: "selection", reason: existingReason });
      return false;
    }
    const vectorKey = parameterVectorKey(part, fit);
    const prior = batchVectors.get(vectorKey);
    if (prior) {
      const reason = prior.blocked
        ? `duplicate fitted die vector matches same-batch candidates ${prior.mpns.join(", ")}; no independent parameterization or shared-die evidence was supplied`
        : `duplicate fitted die vector matches same-batch candidate ${prior.mpn}; no independent parameterization or shared-die evidence was supplied`;
      if (!prior.blocked) {
        fs.rmSync(prior.packagePath, { recursive: true, force: true });
        results[prior.resultIndex] = { ...prior.identity, status: "skipped", stage: "selection", reason };
      }
      batchVectors.set(vectorKey, { blocked: true, mpns: [...new Set([...(prior.mpns ?? [prior.mpn]), part.mpn])] });
      results.push({ ...identity(part), status: "skipped", stage: "selection", reason });
      return false;
    }
    const ownPackagePath = path.join(stagingRoot, "packages", slugManufacturer(part.manufacturer), normalizedIdentity(part, extraction).packageSlug);
    const stagedReason = libraryDuplicateDieReason(part, fit, path.join(stagingRoot, "packages"), ownPackagePath);
    if (stagedReason) {
      results.push({ ...identity(part), status: "skipped", stage: "selection", reason: stagedReason });
      return false;
    }
    const packagePath = stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason, sourceExtraction });
    const resultIndex = results.length;
    results.push({ ...identity(part), status: "staged", fidelity: fit.fidelity, ...(demotionReason ? { demotion_reason: demotionReason } : {}), package_path: packagePath });
    batchVectors.set(vectorKey, { resultIndex, packagePath, mpn: part.mpn, identity: identity(part) });
    return true;
  };

  for (const part of parts) {
    const extractionBytes = part.extraction_path && fs.existsSync(part.extraction_path) ? fs.readFileSync(part.extraction_path) : null;
    const rawExtraction = extractionBytes ? JSON.parse(extractionBytes.toString("utf8")) : null;
    const supplement = part.adjudication_supplement_path
      ? JSON.parse(fs.readFileSync(part.adjudication_supplement_path, "utf8"))
      : null;
    const extraction = rawExtraction
      ? supplement
        ? applyConditionAdjudicationSupplement(part, rawExtraction, supplement, extractionBytes)
        : repairKnownEvidenceDefects(part, rawExtraction)
      : null;
    const collisionReason = libraryCollisionReason(part, libraryRoot, extraction);
    if (collisionReason) {
      results.push({ ...identity(part), status: "skipped", stage: "selection", reason: collisionReason });
      continue;
    }
    try {
      const fit = fitBulkPart(part, extraction, { ...options, forceF1: part.force_f1 === true });
      stageFit(part, extraction, rawExtraction, fit, part.demotion_reason ?? null);
    } catch (error) {
      if (part.allow_f1_demotion !== false) {
        try {
          const fit = fitBulkPart(part, extraction, { ...options, forceF1: true });
          stageFit(part, extraction, rawExtraction, fit, error.message);
        } catch (fallbackError) {
          results.push({ ...identity(part), status: "failed", stage: "fitted", reason: `F2 failed: ${error.message}; F1 failed: ${fallbackError.message}` });
        }
      } else results.push({ ...identity(part), status: "failed", stage: "fitted", reason: error.message });
    }
  }
  return results;
}
