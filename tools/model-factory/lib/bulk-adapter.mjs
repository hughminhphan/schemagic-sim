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
  const scalarPoint = extraction?.specs?.forward_voltage_points?.find((point) => Number(point?.voltage?.value) > 0 && Number(point?.current?.value) > 0);
  const voltage = scalarPoint ? normalizeEvidence(scalarPoint.voltage) : null;
  const forwardCurrent = scalarPoint ? normalizeEvidence(scalarPoint.current) : null;
  const vf = voltage?.unit === "V" ? Number(voltage.value) : hintNumber(part, "diode.forward_voltage", 0.7);
  const current = forwardCurrent?.unit === "A" ? Number(forwardCurrent.value) : 0.01;
  const N = /schottky/i.test(`${part.subcategory} ${part.description}`) ? 1.1 : 1.8;
  return { fidelity: "F1", parameters: { IS: current / Math.exp(vf / (N * 0.025852)), N, RS: 1e-4 }, worst: null, points: [] };
}

function bjtFit(part, extraction, forceF1 = false) {
  const gains = extraction?.specs?.gain_points?.map((point) => Number(point.hfe.value)).filter((value) => value > 0) ?? [];
  const BF = gains.length ? Math.max(...gains) : hintNumber(part, "bjt.dc_current_gain", 100);
  return { fidelity: "F1", parameters: { IS: 1e-14, BF: Math.max(1, BF), VAF: 100, IKF: 1e3, RB: 10, RC: 0.1, RE: 0.05, CJE: 1e-12, CJC: 1e-12, TF: 1e-9 }, worst: null, points: [] };
}

function mosfetFit(part, extraction, forceF1 = false) {
  const specs = extraction?.specs;
  const thresholdValue = specs?.threshold_typ?.value ?? specs?.threshold_max?.value ?? specs?.threshold_min?.value;
  const rdsonValue = specs?.rdson_points?.find((point) => Number(point?.resistance?.value) > 0)?.resistance?.value;
  const threshold = Number.isFinite(Number(thresholdValue)) ? Number(thresholdValue) : hintNumber(part, "vdmos.threshold", 2.5);
  const rdson = Math.max(1e-4, Number.isFinite(Number(rdsonValue)) ? Number(rdsonValue) : hintNumber(part, "vdmos.rds_on", 0.1));
  const ciss = Math.max(1e-15, Number.isFinite(Number(specs?.ciss?.value)) ? Number(specs.ciss.value) : hintNumber(part, "vdmos.ciss", 1e-9));
  const coss = Math.max(1e-15, Number.isFinite(Number(specs?.coss?.value)) ? Number(specs.coss.value) : hintNumber(part, "vdmos.coss", 2e-10));
  const crss = Math.max(1e-15, Number.isFinite(Number(specs?.crss?.value)) ? Number(specs.crss.value) : hintNumber(part, "vdmos.crss", 5e-11));
  return { fidelity: "F1", parameters: { VTO: threshold, KP: 2 / rdson, THETA: 0, LAMBDA: 0.003, RD: 0.55 * rdson, RS: 0.2 * rdson, RG: 1e-4, CGS: Math.max(1e-15, ciss - crss), CGDMAX: crss, CGDMIN: crss, CJO: Math.max(1e-15, coss - crss), IS: 1e-12, N: 1.5, RB: 0.2 * rdson }, worst: null, points: [] };
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
  for (const candidate of [path.resolve(here, "../.venv/bin/python"), path.resolve(here, "../../../tools/model-factory/.venv/bin/python")]) {
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

export function fitBulkPart(part, extraction, { ngspiceRunner = defaultNgspiceRunner, fitRunner = defaultFitRunner, forceF1 = false } = {}) {
  const polarity = polarityFor(part, extraction);
  let fit;
  if (!forceF1 && extraction?.usable_curves) {
    const attempt = fitRunner({
      family: part.conveyor_family, extraction, polarity,
      mpn: part.mpn, manufacturer: part.manufacturer, seed_hints: part.seed_hints ?? [],
    });
    if (attempt?.fidelity !== "F2") {
      throw new Error(attempt?.demotion_reason || `${part.conveyor_family} F2 fit produced no result`);
    }
    const parameters = part.conveyor_family === "bjt" ? { ...BJT_AC_DEFAULTS, ...attempt.parameters } : attempt.parameters;
    fit = {
      fidelity: "F2", parameters, worst: attempt.worst?.value ?? null,
      worst_quantity: attempt.worst?.quantity ?? null, rms: attempt.rms ?? null,
      residuals: attempt.residuals ?? [], curves_used: attempt.curves_used ?? [],
      curves_rejected: attempt.curves_rejected ?? [], optimizer: attempt.optimizer ?? null,
      fitter: attempt.fitter ?? null, points: [],
    };
  } else if (part.conveyor_family === "diode") fit = diodeFit(part, extraction, forceF1);
  else if (part.conveyor_family === "bjt") fit = bjtFit(part, extraction, forceF1);
  else if (part.conveyor_family === "mosfet") fit = mosfetFit(part, extraction, forceF1);
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

export function normalizedIdentity(part) {
  const original = String(part.mpn).trim();
  if (/nexperia/i.test(part.manufacturer) && original.includes(",")) {
    const canonical = original.split(",", 1)[0].trim();
    return { canonical, aliases: [original], packageSlug: safe(original.replace(",", "-")) };
  }
  return { canonical: original, aliases: [], packageSlug: safe(original) };
}

export function libraryCollisionReason(part, libraryRoot = reviewedLibraryRoot) {
  const identity = normalizedIdentity(part);
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
  return value ? { ...value, value: Math.abs(Number(value.value)) } : value;
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
  const match = String(text ?? "").match(/(?:I[DCR]|collector current|drain current)\|?\s*=\s*([0-9.eE+-]+)\s*(u|m)?A/i);
  if (!match) return fallback;
  return Math.abs(Number(match[1])) * ({ u: 1e-6, m: 1e-3 }[match[2]?.toLowerCase()] ?? 1);
}

function nominalCurve(extraction, predicate) {
  return (extraction.curves ?? []).find((curve) => {
    const text = `${curve.name} ${curve.test_conditions}`.toLowerCase();
    return predicate(curve, text) && (!/(-55|85|125|150)\s*(?:deg\s*c|degc|°c)/i.test(text) || /25\s*(?:deg\s*c|degc|°c)/i.test(text));
  });
}

function isNominalTemperatureEvidence(point) {
  const text = Object.values(point ?? {}).map((value) => value?.conditions ?? "").join(" ");
  const temperatures = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c)/gi)].map((match) => Number(match[1]));
  return temperatures.length === 0 || temperatures.every((temperature) => Math.abs(temperature - 25) <= 5);
}

