#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  activeVdmosModelCard,
  citationCohortMaterial,
  curveCohortMaterial,
  curveIdentityMaterial,
  directEvidenceIntersectionErrors,
  directEvidenceUnionErrors,
  identityHash as canonicalIdentityHash,
  pointEvidenceMaterial,
  scalarEvidenceMaterial,
  stableIdentityValue,
  summarizeMosfetResiduals
} from "../../packages/component-schema/evidence-identity.mjs";
import { getPart } from "./lib/parts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const libraryRoot = path.join(repoRoot, "packages", "model-library", "models");
const compareCli = path.join(repoRoot, "tools", "native-ngspice-reference", "compare.mjs");
const packageValidator = path.join(repoRoot, "packages", "component-schema", "validate-package.mjs");
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function assertFiniteNumbers(value, trail = "root") {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Non-finite number at ${trail}: ${value}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, `${trail}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) assertFiniteNumbers(child, `${trail}.${key}`);
  }
}

function parseArgs(argv) {
  const [stage, ...rest] = argv;
  let mpn;
  let manifest;
  let stagingRoot;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--mpn") mpn = rest[++index];
    else if (rest[index] === "--manifest") manifest = rest[++index];
    else if (rest[index] === "--staging-root") stagingRoot = rest[++index];
    else throw new Error(`Unknown argument: ${rest[index]}`);
  }
  const stages = ["resolve", "acquire", "extract", "fit", "generate", "testgen", "validate", "card", "all", "bulk"];
  if (!stages.includes(stage)) throw new Error(`Stage must be one of: ${stages.join(", ")}`);
  if (stage === "bulk") {
    if (!manifest || !stagingRoot) throw new Error("bulk requires --manifest and --staging-root");
    return { stage, manifest, stagingRoot };
  }
  if (!mpn) throw new Error("--mpn is required");
  return { stage, mpn };
}

function context(mpn) {
  const part = getPart(mpn);
  return {
    part,
    packageDir: path.join(libraryRoot, part.manufacturerSlug, part.slug),
    workDir: path.join(here, "tmp", part.slug),
    pdfPath: path.join(here, "tmp", part.slug, "datasheet.pdf"),
    textPath: path.join(here, "tmp", part.slug, "datasheet.txt")
  };
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(file, data) {
  assertFiniteNumbers(data, path.basename(file));
  ensureDirectory(path.dirname(file));
  fs.writeFileSync(file, json(data));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    cwd: options.cwd ?? here,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`.trim());
  }
  return result;
}

function requireFile(file, stage) {
  if (!fs.existsSync(file)) throw new Error(`${stage} requires ${file}. Run the preceding stage first.`);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertNoTrackedPdfs() {
  const roots = [path.join(repoRoot, "packages", "model-library"), here];
  const bad = [];
  const visit = (target) => {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      const absolute = path.join(target, entry.name);
      if (absolute.startsWith(path.join(here, "tmp")) || absolute.startsWith(path.join(here, ".venv"))) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.toLowerCase().endsWith(".pdf")) bad.push(absolute);
    }
  };
  for (const root of roots) if (fs.existsSync(root)) visit(root);
  if (bad.length) throw new Error(`PDF files are prohibited outside tools/model-factory/tmp: ${bad.join(", ")}`);
}

function assertFactualReferences(value, trail = "facts") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFactualReferences(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Object.hasOwn(value, "value")) {
    for (const field of ["unit", "conditions", "page_reference", "source_kind"]) {
      if (typeof value[field] !== "string" || !value[field].trim()) {
        throw new Error(`${trail} quantity is missing ${field}`);
      }
    }
  }
  for (const [key, child] of Object.entries(value)) assertFactualReferences(child, `${trail}.${key}`);
}

function stageResolve(ctx) {
  ensureDirectory(ctx.packageDir);
  ensureDirectory(path.join(ctx.packageDir, "tests"));
  ensureDirectory(ctx.workDir);
  writeJson(path.join(ctx.workDir, "identity.json"), {
    schema_version: "1.0.0",
    ...ctx.part.identity,
    manufacturer_slug: ctx.part.manufacturerSlug,
    resolved_date: today()
  });
  fs.writeFileSync(path.join(ctx.packageDir, "LICENSE"), `MIT License\n\nCopyright (c) 2026 OpenCircuit contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
  fs.writeFileSync(path.join(ctx.packageDir, "MODEL_CARD.md"), `# ${ctx.part.identity.canonical_mpn} model card\n\nPending factory validation. Run the card stage after validation.\n`);
  console.log(`resolve ${ctx.part.slug}: ${ctx.packageDir}`);
}

function stageAcquire(ctx) {
  if (/\.(?:lib|cir)(?:$|[?#])/i.test(ctx.part.source.url)) throw new Error("Vendor SPICE model downloads are prohibited");
  const parsed = new URL(ctx.part.source.url);
  if (parsed.protocol !== "https:" || !parsed.pathname.toLowerCase().endsWith(".pdf")) {
    throw new Error("Acquire only accepts HTTPS datasheet PDF URLs from the part registry");
  }
  ensureDirectory(ctx.workDir);
  const downloadPath = `${ctx.pdfPath}.download`;
  const cachedOfficial = path.join(here, "tmp", "manual-d", `${ctx.part.slug}.pdf`);
  if (fs.existsSync(cachedOfficial)) fs.copyFileSync(cachedOfficial, downloadPath);
  else run("curl", ["-fL", "--retry", "2", "--connect-timeout", "20", "-A", "Mozilla/5.0", "-H", "Accept: application/pdf", "-o", downloadPath, ctx.part.source.url], { timeout: 600_000 });
  const signature = fs.readFileSync(downloadPath).subarray(0, 5).toString("ascii");
  if (signature !== "%PDF-") {
    fs.rmSync(downloadPath, { force: true });
    throw new Error("Acquired file is not a PDF datasheet");
  }
  fs.renameSync(downloadPath, ctx.pdfPath);
  const sourceRecord = [{
    kind: "datasheet",
    url: ctx.part.source.url,
    revision: ctx.part.source.revision,
    sha256: sha256(ctx.pdfPath),
    accessed_date: today(),
    pages_referenced: ctx.part.source.pages,
    placeholder: false
  }];
  writeJson(path.join(ctx.packageDir, "sources.json"), sourceRecord);
  assertNoTrackedPdfs();
  console.log(`acquire ${ctx.part.slug}: sha256 ${sourceRecord[0].sha256}`);
}

function stageExtract(ctx) {
  requireFile(ctx.pdfPath, "extract");
  run("pdftotext", ["-layout", ctx.pdfPath, ctx.textPath]);
  if (ctx.part.facts.extraction_method?.toLowerCase().includes("ocr")) {
    const imageBase = path.join(ctx.workDir, "datasheet-page");
    run("pdftoppm", ["-f", "1", "-singlefile", "-jpeg", "-r", "200", ctx.pdfPath, imageBase]);
    const ocr = run("tesseract", [`${imageBase}.jpg`, "stdout"]);
    fs.writeFileSync(ctx.textPath, ocr.stdout);
  }
  const text = fs.readFileSync(ctx.textPath, "utf8");
  const sourceIdentifiers = [ctx.part.slug, ...(ctx.part.source.identifiers ?? [])];
  if (!sourceIdentifiers.some((identifier) => text.toLowerCase().includes(identifier.toLowerCase()))) throw new Error("Extracted text does not identify the requested MPN or disclosed source-family identifier");
  const facts = structuredClone(ctx.part.facts);
  facts.identity = {
    canonical_mpn: ctx.part.identity.canonical_mpn,
    manufacturer: ctx.part.identity.manufacturer,
    aliases: ctx.part.identity.aliases
  };
  facts.source = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "sources.json"), "utf8"))[0];
  assertFactualReferences(facts);
  writeJson(path.join(ctx.packageDir, "facts.json"), facts);
  const pointCount = facts.fit_points?.length ?? facts.gain_points?.length ?? facts.transfer_points?.length ?? 1;
  console.log(`extract ${ctx.part.slug}: ${pointCount} primary factual targets`);
}

/**
 * Every registry pipeline maps to exactly one fitter script.
 *
 * This used to end in `?? "fit_diode.py"`. That default was not a fallback, it was a
 * silent mis-dispatch: the only "njf" part in the registry (BF256B) would have been
 * handed to the diode fitter, which reads facts.fit_points and emits an IS/N/RS diode
 * card. Nothing downstream would have noticed a JFET described by diode parameters, so
 * an unmapped archetype now fails by name instead of picking a plausible-looking fitter.
 */
export const FITTER_SCRIPTS = Object.freeze({
  diode: "fit_diode.py",
  bjt: "fit_bjt.py",
  darlington: "fit_darlington.py",
  njf: "fit_jfet.py",
  vdmos: "fit_vdmos.py",
  opamp: "fit_opamp.py",
  sensor_behavioral: "fit_sensor.py",
  specialty_analog: "fit_specialty.py"
});

/**
 * Archetypes that are deliberately not fittable today, with the reason a reviewer needs.
 * Listing them is the point: an unfittable archetype must be a written decision, not an
 * absent map entry that some future `??` quietly papers over again.
 */
export const UNFITTABLE_PIPELINES = Object.freeze({});

export class UnmappedArchetypeError extends Error {
  constructor(pipeline, reason = null) {
    const known = Object.keys(FITTER_SCRIPTS).sort().join(", ");
    super(reason
      ? `Archetype "${pipeline}" has no fitter: ${reason}`
      : `Archetype "${pipeline}" has no fitter script mapped. Mapped archetypes: ${known}. `
        + "Add an entry to FITTER_SCRIPTS, or record the archetype in UNFITTABLE_PIPELINES with its reason.");
    this.name = "UnmappedArchetypeError";
    this.pipeline = pipeline;
    this.unfittable = reason !== null;
  }
}

export function fitterScriptFor(pipeline) {
  if (Object.hasOwn(FITTER_SCRIPTS, pipeline)) return FITTER_SCRIPTS[pipeline];
  if (Object.hasOwn(UNFITTABLE_PIPELINES, pipeline)) throw new UnmappedArchetypeError(pipeline, UNFITTABLE_PIPELINES[pipeline]);
  throw new UnmappedArchetypeError(pipeline);
}

function stageFit(ctx) {
  const factsPath = path.join(ctx.packageDir, "facts.json");
  requireFile(factsPath, "fit");
  const output = path.join(ctx.packageDir, "fitted.json");
  if (ctx.part.pipeline === "sibling_alias") {
    const siblingPath = path.join(libraryRoot, ctx.part.sibling.manufacturerSlug, ctx.part.sibling.slug, "fitted.json");
    requireFile(siblingPath, "fit sibling alias");
    const fitted = JSON.parse(fs.readFileSync(siblingPath, "utf8"));
    fitted.inheritance = { kind: "documented_die_sibling", electrical_model_from: ctx.part.sibling.slug, policy: "separate package metadata and provenance; shared fitted die parameters" };
    writeJson(output, fitted);
    console.log(`fit ${ctx.part.slug}: inherited documented die fit from ${ctx.part.sibling.slug}`);
    return;
  }
  const python = path.join(here, ".venv", "bin", "python");
  requireFile(python, "fit");
  const script = fitterScriptFor(ctx.part.pipeline);
  run(python, [path.join(here, "python", script), factsPath, output], { timeout: 600_000 });
  const fitted = JSON.parse(fs.readFileSync(output, "utf8"));
  console.log(`fit ${ctx.part.slug}: worst relative error ${(100 * fitted.worst_relative_error.value).toFixed(3)}%`);
}

function formatSpice(value) {
  if (value === 0) return "0";
  return Number(value).toExponential(10).replace("e+", "e");
}

function emittedParameterValues(model) {
  const values = new Map();
  for (const match of model.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*([^\s(){}]+)/g)) {
    const value = Number(match[2]);
    if (Number.isFinite(value)) values.set(match[1], value);
  }
  return values;
}

export function assertEmittedParametersMatchFitted(model, fitted, electricalFamily = null, modelName = null) {
  let emitted;
  const mismatches = [];
  if (["nmos", "pmos"].includes(electricalFamily)) {
    const card = activeVdmosModelCard(model, modelName);
    emitted = card.parameters;
    if (electricalFamily === "pmos" && !card.pchan) mismatches.push("channel: PMOS active DUT VDMOS card must declare pchan");
    if (electricalFamily === "nmos" && card.pchan) mismatches.push("channel: NMOS active DUT VDMOS card must not declare pchan");
  } else emitted = emittedParameterValues(model);
  for (const [name, expected] of Object.entries(fitted.parameters ?? {})) {
    const expectedValue = Number(expected);
    if (!Number.isFinite(expectedValue)) continue;
    if (!emitted.has(name)) {
      mismatches.push(`${name}: missing from emitted model`);
      continue;
    }
    const actual = emitted.get(name);
    const scale = Math.max(1, Math.abs(expectedValue));
    if (electricalFamily === "nmos" && name === "VTO" && !(expectedValue > 0)) {
      mismatches.push(`VTO: NMOS fitted ${expectedValue}, expected a positive threshold`);
    } else if (electricalFamily === "pmos" && name === "VTO") {
      if (!(actual < 0)) mismatches.push(`VTO: PMOS emitted ${actual}, expected a negative threshold`);
      else if (Math.abs(Math.abs(actual) - Math.abs(expectedValue)) > 5e-10 * scale) mismatches.push(`VTO: emitted magnitude ${Math.abs(actual)}, fitted ${expected}`);
    } else if (Math.abs(actual - expectedValue) > 5e-10 * scale) {
      mismatches.push(`${name}: emitted ${actual}, fitted ${expected}`);
    }
  }
  if (mismatches.length) {
    throw new Error(`Generated model parameters disagree with fitted.json:\n${mismatches.join("\n")}`);
  }
}

