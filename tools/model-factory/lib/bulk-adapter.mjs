import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const localTmpRoot = path.resolve(here, "../tmp/conveyor-syntax");

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

function quantityValues(extraction, curveNames) {
  const names = curveNames.map((name) => name.toLowerCase());
  const curve = extraction?.curves?.find((candidate) => names.some((name) => candidate.name.toLowerCase().includes(name)));
  return curve?.points?.map((point) => ({ x: Number(point.x), y: Number(point.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x > 0 && point.y > 0) ?? [];
}

function linearRegression(points) {
  const n = points.length;
  const sx = points.reduce((sum, point) => sum + point.x, 0);
  const sy = points.reduce((sum, point) => sum + point.y, 0);
  const sxx = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const sxy = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const denominator = n * sxx - sx * sx;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-30) throw new Error("degenerate curve points");
  const slope = (n * sxy - sx * sy) / denominator;
  return { slope, intercept: (sy - slope * sx) / n };
}

function hintNumber(part, target, fallback) {
  const hint = part.seed_hints?.find((candidate) => candidate.factory_target === target);
  if (!hint) return fallback;
  const match = String(hint.raw_value).replace(/,/g, "").match(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  return match ? Number(match[0]) : fallback;
}

function diodeFit(part, extraction) {
  const points = quantityValues(extraction, ["forward", "iv"]).map((point) => ({ x: Math.log(point.y), y: point.x }));
  if (extraction?.usable_curves && points.length >= 3) {
    const regression = linearRegression(points);
    const vt = 0.025852;
    const N = regression.slope / vt;
    const IS = Math.exp(-regression.intercept / regression.slope);
    const residuals = points.map((point) => {
      const fitted = regression.intercept + regression.slope * point.x;
      return Math.abs(fitted - point.y) / Math.max(Math.abs(point.y), 1e-9);
    });
    const worst = Math.max(...residuals);
    if (!(N >= 0.8 && N <= 4 && IS >= 1e-20 && IS <= 1e-6 && worst < 0.08)) {
      throw new Error(`diode F2 residual gate failed: N=${N}, IS=${IS}, worst=${worst}`);
    }
    return { fidelity: "F2", parameters: { IS, N, RS: 1e-4 }, worst, points };
  }
  const vf = hintNumber(part, "diode.forward_voltage", 0.7);
  const current = 0.01;
  const N = /schottky/i.test(`${part.subcategory} ${part.description}`) ? 1.1 : 1.8;
  return { fidelity: "F1", parameters: { IS: current / Math.exp(vf / (N * 0.025852)), N, RS: 1e-4 }, worst: null, points: [] };
}

function bjtFit(part, extraction) {
  const gains = extraction?.specs?.gain_points?.map((point) => Number(point.hfe.value)).filter((value) => value > 0) ?? [];
  if (extraction?.usable_curves && gains.length >= 4) {
    const BF = Math.max(...gains);
    const worst = Math.max(...gains.map((gain) => Math.abs(BF - gain) / gain));
    if (worst >= 0.25) throw new Error(`BJT F2 residual gate failed: constant-BF seed worst=${worst}`);
  }
  const BF = gains.length ? Math.max(...gains) : hintNumber(part, "bjt.dc_current_gain", 100);
  return { fidelity: "F1", parameters: { IS: 1e-14, BF: Math.max(1, BF), VAF: 100, IKF: 1e3, RB: 10, RC: 0.1, RE: 0.05, CJE: 1e-12, CJC: 1e-12, TF: 1e-9 }, worst: null, points: [] };
}

function mosfetFit(part, extraction) {
  if (extraction?.usable_curves) throw new Error("MOSFET F2 native multi-curve residual gate is not yet proven for generic conveyor inputs");
  const threshold = hintNumber(part, "vdmos.threshold", 2.5);
  const rdson = Math.max(1e-4, hintNumber(part, "vdmos.rds_on", 0.1));
  const ciss = Math.max(1e-15, hintNumber(part, "vdmos.ciss", 1e-9));
  const coss = Math.max(1e-15, hintNumber(part, "vdmos.coss", 2e-10));
  const crss = Math.max(1e-15, hintNumber(part, "vdmos.crss", 5e-11));
  return { fidelity: "F1", parameters: { VTO: threshold, KP: 2 / rdson, THETA: 0, LAMBDA: 0.003, RD: 0.55 * rdson, RS: 0.2 * rdson, RG: 1e-4, CGS: Math.max(1e-15, ciss - crss), CGDMAX: crss, CGDMIN: crss, CJO: Math.max(1e-15, coss - crss), IS: 1e-12, N: 1.5, RB: 0.2 * rdson }, worst: null, points: [] };
}

function modelFor(part, fit) {
  const name = `OC_${safe(part.manufacturer).toUpperCase()}_${safe(part.mpn).toUpperCase()}`;
  const p = fit.parameters;
  if (part.conveyor_family === "diode") return { name, text: `.model ${name} D(IS=${fmt(p.IS)} N=${fmt(p.N)} RS=${fmt(p.RS)})\n` };
  if (part.conveyor_family === "bjt") {
    const polarity = /pnp/i.test(`${part.subcategory} ${part.description} ${part.attributes?.Type ?? ""}`) ? "PNP" : "NPN";
    return { name, text: `.model ${name} ${polarity}(IS=${fmt(p.IS)} BF=${fmt(p.BF)} VAF=${fmt(p.VAF)} IKF=${fmt(p.IKF)} RB=${fmt(p.RB)} RC=${fmt(p.RC)} RE=${fmt(p.RE)} CJE=${fmt(p.CJE)} CJC=${fmt(p.CJC)} TF=${fmt(p.TF)})\n` };
  }
  const pchan = /p-channel|pmos/i.test(`${part.subcategory} ${part.description} ${part.attributes?.Type ?? ""}`) ? " pchan" : "";
  return { name, text: `.model ${name} VDMOS(${pchan} VTO=${fmt(Math.abs(p.VTO))} KP=${fmt(p.KP)} THETA=${fmt(p.THETA)} LAMBDA=${fmt(p.LAMBDA)} RD=${fmt(p.RD)} RS=${fmt(p.RS)} RG=${fmt(p.RG)} RDS=1e9 CGS=${fmt(p.CGS)} CGDMAX=${fmt(p.CGDMAX)} CGDMIN=${fmt(p.CGDMIN)} CJO=${fmt(p.CJO)} IS=${fmt(p.IS)} N=${fmt(p.N)} RB=${fmt(p.RB)})\n` };
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

export function fitBulkPart(part, extraction, { ngspiceRunner = defaultNgspiceRunner } = {}) {
  let fit;
  if (part.conveyor_family === "diode") fit = diodeFit(part, extraction);
  else if (part.conveyor_family === "bjt") fit = bjtFit(part, extraction);
  else if (part.conveyor_family === "mosfet") fit = mosfetFit(part, extraction);
  else throw new Error(`Unsupported conveyor family: ${part.conveyor_family}`);
  const model = modelFor(part, fit);
  ngspiceRunner(model.text, { part, fit });
  return { ...fit, model };
}

function pinsFor(family) {
  if (family === "diode") return { pins: [{ name: "A", number: "1", role: "anode", node: "anode" }, { name: "K", number: "2", role: "cathode", node: "cathode" }], order: ["1", "2"], electrical: "diode" };
  if (family === "bjt") return { pins: [{ name: "B", number: "1", role: "base", node: "base" }, { name: "C", number: "2", role: "collector", node: "collector" }, { name: "E", number: "3", role: "emitter", node: "emitter" }], order: ["2", "1", "3"], electrical: "bjt_npn" };
  return { pins: [{ name: "G", number: "1", role: "gate", node: "gate" }, { name: "D", number: "2", role: "drain", node: "drain" }, { name: "S", number: "3", role: "source", node: "source" }], order: ["2", "1", "3"], electrical: "nmos" };
}

export function stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason = null } = {}) {
  const manufacturerSlug = slugManufacturer(part.manufacturer);
  const packageDir = path.join(stagingRoot, "packages", manufacturerSlug, safe(part.mpn));
  if (path.resolve(packageDir).includes(`${path.sep}packages${path.sep}model-library${path.sep}`)) throw new Error("Bulk staging may not target the reviewed model library");
  const pinInfo = pinsFor(part.conveyor_family);
  const omissions = [
    "Unreviewed conveyor output. Independent source, fit, native/WASM, operating-bound, omission, and package review are still required before promotion.",
    "Catalog parametrics were used only as initial guesses or F1 fallback constraints; they are not datasheet citations.",
    ...(demotionReason ? [`F2 attempt demoted to F1: ${demotionReason}`] : []),
    ...(extraction?.omission_reason ? [extraction.omission_reason] : []),
  ];
  const source = { kind: "datasheet", url: part.datasheet_url, revision: extraction?.datasheet_identity?.revision ?? "unreviewed", sha256: sha256(part.datasheet_path), accessed_date: new Date().toISOString().slice(0, 10), pages_referenced: extraction?.datasheet_identity?.pages_examined ?? ["pending review"], placeholder: false };
  const component = {
    schema_version: "1.0.0", canonical_mpn: part.mpn, manufacturer: part.manufacturer, description: part.description || `${part.conveyor_family} from ${part.manufacturer}`,
    electrical_family: pinInfo.electrical, symbol_pins: pinInfo.pins.map(({ name, number, role }) => ({ name, number, role })),
    spice_pin_mapping: pinInfo.order.map((number, index) => ({ symbol_pin_number: number, subckt_node: pinInfo.pins.find((pin) => pin.number === number).node, order: index + 1 })),
    package_variants: [{ name: part.package || "catalog package pending review", standard: part.package || "catalog package pending review", pin_count: pinInfo.pins.length, pin_map: pinInfo.pins.map((pin) => ({ package_pin: pin.number, symbol_pin_number: pin.number })) }],
    ordering_code_aliases: [], datasheet: { url: part.datasheet_url, revision: source.revision }, model_type: "dot_model", fidelity_tier: fit.fidelity,
    domain_coverage: { dc: fit.fidelity === "F2" ? "fitted" : "approx", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" },
    supported_analyses: ["operating_point", "dc_sweep"], supported_operating_region: { summary: `${fit.fidelity} unreviewed conveyor fit; bounds pending independent review.`, numeric_bounds: [{ quantity: "ambient_temperature", minimum: 25, maximum: 25, unit: "degC", conditions: "Nominal bulk fit temperature", placeholder: false }] },
    known_omissions: omissions, licence: { spdx_id: "MIT", provenance_basis: "original_from_facts" }, generator: { tool_or_agent: "opencircuit-conveyor-v0.1.0", date: new Date().toISOString().slice(0, 10) }, reviewer: { tool_or_agent: "pending-review", date: new Date().toISOString().slice(0, 10) },
    test_results: { status: "pending", pass_count: 0, fail_count: 0, total_count: 0, worst_observed_relative_fitting_error: fit.worst == null ? null : { value: fit.worst, quantity: "bulk fit residual" } }, validation_date: null,
  };
  write(path.join(packageDir, "component.json"), json(component));
  write(path.join(packageDir, "facts.json"), json({ schema_version: "1.0.0", extraction, catalog_seed_hints: part.seed_hints ?? [], identity: { canonical_mpn: part.mpn, manufacturer: part.manufacturer, aliases: [] }, source }));
  write(path.join(packageDir, "fitted.json"), json({ schema_version: "1.0.0", fidelity_tier: fit.fidelity, parameters: fit.parameters, worst_relative_error: fit.worst == null ? null : { value: fit.worst, quantity: "bulk fit residual" } }));
  write(path.join(packageDir, "sources.json"), json([source]));
  write(path.join(packageDir, "model.cir"), `* Unreviewed OpenCircuit conveyor model\n* Original from public facts; no vendor SPICE input used.\n${fit.model.text}`);
  write(path.join(packageDir, "MODEL_CARD.md"), `# ${part.mpn} unreviewed conveyor model card\n\n- Manufacturer: ${part.manufacturer}\n- Fidelity: ${fit.fidelity}\n- Reviewer: pending-review\n- Datasheet: ${part.datasheet_url}\n\n## Known omissions\n\n${omissions.map((item) => `- ${item}`).join("\n")}\n`);
  write(path.join(packageDir, "LICENSE"), "MIT License\n\nCopyright (c) 2026 OpenCircuit contributors\n");
  write(path.join(packageDir, "tests", "expectations.json"), json({ schema_version: "1.0.0", tests: [] }));
  return packageDir;
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
  for (const part of parts) {
    const extraction = part.extraction_path && fs.existsSync(part.extraction_path) ? JSON.parse(fs.readFileSync(part.extraction_path, "utf8")) : null;
    try {
      const fit = fitBulkPart(part, extraction, options);
      const packagePath = stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason: part.demotion_reason ?? null });
      results.push({ mpn: part.mpn, status: "staged", fidelity: fit.fidelity, package_path: packagePath });
    } catch (error) {
      if (part.allow_f1_demotion !== false) {
        const fallbackPart = { ...part };
        const fit = part.conveyor_family === "diode" ? diodeFit(fallbackPart, null) : part.conveyor_family === "bjt" ? bjtFit(fallbackPart, null) : mosfetFit(fallbackPart, null);
        const model = modelFor(fallbackPart, fit);
        options.ngspiceRunner ? options.ngspiceRunner(model.text, { part: fallbackPart, fit }) : defaultNgspiceRunner(model.text);
        fit.model = model;
        const packagePath = stageBulkPart(fallbackPart, extraction, fit, stagingRoot, { demotionReason: error.message });
        results.push({ mpn: part.mpn, status: "staged", fidelity: "F1", demotion_reason: error.message, package_path: packagePath });
      } else results.push({ mpn: part.mpn, status: "failed", stage: "fitted", reason: error.message });
    }
  }
  return results;
}