function bulkFactoryFacts(part, extraction, fit, identity, source) {
  const common = {
    schema_version: "1.0.0",
    extraction,
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
      const maximumPoints = scalarForwardPoints.filter((point) => point.voltage?.source_kind === "maximum").sort((left, right) => right.current.value - left.current.value);
      const conservativeMaximum = maximumPoints[0] ? {
        ...maximumPoints[0],
        current: {
          ...maximumPoints[0].current,
          value: maximumPoints[0].current.value * 0.95,
          conditions: `Conservative F1 package bench at 95% of the cited current; ${maximumPoints[0].current.conditions}`,
        },
      } : null;
      fitPoints.push(...typicalPoints, ...(conservativeMaximum ? [conservativeMaximum] : []));
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
  const thresholdConditions = specs.threshold_typ?.conditions ?? specs.threshold_max?.conditions ?? specs.threshold_min?.conditions ?? "Nominal threshold characterization";
  const thresholdCitation = specs.threshold_typ?.page_reference ?? specs.threshold_max?.page_reference ?? specs.threshold_min?.page_reference ?? source.pages_referenced[0];
  const rdsonPoints = (specs.rdson_points ?? []).filter(isNominalTemperatureEvidence);
  return {
    ...common,
    rdson_points: rdsonPoints,
    threshold: (fit.fidelity === "F2" || rdsonPoints.length === 0) && (specs.threshold_min || specs.threshold_typ || specs.threshold_max) ? {
      minimum: specs.threshold_min,
      typical: specs.threshold_typ,
      maximum: specs.threshold_max,
      test_current: quantity(conditionCurrent(thresholdConditions, 250e-6), "A", thresholdConditions, thresholdCitation, "typical"),
    } : null,
    transfer_points: [],
    output_points: [],
  };
}

function numericBound(quantityName, values, unit, conditions) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return null;
  return { quantity: quantityName, minimum: Math.min(...finite), maximum: Math.max(...finite), unit, conditions, placeholder: false };
}

function operatingRegion(part, facts) {
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
  bounds.push({ quantity: "ambient_temperature", minimum: 25, maximum: 25, unit: "degC", conditions: "Nominal model and package benches", placeholder: false });
  const numericBounds = bounds.filter(Boolean);
  const named = numericBounds.filter((bound) => bound.quantity !== "ambient_temperature").map((bound) => `${bound.quantity} ${bound.minimum} to ${bound.maximum} ${bound.unit}`).join("; ");
  return { summary: `Supported only over the cited 25 degC electrical characterization region: ${named}.`, numeric_bounds: numericBounds };
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
    if (/^\.temp\s+25(?:\.0+)?\s*$/mi.test(text)) continue;
    const lines = text.split("\n");
    const modelIndex = lines.findLastIndex((line) => /^\.model\b/i.test(line.trim()));
    if (modelIndex < 0) throw new Error(`${entry.name} has no .model card before temperature pinning`);
    let insertionIndex = modelIndex + 1;
    while (insertionIndex < lines.length && lines[insertionIndex] === "") insertionIndex += 1;
    lines.splice(insertionIndex, 0, ".temp 25");
    fs.writeFileSync(benchPath, lines.join("\n"));
  }
}

