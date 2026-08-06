#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getPart } from "./lib/parts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const libraryRoot = path.join(repoRoot, "packages", "model-library", "models");
const compareCli = path.join(repoRoot, "tools", "native-ngspice-reference", "compare.mjs");
const packageValidator = path.join(repoRoot, "packages", "component-schema", "validate-package.mjs");
const today = () => new Date().toISOString().slice(0, 10);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function parseArgs(argv) {
  const [stage, ...rest] = argv;
  let mpn;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--mpn") mpn = rest[++index];
    else throw new Error(`Unknown argument: ${rest[index]}`);
  }
  const stages = ["resolve", "acquire", "extract", "fit", "generate", "testgen", "validate", "card", "all"];
  if (!stages.includes(stage)) throw new Error(`Stage must be one of: ${stages.join(", ")}`);
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
  run("curl", ["-fL", "--retry", "2", "--connect-timeout", "20", "-o", downloadPath, ctx.part.source.url], { timeout: 600_000 });
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
  const text = fs.readFileSync(ctx.textPath, "utf8");
  if (!text.toLowerCase().includes(ctx.part.slug.toLowerCase())) throw new Error("Extracted text does not identify the requested MPN");
  const facts = structuredClone(ctx.part.facts);
  facts.identity = {
    canonical_mpn: ctx.part.identity.canonical_mpn,
    manufacturer: ctx.part.identity.manufacturer,
    aliases: ctx.part.identity.aliases
  };
  facts.source = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "sources.json"), "utf8"))[0];
  assertFactualReferences(facts);
  writeJson(path.join(ctx.packageDir, "facts.json"), facts);
  console.log(`extract ${ctx.part.slug}: ${facts.fit_points.length} fit points`);
}

function stageFit(ctx) {
  const factsPath = path.join(ctx.packageDir, "facts.json");
  requireFile(factsPath, "fit");
  const python = path.join(here, ".venv", "bin", "python");
  requireFile(python, "fit");
  const output = path.join(ctx.packageDir, "fitted.json");
  run(python, [path.join(here, "python", "fit_diode.py"), factsPath, output]);
  const fitted = JSON.parse(fs.readFileSync(output, "utf8"));
  console.log(`fit ${ctx.part.slug}: worst relative VF error ${(100 * fitted.worst_relative_error.value).toFixed(3)}%`);
}

function formatSpice(value) {
  if (value === 0) return "0";
  return Number(value).toExponential(10).replace("e+", "e");
}

function modelText(ctx, fitted) {
  const parameters = fitted.parameters;
  const optional = [];
  if (parameters.CJO > 0) optional.push(`CJO=${formatSpice(parameters.CJO)}`);
  if (parameters.TT > 0) optional.push(`TT=${formatSpice(parameters.TT)}`);
  const allParameters = [
    `IS=${formatSpice(parameters.IS)}`,
    `N=${formatSpice(parameters.N)}`,
    `RS=${formatSpice(parameters.RS)}`,
    ...optional
  ];
  return `* OpenCircuit Model Factory v0.1.0\n* Original work generated from public factual specifications.\n* This model is not a copy of, or adaptation from, any vendor SPICE model.\n* Source: ${ctx.part.source.url}\n* Revision: ${ctx.part.source.revision}\n* Fit: scipy.optimize.least_squares at ${fitted.temperature_c} degC\n.model ${ctx.part.component.modelName} D(${allParameters.join(" ")})\n`;
}