function modelText(ctx, fitted) {
  const p = fitted.parameters;
  const header = `* OpenCircuit Model Factory v0.1.0\n* Original work generated from public factual specifications.\n* This model is not a copy of, or adaptation from, any vendor SPICE model.\n* Source: ${ctx.part.source.url}\n* Revision: ${ctx.part.source.revision}\n`;
  if (ctx.part.pipeline === "darlington") {
    const polarity = ctx.part.identity.electrical_family === "bjt_pnp" ? "PNP" : "NPN";
    const driver = `${ctx.part.component.modelName}_DRV`;
    const output = `${ctx.part.component.modelName}_OUT`;
    const diode = `${ctx.part.component.modelName}_FWD`;
    const card = (name, prefix) => `.model ${name} ${polarity}(IS=${formatSpice(p[`${prefix}_IS`])} NF=1 BF=${formatSpice(p[`${prefix}_BF`])} IKF=${formatSpice(p[`${prefix}_IKF`])} ISE=${formatSpice(p[`${prefix}_ISE`])} NE=${formatSpice(p[`${prefix}_NE`])} VAF=${formatSpice(p[`${prefix}_VAF`])} BR=2 RB=${formatSpice(p[`${prefix}_RB`])} RE=${formatSpice(p[`${prefix}_RE`])} RC=${formatSpice(p[`${prefix}_RC`])} CJE=${formatSpice(p[`${prefix}_CJE`])} VJE=0.75 MJE=0.33 CJC=${formatSpice(p[`${prefix}_CJC`])} VJC=0.75 MJC=0.33 XCJC=1 TF=${formatSpice(p[`${prefix}_TF`])} TR=${formatSpice(p[`${prefix}_TR`])} FC=0.5 EG=1.11 XTI=3 TNOM=27)`;
    const diodeInstance = polarity === "PNP" ? `D1 C E ${diode}` : `D1 E C ${diode}`;
    return `${header}* Darlington F2 composite ceiling; internal transistor nodes are F1\n* Node order: C B E\n${card(driver, "DRV")}\n${card(output, "OUT")}\n.model ${diode} D(IS=${formatSpice(p.DIODE_IS)} N=${formatSpice(p.DIODE_N)} RS=${formatSpice(p.DIODE_RS)})\n.subckt ${ctx.part.component.modelName} C B E\nQ1 C B N1 ${driver}\nQ2 C N1 E ${output}\nR1 B N1 ${formatSpice(p.R1)}\nR2 N1 E ${formatSpice(p.R2)}\n${diodeInstance}\n.ends ${ctx.part.component.modelName}\n`;
  }
  if (ctx.part.pipeline === "sibling_alias") {
    const names = ["IS", "NF", "BF", "IKF", "ISE", "NE", "VAF", "BR", "RB", "RE", "RC", "CJE", "VJE", "MJE", "CJC", "VJC", "MJC", "XCJC", "TF", "TR"];
    return `${header}* Electrical die fit shared from ${ctx.part.sibling.slug} under the documented sibling/package policy\n* Package metadata and datasheet provenance remain specific to ${ctx.part.slug}\n.model ${ctx.part.component.modelName} NPN(${names.map((name) => `${name}=${formatSpice(p[name])}`).join(" ")} FC=0.5 EG=1.11 XTI=3 TNOM=27)\n`;
  }
  if (ctx.part.pipeline === "bjt") {
    const names = ["IS", "NF", "BF", "IKF", "ISE", "NE", "VAF", "BR", "RB", "RE", "RC", "CJE", "VJE", "MJE", "CJC", "VJC", "MJC", "XCJC", "TF", "TR"];
    const polarity = ctx.part.identity.electrical_family === "bjt_pnp" ? "PNP" : "NPN";
    return `${header}* Fit: native ngspice-46 in scipy.optimize.least_squares, diff_step=1e-4\n.model ${ctx.part.component.modelName} ${polarity}(${names.map((name) => `${name}=${formatSpice(p[name])}`).join(" ")} FC=0.5 EG=1.11 XTI=3 TNOM=27)\n`;
  }
  if (ctx.part.pipeline === "vdmos") {
    const names = ["VTO", "KP", "THETA", "LAMBDA", "RD", "RS", "RG", "CGS", "CGDMAX", "CGDMIN", "A", "CJO", "IS", "N", "RB", "TT", "BV", "IBV", "RTHJC", "RTHCA"];
    const pChannel = ctx.part.identity.electrical_family === "pmos";
    const parameter = (name) => name === "VTO" && pChannel ? -Math.abs(p[name]) : p[name];
    return `${header}* Fit: native ngspice-46 in scipy.optimize.least_squares, diff_step=1e-4\n.model ${ctx.part.component.modelName} VDMOS(${pChannel ? "pchan " : ""}${names.map((name) => `${name}=${formatSpice(parameter(name))}`).join(" ")} RDS=1e9 VJ=0.8 M=0.5 FC=0.5 NBV=1 TNOM=27)\n`;
  }
  if (ctx.part.pipeline === "opamp") {
    return `${header}* Fit: exactly three native ngspice-46 fixed-point calibration iterations\n* Node order: INP INN VCC VEE OUT\n.subckt ${ctx.part.component.modelName} INP INN VCC VEE OUT\n.param AOL=${formatSpice(p.AOL)} GBW=${formatSpice(p.GBW)} SR=${formatSpice(p.SR)} IBIAS=${formatSpice(p.IBIAS)} IOS=${formatSpice(p.IOS)} VOS=${formatSpice(p.VOS)}\n.param ROUT=${formatSpice(p.ROUT)} ILIM=${formatSpice(p.ILIM)} VDRP_H=${formatSpice(p.VDRP_H)} VDRP_L=${formatSpice(p.VDRP_L)} CC=30p FP2=${formatSpice(p.FP2)}\n.param CMRR=${formatSpice(p.CMRR)} PSRR=${formatSpice(p.PSRR)} VSUP_NOM=${formatSpice(p.VSUP_NOM)} IQ=${formatSpice(p.IQ)} EN=${formatSpice(p.EN)}\nIBP 0 INP DC {IBIAS+IOS/2}\nIBN 0 INN DC {IBIAS-IOS/2}\nCDIF INP INN 1p\nBERR e 0 V = v(INP,INN) + VOS + v(nz) + 0.5*(v(INP)+v(INN))/CMRR + (v(VCC,VEE)-VSUP_NOM)/PSRR\nRE e 0 1meg\nRNZ nz 0 {EN*EN/(4*1.380649e-23*300.15)}\nBGM 0 p I = {SR*CC}*tanh({6.283185307*GBW/SR}*v(e))\nCP p 0 {CC}\nRP p 0 {AOL/(6.283185307*GBW*CC)}\nRP2 p p2 {1/(6.283185307*FP2*1p)}\nCP2 p2 0 1p\nBCLMP q 0 V = min(max(v(p2), v(VEE)+min(VDRP_L,0.49*v(VCC,VEE))), v(VCC)-min(VDRP_H,0.49*v(VCC,VEE)))\nRQ q 0 1meg\nBOUT 0 OUT I = ILIM*tanh((v(q)-v(OUT))/(ROUT*ILIM))\nIQVCC VCC VEE DC {IQ}\n.ends ${ctx.part.component.modelName}\n`;
  }
  if (ctx.part.pipeline === "specialty_analog") {
    const variant = ctx.part.facts.specialty_variant;
    if (variant === "lm386_audio_power_amp") {
      return `${header}* Fit: native ngspice-46 least-squares fit to cited frequency-response and output-swing curves\n* Node order: GAIN1 INN INP GND OUT VS BYPASS GAIN8\n.subckt ${ctx.part.component.modelName} GAIN1 INN INP GND OUT VS BYPASS GAIN8 params: GAIN_CL=${formatSpice(p.GAIN_OPEN)}\n.param GAIN_OPEN=${formatSpice(p.GAIN_OPEN)} BW=${formatSpice(p.BW)} VDROP=${formatSpice(p.VDROP)} ILIM=${formatSpice(p.ILIM)}\n.param ROUT=${formatSpice(p.ROUT)} IQ=${formatSpice(p.IQ)} IBIAS=${formatSpice(p.IBIAS)} RIN=${formatSpice(p.RIN)} RBYP=${formatSpice(p.RBYP)} RGAIN=${formatSpice(p.RGAIN)}\nRINPUT INP INN {RIN}\nIBP GND INP DC {IBIAS}\nIBN GND INN DC {IBIAS}\nRBP1 VS BYPASS {RBYP}\nRBP2 BYPASS GND {RBYP}\nRG12 GAIN1 GAIN8 {RGAIN}\nRG1DC GAIN1 GND 1G\nRG8DC GAIN8 GND 1G\nBIDEAL pre GND V={v(GND)+0.5*v(VS,GND)+GAIN_CL*v(INP,INN)}\nRLP pre filt 1k\nCLP filt GND {1/(6.283185307*BW*1k)}\nBCLAMP q GND V={min(max(v(filt),v(GND)+VDROP),v(VS)-VDROP)}\nRQ q GND 1G\nBOUT GND OUT I={ILIM*tanh((v(q)-v(OUT))/(ROUT*ILIM))}\nIQDRAW VS GND DC {IQ}\n.ends ${ctx.part.component.modelName}\n`;
    }
    if (variant === "lm13700_dual_ota") {
      return `${header}* Fit: native ngspice-46 least-squares fit to cited transconductance and amplifier-bias curves\n* Node order follows physical pins 1 through 16\n.subckt ${ctx.part.component.modelName} IABC1 DIODE1 INP1 INN1 OUT1 VEE BUFIN1 BUFOUT1 BUFOUT2 BUFIN2 VCC OUT2 INN2 INP2 DIODE2 IABC2\n.param GM_SCALE=${formatSpice(p.GM_SCALE)} VT=${formatSpice(p.VT)} POLE_HZ=${formatSpice(p.POLE_HZ)} VBIAS0=${formatSpice(p.VBIAS0)} RABC=${formatSpice(p.RABC)}\n.param RIN=${formatSpice(p.RIN)} ROUT=${formatSpice(p.ROUT)} IQ=${formatSpice(p.IQ)} VBUF_DROP=${formatSpice(p.VBUF_DROP)} RBUF=${formatSpice(p.RBUF)} ILIM_BUF=${formatSpice(p.ILIM_BUF)} IBUF=${formatSpice(p.IBUF)}\nVB1 IABC1 NABC1 DC {VBIAS0}\nRABC1 NABC1 VEE {RABC}\nVB2 IABC2 NABC2 DC {VBIAS0}\nRABC2 NABC2 VEE {RABC}\nRIN1 INP1 INN1 {RIN}\nRIN2 INP2 INN2 {RIN}\nRIP1 INP1 0 1G\nRIN1DC INN1 0 1G\nRIP2 INP2 0 1G\nRIN2DC INN2 0 1G\nRD1DC DIODE1 0 1G\nRD2DC DIODE2 0 1G\nRBI1DC BUFIN1 0 1G\nRBO1DC BUFOUT1 0 1G\nRBI2DC BUFIN2 0 1G\nRBO2DC BUFOUT2 0 1G\nBGM1 VEE NGM1 I={GM_SCALE*max((v(IABC1,VEE)-VBIAS0)/RABC,0)*tanh(v(INP1,INN1)/(2*VT))}\nRPOLE1 NGM1 VEE 1\nCPOLE1 NGM1 VEE {1/(6.283185307*POLE_HZ)}\nBOUT1 VEE OUT1 I={v(NGM1,VEE)}\nROUT1 OUT1 0 {ROUT}\nBGM2 VEE NGM2 I={GM_SCALE*max((v(IABC2,VEE)-VBIAS0)/RABC,0)*tanh(v(INP2,INN2)/(2*VT))}\nRPOLE2 NGM2 VEE 1\nCPOLE2 NGM2 VEE {1/(6.283185307*POLE_HZ)}\nBOUT2 VEE OUT2 I={v(NGM2,VEE)}\nROUT2 OUT2 0 {ROUT}\nDLI1P DIODE1 INP1 DLIN\nDLI1N DIODE1 INN1 DLIN\nDLI2P DIODE2 INP2 DLIN\nDLI2N DIODE2 INN2 DLIN\n.model DLIN D(IS=1e-14 N=1)\nIBUF1 BUFIN1 VEE DC {IBUF}\nBBUF1 NBF1 0 V={min(max(v(BUFIN1)-VBUF_DROP,v(VEE)+VBUF_DROP),v(VCC)-VBUF_DROP)}\nBBO1 VEE BUFOUT1 I={ILIM_BUF*tanh((v(NBF1)-v(BUFOUT1))/(RBUF*ILIM_BUF))}\nIBUF2 BUFIN2 VEE DC {IBUF}\nBBUF2 NBF2 0 V={min(max(v(BUFIN2)-VBUF_DROP,v(VEE)+VBUF_DROP),v(VCC)-VBUF_DROP)}\nBBO2 VEE BUFOUT2 I={ILIM_BUF*tanh((v(NBF2)-v(BUFOUT2))/(RBUF*ILIM_BUF))}\nIQDRAW VCC VEE DC {IQ}\n.ends ${ctx.part.component.modelName}\n`;
    }
    throw new Error(`Unsupported specialty analog variant: ${variant}`);
  }
  if (ctx.part.pipeline === "sensor_behavioral") {
    const variant = ctx.part.facts.sensor_variant;
    if (variant === "linear_voltage") {
      return `${header}* Archetype: sensor_behavioral linear voltage output\n* Node order: VS OUT GND\n.subckt ${ctx.part.component.modelName} VS OUT GND params: TEMP_C=25\n.param SCALE=${formatSpice(p.SCALE)} OFFSET=${formatSpice(p.OFFSET)} ROUT=${formatSpice(p.ROUT)} IQ=${formatSpice(p.IQ)} VDROP=${formatSpice(p.VDROP)}\nBIDEAL nideal GND V={OFFSET+SCALE*TEMP_C}\nBCLAMP ndrive GND V={min(max(v(nideal),v(GND)),v(VS)-VDROP)}\nROUTER ndrive OUT {max(ROUT,1e-4)}\nRDC nideal GND 1G\nIQDRAW VS GND DC {IQ}\n.ends ${ctx.part.component.modelName}\n`;
    }
    if (variant === "beta_ntc") {
      return `${header}* Archetype: sensor_behavioral B-parameter NTC\n* Node order: P N\n.subckt ${ctx.part.component.modelName} P N params: TEMP_C=25\n.param R0=${formatSpice(p.R0)} T0_C=${formatSpice(p.T0_C)} BETA=${formatSpice(p.BETA)}\nRNTC P N R={max(R0*exp(BETA*(1/(TEMP_C+273.15)-1/(T0_C+273.15))),1e-4)}\n.ends ${ctx.part.component.modelName}\n`;
    }
    if (variant === "power_ldr") {
      return `${header}* Archetype: sensor_behavioral illuminance power law\n* Node order: P N\n.subckt ${ctx.part.component.modelName} P N params: LUX=10\n.param R10=${formatSpice(p.R10)} GAMMA=${formatSpice(p.GAMMA)} LUX_FLOOR=${formatSpice(p.LUX_FLOOR)}\nRLDR P N R={max(R10*pow(max(LUX,LUX_FLOOR)/10,-GAMMA),1e-4)}\n.ends ${ctx.part.component.modelName}\n`;
    }
    throw new Error(`Unsupported sensor variant: ${variant}`);
  }
  const optional = [];
  if (p.CJO > 0) optional.push(`CJO=${formatSpice(p.CJO)}`);
  if (p.TT > 0) optional.push(`TT=${formatSpice(p.TT)}`);
  for (const name of ["BV", "IBV", "NBV"]) if (p[name] != null) optional.push(`${name}=${formatSpice(p[name])}`);
  return `${header}* Fit: scipy.optimize.least_squares at ${fitted.temperature_c} degC\n.model ${ctx.part.component.modelName} D(IS=${formatSpice(p.IS)} N=${formatSpice(p.N)} RS=${formatSpice(p.RS)} ${optional.join(" ")} TNOM=${formatSpice(fitted.temperature_c)})\n`;
}

function baseComponent(ctx, fitted) {
  const identity = ctx.part.identity;
  const packageInfo = identity.package;
  return {
    schema_version: "1.0.0",
    ...(ctx.part.component.evidence_contract_version ? { evidence_contract_version: ctx.part.component.evidence_contract_version } : {}),
    canonical_mpn: identity.canonical_mpn,
    manufacturer: identity.manufacturer,
    description: identity.description,
    electrical_family: identity.electrical_family,
    symbol_pins: (identity.pins ?? [
      { name: "A", number: "1", role: "anode", node: "anode" },
      { name: "K", number: "2", role: "cathode", node: "cathode" }
    ]).map(({ name, number, role }) => ({ name, number, role })),
    spice_pin_mapping: (identity.spice_order ?? ["1", "2"]).map((number, index) => {
      const pin = (identity.pins ?? [
        { number: "1", node: "anode" },
        { number: "2", node: "cathode" }
      ]).find((candidate) => candidate.number === number);
      return { symbol_pin_number: number, subckt_node: pin.node, order: index + 1 };
    }),
    package_variants: [{
      name: packageInfo.name,
      standard: packageInfo.standard,
      pin_count: packageInfo.pin_count ?? (identity.pins ?? [{}, {}]).length,
      pin_map: (identity.pins ?? [{ number: "1" }, { number: "2" }]).map((pin) => ({
        package_pin: pin.number,
        symbol_pin_number: pin.number
      }))
    }],
    ordering_code_aliases: identity.aliases,
    datasheet: { url: ctx.part.source.url, revision: ctx.part.source.revision },
    model_type: ["opamp", "darlington", "sensor_behavioral", "specialty_analog"].includes(ctx.part.pipeline) ? "subckt" : "dot_model",
    fidelity_tier: ctx.part.component.fidelity_tier ?? "F2",
    domain_coverage: ctx.part.component.domain_coverage,
    supported_analyses: ctx.part.component.supported_analyses,
    supported_operating_region: ctx.part.component.supported_operating_region ?? {
      summary: ctx.part.component.operating_summary,
      numeric_bounds: ctx.part.component.numeric_bounds
    },
    known_omissions: ctx.part.component.omissions,
    licence: { spdx_id: "MIT", provenance_basis: "original_from_facts" },
    generator: { tool_or_agent: "opencircuit-model-factory-v0.1.0", date: today() },
    reviewer: { tool_or_agent: "pending-review", date: today() },
    test_results: {
      status: "pending",
      pass_count: 0,
      fail_count: 0,
      total_count: 0,
      worst_observed_relative_fitting_error: null
    },
    validation_date: null
  };
}

function stageGenerate(ctx) {
  const fittedPath = path.join(ctx.packageDir, "fitted.json");
  requireFile(fittedPath, "generate");
  const fitted = JSON.parse(fs.readFileSync(fittedPath, "utf8"));
  if (ctx.part.pipeline === "vdmos") {
    const factsPath = path.join(ctx.packageDir, "facts.json");
    if (fs.existsSync(factsPath)) assertMosfetConditionIdentityContract(ctx, JSON.parse(fs.readFileSync(factsPath, "utf8")), fitted);
  }
  const model = modelText(ctx, fitted);
  if (ctx.part.pipeline !== "darlington") assertEmittedParametersMatchFitted(model, fitted, ctx.part.identity.electrical_family, ctx.part.component.modelName);
  fs.writeFileSync(path.join(ctx.packageDir, "model.cir"), model);
  writeJson(path.join(ctx.packageDir, "component.json"), baseComponent(ctx, fitted));
  console.log(`generate ${ctx.part.slug}: ${ctx.part.component.modelName}`);
}

function opBench(model, modelName, name, current) {
  return `OpenCircuit factory test: ${name}\n${model}\nItest 0 anode DC ${formatSpice(current)}\nVanchor anchor 0 DC 0\nRanchor anchor 0 1G\nDdut anode 0 ${modelName}\n.op\n.end\n`;
}

function strictDiodeForwardBench(model, modelName, name, current, condition) {
  const temperature = Number(condition.temperature.value_c);
  if (["dc", "continuous", "not_stated", "pulsed_limit"].includes(condition.test_mode.kind)) return {
    text: `OpenCircuit factory test: ${name}\n${model}\n.temp ${formatSpice(temperature)}\nItest 0 anode DC ${formatSpice(current)}\nVanchor anchor 0 DC 0\nRanchor anchor 0 1G\nDdut anode 0 ${modelName}\n.op\n.end\n`,
    analysisType: "operating_point",
    expression: "last(v(anode))",
  };
  const width = Number(condition.test_mode.pulse_width_s);
  const duty = condition.test_mode.kind === "pulsed" ? Number(condition.test_mode.duty_cycle) : null;
  if (!(width > 0) || (condition.test_mode.kind === "pulsed" && !(duty > 0 && duty < 1))) {
    throw new Error(`${name} has an invalid diode pulse qualification`);
  }
  const delay = width;
  const edge = width / 1000;
  const period = duty == null ? width * 4 : width / duty;
  const sample = delay + edge + width / 2;
  const stop = delay + edge + width * 0.75;
  const step = width / 40;
  return {
    text: `OpenCircuit factory test: ${name}\n${model}\n.temp ${formatSpice(temperature)}\nItest 0 anode PULSE(${formatSpice(0)} ${formatSpice(current)} ${formatSpice(delay)} ${formatSpice(edge)} ${formatSpice(edge)} ${formatSpice(width)} ${formatSpice(period)})\nVanchor anchor 0 DC 0\nRanchor anchor 0 1G\nDdut anode 0 ${modelName}\n.tran ${formatSpice(step)} ${formatSpice(stop)}\n.end\n`,
    analysisType: "transient",
    expression: `at(v(anode),${formatSpice(sample)})`,
  };
}

function diodeCitationText(citation, fallback) {
  if (!citation) return fallback;
  if (citation.table) return `p. ${citation.page}, Table ${citation.table}, row ${citation.row}`;
  return `p. ${citation.page}, Figure ${citation.figure}, ${citation.curve ?? citation.trace}`;
}

function strictDiodeForwardRows(facts, fidelityTier) {
  const rows = [];
  for (const curve of facts.curves ?? []) if (curve.characteristic === "forward_voltage") {
    for (const point of curve.points ?? []) rows.push({
      current: point.x_si,
      voltage: point.y_si,
      role: point.evidence_identity.role,
      condition: curve.condition_identity,
      citation: curve.citation_identity,
      evidence: point.evidence_identity,
      pageReference: diodeCitationText(curve.citation_identity, "forward-voltage curve"),
    });
  }
  for (const point of facts.forward_voltage_points ?? []) {
    const voltage = point.voltage;
    if (!voltage?.evidence_identity) continue;
    if (fidelityTier === "F2" && !["minimum", "maximum"].includes(voltage.evidence_identity.role)) continue;
    rows.push({
      current: point.current.value,
      voltage: voltage.value,
      role: voltage.evidence_identity.role,
      condition: voltage.condition_identity,
      citation: voltage.citation_identity,
      evidence: voltage.evidence_identity,
      pageReference: voltage.page_reference,
    });
  }
  return rows;
}

function reverseBench(model, modelName, voltage) {
  return `OpenCircuit factory test: reverse leakage\n${model}\nVreverse cathode 0 DC ${formatSpice(voltage)}\nDdut 0 cathode ${modelName}\n.op\n.end\n`;
}

function capacitanceBench(model, modelName) {
  return `OpenCircuit factory test: zero-bias capacitance\n${model}\nVac anode 0 DC 0 AC 0.05\nDdut anode 0 ${modelName}\n.ac lin 1 1Meg 1Meg\n.end\n`;
}

function reverseRecoveryBench(model, modelName) {
  return `OpenCircuit factory test: reverse recovery\n${model}\nVdrive src 0 PULSE(1.7 -6 20n 0.1n 0.1n 20n 50n)\nRload src anode 100\nDdut anode 0 ${modelName}\n.tran 0.05n 50n\n.end\n`;
}

function expectation(name, expression, expectedValue, unit, absolute, relative, citation, identityLinks = null) {
  return {
    name,
    expression_source: { kind: "raw_variable", expression },
    expected_value: expectedValue,
    unit,
    tolerance: { absolute, relative },
    datasheet_citation: citation,
    ...(identityLinks ?? {}),
    placeholder: false
  };
}

function hardBound(name, expression, unit, bounds, citation, identityLinks = null) {
  return {
    name,
    expression_source: { kind: "raw_variable", expression },
    ...bounds,
    unit,
    inclusive: true,
    datasheet_citation: citation,
    ...(identityLinks ?? {}),
    placeholder: false
  };
}

function writeBench(ctx, file, text) {
  fs.writeFileSync(path.join(ctx.packageDir, "tests", file), text);
}

function testRecord(file, analysisType, scalarChecks = [], hardBoundsChecks = []) {
  return { test_netlist: file, analysis_type: analysisType, scalar_checks: scalarChecks, hard_bounds_checks: hardBoundsChecks };
}

