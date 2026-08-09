import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const localTmpRoot = path.resolve(here, "../tmp/conveyor-syntax");
const conveyorFitRoot = path.resolve(here, "../tmp/conveyor-fit");

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

function diodeFit(part, extraction, forceF1 = false) {
  const scalarPoint = extraction?.specs?.forward_voltage_points?.find((point) => Number(point?.voltage?.value) > 0 && Number(point?.current?.value) > 0);
  const vf = scalarPoint ? Number(scalarPoint.voltage.value) : hintNumber(part, "diode.forward_voltage", 0.7);
  const current = scalarPoint ? Number(scalarPoint.current.value) : 0.01;
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
  if (part.conveyor_family === "diode") return { name, text: `.model ${name} D(IS=${fmt(p.IS)} N=${fmt(p.N)} RS=${fmt(p.RS)})\n` };
  if (part.conveyor_family === "bjt") {
    const polarity = fit.polarity === "p" ? "PNP" : "NPN";
    // ISE/NE carry the low-current roll-off of an F2 Gummel-Poon fit; the F1 path omits them.
    const recombination = Number(p.ISE) > 0 ? ` ISE=${fmt(p.ISE)} NE=${fmt(p.NE ?? 1.5)} NF=${fmt(p.NF ?? 1)}` : "";
    return { name, text: `.model ${name} ${polarity}(IS=${fmt(p.IS)} BF=${fmt(p.BF)} VAF=${fmt(p.VAF)} IKF=${fmt(p.IKF)}${recombination} RB=${fmt(p.RB)} RC=${fmt(p.RC)} RE=${fmt(p.RE)} CJE=${fmt(p.CJE)} CJC=${fmt(p.CJC)} TF=${fmt(p.TF)})\n` };
  }
  const pchan = fit.polarity === "p" ? " pchan" : "";
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
  const model = modelFor(part, fit);
  ngspiceRunner(model.text, { part, fit });
  return { ...fit, model };
}

function pinsFor(family, polarity) {
  if (family === "diode") return { pins: [{ name: "A", number: "1", role: "anode", node: "anode" }, { name: "K", number: "2", role: "cathode", node: "cathode" }], order: ["1", "2"], electrical: "diode" };
  if (family === "bjt") return { pins: [{ name: "B", number: "1", role: "base", node: "base" }, { name: "C", number: "2", role: "collector", node: "collector" }, { name: "E", number: "3", role: "emitter", node: "emitter" }], order: ["2", "1", "3"], electrical: polarity === "p" ? "bjt_pnp" : "bjt_npn" };
  return { pins: [{ name: "G", number: "1", role: "gate", node: "gate" }, { name: "D", number: "2", role: "drain", node: "drain" }, { name: "S", number: "3", role: "source", node: "source" }], order: ["2", "1", "3"], electrical: polarity === "p" ? "pmos" : "nmos" };
}