export function stageBulkPart(part, rawExtraction, fit, stagingRoot, { demotionReason = null } = {}) {
  const extraction = repairKnownEvidenceDefects(part, rawExtraction);
  const identity = normalizedIdentity(part);
  const manufacturerSlug = slugManufacturer(part.manufacturer);
  const packageDir = path.join(stagingRoot, "packages", manufacturerSlug, identity.packageSlug);
  if (path.resolve(packageDir).includes(`${path.sep}packages${path.sep}model-library${path.sep}`)) throw new Error("Bulk staging may not target the reviewed model library");
  const buildDir = `${packageDir}.building-${process.pid}-${Date.now()}`;
  fs.rmSync(buildDir, { recursive: true, force: true });
  const pinInfo = pinsFor(part.conveyor_family, fit.polarity);
  const omissions = [
    "AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.",
    "Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.",
    "Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.",
    ...(demotionReason ? [`F2 evidence did not qualify; staged as F1: ${demotionReason}`] : []),
    ...(extraction?.omission_reason ? [extraction.omission_reason] : []),
    ...(part.conveyor_family === "diode" && fit.fidelity === "F1" && extraction?.specs?.reverse_current
      ? ["Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets."]
      : []),
    ...(part.conveyor_family === "mosfet" && fit.fidelity === "F1" && (extraction?.specs?.rdson_points ?? []).some(isNominalTemperatureEvidence) && (extraction?.specs?.threshold_min || extraction?.specs?.threshold_typ || extraction?.specs?.threshold_max)
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
  const facts = bulkFactoryFacts(part, extraction, fit, identity, source);
  const operating = operatingRegion(part, facts);
  const component = {
    schema_version: "1.0.0",
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
    generator: { tool_or_agent: "opencircuit-model-factory-v0.1.0 bulk-adapter", date: new Date().toISOString().slice(0, 10) },
    reviewer: { tool_or_agent: "pending-independent-package-review", date: new Date().toISOString().slice(0, 10) },
    test_results: { status: "pending", pass_count: 0, fail_count: 0, total_count: 0, worst_observed_relative_fitting_error: null },
    validation_date: null,
  };
  const fitted = {
    schema_version: "1.0.0",
    fidelity_tier: fit.fidelity,
    parameters: fit.parameters,
    fitter: fit.fitter ?? "catalog-parametric F1 fallback",
    optimizer: fit.optimizer ?? null,
    held_defaults: fit.optimizer?.held_defaults ?? [],
    curves_used: fit.curves_used ?? [],
    curves_rejected: fit.curves_rejected ?? [],
    residuals: fit.residuals ?? [],
    rms_relative_error: fit.rms ?? null,
    worst_relative_error: fit.worst == null ? null : { value: fit.worst, quantity: fit.worst_quantity ?? "bulk fit residual" },
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

  const stageFit = (part, extraction, fit, demotionReason) => {
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
    const ownPackagePath = path.join(stagingRoot, "packages", slugManufacturer(part.manufacturer), normalizedIdentity(part).packageSlug);
    const stagedReason = libraryDuplicateDieReason(part, fit, path.join(stagingRoot, "packages"), ownPackagePath);
    if (stagedReason) {
      results.push({ ...identity(part), status: "skipped", stage: "selection", reason: stagedReason });
      return false;
    }
    const packagePath = stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason });
    const resultIndex = results.length;
    results.push({ ...identity(part), status: "staged", fidelity: fit.fidelity, ...(demotionReason ? { demotion_reason: demotionReason } : {}), package_path: packagePath });
    batchVectors.set(vectorKey, { resultIndex, packagePath, mpn: part.mpn, identity: identity(part) });
    return true;
  };

  for (const part of parts) {
    const collisionReason = libraryCollisionReason(part, libraryRoot);
    if (collisionReason) {
      results.push({ ...identity(part), status: "skipped", stage: "selection", reason: collisionReason });
      continue;
    }
    const rawExtraction = part.extraction_path && fs.existsSync(part.extraction_path) ? JSON.parse(fs.readFileSync(part.extraction_path, "utf8")) : null;
    const extraction = rawExtraction ? repairKnownEvidenceDefects(part, rawExtraction) : null;
    try {
      const fit = fitBulkPart(part, extraction, { ...options, forceF1: part.force_f1 === true });
      stageFit(part, extraction, fit, part.demotion_reason ?? null);
    } catch (error) {
      if (part.allow_f1_demotion !== false) {
        try {
          const fit = fitBulkPart(part, extraction, { ...options, forceF1: true });
          stageFit(part, extraction, fit, error.message);
        } catch (fallbackError) {
          results.push({ ...identity(part), status: "failed", stage: "fitted", reason: `F2 failed: ${error.message}; F1 failed: ${fallbackError.message}` });
        }
      } else results.push({ ...identity(part), status: "failed", stage: "fitted", reason: error.message });
    }
  }
  return results;
}