function bjtTestgen(ctx, model, facts) {
  const tests = [];
  const sign = ctx.part.identity.electrical_family === "bjt_pnp" ? -1 : 1;
  const instance = (name, collector, base, emitter = "0") => ctx.part.pipeline === "darlington"
    ? `X${name} ${collector} ${base} ${emitter} ${ctx.part.component.modelName}`
    : `Q${name} ${collector} ${base} ${emitter} ${ctx.part.component.modelName}`;
  const gainLines = [`OpenCircuit factory test: ${ctx.part.slug} DC gain`, model, ".temp 25"];
  const gainChecks = [];
  const gainBounds = [];
  facts.gain_points.forEach((point, index) => {
    const id = index + 1;
    const baseCurrent = point.collector_current.value / point.hfe.value;
    gainLines.push(`VCG${id} cg${id} 0 DC ${formatSpice(sign * point.vce.value)}`, `IBG${id} 0 bg${id} DC ${formatSpice(sign * baseCurrent)}`, instance(`G${id}`, `cg${id}`, `bg${id}`));
    const gainExpression = `scale_abs:last(i(vcg${id}),${1 / baseCurrent})`;
    if (point.hfe.source_kind === "minimum") {
      gainBounds.push(hardBound(`hfe_minimum_at_${point.collector_current.value}_a`, gainExpression, "1", { minimum: point.hfe.value }, point.hfe.page_reference));
    } else if (point.hfe.source_kind === "maximum") {
      gainBounds.push(hardBound(`hfe_maximum_at_${point.collector_current.value}_a`, gainExpression, "1", { maximum: point.hfe.value }, point.hfe.page_reference));
    } else {
      gainChecks.push(expectation(`hfe_at_${point.collector_current.value}_a`, gainExpression, point.hfe.value, "1", 0, ctx.part.component.test_tolerances?.dc_current_gain ?? 0.30, point.hfe.page_reference));
    }
  });
  gainLines.push(".op", ".end", "");
  writeBench(ctx, "dc_gain.cir", gainLines.join("\n"));
  tests.push(testRecord("dc_gain.cir", "operating_point", gainChecks, gainBounds));

  if (facts.saturation_points.length) {
    const satLines = [`OpenCircuit factory test: ${ctx.part.slug} saturation`, model, ".temp 25"];
    const satChecks = [];
    const satBounds = [];
    facts.saturation_points.forEach((point, index) => {
      const id = index + 1;
      satLines.push(`ICS${id} 0 cs${id} DC ${formatSpice(sign * point.collector_current.value)}`, `IBS${id} 0 bs${id} DC ${formatSpice(sign * point.base_current.value)}`, instance(`S${id}`, `cs${id}`, `bs${id}`));
      for (const [name, expression, target] of [
        [`vce_sat_${id}`, `abs:last(v(cs${id}))`, point.vce_sat],
        [`vbe_sat_${id}`, `abs:last(v(bs${id}))`, point.vbe_sat]
      ]) {
        if (!target) continue;
        if (target.source_kind === "maximum") {
          satBounds.push(hardBound(`${name}_maximum`, expression, "V", { minimum: 0, maximum: target.value }, target.page_reference));
        } else if (target.source_kind === "minimum") {
          satBounds.push(hardBound(`${name}_minimum`, expression, "V", { minimum: target.value }, target.page_reference));
        } else {
          satChecks.push(expectation(name, expression, target.value, "V", 0.02, ctx.part.component.test_tolerances?.saturation_voltage ?? 0.15, target.page_reference));
        }
      }
    });
    satLines.push(".op", ".end", "");
    writeBench(ctx, "saturation.cir", satLines.join("\n"));
    tests.push(testRecord("saturation.cir", "operating_point", satChecks, satBounds));
  }

  if (facts.frequency_response) {
    const ft = facts.frequency_response;
    const beta = facts.gain_points.find((point) => point.collector_current.value === ft.ic.value)?.hfe.value ?? 100;
    writeBench(ctx, "ft_bench.cir", `OpenCircuit factory test: ${ctx.part.slug} fT\n${model}\n.temp 25\nVCC c 0 DC ${formatSpice(sign * ft.vce.value)}\nIBDC 0 b DC ${formatSpice(sign * ft.ic.value / beta)}\nIAC 0 b AC 1\n${instance("1", "c", "b")}\n.ac dec 20 1Meg 10G\n.end\n`);
    if (ft.ft.source_kind === "minimum") {
      tests.push(testRecord("ft_bench.cir", "ac_small_signal", [], [hardBound("current_gain_bandwidth_minimum", "frequency_at_magnitude(i(vcc),1)", "Hz", { minimum: ft.ft.value }, ft.ft.page_reference)]));
    } else {
      tests.push(testRecord("ft_bench.cir", "ac_small_signal", [expectation("current_gain_bandwidth", "frequency_at_magnitude(i(vcc),1)", ft.ft.value, "Hz", 0, 0.20, ft.ft.page_reference)]));
    }
  }

  if (facts.capacitances) {
    const cap = facts.capacitances;
    writeBench(ctx, "capacitance.cir", `OpenCircuit factory test: ${ctx.part.slug} Cobo\n${model}\n.temp 25\nVCB c 0 DC ${sign * cap.cobo_vcb.value} AC 1\n${instance("1", "c", "b")}\nVB b 0 DC 0\n.ac lin 1 1Meg 1Meg\n.end\n`);
    tests.push(testRecord("capacitance.cir", "ac_small_signal", [expectation("cobo", "imag_cap:last(i(vcb),1000000)", cap.cobo.value, "F", 0.5e-12, 0.20, cap.cobo.page_reference)]));
  }

  writeBench(ctx, "output_curve.cir", `OpenCircuit factory test: ${ctx.part.slug} output sanity\n${model}\n.temp 25\nVCE1 c1 0 DC ${2 * sign}\nIB1 0 b1 DC ${10e-6 * sign}\n${instance("1", "c1", "b1")}\nVCE2 c2 0 DC ${10 * sign}\nIB2 0 b2 DC ${50e-6 * sign}\n${instance("2", "c2", "b2")}\n.op\n.end\n`);
  tests.push(testRecord("output_curve.cir", "operating_point"));

  const upperCurrent = Math.max(...facts.gain_points.map((point) => point.collector_current.value));
  const upperPoint = facts.gain_points.find((point) => point.collector_current.value === upperCurrent);
  const upperBaseCurrent = upperCurrent / upperPoint.hfe.value;
  const ratedVoltage = ctx.part.component.numeric_bounds.find((bound) => bound.quantity.startsWith("collector_emitter_voltage"))?.maximum;
  writeBench(ctx, "boundary_region.cir", `OpenCircuit factory test: ${ctx.part.slug} supported-region upper-current boundary\n${model}\n.temp 25\nIC 0 c DC ${formatSpice(sign * upperCurrent)}\nIB 0 b DC ${formatSpice(sign * upperBaseCurrent)}\n${instance("1", "c", "b")}\n.op\n.end\n`);
  tests.push(testRecord("boundary_region.cir", "operating_point", [], [hardBound(
    "upper_current_boundary_voltage",
    "abs:last(v(c))",
    "V",
    { minimum: 0, maximum: Number(ratedVoltage) || upperPoint.vce.value },
    upperPoint.collector_current.page_reference
  )]));
  return tests;
}

const MOSFET_CRITICAL_PARAMETERS = new Set(["VTO", "KP", "RD", "RS", "RB"]);
const PLACEHOLDER_CITATION = /^(?:n\/?a|none|unknown|tbd|todo|fixture|placeholder|catalog|datasheet|source|not stated|model-factory)(?:\b|$)/i;
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function closeEnough(left, right) {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function realDatasheetCitation(citation, trail) {
  if (typeof citation !== "string" || !citation.trim() || PLACEHOLDER_CITATION.test(citation.trim())) {
    throw new Error(`${trail} must carry a real datasheet citation`);
  }
  const text = citation.trim();
  if (!/(?:\bp\.?\s*\d+|\bpage\s+\d+)/i.test(text)
      || !/(?:table|fig(?:ure)?|curve|characteristics|section|heading|source-drain|electrical)/i.test(text)) {
    throw new Error(`${trail} citation must identify a datasheet page and table, figure, curve, or section: ${text}`);
  }
  return text;
}

function assertExactKeys(raw, required, optional, trail) {
  const keys = Object.keys(raw);
  for (const key of required) if (!Object.hasOwn(raw, key)) throw new Error(`${trail}.${key} is required`);
  const allowed = new Set([...required, ...optional]);
  for (const key of keys) if (!allowed.has(key)) throw new Error(`${trail}.${key} is not part of the frozen contract`);
}

function assertFinite(value, trail) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${trail} must be finite`);
  return number;
}

export function identityHash(value) {
  return canonicalIdentityHash(value);
}

function assertIdentityHash(raw, idField, trail, projection = null) {
  const claimed = raw[idField];
  if (!SHA256_ID.test(claimed)) throw new Error(`${trail}.${idField} must be sha256:<64 lowercase hex>`);
  const payload = projection ? projection(raw) : Object.fromEntries(Object.entries(raw).filter(([key]) => key !== idField));
  const expected = identityHash(payload);
  if (claimed !== expected) throw new Error(`${trail}.${idField} does not match canonical content`);
}

function assertVoltageCondition(raw, trail) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${trail} is required`);
  if (raw.kind === "fixed") {
    assertExactKeys(raw, ["kind", "value_v"], [], trail);
    assertFinite(raw.value_v, `${trail}.value_v`);
  } else if (raw.kind === "relation") {
    assertExactKeys(raw, ["kind", "relation"], [], trail);
    if (!["vds_equals_vgs", "vds_not_stated"].includes(raw.relation)) throw new Error(`${trail}.relation is invalid`);
  } else if (raw.kind === "range") {
    assertExactKeys(raw, ["kind", "lower_v", "upper_v"], [], trail);
    const lower = assertFinite(raw.lower_v, `${trail}.lower_v`);
    const upper = assertFinite(raw.upper_v, `${trail}.upper_v`);
    if (lower > upper) throw new Error(`${trail} range is reversed`);
  } else throw new Error(`${trail}.kind is invalid`);
  return structuredClone(raw);
}

function assertCurrentCondition(raw, trail) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${trail} is required`);
  if (raw.kind === "fixed") {
    assertExactKeys(raw, ["kind", "value_a"], [], trail);
    if (!(assertFinite(raw.value_a, `${trail}.value_a`) > 0)) throw new Error(`${trail}.value_a must be positive`);
  } else if (raw.kind === "range") {
    assertExactKeys(raw, ["kind", "lower_a", "upper_a"], [], trail);
    const lower = assertFinite(raw.lower_a, `${trail}.lower_a`);
    const upper = assertFinite(raw.upper_a, `${trail}.upper_a`);
    if (!(lower > 0) || lower > upper) throw new Error(`${trail} range must be positive and ordered`);
  } else throw new Error(`${trail}.kind is invalid`);
  return structuredClone(raw);
}

function assertAbsoluteCondition(condition, trail) {
  const numeric = Object.entries(condition).filter(([key]) => /^(?:value|lower|upper)_[va]$/.test(key));
  if (numeric.some(([, value]) => value < 0)) throw new Error(`${trail} must be nonnegative under absolute magnitude convention`);
}

export function normalizeMosfetConditionIdentity(raw, trail = "condition_identity") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${trail} is required`);
  assertExactKeys(raw, ["schema_version", "characteristic", "polarity", "magnitude_convention", "temperature", "electrical", "test_mode", "qualifiers", "condition_id"], [], trail);
  if (raw.schema_version !== "1.0.0") throw new Error(`${trail}.schema_version must be 1.0.0`);
  if (!["gate_threshold", "rds_on", "transfer_current", "output_current"].includes(raw.characteristic)) throw new Error(`${trail}.characteristic is invalid`);
  if (!["n", "p"].includes(raw.polarity)) throw new Error(`${trail}.polarity is invalid`);
  if (!["signed", "absolute"].includes(raw.magnitude_convention)) throw new Error(`${trail}.magnitude_convention is invalid`);
  assertIdentityHash(raw, "condition_id", trail);
  assertExactKeys(raw.temperature ?? {}, ["kind", "value_c"], [], `${trail}.temperature`);
  if (!["junction", "ambient", "case"].includes(raw.temperature.kind)) throw new Error(`${trail}.temperature.kind is invalid`);
  assertFinite(raw.temperature.value_c, `${trail}.temperature.value_c`);
  assertExactKeys(raw.electrical ?? {}, ["vgs", "vds", "id"], [], `${trail}.electrical`);
  const vgs = assertVoltageCondition(raw.electrical.vgs, `${trail}.electrical.vgs`);
  const vds = assertVoltageCondition(raw.electrical.vds, `${trail}.electrical.vds`);
  const id = assertCurrentCondition(raw.electrical.id, `${trail}.electrical.id`);
  if (raw.magnitude_convention === "absolute") {
    assertAbsoluteCondition(vgs, `${trail}.electrical.vgs`);
    assertAbsoluteCondition(vds, `${trail}.electrical.vds`);
    assertAbsoluteCondition(id, `${trail}.electrical.id`);
  }
  if (raw.characteristic === "transfer_current" && vds.kind !== "fixed") throw new Error(`${trail} transfer_current requires fixed VDS`);
  assertExactKeys(raw.test_mode ?? {}, ["kind"], ["pulse_width_s", "duty_cycle", "repetition_period_s", "repetition_frequency_hz"], `${trail}.test_mode`);
  if (!["dc", "continuous", "pulsed", "single_pulse"].includes(raw.test_mode.kind)) throw new Error(`${trail}.test_mode.kind is invalid`);
  for (const field of ["pulse_width_s", "duty_cycle", "repetition_period_s", "repetition_frequency_hz"]) {
    if (Object.hasOwn(raw.test_mode, field) && !(assertFinite(raw.test_mode[field], `${trail}.test_mode.${field}`) > 0)) throw new Error(`${trail}.test_mode.${field} must be positive`);
  }
  if (!Array.isArray(raw.qualifiers)) throw new Error(`${trail}.qualifiers must be an array`);
  const qualifierKeys = raw.qualifiers.map((qualifier, index) => {
    assertExactKeys(qualifier ?? {}, ["key", "value"], [], `${trail}.qualifiers[${index}]`);
    if (typeof qualifier.key !== "string" || !qualifier.key || typeof qualifier.value !== "string" || !qualifier.value) throw new Error(`${trail}.qualifiers[${index}] must contain non-empty strings`);
    return `${qualifier.key} ${qualifier.value}`;
  });
  if (new Set(qualifierKeys).size !== qualifierKeys.length || qualifierKeys.some((value, index) => index && value < qualifierKeys[index - 1])) {
    throw new Error(`${trail}.qualifiers must be sorted by key/value with no duplicate pairs`);
  }
  return { ...structuredClone(raw), electrical: { vgs, vds, id } };
}

export function normalizeMosfetCitationIdentity(raw, trail = "citation_identity") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${trail} is required`);
  const optional = ["source_revision", "section", "table", "row", "column", "figure", "curve", "trace"];
  assertExactKeys(raw, ["source_sha256", "page", "citation_id"], optional, trail);
  if (!SHA256_HEX.test(raw.source_sha256)) throw new Error(`${trail}.source_sha256 must be 64 lowercase hex`);
  if (!Number.isInteger(raw.page) || raw.page <= 0) throw new Error(`${trail}.page must be a positive integer`);
  assertIdentityHash(raw, "citation_id", trail);
  for (const field of optional) if (Object.hasOwn(raw, field) && (typeof raw[field] !== "string" || !raw[field].trim() || PLACEHOLDER_CITATION.test(raw[field].trim()))) throw new Error(`${trail}.${field} is invalid`);
  if (!(raw.table && raw.row) && !(raw.figure && (raw.curve || raw.trace))) throw new Error(`${trail} requires table+row or figure+(curve|trace)`);
  return structuredClone(raw);
}

export function normalizeMosfetEvidenceIdentity(raw, condition, citation, trail = "evidence_identity", { curve = false, characteristic = condition?.characteristic, quantity = null, valueSi = null, unitSi = null, point = null } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${trail} is required`);
  assertExactKeys(raw, ["evidence_id", "cohort_id", "role", "condition_id", "citation_id"], curve ? ["curve_id", "point_index"] : [], trail);
  if (!SHA256_ID.test(raw.cohort_id)) throw new Error(`${trail}.cohort_id must be sha256:<64 lowercase hex>`);
  if (!SHA256_ID.test(raw.evidence_id)) throw new Error(`${trail}.evidence_id must be sha256:<64 lowercase hex>`);
  if (!["minimum", "typical", "maximum", "digitized_typical_curve", "seed_only"].includes(raw.role)) throw new Error(`${trail}.role is invalid`);
  if (raw.condition_id !== condition.condition_id || raw.citation_id !== citation.citation_id) throw new Error(`${trail} contains hybrid condition or citation IDs`);
  if (curve) {
    if (!SHA256_ID.test(raw.curve_id)) throw new Error(`${trail}.curve_id must be sha256:<64 lowercase hex>`);
    if (!Number.isInteger(raw.point_index) || raw.point_index < 0) throw new Error(`${trail}.point_index must be a nonnegative integer`);
    const expectedCohort = identityHash(curveCohortMaterial(characteristic, condition.condition_id, citation.citation_id, raw.curve_id));
    if (raw.cohort_id !== expectedCohort) throw new Error(`${trail}.cohort_id does not match canonical curve membership`);
    if (point && raw.evidence_id !== identityHash(pointEvidenceMaterial(characteristic, point, raw))) throw new Error(`${trail}.evidence_id does not match canonical point content`);
  } else if (quantity != null) {
    const expectedCohort = identityHash(citationCohortMaterial(characteristic, condition.condition_id, citation));
    if (raw.cohort_id !== expectedCohort) throw new Error(`${trail}.cohort_id does not match canonical citation cohort`);
    if (raw.evidence_id !== identityHash(scalarEvidenceMaterial(characteristic, raw, quantity, valueSi, unitSi))) throw new Error(`${trail}.evidence_id does not match canonical scalar content`);
  }
  return structuredClone(raw);
}

function evidenceLinks(evidence, condition, citation = null) {
  const diodeProjection = condition.characteristic === "forward_voltage" && ["not_stated", "pulsed_limit"].includes(condition.test_mode.kind);
  const qualification = condition.test_mode.kind === "pulsed" || condition.test_mode.kind === "single_pulse"
    ? { test_mode: condition.test_mode.kind, pulse_width_s: condition.test_mode.pulse_width_s, ...(condition.test_mode.duty_cycle == null ? {} : { duty_cycle: condition.test_mode.duty_cycle }) }
    : diodeProjection && condition.test_mode.kind === "pulsed_limit"
      ? { test_mode: "pulsed_limit", ...(condition.test_mode.maximum_pulse_width_s == null ? {} : { maximum_pulse_width_s: condition.test_mode.maximum_pulse_width_s }), ...(condition.test_mode.maximum_duty_cycle == null ? {} : { maximum_duty_cycle: condition.test_mode.maximum_duty_cycle }) }
      : diodeProjection && condition.test_mode.kind === "not_stated"
        ? { test_mode: "not_stated" }
    : { test_mode: "continuous_dc" };
  const projected = diodeProjection;
  const locator = citation?.table
    ? { page: citation.page, table: citation.table, row: citation.row }
    : citation?.figure
      ? { page: citation.page, figure: citation.figure, ...(citation.curve ? { curve: citation.curve } : { trace: citation.trace }) }
      : null;
  return {
    evidence_id: evidence.evidence_id,
    condition_id: evidence.condition_id,
    citation_id: evidence.citation_id,
    cohort_id: evidence.cohort_id,
    bench_condition_id: condition.condition_id,
    evidence_role: evidence.role === "minimum" ? "inclusive_minimum" : evidence.role === "maximum" ? "inclusive_maximum" : evidence.role === "digitized_typical_curve" ? "curve_point" : "typical_observation",
    citation_locator: locator,
    evidence_qualification: qualification,
    bench_qualification: projected ? { test_mode: "continuous_dc" } : qualification,
    ...(projected ? { bench_equivalence_policy: "isothermal_diode_forward_projection" } : {}),
  };
}