function baseComponent(ctx, fitted) {
  const identity = ctx.part.identity;
  const packageInfo = identity.package;
  return {
    schema_version: "1.0.0",
    canonical_mpn: identity.canonical_mpn,
    manufacturer: identity.manufacturer,
    description: identity.description,
    electrical_family: identity.electrical_family,
    symbol_pins: [
      { name: "A", number: "1", role: "anode" },
      { name: "K", number: "2", role: "cathode" }
    ],
    spice_pin_mapping: [
      { symbol_pin_number: "1", subckt_node: "anode", order: 1 },
      { symbol_pin_number: "2", subckt_node: "cathode", order: 2 }
    ],
    package_variants: [{
      name: packageInfo.name,
      standard: packageInfo.standard,
      pin_count: 2,
      pin_map: [
        { package_pin: "1", symbol_pin_number: "1" },
        { package_pin: "2", symbol_pin_number: "2" }
      ]
    }],
    ordering_code_aliases: identity.aliases,
    datasheet: { url: ctx.part.source.url, revision: ctx.part.source.revision },
    model_type: "dot_model",
    fidelity_tier: "F2",
    domain_coverage: ctx.part.component.domain_coverage,
    supported_analyses: ctx.part.component.supported_analyses,
    supported_operating_region: {
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
  fs.writeFileSync(path.join(ctx.packageDir, "model.cir"), modelText(ctx, fitted));
  writeJson(path.join(ctx.packageDir, "component.json"), baseComponent(ctx, fitted));
  console.log(`generate ${ctx.part.slug}: ${ctx.part.component.modelName}`);
}

function opBench(model, modelName, name, current) {
  return `OpenCircuit factory test: ${name}\n${model}\nItest 0 anode DC ${formatSpice(current)}\nVanchor anchor 0 DC 0\nRanchor anchor 0 1G\nDdut anode 0 ${modelName}\n.op\n.end\n`;
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

function expectation(name, expression, expectedValue, unit, absolute, relative, citation) {
  return {
    name,
    expression_source: { kind: "raw_variable", expression },
    expected_value: expectedValue,
    unit,
    tolerance: { absolute, relative },
    datasheet_citation: citation,
    placeholder: false
  };
}

function hardBound(name, expression, unit, bounds, citation) {
  return {
    name,
    expression_source: { kind: "raw_variable", expression },
    ...bounds,
    unit,
    inclusive: true,
    datasheet_citation: citation,
    placeholder: false
  };
}

function stageTestgen(ctx) {
  const modelPath = path.join(ctx.packageDir, "model.cir");
  const factsPath = path.join(ctx.packageDir, "facts.json");
  requireFile(modelPath, "testgen");
  requireFile(factsPath, "testgen");
  const model = fs.readFileSync(modelPath, "utf8");
  const facts = JSON.parse(fs.readFileSync(factsPath, "utf8"));
  const tests = [];
  ensureDirectory(path.join(ctx.packageDir, "tests"));

  facts.fit_points.forEach((point, index) => {
    const file = `forward_${String(index + 1).padStart(2, "0")}.cir`;
    fs.writeFileSync(path.join(ctx.packageDir, "tests", file), opBench(model, ctx.part.component.modelName, file, point.current.value));
    tests.push({
      test_netlist: file,
      analysis_type: "operating_point",
      scalar_checks: [expectation(
        `forward_voltage_at_${point.current.value}_a`,
        "last(v(anode))",
        point.voltage.value,
        "V",
        0.02,
        0.04,
        point.voltage.page_reference
      )],
      hard_bounds_checks: []
    });
  });

  const reverse = facts.electrical_limits.reverse_current_20v ?? facts.electrical_limits.reverse_current_5v;
  const reverseVoltage = facts.electrical_limits.reverse_current_20v ? 20 : 5;
  fs.writeFileSync(path.join(ctx.packageDir, "tests", "reverse_leakage.cir"), reverseBench(model, ctx.part.component.modelName, reverseVoltage));
  tests.push({
    test_netlist: "reverse_leakage.cir",
    analysis_type: "operating_point",
    scalar_checks: [],
    hard_bounds_checks: [hardBound("reverse_leakage_maximum", "abs:last(i(vreverse))", "A", { minimum: 0, maximum: reverse.value }, reverse.page_reference)]
  });

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

  writeJson(path.join(ctx.packageDir, "tests", "expectations.json"), { schema_version: "1.0.0", tests });
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

function expressionValue(nativeResult, expression) {
  let transform = "real";
  let source = expression;
  if (source.startsWith("abs:")) { transform = "abs"; source = source.slice(4); }
  if (source.startsWith("magnitude:")) { transform = "magnitude"; source = source.slice(10); }
  const recoveryMatch = /^recovery_time\((i\([^)]+\)),([^,]+),([^)]+)\)$/.exec(source);
  if (recoveryMatch) {
    const requested = recoveryMatch[1].toLowerCase();
    const edge = Number(recoveryMatch[2]);
    const threshold = Number(recoveryMatch[3]);
    const vector = nativeResult.vectors.find((candidate) => canonical(candidate.name, candidate.type) === requested);
    const time = nativeResult.vectors.find((candidate) => canonical(candidate.name, candidate.type) === "time");
    if (!vector || !time) throw new Error(`Recovery expression vectors not found: ${requested}`);
    const afterEdge = time.values.map((value, index) => ({ time: value, current: vector.values[index] })).filter((point) => point.time >= edge);
    const peakIndex = afterEdge.reduce((best, point, index, points) => Math.abs(point.current) > Math.abs(points[best].current) ? index : best, 0);
    const recovered = afterEdge.slice(peakIndex).find((point) => Math.abs(point.current) <= threshold);
    if (!recovered) throw new Error(`Recovery threshold was not reached for ${requested}`);
    return recovered.time - edge;
  }
  const match = /^last\((.+)\)$/.exec(source);
  if (!match) throw new Error(`Unsupported expectation expression: ${expression}`);
  const requested = match[1].toLowerCase();
  const vector = nativeResult.vectors.find((candidate) => canonical(candidate.name, candidate.type) === requested);
  if (!vector) throw new Error(`Expectation vector not found: ${requested}`);
  const raw = vector.values.at(-1);
  if (typeof raw === "number") return transform === "real" ? raw : Math.abs(raw);
  if (transform === "real") return raw.real;
  return Math.hypot(raw.real, raw.img);
}

function evaluateCheck(value, check) {
  if (Object.hasOwn(check, "expected_value")) {
    const error = Math.abs(value - check.expected_value);
    const allowed = Math.max(check.tolerance.absolute, Math.abs(check.expected_value) * check.tolerance.relative);
    return { pass: error <= allowed, value, error, allowed };
  }
  const lower = check.minimum ?? -Infinity;
  const upper = check.maximum ?? Infinity;
  return { pass: value >= lower && value <= upper, value, minimum: lower, maximum: upper };
}

function stageValidate(ctx) {
  assertNoTrackedPdfs();
  run("node", [packageValidator, ctx.packageDir]);
  const expectations = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "tests", "expectations.json"), "utf8"));
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let worstEngineRelativeDelta = 0;
  let worstEngineAbsoluteDelta = 0;

  for (const test of expectations.tests) {
    const benchPath = path.join(ctx.packageDir, "tests", test.test_netlist);
    const analysis = test.analysis_type === "ac_small_signal" ? "ac" : test.analysis_type === "transient" ? "tran" : "op";
    const reportPath = path.join(ctx.workDir, `${test.test_netlist}.compare.json`);
    run("node", [compareCli, benchPath, "--analysis", analysis, "--json", reportPath], { timeout: 120_000 });
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const nativeResultPath = path.join(ctx.workDir, `${test.test_netlist}.native.json`);
    run("node", [path.join(here, "lib", "read-native.mjs"), benchPath, nativeResultPath]);
    const nativeResult = JSON.parse(fs.readFileSync(nativeResultPath, "utf8"));
    for (const vector of report.vectors) {
      if (Number.isFinite(vector.maxRelativeError)) worstEngineRelativeDelta = Math.max(worstEngineRelativeDelta, vector.maxRelativeError);
      if (Number.isFinite(vector.maxAbsError)) worstEngineAbsoluteDelta = Math.max(worstEngineAbsoluteDelta, vector.maxAbsError);
    }
    const checks = [];
    for (const check of [...test.scalar_checks, ...test.hard_bounds_checks]) {
      const value = expressionValue(nativeResult, check.expression_source.expression);
      const evaluation = evaluateCheck(value, check);
      if (evaluation.pass) passCount += 1;
      else failCount += 1;
      checks.push({ name: check.name, ...evaluation });
    }
    results.push({
      test_netlist: test.test_netlist,
      analysis,
      native_wasm_pass: report.pass,
      checks
    });
  }

  const fitted = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "fitted.json"), "utf8"));
  const validation = {
    schema_version: "1.0.0",
    validation_date: today(),
    native_wasm_all_pass: results.every((result) => result.native_wasm_pass),
    expectations_all_pass: failCount === 0,
    expectation_pass_count: passCount,
    expectation_fail_count: failCount,
    worst_native_wasm_relative_delta: worstEngineRelativeDelta,
    worst_native_wasm_absolute_delta: worstEngineAbsoluteDelta,
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
    worst_observed_relative_fitting_error: fitted.worst_relative_error
  };
  component.validation_date = today();
  writeJson(componentPath, component);
  run("node", [packageValidator, ctx.packageDir]);
  console.log(`validate ${ctx.part.slug}: ${passCount} checks, engine max rel ${worstEngineRelativeDelta.toExponential(3)}`);
}