export function stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason = null } = {}) {
  const manufacturerSlug = slugManufacturer(part.manufacturer);
  const packageDir = path.join(stagingRoot, "packages", manufacturerSlug, safe(part.mpn));
  if (path.resolve(packageDir).includes(`${path.sep}packages${path.sep}model-library${path.sep}`)) throw new Error("Bulk staging may not target the reviewed model library");
  const pinInfo = pinsFor(part.conveyor_family, fit.polarity);
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
    test_results: { status: "pending", pass_count: 0, fail_count: 0, total_count: 0, worst_observed_relative_fitting_error: fit.worst == null ? null : { value: fit.worst, quantity: fit.worst_quantity ?? "bulk fit residual" } }, validation_date: null,
  };
  write(path.join(packageDir, "component.json"), json(component));
  write(path.join(packageDir, "facts.json"), json({ schema_version: "1.0.0", extraction, catalog_seed_hints: part.seed_hints ?? [], identity: { canonical_mpn: part.mpn, manufacturer: part.manufacturer, aliases: [] }, source }));
  write(path.join(packageDir, "fitted.json"), json({
    schema_version: "1.0.0", fidelity_tier: fit.fidelity, parameters: fit.parameters,
    fitter: fit.fitter ?? "catalog-parametric F1 fallback",
    optimizer: fit.optimizer ?? null,
    curves_used: fit.curves_used ?? [],
    curves_rejected: fit.curves_rejected ?? [],
    residuals: fit.residuals ?? [],
    rms_relative_error: fit.rms ?? null,
    worst_relative_error: fit.worst == null ? null : { value: fit.worst, quantity: fit.worst_quantity ?? "bulk fit residual" },
  }));
  write(path.join(packageDir, "sources.json"), json([source]));
  write(path.join(packageDir, "model.cir"), `* Unreviewed OpenCircuit conveyor model\n* Original from public facts; no vendor SPICE input used.\n${fit.model.text}`);
  const residualRows = (fit.residuals ?? []).map((row) => `| ${row.quantity} | ${row.datasheet_value} | ${Number(row.fitted_value).toPrecision(5)} | ${row.unit} | ${(100 * row.relative_error).toFixed(2)}% | ${row.citation} |`).join("\n");
  const evidence = fit.residuals?.length
    ? `\n## Fitted versus datasheet\n\nFit: ${fit.fitter}. Residuals are measured by evaluating this model card in native ngspice-46.\n\n| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |\n| --- | ---: | ---: | --- | ---: | --- |\n${residualRows}\n\nWorst fitting error: ${(100 * fit.worst).toFixed(3)}% for ${fit.worst_quantity}. RMS: ${(100 * fit.rms).toFixed(3)}%.\n\n### Curves used\n\n${fit.curves_used.map((item) => `- ${item}`).join("\n")}\n${fit.curves_rejected?.length ? `\n### Curves rejected by validation\n\n${fit.curves_rejected.map((item) => `- ${item}`).join("\n")}\n` : ""}`
    : "";
  write(path.join(packageDir, "MODEL_CARD.md"), `# ${part.mpn} unreviewed conveyor model card\n\n- Manufacturer: ${part.manufacturer}\n- Fidelity: ${fit.fidelity}\n- Reviewer: pending-review\n- Datasheet: ${part.datasheet_url}\n${evidence}\n## Known omissions\n\n${omissions.map((item) => `- ${item}`).join("\n")}\n`);
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
      const fit = fitBulkPart(part, extraction, { ...options, forceF1: part.force_f1 === true });
      const demotionReason = part.demotion_reason ?? null;
      const packagePath = stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason });
      results.push({ ...(part.lcsc_id ? { lcsc_id: part.lcsc_id } : {}), mpn: part.mpn, status: "staged", fidelity: fit.fidelity, ...(demotionReason ? { demotion_reason: demotionReason } : {}), package_path: packagePath });
    } catch (error) {
      if (part.allow_f1_demotion !== false) {
        try {
          const fit = fitBulkPart(part, extraction, { ...options, forceF1: true });
          const packagePath = stageBulkPart(part, extraction, fit, stagingRoot, { demotionReason: error.message });
          results.push({ ...(part.lcsc_id ? { lcsc_id: part.lcsc_id } : {}), mpn: part.mpn, status: "staged", fidelity: "F1", demotion_reason: error.message, package_path: packagePath });
        } catch (fallbackError) {
          results.push({ ...(part.lcsc_id ? { lcsc_id: part.lcsc_id } : {}), mpn: part.mpn, status: "failed", stage: "fitted", reason: `F2 failed: ${error.message}; F1 failed: ${fallbackError.message}` });
        }
      } else results.push({ ...(part.lcsc_id ? { lcsc_id: part.lcsc_id } : {}), mpn: part.mpn, status: "failed", stage: "fitted", reason: error.message });
    }
  }
  return results;
}