export function normalizeMosfetCurve(raw, trail = "curve") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${trail} is required`);
  assertExactKeys(raw, ["curve_id", "characteristic", "x_axis", "y_axis", "condition_identity", "citation_identity", "points"], [], trail);
  if (!["transfer_current", "output_current"].includes(raw.characteristic)) throw new Error(`${trail}.characteristic is invalid`);
  assertExactKeys(raw.x_axis ?? {}, ["quantity", "unit"], [], `${trail}.x_axis`);
  const requiredX = raw.characteristic === "transfer_current" ? "vgs" : "vds";
  if (raw.x_axis.quantity !== requiredX || raw.x_axis.unit !== "V") throw new Error(`${trail}.x_axis must be ${requiredX} in V`);
  assertExactKeys(raw.y_axis ?? {}, ["quantity", "unit"], [], `${trail}.y_axis`);
  if (raw.y_axis.quantity !== "id" || raw.y_axis.unit !== "A") throw new Error(`${trail}.y_axis must be id in A`);
  const condition = normalizeMosfetConditionIdentity(raw.condition_identity, `${trail}.condition_identity`);
  const citation = normalizeMosfetCitationIdentity(raw.citation_identity, `${trail}.citation_identity`);
  if (condition.characteristic !== raw.characteristic) throw new Error(`${trail} characteristic disagrees with condition identity`);
  if (!Array.isArray(raw.points) || !raw.points.length) throw new Error(`${trail}.points must be non-empty`);
  const points = raw.points.map((point, index) => {
    assertExactKeys(point ?? {}, ["x_si", "y_si", "point_index", "evidence_identity"], [], `${trail}.points[${index}]`);
    const xSi = assertFinite(point.x_si, `${trail}.points[${index}].x_si`);
    const ySi = assertFinite(point.y_si, `${trail}.points[${index}].y_si`);
    if (point.point_index !== index) throw new Error(`${trail}.points must be ordered with contiguous point_index values`);
    if (point.evidence_identity?.curve_id !== raw.curve_id || point.evidence_identity?.point_index !== point.point_index) throw new Error(`${trail}.points[${index}] has hybrid curve identity`);
    if (point.evidence_identity?.role !== "digitized_typical_curve") throw new Error(`${trail}.points[${index}].evidence_identity.role must be digitized_typical_curve`);
    const evidence = normalizeMosfetEvidenceIdentity(point.evidence_identity, condition, citation, `${trail}.points[${index}].evidence_identity`, {
      curve: true,
      characteristic: raw.characteristic,
      point: { x_si: xSi, y_si: ySi, point_index: point.point_index }
    });
    return { x_si: xSi, y_si: ySi, point_index: point.point_index, evidence_identity: evidence };
  });
  assertIdentityHash(raw, "curve_id", trail, (curve) => curveIdentityMaterial(curve, condition.condition_id, citation.citation_id));
  return { ...structuredClone(raw), condition_identity: condition, citation_identity: citation, points };
}

function assertQuantityIdentity(quantity, trail, expected = {}) {
  if (!quantity || typeof quantity !== "object") throw new Error(`${trail} is required`);
  const condition = normalizeMosfetConditionIdentity(quantity.condition_identity, `${trail}.condition_identity`);
  const citation = normalizeMosfetCitationIdentity(quantity.citation_identity, `${trail}.citation_identity`);
  const evidence = normalizeMosfetEvidenceIdentity(quantity.evidence_identity, condition, citation, `${trail}.evidence_identity`, {
    characteristic: condition.characteristic,
    quantity: quantity.quantity,
    valueSi: quantity.value,
    unitSi: quantity.unit
  });
  realDatasheetCitation(quantity.page_reference, `${trail}.page_reference`);
  if (typeof quantity.quantity !== "string" || quantity.quantity !== expected.quantityLabel) throw new Error(`${trail}.quantity must be ${expected.quantityLabel}`);
  if (expected.characteristic && condition.characteristic !== expected.characteristic) throw new Error(`${trail} has the wrong characteristic`);
  if (expected.role && evidence.role !== expected.role) throw new Error(`${trail} has the wrong evidence role`);
  if (expected.vgs != null && (condition.electrical.vgs.kind !== "fixed" || !closeEnough(Math.abs(condition.electrical.vgs.value_v), expected.vgs))) throw new Error(`${trail} has hybrid VGS metadata`);
  if (expected.current != null && (condition.electrical.id.kind !== "fixed" || !closeEnough(Math.abs(condition.electrical.id.value_a), expected.current))) throw new Error(`${trail} has hybrid ID metadata`);
  if (expected.vds != null && (condition.electrical.vds.kind !== "fixed" || !closeEnough(Math.abs(condition.electrical.vds.value_v), expected.vds))) throw new Error(`${trail} has hybrid VDS metadata`);
  return { condition, citation, evidence, kind: "scalar", characteristic: condition.characteristic, quantity: quantity.quantity, valueSi: quantity.value, unitSi: quantity.unit };
}

function assertSamePointIdentity(identities, trail) {
  for (const identity of identities.slice(1)) {
    const sameCitationCohort = identity.evidence.cohort_id === identities[0].evidence.cohort_id;
    if (identity.condition.condition_id !== identities[0].condition.condition_id || !sameCitationCohort) {
      throw new Error(`${trail} contains hybrid condition, citation, or cohort metadata`);
    }
  }
  return identities[0];
}

function assertDcConditionIdentity(identity, trail) {
  if (!["dc", "continuous"].includes(identity.test_mode.kind)) {
    throw new Error(`${trail} is ${identity.test_mode.kind}-qualified and cannot be emitted as a continuous operating-point bench`);
  }
}

function evidenceTemperatureC(...values) {
  const text = values.filter(Boolean).map((value) => value?.conditions ?? value).join(" ");
  const temperatures = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:deg\s*c|degc|°c|\bc\b)/gi)]
    .map((match) => Number(match[1])).filter(Number.isFinite);
  if (!temperatures.length) return null;
  const first = temperatures[0];
  if (temperatures.some((value) => Math.abs(value - first) > 1e-9)) throw new Error(`Conflicting cited temperatures in MOSFET bench evidence: ${text}`);
  return first;
}

function conditionCurrentA(...values) {
  const text = values.filter(Boolean).map((value) => value?.conditions ?? value).join(" ").replaceAll("_", "");
  const currents = [...text.matchAll(/(?:I[D]|drain current)\|?\s*=\s*([0-9.eE+-]+)\s*(u|µ|μ|m)?A/gi)]
    .map((match) => Math.abs(Number(match[1])) * ({ u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3 }[match[2]?.toLowerCase()] ?? 1))
    .filter(Number.isFinite);
  if (!currents.length) return null;
  const first = currents[0];
  if (currents.some((value) => !closeEnough(value, first))) throw new Error(`Conflicting cited MOSFET currents: ${text}`);
  return first;
}

function conditionVoltageV(symbol, ...values) {
  const text = values.filter(Boolean).map((value) => value?.conditions ?? value).join(" ").replaceAll("_", "");
  const voltages = [...text.matchAll(new RegExp(`${symbol}\\s*=\\s*([0-9.eE+-]+)\\s*V`, "gi"))]
    .map((match) => Math.abs(Number(match[1]))).filter(Number.isFinite);
  if (!voltages.length) return null;
  const first = voltages[0];
  if (voltages.some((value) => !closeEnough(value, first))) throw new Error(`Conflicting cited MOSFET ${symbol} values: ${text}`);
  return first;
}

function legacyMosfetTemperature(facts, trail, ...values) {
  const cited = evidenceTemperatureC(...values);
  if (cited != null) return cited;
  const declared = facts.fit_conditions?.temperature;
  if (declared && Number.isFinite(Number(declared.value)) && declared.unit === "degC") return Number(declared.value);
  throw new Error(`${trail} requires an exact cited temperature; no 25 degC default is permitted`);
}

function criticalMosfetEvidence(facts) {
  const rows = [];
  for (const [index, point] of (facts.rdson_points ?? []).entries()) {
    const expectedLabels = {
      vgs: "vgs",
      current: "drain_current",
      resistance: point.resistance?.source_kind === "minimum" ? "rds_on_minimum" : point.resistance?.source_kind === "maximum" ? "rds_on_maximum" : "rds_on_typical"
    };
    rows.push(...["vgs", "current", "resistance"].map((field) => assertQuantityIdentity(point[field], `facts.rdson_points[${index}].${field}`, { characteristic: "rds_on", quantityLabel: expectedLabels[field] })));
  }
  for (const field of ["minimum", "typical", "maximum"]) {
    if (facts.threshold?.[field]) rows.push(assertQuantityIdentity(facts.threshold[field], `facts.threshold.${field}`, { characteristic: "gate_threshold", role: field, quantityLabel: `threshold_${field}` }));
  }
  const curves = (facts.curves ?? []).map((curve, index) => normalizeMosfetCurve(curve, `facts.curves[${index}]`));
  for (const curve of curves) {
    for (const point of curve.points) rows.push({ condition: curve.condition_identity, citation: curve.citation_identity, evidence: point.evidence_identity, kind: "point", characteristic: curve.characteristic, curve, point });
  }
  return { rows, curves };
}

function assertHeldDefaults(fitted, { allowF2DcHeldParameters = false } = {}) {
  const held = fitted.held_defaults ?? fitted.optimizer?.held_defaults ?? [];
  if (!Array.isArray(held)) throw new Error("fitted.held_defaults must be an array");
  const byParameter = new Map();
  for (const [index, item] of held.entries()) {
    const trail = `fitted.held_defaults[${index}]`;
    if (!item || typeof item !== "object") throw new Error(`${trail} must be an object`);
    const parameter = String(item.parameter ?? "").trim();
    const allowedF2DcHeldParameter = allowF2DcHeldParameters
      && /F2-DC.*output-characteristic family/i.test(String(item.reason ?? ""))
      && ((parameter === "LAMBDA" && closeEnough(item.value, 0.003))
        || (parameter === "RD" && closeEnough(item.value, 1e-6)));
    if (!parameter || (MOSFET_CRITICAL_PARAMETERS.has(parameter) && !allowedF2DcHeldParameter)
        || /(?:temp|threshold|drain.?current|vds)/i.test(parameter)) {
      throw new Error(`${trail} cannot hold a critical MOSFET condition or parameter default`);
    }
    if (!Number.isFinite(Number(item.value)) || typeof item.unit !== "string" || !item.unit.trim()
        || typeof item.reason !== "string" || !item.reason.trim() || PLACEHOLDER_CITATION.test(item.reason.trim())) {
      throw new Error(`${trail} must truthfully record parameter, finite value, unit, and reason`);
    }
    if (Object.hasOwn(fitted.parameters ?? {}, parameter) && !closeEnough(fitted.parameters[parameter], item.value)) {
      throw new Error(`${trail}.value disagrees with fitted.parameters.${parameter}`);
    }
    byParameter.set(parameter, item);
  }
  for (const [parameter, metadata] of Object.entries(fitted.parameter_metadata ?? {})) {
    if (/held(?:\s|_|-)*(?:default|constant)|physical default|catalog seed/i.test(String(metadata?.status ?? "")) && !byParameter.has(parameter)) {
      throw new Error(`fitted.parameter_metadata.${parameter} declares a held default without truthful held_defaults metadata`);
    }
  }
}

function assertCriticalFittedProvenance(fitted, packageEvidence) {
  const byEvidenceId = new Map(packageEvidence.map((row) => [row.evidence.evidence_id, row]));
  const observations = fitted.calibration?.observations ?? [];
  const constraints = fitted.calibration?.constraints ?? [];
  const residuals = fitted.residuals ?? [];
  const calibrationRecords = [...observations, ...constraints];
  const residualTargetCount = fitted.calibration?.residual_target_count;
  const sameCalibrationRecord = (left, right) =>
    left?.evidence_identity?.evidence_id === right?.evidence_identity?.evidence_id
    && left?.evidence_role === right?.evidence_role;
  if (!Number.isInteger(residualTargetCount) || residualTargetCount < 0) throw new Error("fitted.calibration.residual_target_count must be a non-negative integer");
  if (fitted.fidelity_tier === "F2") {
    const observationResidualCount = residuals.filter((residual) => observations.some((observation) => sameCalibrationRecord(observation, residual))).length;
    if (residualTargetCount !== observations.length) throw new Error("fitted.calibration.residual_target_count must equal the calibration observation count");
    if (residualTargetCount !== observationResidualCount) throw new Error("fitted.calibration.residual_target_count must equal the observation-linked residual row count");
  }
  for (const [index, residual] of residuals.entries()) {
    const trail = `fitted.residuals[${index}]`;
    const matches = calibrationRecords.filter((record) => sameCalibrationRecord(record, residual));
    if (matches.length !== 1) throw new Error(`${trail} must resolve exactly once to a declared calibration record`);
    const record = matches[0];
    for (const field of ["quantity", "gate_quantity", "datasheet_value", "unit", "evidence_role"]) {
      if (record[field] !== residual[field]) throw new Error(`${trail}.${field} disagrees with its declared calibration record`);
    }
    for (const [field, nested] of [["condition_identity", "condition_id"], ["citation_identity", "citation_id"], ["evidence_identity", "evidence_id"]]) {
      if (record[field]?.[nested] !== residual[field]?.[nested]) throw new Error(`${trail}.${field}.${nested} disagrees with its declared calibration record`);
    }
  }
  if (fitted.fidelity_tier === "F2") for (const [index, observation] of observations.entries()) {
    const matches = residuals.filter((residual) => sameCalibrationRecord(residual, observation));
    if (matches.length !== 1) throw new Error(`fitted.calibration.observations[${index}] must resolve exactly once to a residual row`);
  }
  const groups = [
    ["calibration.observations", fitted.calibration?.observations ?? []],
    ["calibration.constraints", fitted.calibration?.constraints ?? []],
    ["residuals", fitted.residuals ?? []]
  ];
  for (const [group, rows] of groups) for (const [index, row] of rows.entries()) {
    const trail = `fitted.${group}[${index}]`;
    const text = `${row.quantity ?? ""} ${row.kind ?? ""} ${row.parameter_coordinate ?? ""}`;
    if (!/(?:threshold|gate_threshold|rds|rdson|transfer current|output current|\bVTO\b)/i.test(text)) throw new Error(`${trail} uses a non-canonical critical MOSFET quantity label`);
    const linked = Array.isArray(row.evidence) && row.evidence.length ? row.evidence
      : Array.isArray(row.evidence_identities) && Array.isArray(row.citation_identities)
        ? row.evidence_identities.map((evidence_identity, evidenceIndex) => ({ condition_identity: row.condition_identity, citation_identity: row.citation_identities[evidenceIndex], evidence_identity }))
        : [{ condition_identity: row.condition_identity, citation_identity: row.citation_identity, evidence_identity: row.evidence_identity }];
    for (const [evidenceIndex, item] of linked.entries()) {
      const itemTrail = linked.length === 1 ? trail : `${trail}.evidence[${evidenceIndex}]`;
      const condition = normalizeMosfetConditionIdentity(item.condition_identity, `${itemTrail}.condition_identity`);
      const citation = normalizeMosfetCitationIdentity(item.citation_identity, `${itemTrail}.citation_identity`);
      const evidence = normalizeMosfetEvidenceIdentity(item.evidence_identity, condition, citation, `${itemTrail}.evidence_identity`, { curve: Object.hasOwn(item.evidence_identity ?? {}, "curve_id") });
      const packageRow = byEvidenceId.get(evidence.evidence_id);
      if (!packageRow || packageRow.condition.condition_id !== condition.condition_id || packageRow.citation.citation_id !== citation.citation_id) {
        throw new Error(`${itemTrail} does not resolve to package evidence`);
      }
      const expectedValue = packageRow.kind === "point" ? packageRow.point.y_si : packageRow.valueSi;
      const expectedUnit = packageRow.kind === "point" ? packageRow.curve.y_axis.unit : packageRow.unitSi;
      const expectedQuantity = packageRow.kind === "point" ? packageRow.curve.y_axis.quantity : packageRow.quantity;
      const itemValue = Object.hasOwn(item, "value_si") ? item.value_si : Object.hasOwn(item, "datasheet_value") ? item.datasheet_value : Object.hasOwn(item, "value") ? item.value : undefined;
      if (item.quantity != null && item.quantity !== expectedQuantity) throw new Error(`${itemTrail}.quantity disagrees with referenced evidence`);
      if (itemValue != null && !closeEnough(itemValue, expectedValue)) throw new Error(`${itemTrail}.datasheet value disagrees with referenced evidence`);
      if ((item.unit_si ?? item.unit) != null && (item.unit_si ?? item.unit) !== expectedUnit) throw new Error(`${itemTrail}.unit disagrees with referenced evidence`);
      const primary = item.evidence_identity?.evidence_id === row.evidence_identity?.evidence_id;
      if (primary) {
        const expectedGate = packageRow.characteristic === "rds_on" ? "rds_on"
          : ["transfer_current", "output_current"].includes(packageRow.characteristic) ? "drain_current"
            : packageRow.characteristic;
        if (row.datasheet_value != null && !closeEnough(row.datasheet_value, expectedValue)) throw new Error(`${trail}.datasheet_value disagrees with referenced evidence`);
        if (row.value != null && !closeEnough(row.value, expectedValue)) throw new Error(`${trail}.value disagrees with referenced evidence`);
        if (row.unit != null && row.unit !== expectedUnit) throw new Error(`${trail}.unit disagrees with referenced evidence`);
        if (row.gate_quantity != null && row.gate_quantity !== expectedGate) throw new Error(`${trail}.gate_quantity disagrees with referenced evidence quantity`);
        if (group === "residuals" && !Number.isFinite(Number(row.fitted_value))) throw new Error(`${trail}.fitted_value must declare the calibrated model observation`);
      }
    }
  }
}

function conditionDomain(condition, quantity, temperatureKind = null) {
  if (quantity === "temperature") return condition.temperature.kind === temperatureKind
    ? { minimum: condition.temperature.value_c, maximum: condition.temperature.value_c }
    : null;
  const electrical = condition.electrical[quantity];
  if (electrical.kind === "fixed") {
    const value = electrical[`value_${quantity === "id" ? "a" : "v"}`];
    return { minimum: value, maximum: value };
  }
  if (electrical.kind === "range") return {
    minimum: electrical[`lower_${quantity === "id" ? "a" : "v"}`],
    maximum: electrical[`upper_${quantity === "id" ? "a" : "v"}`]
  };
  if (electrical.kind === "enumerated") return { values: electrical.values };
  return null;
}

function conditionValues(condition, quantity, temperatureKind = null) {
  const domain = conditionDomain(condition, quantity, temperatureKind);
  if (!domain) return [];
  return domain.values ?? [domain.minimum, domain.maximum];
}

function assertMosfetRegionContract(region, packageEvidence) {
  if (!region || region.contract_version !== "1.0.0" || !Array.isArray(region.numeric_bounds) || !region.numeric_bounds.length) {
    throw new Error("MOSFET supported_operating_region must use contract_version 1.0.0 with numeric bounds");
  }
  const byEvidenceId = new Map(packageEvidence.map((row) => [row.evidence.evidence_id, row]));
  const representedQuantities = new Set();
  for (const [index, bound] of region.numeric_bounds.entries()) {
    representedQuantities.add(bound.quantity);
    const trail = `supported_operating_region.numeric_bounds[${index}]`;
    assertExactKeys(bound, ["bound_id", "quantity", "kind", "unit", "evidence_refs", "condition_ids", "citation_ids", "derivation"], ["minimum", "maximum", "values", "temperature_kind", "conditions", "placeholder"], trail);
    if (!["vgs", "vds", "id", "temperature"].includes(bound.quantity)) throw new Error(`${trail}.quantity is invalid`);
    if (!["minimum", "maximum", "range", "enumerated"].includes(bound.kind)) throw new Error(`${trail}.kind is invalid`);
    const expectedUnit = bound.quantity === "id" ? "A" : bound.quantity === "temperature" ? "degC" : "V";
    if (bound.unit !== expectedUnit) throw new Error(`${trail}.unit must be ${expectedUnit}`);
    if (!["direct_evidence_union", "direct_evidence_intersection"].includes(bound.derivation)) throw new Error(`${trail}.derivation is invalid`);
    if (bound.quantity === "temperature" && !["junction", "ambient", "case"].includes(bound.temperature_kind)) throw new Error(`${trail}.temperature_kind is required`);
    if (bound.kind === "enumerated") {
      if (!Array.isArray(bound.values) || !bound.values.length || bound.values.some((value) => !Number.isFinite(Number(value)))) throw new Error(`${trail}.values must be finite and non-empty`);
    } else {
      if (["minimum", "range"].includes(bound.kind)) assertFinite(bound.minimum, `${trail}.minimum`);
      if (["maximum", "range"].includes(bound.kind)) assertFinite(bound.maximum, `${trail}.maximum`);
      if (bound.kind === "range" && bound.minimum > bound.maximum) throw new Error(`${trail} range is reversed`);
    }
    if (!Array.isArray(bound.evidence_refs) || !bound.evidence_refs.length) throw new Error(`${trail}.evidence_refs must be non-empty`);
    const referenced = bound.evidence_refs.map((ref, refIndex) => {
      assertExactKeys(ref ?? {}, ["evidence_id", "condition_id", "citation_id", "cohort_id"], [], `${trail}.evidence_refs[${refIndex}]`);
      const resolved = byEvidenceId.get(ref.evidence_id);
      if (!resolved || resolved.condition.condition_id !== ref.condition_id || resolved.citation.citation_id !== ref.citation_id || resolved.evidence.cohort_id !== ref.cohort_id) {
        throw new Error(`${trail}.evidence_refs[${refIndex}] does not resolve to package evidence`);
      }
      return resolved;
    });
    const conditionIds = [...new Set(referenced.map((row) => row.condition.condition_id))].sort();
    const citationIds = [...new Set(referenced.map((row) => row.citation.citation_id))].sort();
    if (JSON.stringify(bound.condition_ids) !== JSON.stringify(conditionIds) || JSON.stringify(bound.citation_ids) !== JSON.stringify(citationIds)) throw new Error(`${trail} identity sets disagree with evidence_refs`);
    const evidenceDomains = referenced.map((row) => conditionDomain(row.condition, bound.quantity, bound.temperature_kind));
    const evidenceValues = evidenceDomains.filter(Boolean).flatMap((domain) => domain.values ?? [domain.minimum, domain.maximum]);
    const covers = (value) => bound.kind === "enumerated" ? bound.values.some((candidate) => closeEnough(candidate, value))
      : (bound.minimum == null || value >= bound.minimum - 1e-12) && (bound.maximum == null || value <= bound.maximum + 1e-12);
    if (bound.derivation === "direct_evidence_union" && evidenceValues.some((value) => !covers(value))) throw new Error(`${trail} omits referenced evidence values`);
    const unionErrors = directEvidenceUnionErrors(bound, evidenceValues, trail);
    if (unionErrors.length) throw new Error(unionErrors[0]);
    const intersectionErrors = directEvidenceIntersectionErrors(bound, evidenceDomains, trail);
    if (intersectionErrors.length) throw new Error(intersectionErrors[0]);
    assertIdentityHash(bound, "bound_id", trail, (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))));
  }
  const required = new Set(["vgs", "id", "temperature"]);
  if (packageEvidence.some((row) => conditionValues(row.condition, "vds").length)) required.add("vds");
  for (const quantity of required) if (!representedQuantities.has(quantity)) throw new Error(`MOSFET supported region is missing ${quantity} evidence coverage`);
}

export function assertMosfetConditionIdentityContract(ctx, facts, fitted) {
  const strict = ctx.part.pipeline === "vdmos" && facts?.evidence_contract_version === "1.0.0";
  if (!strict) return { strict: false, rows: [], curves: [] };
  const componentTier = ctx.part.component?.fidelity_tier;
  if (fitted?.fidelity_tier !== componentTier) throw new Error("MOSFET fitted.fidelity_tier must exactly equal component.fidelity_tier");
  const source = facts.source;
  if (!source || source.placeholder !== false || !SHA256_HEX.test(source.sha256) || !Array.isArray(source.pages_referenced) || !source.pages_referenced.length) {
    throw new Error("MOSFET package provenance requires a non-placeholder datasheet source with SHA-256 and cited pages");
  }
  assertHeldDefaults(fitted, { allowF2DcHeldParameters: ctx.part.component?.model_card_fidelity_tier === "F2-DC" });
  let datasheet = source;
  if (ctx.packageDir) {
    const sourcesPath = path.join(ctx.packageDir, "sources.json");
    const componentPath = path.join(ctx.packageDir, "component.json");
    if (fs.existsSync(sourcesPath) && fs.existsSync(componentPath)) {
      const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
      const component = JSON.parse(fs.readFileSync(componentPath, "utf8"));
      const componentUrl = component.datasheet?.url;
      const datasheets = sources.filter((candidate) => candidate.kind === "datasheet" && candidate.url === componentUrl);
      if (datasheets.length !== 1) throw new Error("MOSFET component datasheet URL must resolve exactly once in sources.json");
      datasheet = datasheets[0];
      if (component.datasheet?.revision !== datasheet.revision) throw new Error("MOSFET component datasheet revision disagrees with sources.json");
      if (source.url !== datasheet.url || source.sha256 !== datasheet.sha256 || source.revision !== datasheet.revision) {
        throw new Error("MOSFET facts.source URL, SHA-256, and revision must exactly match the selected sources.json datasheet");
      }
    }
  }
  const evidence = criticalMosfetEvidence(facts);
  if (!evidence.rows.length) throw new Error(`${ctx.part.slug} has no critical MOSFET condition identities`);
  if (evidence.rows.some((row) => row.citation.source_sha256 !== datasheet.sha256 || (row.citation.source_revision != null && row.citation.source_revision !== datasheet.revision))) {
    throw new Error("MOSFET citation identity must resolve to the same sources.json datasheet");
  }
  assertCriticalFittedProvenance(fitted, evidence.rows);
  if (fitted.fidelity_tier === "F2") {
    const summary = summarizeMosfetResiduals(fitted.residuals);
    if (!summary.worst || !Number.isFinite(summary.rms)) throw new Error("MOSFET F2 residual summary requires finite residuals");
    for (const [index, item] of summary.rows.entries()) if (!closeEnough(fitted.residuals[index].relative_error, item.relativeError)) throw new Error(`fitted.residuals[${index}].relative_error disagrees with recomputed residual`);
    if (!closeEnough(fitted.rms_relative_error ?? fitted.rms, summary.rms)) throw new Error("MOSFET F2 RMS disagrees with recomputed residuals");
    const declaredWorst = fitted.worst_relative_error ?? fitted.worst;
    if (!closeEnough(declaredWorst?.value, summary.worst.relativeError) || declaredWorst?.quantity !== summary.worst.row.quantity) throw new Error("MOSFET F2 worst quantity or value disagrees with recomputed residuals");
    const declaredGate = fitted.gate?.pass ?? fitted.f2_gate_pass;
    if (typeof declaredGate !== "boolean" || declaredGate !== summary.gatePass) throw new Error("MOSFET F2 declared gate result disagrees with recomputed 0.20 worst and 0.12 RMS gates");
    if (!summary.gatePass) throw new Error("MOSFET F2 residuals fail the 0.20 worst and 0.12 RMS gates");
  }
  assertMosfetRegionContract(ctx.part.component.supported_operating_region ?? {
    contract_version: ctx.part.component.operating_contract_version,
    numeric_bounds: ctx.part.component.numeric_bounds
  }, evidence.rows);
  return { strict: true, ...evidence };
}

function vdmosTestgen(ctx, model, facts, fitted) {
  const tests = [];
  const contract = assertMosfetConditionIdentityContract(ctx, facts, fitted);
  const strict = contract.strict;
  const pChannel = ctx.part.identity.electrical_family === "pmos";
  const signed = (value) => (pChannel ? -1 : 1) * Number(value);
  const currentSource = (name, node, current) => pChannel
    ? `${name} ${node} 0 DC ${formatSpice(current)}`
    : `${name} 0 ${node} DC ${formatSpice(current)}`;

  if (facts.rdson_points?.length) {
    const groups = new Map();
    for (const [index, point] of facts.rdson_points.entries()) {
      let identity = null;
      const temperature = strict
        ? (() => {
          const vgsIdentity = assertQuantityIdentity(point.vgs, `facts.rdson_points[${index}].vgs`, { characteristic: "rds_on", quantityLabel: "vgs", vgs: point.vgs.value, current: point.current.value });
          const currentIdentity = assertQuantityIdentity(point.current, `facts.rdson_points[${index}].current`, { characteristic: "rds_on", quantityLabel: "drain_current", vgs: point.vgs.value, current: point.current.value });
          const resistanceIdentity = assertQuantityIdentity(point.resistance, `facts.rdson_points[${index}].resistance`, { characteristic: "rds_on", quantityLabel: point.resistance.source_kind === "minimum" ? "rds_on_minimum" : point.resistance.source_kind === "maximum" ? "rds_on_maximum" : "rds_on_typical", vgs: point.vgs.value, current: point.current.value });
          assertSamePointIdentity([vgsIdentity, currentIdentity, resistanceIdentity], `facts.rdson_points[${index}]`);
          identity = resistanceIdentity;
          assertDcConditionIdentity(identity.condition, `facts.rdson_points[${index}]`);
          return identity.condition.temperature.value_c;
        })()
        : legacyMosfetTemperature(facts, `facts.rdson_points[${index}]`, point.vgs, point.current, point.resistance);
      const group = groups.get(temperature) ?? [];
      group.push({ point, identity });
      groups.set(temperature, group);
    }
    [...groups.entries()].forEach(([temperature, points], groupIndex) => {
      const benchName = groupIndex === 0 ? "rdson.cir" : `rdson-${groupIndex + 1}.cir`;
      const rdLines = [`OpenCircuit factory test: ${ctx.part.slug} RDS(on)`, model, `.temp ${Number(temperature)}`];
      const rdChecks = [];
      const rdHardChecks = [];
      points.forEach(({ point, identity }, index) => {
        const id = index + 1;
        rdLines.push(
          `M${id} d${id} g${id} 0 ${ctx.part.component.modelName}`,
          currentSource(`ID${id}`, `d${id}`, point.current.value),
          `VG${id} g${id} 0 DC ${formatSpice(signed(point.vgs.value))}`
        );
        const expression = `scale_abs:last(v(d${id}),${1 / point.current.value})`;
        const links = strict ? evidenceLinks(identity.evidence, identity.condition, identity.citation) : null;
        if (point.resistance.source_kind === "maximum") {
          rdHardChecks.push(hardBound(`rdson_maximum_${groupIndex + 1}_${id}`, expression, "ohm", { minimum: 0, maximum: point.resistance.value }, point.resistance.page_reference, links));
        } else if (point.resistance.source_kind === "minimum") {
          rdHardChecks.push(hardBound(`rdson_minimum_${groupIndex + 1}_${id}`, expression, "ohm", { minimum: point.resistance.value }, point.resistance.page_reference, links));
        } else {
          rdChecks.push(expectation(`rdson_${groupIndex + 1}_${id}`, expression, point.resistance.value, "ohm", 0, ctx.part.component.test_tolerances?.rds_on ?? 0.15, point.resistance.page_reference, links));
        }
      });
      rdLines.push(".op", ".end", "");
      writeBench(ctx, benchName, rdLines.join("\n"));
      tests.push(testRecord(benchName, "operating_point", rdChecks, rdHardChecks));
    });
  }

  if (facts.threshold) {
    const threshold = facts.threshold;
    const thresholdValues = [threshold.minimum, threshold.typical, threshold.maximum].filter(Boolean);
    if (!thresholdValues.length) throw new Error("MOSFET threshold has no cited values");
    let identity = null;
    let current;
    let temperature;
    if (strict) {
      const identities = thresholdValues.map((value, index) => assertQuantityIdentity(value, `facts.threshold.value[${index}]`, { characteristic: "gate_threshold", quantityLabel: `threshold_${value.source_kind}` }));
      identity = identities[0];
      if (identities.some((entry) => entry.condition.condition_id !== identity.condition.condition_id
          || entry.citation.citation_id !== identity.citation.citation_id
          || entry.evidence.cohort_id !== identity.evidence.cohort_id)) {
        throw new Error("facts.threshold contains hybrid condition, citation, or cohort metadata");
      }
      assertDcConditionIdentity(identity.condition, "facts.threshold");
      if (identity.condition.electrical.id.kind !== "fixed") throw new Error("MOSFET threshold bench requires exact fixed ID");
      if (identity.condition.electrical.vds.kind !== "relation" || identity.condition.electrical.vds.relation !== "vds_equals_vgs") throw new Error("MOSFET threshold bench requires VDS = VGS");
      current = identity.condition.electrical.id.value_a;
      temperature = identity.condition.temperature.value_c;
    } else {
      current = Number(threshold.test_current?.value);
      if (!(current > 0)) current = conditionCurrentA(...thresholdValues, threshold.test_current);
      if (!(current > 0)) throw new Error("MOSFET threshold bench requires cited test current; no 250 uA default is permitted");
      temperature = legacyMosfetTemperature(facts, "facts.threshold", ...thresholdValues, threshold.test_current);
    }
    const lines = [
      `OpenCircuit factory test: ${ctx.part.slug} threshold bounds`,
      model,
      `.temp ${Number(temperature)}`,
      `MTH d d 0 ${ctx.part.component.modelName}`,
      currentSource("ITH", "d", current),
      ".op",
      ".end",
      ""
    ];
    const scalarChecks = [];
    const hardChecks = [];
    const expression = "abs:last(v(d))";
    if (threshold.typical) {
      const typicalIdentity = strict ? assertQuantityIdentity(threshold.typical, "facts.threshold.typical", { characteristic: "gate_threshold", role: "typical", quantityLabel: "threshold_typical" }) : null;
      scalarChecks.push(expectation("gate_threshold_typical", expression, threshold.typical.value, "V", 0, ctx.part.component.test_tolerances?.threshold ?? 0.35, threshold.typical.page_reference, strict ? evidenceLinks(typicalIdentity.evidence, typicalIdentity.condition, typicalIdentity.citation) : null));
    }
    if (threshold.minimum) {
      const minimumIdentity = strict ? assertQuantityIdentity(threshold.minimum, "facts.threshold.minimum", { characteristic: "gate_threshold", role: "minimum", quantityLabel: "threshold_minimum" }) : null;
      hardChecks.push(hardBound("gate_threshold_minimum", expression, "V", { minimum: threshold.minimum.value }, threshold.minimum.page_reference, strict ? evidenceLinks(minimumIdentity.evidence, minimumIdentity.condition, minimumIdentity.citation) : null));
    }
    if (threshold.maximum) {
      const maximumIdentity = strict ? assertQuantityIdentity(threshold.maximum, "facts.threshold.maximum", { characteristic: "gate_threshold", role: "maximum", quantityLabel: "threshold_maximum" }) : null;
      hardChecks.push(hardBound("gate_threshold_maximum", expression, "V", { maximum: threshold.maximum.value }, threshold.maximum.page_reference, strict ? evidenceLinks(maximumIdentity.evidence, maximumIdentity.condition, maximumIdentity.citation) : null));
    }
    writeBench(ctx, "threshold.cir", lines.join("\n"));
    tests.push(testRecord("threshold.cir", "operating_point", scalarChecks, hardChecks));
  }

  const transferCurves = strict ? contract.curves.filter((curve) => curve.characteristic === "transfer_current") : [];
  if (strict && facts.transfer_points?.length) throw new Error("New-contract MOSFET transfer evidence must remain a validated curve object, not reconstructed point quantities");
  if (strict && facts.output_points?.length) throw new Error("New-contract MOSFET output evidence must remain a validated curve object, not reconstructed point quantities");
  if (transferCurves.length) {
    transferCurves.forEach((curve, curveIndex) => {
      const condition = curve.condition_identity;
      assertDcConditionIdentity(condition, `facts.curves transfer ${curveIndex}`);
      if (condition.electrical.vds.kind !== "fixed") throw new Error("Transfer curve bench requires exact fixed VDS");
      const vds = condition.electrical.vds.value_v;
      const transferLines = [`OpenCircuit factory test: ${ctx.part.slug} transfer curve ${curveIndex + 1}`, model, `.temp ${formatSpice(condition.temperature.value_c)}`];
      const transferChecks = [];
      curve.points.forEach((point, index) => {
        const id = index + 1;
        transferLines.push(
          `MT${id} dt${id} gt${id} 0 ${ctx.part.component.modelName}`,
          `VDT${id} dt${id} 0 DC ${formatSpice(signed(vds))}`,
          `VGT${id} gt${id} 0 DC ${formatSpice(signed(point.x_si))}`
        );
        transferChecks.push(expectation(`transfer_curve_${curveIndex + 1}_point_${point.point_index}`, `abs:last(i(vdt${id}))`, point.y_si, "A", 0, ctx.part.component.test_tolerances?.drain_current ?? 0.33, curve.citation_identity.figure ? `p. ${curve.citation_identity.page}, Figure ${curve.citation_identity.figure}, ${curve.citation_identity.curve ?? curve.citation_identity.trace}` : `p. ${curve.citation_identity.page}`, evidenceLinks(point.evidence_identity, condition, curve.citation_identity)));
      });
      transferLines.push(".op", ".end", "");
      const file = transferCurves.length === 1 ? "transfer_curve.cir" : `transfer_curve-${curveIndex + 1}.cir`;
      writeBench(ctx, file, transferLines.join("\n"));
      tests.push(testRecord(file, "operating_point", transferChecks));
    });
  } else if (facts.transfer_points?.length) {
    const transferLines = [`OpenCircuit factory test: ${ctx.part.slug} transfer`, model];
    const transferChecks = [];
    const temperatures = new Set();
    facts.transfer_points.forEach((point, index) => {
      const id = index + 1;
      const vds = Number(point.vds?.value ?? facts.transfer_vds?.value ?? conditionVoltageV("VDS", point.vgs, point.current));
      if (!(vds > 0)) throw new Error(`MOSFET transfer point ${index + 1} requires cited VDS; no 25 V default is permitted`);
      temperatures.add(legacyMosfetTemperature(facts, `facts.transfer_points[${index}]`, point.vgs, point.current, point.vds, facts.transfer_vds));
      transferLines.push(
        `MT${id} dt${id} gt${id} 0 ${ctx.part.component.modelName}`,
        `VDT${id} dt${id} 0 DC ${formatSpice(signed(vds))}`,
        `VGT${id} gt${id} 0 DC ${formatSpice(signed(point.vgs.value))}`
      );
      transferChecks.push(expectation(`transfer_${point.vgs.value}_v`, `abs:last(i(vdt${id}))`, point.current.value, "A", 0, ctx.part.component.test_tolerances?.drain_current ?? 0.33, point.current.page_reference));
    });
    if (temperatures.size !== 1) throw new Error("MOSFET transfer points with different temperatures require separate condition-identity curves");
    transferLines.splice(2, 0, `.temp ${formatSpice([...temperatures][0])}`);
    transferLines.push(".op", ".end", "");
    writeBench(ctx, "transfer_curve.cir", transferLines.join("\n"));
    tests.push(testRecord("transfer_curve.cir", "operating_point", transferChecks));
  }

  const outputCurves = strict ? contract.curves.filter((curve) => curve.characteristic === "output_current") : [];
  if (outputCurves.length) {
    outputCurves.forEach((curve, curveIndex) => {
      const condition = curve.condition_identity;
      assertDcConditionIdentity(condition, `facts.curves output ${curveIndex}`);
      if (condition.electrical.vgs.kind !== "fixed") throw new Error("Output curve bench requires exact fixed VGS");
      const outputLines = [`OpenCircuit factory test: ${ctx.part.slug} output curve ${curveIndex + 1}`, model, `.temp ${formatSpice(condition.temperature.value_c)}`];
      const outputChecks = [];
      curve.points.forEach((point, index) => {
        const id = index + 1;
        outputLines.push(
          `MO${id} do${id} go${id} 0 ${ctx.part.component.modelName}`,
          `VDO${id} do${id} 0 DC ${formatSpice(signed(point.x_si))}`,
          `VGO${id} go${id} 0 DC ${formatSpice(signed(condition.electrical.vgs.value_v))}`
        );
        outputChecks.push(expectation(`output_curve_${curveIndex + 1}_point_${point.point_index}`, `abs:last(i(vdo${id}))`, point.y_si, "A", 0, ctx.part.component.test_tolerances?.drain_current ?? 0.33, `p. ${curve.citation_identity.page}, Figure ${curve.citation_identity.figure}, ${curve.citation_identity.curve ?? curve.citation_identity.trace}`, evidenceLinks(point.evidence_identity, condition, curve.citation_identity)));
      });
      outputLines.push(".op", ".end", "");
      const file = outputCurves.length === 1 ? "output_curve.cir" : `output_curve-${curveIndex + 1}.cir`;
      writeBench(ctx, file, outputLines.join("\n"));
      tests.push(testRecord(file, "operating_point", outputChecks));
    });
  } else if (facts.output_points?.length) {
    const outputLines = [`OpenCircuit factory test: ${ctx.part.slug} output`, model];
    facts.output_points.forEach((point, index) => {
      const id = index + 1;
      outputLines.push(
        `MO${id} do${id} go${id} 0 ${ctx.part.component.modelName}`,
        `VDO${id} do${id} 0 DC ${formatSpice(signed(point.vds.value))}`,
        `VGO${id} go${id} 0 DC ${formatSpice(signed(point.vgs.value))}`
      );
    });
    outputLines.push(".op", ".end", "");
    writeBench(ctx, "output_curve.cir", outputLines.join("\n"));
    tests.push(testRecord("output_curve.cir", "operating_point"));
  }

  if (facts.gate_charge?.qg_at_5v) {
    writeBench(ctx, "gate_charge.cir", `OpenCircuit factory test: ${ctx.part.slug} gate charge\n${model}\nM1 d g 0 ${ctx.part.component.modelName}\nIG 0 g PULSE(0 0.01 1n 0.1n 0.1n 20u 40u)\nRGDC g 0 1G\nIL vsup d DC 25\nVSUP vsup 0 DC 44\n.ic v(g)=0\n.tran 1n 10u\n.end\n`);
    tests.push(testRecord("gate_charge.cir", "transient", [expectation("gate_charge_at_5v", "charge_at_voltage(v(g),5,0.01)", facts.gate_charge.qg_at_5v.value, "C", 0, 0.75, facts.gate_charge.qg_at_5v.page_reference)]));
  }

  if (facts.capacitances?.coss && facts.capacitances?.crss && facts.capacitances?.vds_test) {
    const caps = facts.capacitances;
    writeBench(ctx, "capacitance.cir", `OpenCircuit factory test: ${ctx.part.slug} capacitance\n${model}\nM1 d g 0 ${ctx.part.component.modelName}\nVD d 0 DC ${formatSpice(signed(caps.vds_test.value))} AC 1\nVG g 0 DC 0\n.ac lin 1 1Meg 1Meg\n.end\n`);
    tests.push(testRecord("capacitance.cir", "ac_small_signal", [
      expectation("coss", "imag_cap:last(i(vd),1000000)", caps.coss.value, "F", 0, 0.20, caps.coss.page_reference),
      expectation("crss", "imag_cap:last(i(vg),1000000)", caps.crss.value, "F", 0, 0.35, caps.crss.page_reference)
    ]));
  }

  if (facts.body_diode?.current && facts.body_diode?.vsd) {
    writeBench(ctx, "body_diode.cir", `OpenCircuit factory test: ${ctx.part.slug} body diode\n${model}\nM1 d g 0 ${ctx.part.component.modelName}\nISD d 0 DC ${facts.body_diode.current.value}\nVG g 0 DC 0\n.op\n.end\n`);
    tests.push(testRecord("body_diode.cir", "operating_point", [expectation("body_diode_forward_voltage", "abs:last(v(d))", facts.body_diode.vsd.value, "V", 0.05, 0.10, facts.body_diode.vsd.page_reference)]));
  }

  if (!tests.length) throw new Error(`${ctx.part.slug} has no extracted VDMOS targets for bench generation`);
  return tests;
}

function opampTestgen(ctx, model, facts) {
  const p = facts.parameters;
  const swing = p.output_swing.typical_25c;
  const minimumSupply = p.supply_voltage_total.minimum;
  const minimumRail = minimumSupply.value / 2;
  const tests = [];
  fs.rmSync(path.join(ctx.packageDir, "tests", "negative_swing.cir"), { force: true });

  writeBench(ctx, "open_loop_gain.cir", `OpenCircuit factory test: ${ctx.part.slug} open-loop DC-servo\n${model}\n.temp 25\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nVIN sig 0 DC 0 AC 1\nX1 sig inn vcc vee out ${ctx.part.component.modelName}\nLSERVO out inn 1G\nCSERVO inn 0 1G\nRL out 0 2k\n.ac dec 40 0.01 300Meg\n.end\n`);
  tests.push(testRecord("open_loop_gain.cir", "ac_small_signal", [
    expectation("open_loop_gain_db", "db:first(v(out))", 20 * Math.log10(p.aol.value), "dB", 0.6, 0, p.aol.page_reference),
    expectation("unity_gain_bandwidth", "frequency_at_magnitude(v(out),1)", p.gbw.value, "Hz", 0, 0.20, p.gbw.page_reference)
  ]));

  writeBench(ctx, "offset_and_bias.cir", `OpenCircuit factory test: ${ctx.part.slug} offset and bias\n${model}\n.temp 25\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nX1 p1 n1 vcc vee out1 ${ctx.part.component.modelName}\nVP1 p1 0 DC 0\nVN1 n1 0 DC 0\nRL1 out1 0 2k\nX2 sig2 inn2 vcc vee out2 ${ctx.part.component.modelName}\nVS2 sig2 0 DC 0\nRF2 out2 inn2 9k\nRG2 inn2 0 1k\nRL2 out2 0 2k\n.op\n.end\n`);
  tests.push(testRecord("offset_and_bias.cir", "operating_point", [
    expectation("input_offset", "scale:last(v(out2),0.1)", p.vos.value, "V", 1e-4, ctx.part.component.fidelity_tier === "F1" ? 2.0 : 0.05, p.vos.page_reference),
    expectation("input_bias_positive", "abs:last(i(vp1))", p.ibias.value + p.ios.value / 2, "A", 1e-13, 0.05, p.ibias.page_reference),
    expectation("input_bias_negative", "abs:last(i(vn1))", p.ibias.value - p.ios.value / 2, "A", 1e-13, 0.05, p.ibias.page_reference)
  ]));

  writeBench(ctx, "slew_and_swing.cir", `OpenCircuit factory test: ${ctx.part.slug} positive slew\n${model}\n.temp 25\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nVIN sig 0 PULSE(0 14 1u 1n 1n 5u 12u)\nX1 sig out vcc vee out ${ctx.part.component.modelName}\nRL out 0 2k\n.tran 2n 8u\n.end\n`);
  tests.push(testRecord("slew_and_swing.cir", "transient", [
    expectation("rising_slew", "slew(v(out),2,7,rising)", p.sr.value, "V/s", 0, 0.15, p.sr.page_reference)
  ]));

  writeBench(ctx, "output_swing.cir", `OpenCircuit factory test: ${ctx.part.slug} 25 degC typical output swing\n${model}\n.temp 25\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nVPOS pos 0 DC 14\nXPOS pos outp vcc vee outp ${ctx.part.component.modelName}\nRLP outp 0 10k\nVNEG neg 0 DC -14\nXNEG neg outn vcc vee outn ${ctx.part.component.modelName}\nRLN outn 0 10k\n.op\n.end\n`);
  tests.push(testRecord("output_swing.cir", "operating_point", [
    expectation("positive_swing_typical_25c", "last(v(outp))", swing.value, "V", 0.1, 0.05, swing.page_reference),
    expectation("negative_swing_typical_25c", "last(v(outn))", -swing.value, "V", 0.1, 0.05, swing.page_reference)
  ]));

  writeBench(ctx, "minimum_supply_follower.cir", `OpenCircuit factory test: ${ctx.part.slug} minimum rated supply follower\n${model}\n.temp 25\nVCC vcc 0 DC ${formatSpice(minimumRail)}\nVEE vee 0 DC ${formatSpice(-minimumRail)}\nVINN inn_sig 0 DC -0.25\nXN inn_sig outn vcc vee outn ${ctx.part.component.modelName}\nRLN outn 0 10k\nVINZ zero_sig 0 DC 0\nXZ zero_sig outz vcc vee outz ${ctx.part.component.modelName}\nRLZ outz 0 10k\nVINP inp_sig 0 DC 0.25\nXP inp_sig outp vcc vee outp ${ctx.part.component.modelName}\nRLP outp 0 10k\n.op\n.end\n`);
  const boundaryCitation = `${minimumSupply.page_reference}; ${p.vos.page_reference}`;
  tests.push(testRecord("minimum_supply_follower.cir", "operating_point", [
    expectation("minimum_supply_follow_negative", "last(v(outn))", -0.25 + p.vos.value, "V", 0.01, 0.02, boundaryCitation),
    expectation("minimum_supply_follow_zero", "last(v(outz))", p.vos.value, "V", 0.01, 0.02, boundaryCitation),
    expectation("minimum_supply_follow_positive", "last(v(outp))", 0.25 + p.vos.value, "V", 0.01, 0.02, boundaryCitation)
  ]));

  writeBench(ctx, "short_circuit.cir", `OpenCircuit factory test: ${ctx.part.slug} short circuit\n${model}\n.temp 25\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nVIN sig 0 DC 7.5\nX1 sig inn vcc vee out ${ctx.part.component.modelName}\nRF out inn 1Meg\nVSHORT out 0 DC 0\n.op\n.end\n`);
  tests.push(testRecord("short_circuit.cir", "operating_point", [expectation("short_circuit_current", "abs:last(i(vshort))", p.ilim.value, "A", 0, 0.10, p.ilim.page_reference)]));

  writeBench(ctx, "cmrr.cir", `OpenCircuit factory test: ${ctx.part.slug} CMRR\n${model}\n.temp 25\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nVCM sig 0 DC 0 AC 1\nX1 sig inn vcc vee out ${ctx.part.component.modelName}\nLSERVO out inn 1G\nCSERVO inn sig 1G\nRL out 0 2k\n.ac lin 1 0.01 0.01\n.end\n`);
  tests.push(testRecord("cmrr.cir", "ac_small_signal", [expectation("common_mode_gain", "magnitude:last(v(out))", p.aol.value / (10 ** (p.cmrr_db.value / 20)), "V/V", 0, 0.30, p.cmrr_db.page_reference)]));
  return tests;
}

function specialtyTestgen(ctx, model, facts) {
  const tests = [];
  const variant = facts.specialty_variant;
  if (variant === "lm386_audio_power_amp") {
    const p = facts.parameters;
    const gainLines = [`OpenCircuit factory test: ${ctx.part.slug} cited gain-frequency curve`, model, "VS vs 0 DC 6", "VIN inp 0 DC 0 AC 1", `X1 g1 0 inp 0 out vs bypass g8 ${ctx.part.component.modelName}`, "RLOAD out 0 10k", ".ac dec 40 100 3Meg", ".end", ""];
    writeBench(ctx, "gain_frequency.cir", gainLines.join("\n"));
    tests.push(testRecord("gain_frequency.cir", "ac_small_signal", facts.gain_frequency_points.map((point, index) => expectation(`gain_curve_${index + 1}`, `at_abs(v(out),frequency,${point.frequency.value})`, point.gain.value, "V/V", 0, 0.18, point.gain.page_reference))));

    writeBench(ctx, "gain_200.cir", `OpenCircuit factory test: ${ctx.part.slug} parameterized 200 gain mode\n${model}\nVS vs 0 DC 6\nVIN inp 0 DC 0 AC 1\nX1 g1 0 inp 0 out vs bypass g8 ${ctx.part.component.modelName} GAIN_CL=200\nRLOAD out 0 10k\n.ac lin 1 1000 1000\n.end\n`);
    tests.push(testRecord("gain_200.cir", "ac_small_signal", [expectation("gain_200_mode", "magnitude:last(v(out))", p.gain_bypassed.value, "V/V", 0, 0.05, p.gain_bypassed.page_reference)]));

    writeBench(ctx, "quiescent_and_bias.cir", `OpenCircuit factory test: ${ctx.part.slug} quiescent current and input bias\n${model}\nVS vs 0 DC 6\nVINP inp 0 DC 0\nVINN inn 0 DC 0\nX1 g1 inn inp 0 out vs bypass g8 ${ctx.part.component.modelName}\nRLOAD out 0 10k\n.op\n.end\n`);
    tests.push(testRecord("quiescent_and_bias.cir", "operating_point", [
      expectation("quiescent_supply_current", "abs:last(i(vs))", p.quiescent_current.typical.value, "A", 0, 0.12, p.quiescent_current.typical.page_reference),
      expectation("positive_input_bias", "abs:last(i(vinp))", p.input_bias_current.value, "A", 20e-9, 0.10, p.input_bias_current.page_reference),
      expectation("negative_input_bias", "abs:last(i(vinn))", p.input_bias_current.value, "A", 20e-9, 0.10, p.input_bias_current.page_reference)
    ], [hardBound("quiescent_supply_current_maximum", "abs:last(i(vs))", "A", { minimum: 0, maximum: p.quiescent_current.maximum.value }, p.quiescent_current.maximum.page_reference)]));

    const swingLines = [`OpenCircuit factory test: ${ctx.part.slug} cited output-swing curve`, model];
    const swingChecks = [];
    facts.output_swing_curve.forEach((point, index) => {
      const id = index + 1;
      const supply = point.supply_voltage.value;
      swingLines.push(`VS${id} vs${id} 0 DC ${supply}`, `VM${id} mid${id} 0 DC ${supply / 2}`, `VIN${id} inp${id} 0 DC 1`, `X${id} g1_${id} 0 inp${id} 0 out${id} vs${id} byp${id} g8_${id} ${ctx.part.component.modelName}`, `RL${id} out${id} mid${id} ${point.load_resistance.value}`);
      swingChecks.push(expectation(`output_swing_${supply}_v_supply`, `affine:last(v(out${id}),2,${-supply})`, point.output_voltage_pp.value, "Vpp", 0.15, 0.12, point.output_voltage_pp.page_reference));
    });
    swingLines.push(".op", ".end", "");
    writeBench(ctx, "output_swing_curve.cir", swingLines.join("\n"));
    tests.push(testRecord("output_swing_curve.cir", "operating_point", swingChecks));

    writeBench(ctx, "minimum_supply.cir", `OpenCircuit factory test: ${ctx.part.slug} minimum supply boundary\n${model}\nVS vs 0 DC ${p.supply_voltage.minimum.value}\nX1 g1 0 0 0 out vs bypass g8 ${ctx.part.component.modelName}\nRLOAD out 0 10k\n.op\n.end\n`);
    tests.push(testRecord("minimum_supply.cir", "operating_point", [expectation("minimum_supply_output_bias", "last(v(out))", p.supply_voltage.minimum.value / 2, "V", 0.05, 0.03, p.supply_voltage.minimum.page_reference)]));

    writeBench(ctx, "transient_response.cir", `OpenCircuit factory test: ${ctx.part.slug} transient response\n${model}\nVS vs 0 DC 6\nVIN inp 0 PULSE(0 0.1 1u 1n 1n 20u 40u)\nX1 g1 0 inp 0 out vs bypass g8 ${ctx.part.component.modelName}\nRLOAD out 0 10k\n.tran 20n 25u\n.end\n`);
    tests.push(testRecord("transient_response.cir", "transient", [expectation("settled_step_output", "at(v(out),0.00002)", 5, "V", 0.1, 0.03, p.gain_open.page_reference)]));
    return tests;
  }

  if (variant === "lm13700_dual_ota") {
    const p = facts.parameters;
    const gmLines = [`OpenCircuit factory test: ${ctx.part.slug} cited transconductance curve`, model, "VCC vcc 0 DC 15", "VEE vee 0 DC -15"];
    const gmChecks = [];
    facts.transconductance_curve.forEach((point, index) => {
      const id = index + 1;
      gmLines.push(`IABC${id} vcc abc${id} DC ${point.amplifier_bias_current.value}`, `VIN${id} inp${id} 0 DC 0 AC 1m`, `VNN${id} inn${id} 0 DC 0`, `VOUT${id} out${id} 0 DC 0`, `X${id} abc${id} d1_${id} inp${id} inn${id} out${id} vee bi1_${id} bo1_${id} bo2_${id} bi2_${id} vcc o2_${id} n2_${id} p2_${id} d2_${id} a2_${id} ${ctx.part.component.modelName}`);
      gmChecks.push(expectation(`transconductance_${id}`, `scale_abs:last(i(vout${id}),1000)`, point.transconductance.value, "S", 0, 0.12, point.transconductance.page_reference));
    });
    gmLines.push(".ac lin 1 10 10", ".end", "");
    writeBench(ctx, "transconductance_curve.cir", gmLines.join("\n"));
    tests.push(testRecord("transconductance_curve.cir", "ac_small_signal", gmChecks));

    const biasLines = [`OpenCircuit factory test: ${ctx.part.slug} cited amplifier-bias voltage curve`, model, "VCC vcc 0 DC 15", "VEE vee 0 DC -15"];
    const biasChecks = [];
    facts.transconductance_curve.forEach((point, index) => {
      const id = index + 1;
      biasLines.push(`IABC${id} vcc abc${id} DC ${point.amplifier_bias_current.value}`, `X${id} abc${id} d1_${id} p1_${id} n1_${id} o1_${id} vee bi1_${id} bo1_${id} bo2_${id} bi2_${id} vcc o2_${id} n2_${id} p2_${id} d2_${id} a2_${id} ${ctx.part.component.modelName}`);
      biasChecks.push(expectation(`bias_pin_voltage_${id}`, `last(v(abc${id}))`, -15 + point.bias_pin_voltage.value, "V", 0.04, 0.05, point.bias_pin_voltage.page_reference));
    });
    biasLines.push(".op", ".end", "");
    writeBench(ctx, "amplifier_bias_curve.cir", biasLines.join("\n"));
    tests.push(testRecord("amplifier_bias_curve.cir", "operating_point", biasChecks));

    const gmTypical = p.forward_transconductance.typical.value;
    writeBench(ctx, "bandwidth.cir", `OpenCircuit factory test: ${ctx.part.slug} open-loop bandwidth\n${model}\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nIABC vcc abc DC 500u\nVIN inp 0 DC 0 AC 1\nVNN inn 0 DC 0\nVOUT out 0 DC 0\nX1 abc d1 inp inn out vee bi1 bo1 bo2 bi2 vcc o2 n2 p2 d2 a2 ${ctx.part.component.modelName}\n.ac dec 40 10 20Meg\n.end\n`);
    tests.push(testRecord("bandwidth.cir", "ac_small_signal", [expectation("open_loop_bandwidth", `frequency_at_magnitude(i(vout),${gmTypical / Math.sqrt(2)})`, p.open_loop_bandwidth.value, "Hz", 0, 0.15, p.open_loop_bandwidth.page_reference)]));

    writeBench(ctx, "peak_output_current.cir", `OpenCircuit factory test: ${ctx.part.slug} peak OTA output current\n${model}\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nIABC vcc abc DC 500u\nVIN inp 0 DC 1\nVNN inn 0 DC 0\nVOUT out 0 DC 0\nX1 abc d1 inp inn out vee bi1 bo1 bo2 bi2 vcc o2 n2 p2 d2 a2 ${ctx.part.component.modelName}\n.op\n.end\n`);
    tests.push(testRecord("peak_output_current.cir", "operating_point", [expectation("peak_output_current_typical", "abs:last(i(vout))", p.peak_output_current.typical.value, "A", 0, 0.08, p.peak_output_current.typical.page_reference)], [hardBound("peak_output_current_bounds", "abs:last(i(vout))", "A", { minimum: p.peak_output_current.minimum.value, maximum: p.peak_output_current.maximum.value }, `${p.peak_output_current.minimum.page_reference}; ${p.peak_output_current.maximum.page_reference}`)]));

    writeBench(ctx, "input_resistance.cir", `OpenCircuit factory test: ${ctx.part.slug} differential input resistance\n${model}\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nIABC vcc abc DC 500u\nVIN inp 0 DC 0 AC 1\nVNN inn 0 DC 0\nX1 abc d1 inp inn out vee bi1 bo1 bo2 bi2 vcc o2 n2 p2 d2 a2 ${ctx.part.component.modelName}\n.ac lin 1 1000 1000\n.end\n`);
    tests.push(testRecord("input_resistance.cir", "ac_small_signal", [expectation("differential_input_conductance", "magnitude:last(i(vin))", 1 / p.input_resistance.typical.value, "S", 0, 0.08, p.input_resistance.typical.page_reference)], [hardBound("input_resistance_minimum_conductance", "magnitude:last(i(vin))", "S", { minimum: 0, maximum: 1 / p.input_resistance.minimum.value }, p.input_resistance.minimum.page_reference)]));

    writeBench(ctx, "buffer_output.cir", `OpenCircuit factory test: ${ctx.part.slug} Darlington buffer output\n${model}\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nIABC1 vcc a1 DC 500u\nIABC2 vcc a2 DC 500u\nVBUF bi1 0 DC 12\nRLOAD bo1 vee 5k\nX1 a1 d1 p1 n1 o1 vee bi1 bo1 bo2 bi2 vcc o2 n2 p2 d2 a2 ${ctx.part.component.modelName}\n.op\n.end\n`);
    tests.push(testRecord("buffer_output.cir", "operating_point", [], [hardBound("buffer_output_voltage_minimum", "last(v(bo1))", "V", { minimum: p.peak_buffer_output_voltage_minimum.value }, p.peak_buffer_output_voltage_minimum.page_reference)]));

    writeBench(ctx, "transient_control.cir", `OpenCircuit factory test: ${ctx.part.slug} current-controlled transient\n${model}\nVCC vcc 0 DC 15\nVEE vee 0 DC -15\nIABC vcc abc PULSE(10u 500u 1u 10n 10n 20u 40u)\nVIN inp 0 DC 10m\nVNN inn 0 DC 0\nX1 abc d1 inp inn out vee bi1 bo1 bo2 bi2 vcc o2 n2 p2 d2 a2 ${ctx.part.component.modelName}\nRLOAD out 0 5k\n.tran 20n 25u\n.end\n`);
    tests.push(testRecord("transient_control.cir", "transient", [], [hardBound("controlled_output_after_bias_step", "at(v(out),0.00002)", "V", { minimum: 0.35, maximum: 0.65 }, facts.transconductance_curve[3].transconductance.page_reference)]));
    return tests;
  }
  throw new Error(`Unsupported specialty analog variant: ${variant}`);
}

function sensorTestgen(ctx, model, facts) {
  const tests = [];
  const variant = facts.sensor_variant;
  facts.transfer_points.forEach((point, index) => {
    const id = index + 1;
    const file = `transfer_${String(id).padStart(2, "0")}.cir`;
    let bench;
    let expression;
    if (variant === "linear_voltage") {
      bench = `OpenCircuit factory test: ${ctx.part.slug} transfer at ${point.environment.value} degC\n${model}\nVS vs 0 DC 5\nX1 vs out 0 ${ctx.part.component.modelName} TEMP_C=${formatSpice(point.environment.value)}\nRLOAD out 0 10k\n.op\n.end\n`;
      expression = "last(v(out))";
    } else {
      const parameter = variant === "beta_ntc" ? `TEMP_C=${formatSpice(point.environment.value)}` : `LUX=${formatSpice(point.environment.value)}`;
      bench = `OpenCircuit factory test: ${ctx.part.slug} transfer at ${point.environment.value} ${point.environment.unit}\n${model}\nITEST 0 sense DC 1u\nX1 sense 0 ${ctx.part.component.modelName} ${parameter}\nRALL all 0 1G\n.op\n.end\n`;
      expression = "scale:last(v(sense),1000000)";
    }
    writeBench(ctx, file, bench);
    const target = point.electrical;
    if (target.source_kind === "maximum") {
      tests.push(testRecord(file, "operating_point", [], [hardBound(`transfer_maximum_${id}`, expression, target.unit, { minimum: 0, maximum: target.value }, target.page_reference)]));
    } else if (target.source_kind === "minimum") {
      tests.push(testRecord(file, "operating_point", [], [hardBound(`transfer_minimum_${id}`, expression, target.unit, { minimum: target.value }, target.page_reference)]));
    } else {
      const relativeTolerance = variant === "linear_voltage" ? 0.02 : variant === "beta_ntc" ? 0.16 : 0.08;
      tests.push(testRecord(file, "operating_point", [expectation(`transfer_${id}`, expression, target.value, target.unit, variant === "linear_voltage" ? 0.005 : 0, relativeTolerance, target.page_reference)]));
    }
  });
  return tests;
}

export function stageTestgen(ctx) {
  const modelPath = path.join(ctx.packageDir, "model.cir");
  const factsPath = path.join(ctx.packageDir, "facts.json");
  requireFile(modelPath, "testgen");
  requireFile(factsPath, "testgen");
  const model = fs.readFileSync(modelPath, "utf8");
  const facts = JSON.parse(fs.readFileSync(factsPath, "utf8"));
  let tests = [];
  ensureDirectory(path.join(ctx.packageDir, "tests"));

  if (["bjt", "darlington", "sibling_alias"].includes(ctx.part.pipeline)) tests = bjtTestgen(ctx, model, facts);
  else if (ctx.part.pipeline === "vdmos") {
    const fittedPath = path.join(ctx.packageDir, "fitted.json");
    requireFile(fittedPath, "testgen VDMOS provenance");
    tests = vdmosTestgen(ctx, model, facts, JSON.parse(fs.readFileSync(fittedPath, "utf8")));
  }
  else if (ctx.part.pipeline === "opamp") tests = opampTestgen(ctx, model, facts);
  else if (ctx.part.pipeline === "specialty_analog") tests = specialtyTestgen(ctx, model, facts);
  else if (ctx.part.pipeline === "sensor_behavioral") tests = sensorTestgen(ctx, model, facts);
  // The diode archetype falls through to the forward-bench generator below. Every
  // other archetype has already produced its benches above.
  if (ctx.part.pipeline && ctx.part.pipeline !== "diode") {
    const strictEvidence = ctx.part.pipeline === "vdmos" && facts.evidence_contract_version === "1.0.0";
    const linkedChecks = tests.flatMap((entry) => [...(entry.scalar_checks ?? []), ...(entry.hard_bounds_checks ?? [])]).filter((check) => check.evidence_id);
    const evidenceCohorts = [...new Map(linkedChecks.map((check) => [check.cohort_id, {
      cohort_id: check.cohort_id,
      fidelity_tier: ctx.part.component.fidelity_tier ?? "F2",
      evidence_ids: linkedChecks.filter((candidate) => candidate.cohort_id === check.cohort_id).map((candidate) => candidate.evidence_id).filter((value, index, values) => values.indexOf(value) === index),
    }])).values()];
    writeJson(path.join(ctx.packageDir, "tests", "expectations.json"), {
      schema_version: "1.0.0",
      ...(strictEvidence ? { evidence_contract_version: "1.0.0", evidence_cohorts: evidenceCohorts } : {}),
      tests,
    });
    console.log(`testgen ${ctx.part.slug}: ${tests.length} benches`);
    return;
  }

  const strictDiodeEvidence = facts.evidence_contract_version === "1.0.0" && Array.isArray(facts.forward_voltage_points);
  const forwardRows = strictDiodeEvidence
    ? strictDiodeForwardRows(facts, ctx.part.component.fidelity_tier)
    : facts.fit_points.map((point) => ({
      current: point.current.value,
      voltage: point.voltage.value,
      role: point.voltage.source_kind,
      pageReference: point.voltage.page_reference,
    }));
  forwardRows.forEach((row, index) => {
    const file = `forward_${String(index + 1).padStart(2, "0")}.cir`;
    const bench = strictDiodeEvidence
      ? strictDiodeForwardBench(model, ctx.part.component.modelName, file, row.current, row.condition)
      : { text: opBench(model, ctx.part.component.modelName, file, row.current), analysisType: "operating_point", expression: "last(v(anode))" };
    fs.writeFileSync(path.join(ctx.packageDir, "tests", file), bench.text);
    const maximumBound = row.role.includes("maximum");
    const minimumBound = row.role.includes("minimum");
    const links = strictDiodeEvidence ? evidenceLinks(row.evidence, row.condition, row.citation) : null;
    tests.push({
      test_netlist: file,
      analysis_type: bench.analysisType,
      scalar_checks: maximumBound || minimumBound ? [] : [expectation(
        `forward_voltage_at_${row.current}_a`,
        bench.expression,
        row.voltage,
        "V",
        0.02,
        ctx.part.component.test_tolerances?.forward_voltage ?? 0.04,
        row.pageReference,
        links
      )],
      hard_bounds_checks: maximumBound
        ? [hardBound(`forward_voltage_maximum_at_${row.current}_a`, bench.expression, "V", { minimum: 0, maximum: row.voltage }, row.pageReference, links)]
        : minimumBound
          ? [hardBound(`forward_voltage_minimum_at_${row.current}_a`, bench.expression, "V", { minimum: row.voltage }, row.pageReference, links)]
          : []
    });
  });

  const reverseEntry = Object.entries(facts.electrical_limits ?? {}).find(([name]) => /^reverse_current_[0-9.]+v$/i.test(name));
  if (reverseEntry) {
    const [reverseName, reverse] = reverseEntry;
    const reverseVoltage = Number(reverseName.match(/_([0-9.]+)v$/i)[1]);
    fs.writeFileSync(path.join(ctx.packageDir, "tests", "reverse_leakage.cir"), reverseBench(model, ctx.part.component.modelName, reverseVoltage));
    tests.push({
      test_netlist: "reverse_leakage.cir",
      analysis_type: "operating_point",
      scalar_checks: [],
      hard_bounds_checks: [hardBound("reverse_leakage_maximum", "abs:last(i(vreverse))", "A", { minimum: 0, maximum: reverse.value }, reverse.page_reference)]
    });
  }

  if (facts.zener_points) {
    for (const [index, point] of facts.zener_points.entries()) {
      const file = `zener_${String(index + 1).padStart(2, "0")}.cir`;
      writeBench(ctx, file, `OpenCircuit factory test: ${ctx.part.slug} reverse Zener voltage\n${model}\nIZ 0 cathode DC ${formatSpice(point.current.value)}\nDdut 0 cathode ${ctx.part.component.modelName}\nRALL all 0 1G\n.op\n.end\n`);
      tests.push(testRecord(file, "operating_point", [], [hardBound(
        `zener_voltage_at_${point.current.value}_a`,
        "last(v(cathode))",
        "V",
        { minimum: point.voltage_minimum.value, maximum: point.voltage_maximum.value },
        `${point.voltage_minimum.page_reference}; ${point.voltage_maximum.page_reference}`
      )]));
    }
  }

  if (facts.derived_model_inputs?.CJO) {
    const cap = facts.derived_model_inputs.CJO;
    fs.writeFileSync(path.join(ctx.packageDir, "tests", "zero_bias_capacitance.cir"), capacitanceBench(model, ctx.part.component.modelName));
    tests.push({
      test_netlist: "zero_bias_capacitance.cir",
      analysis_type: "ac_small_signal",
      scalar_checks: [expectation(
        "zero_bias_capacitive_current",
        "magnitude:last(i(vac))",
        2 * Math.PI * 1e6 * cap.value * 0.05,
        "A",
        2e-8,
        0.05,
        cap.page_reference
      )],
      hard_bounds_checks: []
    });
  }

  if (facts.derived_model_inputs?.TT) {
    const recovery = facts.derived_model_inputs.TT;
    fs.writeFileSync(path.join(ctx.packageDir, "tests", "reverse_recovery.cir"), reverseRecoveryBench(model, ctx.part.component.modelName));
    tests.push({
      test_netlist: "reverse_recovery.cir",
      analysis_type: "transient",
      scalar_checks: [],
      hard_bounds_checks: [hardBound(
        "reverse_recovery_time_maximum",
        "recovery_time(i(vdrive),2e-8,1e-3)",
        "s",
        { minimum: 0, maximum: recovery.value },
        recovery.page_reference
      )]
    });
  }

  const linkedChecks = tests.flatMap((entry) => [...(entry.scalar_checks ?? []), ...(entry.hard_bounds_checks ?? [])]).filter((check) => check.evidence_id);
  const evidenceCohorts = [...new Map(linkedChecks.map((check) => [check.cohort_id, {
    cohort_id: check.cohort_id,
    fidelity_tier: ctx.part.component.fidelity_tier,
    evidence_ids: linkedChecks.filter((candidate) => candidate.cohort_id === check.cohort_id).map((candidate) => candidate.evidence_id).filter((value, index, values) => values.indexOf(value) === index),
  }])).values()];
  writeJson(path.join(ctx.packageDir, "tests", "expectations.json"), {
    schema_version: "1.0.0",
    ...(strictDiodeEvidence ? { evidence_contract_version: "1.0.0", evidence_cohorts: evidenceCohorts } : {}),
    tests,
  });
  console.log(`testgen ${ctx.part.slug}: ${tests.length} benches`);
}

function canonical(name, type = "") {
  const compact = String(name).trim().toLowerCase().replace(/\s+/g, "");
  if (compact === "time" || type === "time") return "time";
  if (compact === "frequency" || type === "frequency") return "frequency";
  if (/^v\(.+\)$/.test(compact) || /^i\(.+\)$/.test(compact)) return compact;
  if (compact.endsWith("#branch")) return `i(${compact.slice(0, -7)})`;
  if (type === "voltage") return `v(${compact})`;
  if (type === "current") return `i(${compact})`;
  return compact;
}

export function expressionValue(nativeResult, expression) {
  const findVector = (requested) => {
    const vector = nativeResult.vectors.find((candidate) => canonical(candidate.name, candidate.type) === requested.toLowerCase());
    if (!vector) throw new Error(`Expectation vector not found: ${requested}`);
    return vector;
  };
  const real = (value) => typeof value === "number" ? value : value.real;
  const magnitude = (value) => typeof value === "number" ? Math.abs(value) : Math.hypot(value.real, value.img);
  const interpolateAt = (xValues, yValues, target) => {
    let best = 0;
    for (let index = 1; index < xValues.length; index += 1) if (Math.abs(real(xValues[index]) - target) < Math.abs(real(xValues[best]) - target)) best = index;
    return yValues[best];
  };
  const linearAt = (xValues, yValues, target) => {
    const xs = xValues.map(real);
    const ys = yValues.map(real);
    if (target <= xs[0]) return ys[0];
    if (target >= xs.at(-1)) return ys.at(-1);
    for (let index = 1; index < xs.length; index += 1) if (xs[index] >= target) {
      const fraction = (target - xs[index - 1]) / (xs[index] - xs[index - 1]);
      return ys[index - 1] + fraction * (ys[index] - ys[index - 1]);
    }
    throw new Error(`Interpolation target not found: ${target}`);
  };
  const edgeTimes = (vectorName, threshold, direction) => {
    const samples = findVector(vectorName).values.map(real);
    const times = findVector("time").values.map(real);
    const crossings = [];
    for (let index = 1; index < samples.length; index += 1) {
      const crossed = direction === "rising"
        ? samples[index - 1] < threshold && samples[index] >= threshold
        : samples[index - 1] > threshold && samples[index] <= threshold;
      if (!crossed) continue;
      const fraction = (threshold - samples[index - 1]) / (samples[index] - samples[index - 1]);
      crossings.push(times[index - 1] + fraction * (times[index] - times[index - 1]));
    }
    return crossings;
  };

  let match = /^frequency_from_edges\(([^,]+),([^,]+),(rising|falling),(\d+),(\d+)\)$/.exec(expression);
  if (match) {
    const edges = edgeTimes(match[1], Number(match[2]), match[3]);
    const first = Number(match[4]);
    const last = Number(match[5]);
    if (![edges[first - 1], edges[last - 1]].every(Number.isFinite) || last <= first) throw new Error(`Requested frequency edges not found: ${expression}`);
    return (last - first) / (edges[last - 1] - edges[first - 1]);
  }
  match = /^duty_cycle_from_edges\(([^,]+),([^,]+),(rising|falling),(\d+),(rising|falling),(\d+),(rising|falling),(\d+)\)$/.exec(expression);
  if (match) {
    const first = edgeTimes(match[1], Number(match[2]), match[3])[Number(match[4]) - 1];
    const middle = edgeTimes(match[1], Number(match[2]), match[5])[Number(match[6]) - 1];
    const last = edgeTimes(match[1], Number(match[2]), match[7])[Number(match[8]) - 1];
    if (![first, middle, last].every(Number.isFinite) || !(first < middle && middle < last)) throw new Error(`Duty-cycle edge ordering is invalid: ${expression}`);
    return (middle - first) / (last - first);
  }
  match = /^pulse_width\(([^,]+),([^,]+),(rising|falling),(\d+),(rising|falling),(\d+)\)$/.exec(expression);
  if (match) {
    const first = edgeTimes(match[1], Number(match[2]), match[3])[Number(match[4]) - 1];
    const last = edgeTimes(match[1], Number(match[2]), match[5])[Number(match[6]) - 1];
    if (![first, last].every(Number.isFinite) || last <= first) throw new Error(`Pulse-width edges not found: ${expression}`);
    return last - first;
  }
  match = /^at\(([^,]+),([^\)]+)\)$/.exec(expression);
  if (match) return linearAt(findVector("time").values, findVector(match[1]).values, Number(match[2]));
  match = /^max_after\(([^,]+),([^\)]+)\)$/.exec(expression);
  if (match) {
    const values = findVector(match[1]).values.map(real);
    const times = findVector("time").values.map(real);
    const start = Number(match[2]);
    return Math.max(...values.filter((_, index) => times[index] >= start));
  }

  match = /^recovery_time\((i\([^)]+\)),([^,]+),([^)]+)\)$/.exec(expression);
  if (match) {
    const samples = findVector(match[1]).values;
    const times = findVector("time").values;
    const edge = Number(match[2]);
    const threshold = Number(match[3]);
    const afterEdge = times.map((value, index) => ({ time: real(value), current: real(samples[index]) })).filter((point) => point.time >= edge);
    const peakIndex = afterEdge.reduce((best, point, index, points) => Math.abs(point.current) > Math.abs(points[best].current) ? index : best, 0);
    const recovered = afterEdge.slice(peakIndex).find((point) => Math.abs(point.current) <= threshold);
    if (!recovered) throw new Error(`Recovery threshold was not reached for ${match[1]}`);
    return recovered.time - edge;
  }
  match = /^ratio_abs:last\((i\([^)]+\)),(i\([^)]+\))\)$/.exec(expression);
  if (match) return Math.abs(real(findVector(match[1]).values.at(-1)) / real(findVector(match[2]).values.at(-1)));
  match = /^scale:last\((v\([^)]+\)),([^\)]+)\)$/.exec(expression);
  if (match) return real(findVector(match[1]).values.at(-1)) * Number(match[2]);
  match = /^affine:last\((v\([^)]+\)),([^,]+),([^\)]+)\)$/.exec(expression);
  if (match) return real(findVector(match[1]).values.at(-1)) * Number(match[2]) + Number(match[3]);
  match = /^scale_abs:last\((v\([^)]+\)),([^\)]+)\)$/.exec(expression);
  if (match) return Math.abs(real(findVector(match[1]).values.at(-1)) * Number(match[2]));
  match = /^scale_abs:last\((i\([^)]+\)),([^\)]+)\)$/.exec(expression);
  if (match) return Math.abs(real(findVector(match[1]).values.at(-1)) * Number(match[2]));
  match = /^imag_cap:last\((i\([^)]+\)),([^\)]+)\)$/.exec(expression);
  if (match) {
    const value = findVector(match[1]).values.at(-1);
    return Math.abs(value.img) / (2 * Math.PI * Number(match[2]));
  }
  match = /^frequency_at_magnitude\(([^,]+),([^\)]+)\)$/.exec(expression);
  if (match) {
    const frequencies = findVector("frequency").values.map(real);
    const values = findVector(match[1]).values.map(magnitude);
    const target = Number(match[2]);
    for (let index = 1; index < values.length; index += 1) {
      if (values[index - 1] >= target && values[index] <= target) {
        const fraction = (target - values[index - 1]) / (values[index] - values[index - 1]);
        return frequencies[index - 1] * (frequencies[index] / frequencies[index - 1]) ** fraction;
      }
    }
    throw new Error(`Magnitude crossing not found: ${expression}`);
  }
  match = /^at_abs\(([^,]+),([^,]+),([^\)]+)\)$/.exec(expression);
  if (match) return magnitude(interpolateAt(findVector(match[2]).values, findVector(match[1]).values, Number(match[3])));
  match = /^charge_at_voltage\(([^,]+),([^,]+),([^\)]+)\)$/.exec(expression);
  if (match) {
    const voltage = findVector(match[1]).values.map(real);
    const time = findVector("time").values.map(real);
    const target = Number(match[2]);
    const current = Number(match[3]);
    for (let index = 1; index < voltage.length; index += 1) if (voltage[index - 1] <= target && voltage[index] >= target) {
      const fraction = (target - voltage[index - 1]) / (voltage[index] - voltage[index - 1]);
      return current * (time[index - 1] + fraction * (time[index] - time[index - 1]));
    }
    throw new Error(`Voltage crossing not found: ${expression}`);
  }
  match = /^slew\(([^,]+),([^,]+),([^,]+),(rising|falling)\)$/.exec(expression);
  if (match) {
    const values = findVector(match[1]).values.map(real);
    const times = findVector("time").values.map(real);
    const low = Number(match[2]);
    const high = Number(match[3]);
    const crossing = (target, start, rising) => {
      for (let index = Math.max(1, start); index < values.length; index += 1) {
        const crossed = rising ? values[index - 1] <= target && values[index] >= target : values[index - 1] >= target && values[index] <= target;
        if (crossed) return { index, time: times[index - 1] + (target - values[index - 1]) * (times[index] - times[index - 1]) / (values[index] - values[index - 1]) };
      }
      throw new Error(`Slew crossing not found: ${target}`);
    };
    const rising = match[4] === "rising";
    const first = crossing(rising ? low : high, 1, rising);
    const second = crossing(rising ? high : low, first.index, rising);
    return (high - low) / (second.time - first.time);
  }
  match = /^(max|min)\((.+)\)$/.exec(expression);
  if (match) return Math[match[1]](...findVector(match[2]).values.map(real));
  match = /^db:first\((.+)\)$/.exec(expression);
  if (match) return 20 * Math.log10(magnitude(findVector(match[1]).values[0]));

  let transform = "real";
  let source = expression;
  if (source.startsWith("abs:")) { transform = "abs"; source = source.slice(4); }
  if (source.startsWith("magnitude:")) { transform = "magnitude"; source = source.slice(10); }
  match = /^last\((.+)\)$/.exec(source);
  if (!match) throw new Error(`Unsupported expectation expression: ${expression}`);
  const raw = findVector(match[1]).values.at(-1);
  return transform === "real" ? real(raw) : magnitude(raw);
}

function evaluateCheck(value, check) {
  if (Object.hasOwn(check, "expected_value")) {
    const error = Math.abs(value - check.expected_value);
    const allowed = Math.max(check.tolerance.absolute, Math.abs(check.expected_value) * check.tolerance.relative);
    return { pass: error <= allowed, value, error, allowed };
  }
  const lower = check.minimum ?? -Infinity;
  const upper = check.maximum ?? Infinity;
  return {
    pass: value >= lower && value <= upper,
    value,
    ...(Object.hasOwn(check, "minimum") ? { minimum: check.minimum } : {}),
    ...(Object.hasOwn(check, "maximum") ? { maximum: check.maximum } : {})
  };
}

export function evaluateCheckAcrossEngines(check, nativeResult, browserWasmResult) {
  if (!check?.expression_source?.expression) throw new Error("Dual-engine expectation requires an expression");
  const expression = check.expression_source.expression;
  const native = evaluateCheck(expressionValue(nativeResult, expression), check);
  const browserWasm = evaluateCheck(expressionValue(browserWasmResult, expression), check);
  return {
    name: check.name,
    ...native,
    pass: native.pass && browserWasm.pass,
    native,
    browser_wasm: browserWasm,
  };
}

export function stageValidate(ctx) {
  assertNoTrackedPdfs();
  if (ctx.part.pipeline === "vdmos") {
    const facts = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "facts.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "fitted.json"), "utf8"));
    assertMosfetConditionIdentityContract(ctx, facts, fitted);
  }
  run("node", [packageValidator, ...(ctx.part.pipeline === "vdmos" ? ["--require-evidence-contract"] : []), ctx.packageDir]);
  if (ctx.part.pipeline === "vdmos") {
    const emittedComponent = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "component.json"), "utf8"));
    const facts = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "facts.json"), "utf8"));
    const fitted = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "fitted.json"), "utf8"));
    assertMosfetConditionIdentityContract({ ...ctx, part: { ...ctx.part, component: { ...ctx.part.component, supported_operating_region: emittedComponent.supported_operating_region } } }, facts, fitted);
  }
  const expectations = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "tests", "expectations.json"), "utf8"));
  const fitted = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "fitted.json"), "utf8"));
  const strictMosfet = ctx.part.pipeline === "vdmos" && expectations.evidence_contract_version === "1.0.0";
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let worstEngineRelativeDelta = 0;
  let worstEngineAbsoluteDelta = 0;
  let worstExpectationRelativeError = 0;
  let worstExpectationQuantity = "package expectation";
  let engineVersions = null;
  const modelHash = `sha256:${sha256(path.join(ctx.packageDir, "model.cir"))}`;
  const benchHashes = {};

  for (const test of expectations.tests) {
    const benchPath = path.join(ctx.packageDir, "tests", test.test_netlist);
    const benchHash = `sha256:${sha256(benchPath)}`;
    benchHashes[test.test_netlist] = benchHash;
    const analysis = test.analysis_type === "ac_small_signal" ? "ac" : test.analysis_type === "transient" ? "tran" : "op";
    const reportPath = path.join(ctx.workDir, `${test.test_netlist}.compare.json`);
    run("node", [compareCli, benchPath, "--analysis", analysis, "--json", reportPath], { timeout: 120_000 });
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const nativeResultPath = path.join(ctx.workDir, `${test.test_netlist}.native.json`);
    run("node", [path.join(here, "lib", "read-native.mjs"), benchPath, nativeResultPath]);
    const nativeResult = JSON.parse(fs.readFileSync(nativeResultPath, "utf8"));
    let browserWasmResult = null;
    if (strictMosfet) {
      const browserWasmResultPath = path.join(ctx.workDir, `${test.test_netlist}.browser-wasm.json`);
      run("node", [path.join(here, "lib", "read-wasm.mjs"), benchPath, browserWasmResultPath], { timeout: 120_000 });
      browserWasmResult = JSON.parse(fs.readFileSync(browserWasmResultPath, "utf8"));
      const currentVersions = {
        native: { version: nativeResult.version },
        browser_wasm: { version: browserWasmResult.version, ngspice_version: browserWasmResult.ngspiceVersion },
      };
      if (nativeResult.version !== report.engines.native.version
          || browserWasmResult.version !== report.engines.wasm.version
          || browserWasmResult.ngspiceVersion !== report.engines.wasm.ngspiceVersion) {
        throw new Error(`${test.test_netlist} engine identity drifted between comparison and expectation evaluation`);
      }
      if (engineVersions && JSON.stringify(engineVersions) !== JSON.stringify(currentVersions)) {
        throw new Error(`${test.test_netlist} engine version drifted within strict MOSFET validation`);
      }
      engineVersions = currentVersions;
    }
    for (const vector of report.vectors) {
      if (Number.isFinite(vector.maxRelativeError)) worstEngineRelativeDelta = Math.max(worstEngineRelativeDelta, vector.maxRelativeError);
      if (Number.isFinite(vector.maxAbsError)) worstEngineAbsoluteDelta = Math.max(worstEngineAbsoluteDelta, vector.maxAbsError);
    }
    const checks = [];
    for (const check of [...test.scalar_checks, ...test.hard_bounds_checks]) {
      const evaluation = strictMosfet
        ? evaluateCheckAcrossEngines(check, nativeResult, browserWasmResult)
        : { name: check.name, ...evaluateCheck(expressionValue(nativeResult, check.expression_source.expression), check) };
      if (evaluation.pass) passCount += 1;
      else failCount += 1;
      if (Object.hasOwn(check, "expected_value")) {
        const relativeError = Math.max(
          evaluation.native?.error ?? evaluation.error,
          evaluation.browser_wasm?.error ?? evaluation.error,
        ) / Math.max(Math.abs(check.expected_value), Number.EPSILON);
        if (relativeError >= worstExpectationRelativeError) {
          worstExpectationRelativeError = relativeError;
          worstExpectationQuantity = check.name;
        }
      }
      checks.push(evaluation);
    }
    results.push({
      test_netlist: test.test_netlist,
      bench_sha256: benchHash,
      analysis,
      native_wasm_pass: report.pass,
      ...(strictMosfet ? { engines: engineVersions } : {}),
      checks
    });
  }

  const validation = {
    schema_version: "1.0.0",
    validation_date: today(),
    native_wasm_all_pass: results.every((result) => result.native_wasm_pass),
    expectations_all_pass: failCount === 0,
    expectation_pass_count: passCount,
    expectation_fail_count: failCount,
    worst_native_wasm_relative_delta: worstEngineRelativeDelta,
    worst_native_wasm_absolute_delta: worstEngineAbsoluteDelta,
    ...(strictMosfet ? {
      strict_dual_engine_expectations: true,
      engines: engineVersions,
      artifact_hashes: { model_cir: modelHash, benches: benchHashes },
    } : {}),
    benches: results
  };
  writeJson(path.join(ctx.packageDir, "validation-results.json"), validation);
  if (!validation.native_wasm_all_pass || !validation.expectations_all_pass) {
    throw new Error(`Validation failed for ${ctx.part.slug}. See validation-results.json`);
  }

  const componentPath = path.join(ctx.packageDir, "component.json");
  const component = JSON.parse(fs.readFileSync(componentPath, "utf8"));
  component.test_results = {
    status: "complete",
    pass_count: passCount,
    fail_count: failCount,
    total_count: passCount + failCount,
    worst_observed_relative_fitting_error: fitted.worst_relative_error ?? { value: worstExpectationRelativeError, quantity: worstExpectationQuantity }
  };
  component.validation_date = today();
  writeJson(componentPath, component);
  run("node", [packageValidator, ...(ctx.part.pipeline === "vdmos" ? ["--require-evidence-contract"] : []), ctx.packageDir]);
  console.log(`validate ${ctx.part.slug}: ${passCount} checks, engine max rel ${worstEngineRelativeDelta.toExponential(3)}`);
}

function coverageTable(coverage) {
  return Object.entries(coverage).map(([domain, rating]) => `| ${domain} | ${rating} |`).join("\n");
}

export function renderParameterTable(fitted) {
  const parameters = Object.entries(fitted.parameters ?? {});
  if (parameters.length === 0) throw new Error("Card generation requires fitted model parameters");
  return parameters.map(([name, value]) => `| ${name} | ${Number(value).toExponential(8)} | ${fitted.parameter_metadata?.[name]?.status ?? "fitted or derived"} |`).join("\n");
}

export function assertCardParameterTable(card, fitted) {
  const start = card.indexOf("\n## Model parameters\n");
  if (start < 0) throw new Error("Generated model card is missing the model-parameter table");
  const end = card.indexOf("\n## ", start + 1);
  const section = card.slice(start, end < 0 ? card.length : end);
  for (const name of Object.keys(fitted.parameters ?? {})) {
    if (!section.includes(`| ${name} |`)) {
      throw new Error(`Generated model card is missing parameter ${name}`);
    }
  }
}

export function modelCardOmissions(componentOmissions, fittedOmissions) {
  if (!Array.isArray(componentOmissions)) throw new Error("component omissions must be an array");
  if (fittedOmissions != null && !Array.isArray(fittedOmissions)) throw new Error("fitted known_omissions must be an array when present");
  return [...new Set([...componentOmissions, ...(fittedOmissions ?? [])])];
}

export function stageCard(ctx) {
  const fitted = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "fitted.json"), "utf8"));
  const validation = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "validation-results.json"), "utf8"));
  const source = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "sources.json"), "utf8"))[0];
  const rows = fitted.residuals.map((row) => {
    if (Object.hasOwn(row, "current_a")) return `| forward voltage at ${row.current_a.toExponential(3)} A | ${row.datasheet_voltage_v.toExponential(6)} | ${row.fitted_voltage_v.toExponential(6)} | V | ${(100 * row.relative_error).toFixed(3)}% | ${row.citation} |`;
    return `| ${row.quantity} | ${Number(row.datasheet_value).toExponential(6)} | ${Number(row.fitted_value).toExponential(6)} | ${row.unit} | ${(100 * row.relative_error).toFixed(3)}% | ${row.citation} |`;
  }).join("\n");
  const parameterRows = renderParameterTable(fitted);
  const heldDefaults = (fitted.held_defaults ?? []).map((item) => `| ${item.parameter} | ${Number(item.value).toExponential(8)} | ${item.unit} | ${item.reason} |`).join("\n");
  const heldDefaultsSection = heldDefaults ? `\n## Held defaults\n\n| Parameter | Value | Unit | Status |\n| --- | ---: | --- | --- |\n${heldDefaults}\n` : "";
  const omissions = modelCardOmissions(ctx.part.component.omissions, fitted.known_omissions).map((item) => `- ${item}`).join("\n");
  const fitSummary = fitted.worst_relative_error
    ? `Worst fitting error: ${(100 * fitted.worst_relative_error.value).toFixed(3)}% for ${fitted.worst_relative_error.quantity}.`
    : "F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.";
  const fittedRows = rows || "| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |";
  const validationSummary = validation.strict_dual_engine_expectations
    ? `Native and browser-WASM each passed every scalar and hard-bound expectation across ${validation.benches.length} benches; their vector comparison also passed. Worst reported relative delta was ${validation.worst_native_wasm_relative_delta.toExponential(3)} and worst absolute delta was ${validation.worst_native_wasm_absolute_delta.toExponential(3)}.`
    : `Native and WASM agreement: all ${validation.benches.length} benches passed. Worst reported relative delta was ${validation.worst_native_wasm_relative_delta.toExponential(3)} and worst absolute delta was ${validation.worst_native_wasm_absolute_delta.toExponential(3)}.`;
  const card = `# ${ctx.part.identity.canonical_mpn} model card\n\n## Identity\n\n- Manufacturer: ${ctx.part.identity.manufacturer}\n- Description: ${ctx.part.identity.description}\n- Electrical family: ${ctx.part.identity.electrical_family}\n- Fidelity tier: ${ctx.part.component.model_card_fidelity_tier ?? ctx.part.component.fidelity_tier ?? "F2"}, datasheet-constrained\n- Independent reviewer: pending-review\n\n## Provenance\n\n- Datasheet: ${source.url}\n- Revision: ${source.revision}\n- Accessed: ${source.accessed_date}\n- Referenced pages: ${source.pages_referenced.join(", ")}\n- SHA-256: \`${source.sha256}\`\n- Basis: original model generated from public factual specifications\n- Vendor SPICE models used: none\n\n## Domain coverage\n\n| Domain | Coverage |\n| --- | --- |\n${coverageTable(ctx.part.component.domain_coverage)}\n\n## Model parameters\n\n| Parameter | Value | Status |\n| --- | ---: | --- |\n${parameterRows}\n${heldDefaultsSection}\n## Fitted versus datasheet\n\n| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |\n| --- | ---: | ---: | --- | ---: | --- |\n${fittedRows}\n\n${fitSummary}\n\n${validationSummary}\n\n## Known omissions\n\n${omissions}\n\n## Licence\n\nMIT. See \`LICENSE\`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.\n`;
  assertCardParameterTable(card, fitted);
  fs.writeFileSync(path.join(ctx.packageDir, "MODEL_CARD.md"), card);
  run("node", [packageValidator, ...(ctx.part.pipeline === "vdmos" ? ["--require-evidence-contract"] : []), ctx.packageDir]);
  console.log(`card ${ctx.part.slug}: MODEL_CARD.md`);
}

const stageFunctions = {
  resolve: stageResolve,
  acquire: stageAcquire,
  extract: stageExtract,
  fit: stageFit,
  generate: stageGenerate,
  testgen: stageTestgen,
  validate: stageValidate,
  card: stageCard
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.stage === "bulk") {
    const { runBulkManifest } = await import("./lib/bulk-adapter.mjs");
    const originalLog = console.log;
    console.log = (...values) => console.error(...values);
    let results;
    try {
      results = runBulkManifest(path.resolve(args.manifest), path.resolve(args.stagingRoot));
    } finally {
      console.log = originalLog;
    }
    process.stdout.write(json(results));
    if (results.some((result) => result.status === "failed")) process.exitCode = 2;
    return;
  }
  const { stage, mpn } = args;
  const ctx = context(mpn);
  if (stage === "all") {
    for (const name of ["resolve", "acquire", "extract", "fit", "generate", "testgen", "validate", "card"]) {
      stageFunctions[name](ctx);
    }
  } else {
    stageFunctions[stage](ctx);
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