function coverageTable(coverage) {
  return Object.entries(coverage).map(([domain, rating]) => `| ${domain} | ${rating} |`).join("\n");
}

function stageCard(ctx) {
  const fitted = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "fitted.json"), "utf8"));
  const validation = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "validation-results.json"), "utf8"));
  const source = JSON.parse(fs.readFileSync(path.join(ctx.packageDir, "sources.json"), "utf8"))[0];
  const rows = fitted.residuals.map((row) => `| ${row.current_a.toExponential(3)} | ${row.datasheet_voltage_v.toFixed(4)} | ${row.fitted_voltage_v.toFixed(4)} | ${(100 * row.relative_error).toFixed(3)}% | ${row.citation} |`).join("\n");
  const omissions = ctx.part.component.omissions.map((item) => `- ${item}`).join("\n");
  const card = `# ${ctx.part.identity.canonical_mpn} model card\n\n## Identity\n\n- Manufacturer: ${ctx.part.identity.manufacturer}\n- Description: ${ctx.part.identity.description}\n- Electrical family: ${ctx.part.identity.electrical_family}\n- Fidelity tier: F2, datasheet-fitted\n- Independent reviewer: pending-review\n\n## Provenance\n\n- Datasheet: ${source.url}\n- Revision: ${source.revision}\n- Accessed: ${source.accessed_date}\n- SHA-256: \`${source.sha256}\`\n- Basis: original model generated from public factual specifications\n- Vendor SPICE models used: none\n\n## Domain coverage\n\n| Domain | Coverage |\n| --- | --- |\n${coverageTable(ctx.part.component.domain_coverage)}\n\n## Fitted parameters\n\n| Parameter | Value |\n| --- | ---: |\n| IS | ${fitted.parameters.IS.toExponential(6)} A |\n| N | ${fitted.parameters.N.toFixed(6)} |\n| RS | ${fitted.parameters.RS.toFixed(6)} ohm |\n| CJO | ${fitted.parameters.CJO.toExponential(6)} F |\n| TT | ${fitted.parameters.TT.toExponential(6)} s |\n\n## Fitted versus datasheet\n\n| Current (A) | Datasheet VF (V) | Fitted VF (V) | Relative error | Citation |\n| ---: | ---: | ---: | ---: | --- |\n${rows}\n\nWorst fitting error: ${(100 * fitted.worst_relative_error.value).toFixed(3)}% for ${fitted.worst_relative_error.quantity}.\n\nNative and WASM agreement: all ${validation.benches.length} benches passed. Worst reported relative delta was ${validation.worst_native_wasm_relative_delta.toExponential(3)} and worst absolute delta was ${validation.worst_native_wasm_absolute_delta.toExponential(3)}.\n\n## Known omissions\n\n${omissions}\n\n## Licence\n\nMIT. See \`LICENSE\`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.\n`;
  fs.writeFileSync(path.join(ctx.packageDir, "MODEL_CARD.md"), card);
  run("node", [packageValidator, ctx.packageDir]);
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
  const { stage, mpn } = parseArgs(process.argv.slice(2));
  const ctx = context(mpn);
  if (stage === "all") {
    for (const name of ["resolve", "acquire", "extract", "fit", "generate", "testgen", "validate", "card"]) {
      stageFunctions[name](ctx);
    }
  } else {
    stageFunctions[stage](ctx);
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
