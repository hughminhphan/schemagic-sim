import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assessSelectedSemiconductorCiWiringV1,
  assessSelectedSemiconductorExpectationCohortsV1,
  assessSelectedSemiconductorRdsonProjectionCiWiringV1,
  assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1,
  assessSelectedSemiconductorStoredValidationV1,
  buildDesignerReleaseReadinessReportV1,
} from "../src";

const CONDITIONAL_EXPRESSION = "${{ steps.native-version.outputs.major != '46' }}";
const EXECUTABLE_EVIDENCE_HASHES = {
  identityTest: "sha256:1345107849bc4684bce0e42e907b50710af2ed6101b2a2e506e8015520a24c68",
  reportTest: "sha256:5dfecf3c77792cceeb011c9dbab63e1f84feedb4887fecdef14204d41d2ef711",
  runner: "sha256:0ea4f3e13d3268580da949f48998f50a304c9b5ced992c5569ed28eefd0428d9",
} as const;

const NATIVE_DETECTION_STEP = [
  "      - name: Detect native ngspice version",
  "        id: native-version",
  "        shell: bash",
  "        run: |",
  "          version_output=\"$(ngspice --version 2>&1)\"",
  "          printf '%s\\n' \"$version_output\"",
  "          major=\"$(printf '%s\\n' \"$version_output\" | grep -Eo 'ngspice-[0-9]+' | head -1 | cut -d- -f2 || true)\"",
  "          echo \"major=$major\" >> \"$GITHUB_OUTPUT\"",
  "          echo \"text<<EOF\" >> \"$GITHUB_OUTPUT\"",
  "          echo \"$version_output\" >> \"$GITHUB_OUTPUT\"",
  "          echo \"EOF\" >> \"$GITHUB_OUTPUT\"",
].join("\n");

const PASSIVE_RERUN_STEP = [
  "      - name: Rerun selected-passive native and WASM artifact",
  "        id: selected-passive-rerun",
  "        if: always()",
  "        shell: bash",
  `        continue-on-error: ${CONDITIONAL_EXPRESSION}`,
  "        working-directory: tools/native-ngspice-reference",
  "        env:",
  "          OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE: ${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs",
  "        run: npm run test:selected-passive-application-golden",
].join("\n");

const HARD_IDENTITY_STEP = [
  "      - name: Validate selected-semiconductor persisted artifact and production identity",
  "        id: selected-semiconductor-identity",
  "        if: always()",
  "        shell: bash",
  "        working-directory: tools/native-ngspice-reference",
  "        run: node --test test/selected-semiconductor-execution-report.test.mjs && npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-application-golden.test.ts",
].join("\n");

const NUMERICAL_RERUN_STEP = [
  "      - name: Rerun selected-semiconductor native and WASM artifact",
  "        id: selected-semiconductor-rerun",
  "        if: always()",
  "        shell: bash",
  `        continue-on-error: ${CONDITIONAL_EXPRESSION}`,
  "        working-directory: tools/native-ngspice-reference",
  "        env:",
  "          OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE: ${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs",
  "        run: npm run test:selected-semiconductor-application-golden",
].join("\n");

const HARD_PROJECTION_VALIDATION_STEP = [
  "      - name: Validate ideal reviewed-RDS(on) projection identity and persisted report",
  "        id: selected-semiconductor-rdson-projection-identity",
  "        if: always()",
  "        shell: bash",
  "        working-directory: tools/native-ngspice-reference",
  "        run: npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-rdson-projection.test.ts && node --test test/selected-semiconductor-rdson-projection-report.test.mjs",
].join("\n");

const PROJECTION_RERUN_STEP = [
  "      - name: Rerun ideal reviewed-RDS(on) projection",
  "        id: selected-semiconductor-rdson-projection",
  "        if: always()",
  "        shell: bash",
  `        continue-on-error: ${CONDITIONAL_EXPRESSION}`,
  "        working-directory: tools/native-ngspice-reference",
  "        env:",
  "          OPEN_CIRCUIT_NGSPICE_ENGINE_MODULE: ${{ github.workspace }}/tools/ngspice-wasm-build/dist-loader/index.mjs",
  "        run: npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-rdson-projection.mjs --verify-persisted-report",
].join("\n");

const WORKFLOW = [
  "on:",
  "  push:",
  "  pull_request:",
  "",
  "jobs:",
  "  native-comparison:",
  "    name: Native versus WASM comparison",
  "    runs-on: ubuntu-latest",
  "    steps:",
  NATIVE_DETECTION_STEP,
  PASSIVE_RERUN_STEP,
  HARD_IDENTITY_STEP,
  NUMERICAL_RERUN_STEP,
  "      - name: Record comparison authority",
  "        if: always()",
  "        shell: bash",
  "        run: echo authority",
  HARD_PROJECTION_VALIDATION_STEP,
  PROJECTION_RERUN_STEP,
  "",
].join("\n");

const HARNESS_PACKAGE = JSON.stringify({
  scripts: {
    test: "node --test test/*.test.mjs && node suite.mjs && npm run test:application-golden && npm run test:selected-passive-application-golden && npm run test:selected-semiconductor-application-golden && npm run test:selected-semiconductor-rdson-projection",
    "test:selected-semiconductor-application-golden": "npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-application-golden.test.ts && if [ -f selected-semiconductor-application-golden/contract.json ] && [ -f selected-semiconductor-application-golden/execution-report.json ]; then npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-application-golden.mjs --verify-persisted-report; else echo 'Selected-semiconductor device-model golden unavailable: current external-Motor structural identities exist, but no approved model package, dedicated device-model contract, or execution report is present.'; fi",
    "test:selected-semiconductor-rdson-projection": "npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-rdson-projection.test.ts && node --test test/selected-semiconductor-rdson-projection-report.test.mjs && npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-rdson-projection.mjs --verify-persisted-report",
  },
});

const MODEL_TEXT = ".model TEST VDMOS(VTO=2)\n";
const RDSON_BENCH_TEXT = "rdson bench\n";
const THRESHOLD_BENCH_TEXT = "threshold bench\n";
const hashText = (text: string): `sha256:${string}` => `sha256:${createHash("sha256").update(text).digest("hex")}`;

function storedValidationFixture() {
  const engine = {
    native: { version: "ngspice-46" },
    browser_wasm: { version: "ngspice-46-opencircuit-wasm1", ngspice_version: "ngspice-46" },
  };
  return {
    native_wasm_all_pass: true,
    expectations_all_pass: true,
    expectation_pass_count: 2,
    expectation_fail_count: 0,
    strict_dual_engine_expectations: true,
    engines: structuredClone(engine),
    artifact_hashes: {
      model_cir: hashText(MODEL_TEXT),
      benches: {
        "rdson.cir": hashText(RDSON_BENCH_TEXT),
        "threshold.cir": hashText(THRESHOLD_BENCH_TEXT),
      },
    },
    benches: [
      {
        test_netlist: "rdson.cir",
        bench_sha256: hashText(RDSON_BENCH_TEXT),
        analysis: "op",
        native_wasm_pass: true,
        engines: structuredClone(engine),
        checks: [{ pass: true, native: { pass: true }, browser_wasm: { pass: true } }],
      },
      {
        test_netlist: "threshold.cir",
        bench_sha256: hashText(THRESHOLD_BENCH_TEXT),
        analysis: "op",
        native_wasm_pass: true,
        engines: structuredClone(engine),
        checks: [{ pass: true, native: { pass: true }, browser_wasm: { pass: true } }],
      },
    ],
  };
}

describe("selected-semiconductor golden release authority", () => {
  it("recognizes the repository's exact selected-semiconductor CI wiring", () => {
    const workflow = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
    const harnessPackage = readFileSync(new URL("../../../tools/native-ngspice-reference/package.json", import.meta.url), "utf8");
    expect(assessSelectedSemiconductorCiWiringV1(workflow, harnessPackage).implemented).toBe(true);
    expect(assessSelectedSemiconductorRdsonProjectionCiWiringV1(workflow, harnessPackage)).toEqual({
      implemented: true,
      checks: {
        exactHarnessCommand: true,
        aggregateHarnessIncludesProjection: true,
        workflowExecutionDefaultsAbsent: true,
        unfilteredPushAndPullRequestTriggers: true,
        uniqueNativeComparisonJob: true,
        orderedHardValidationThenConditionalRerun: true,
        hardProjectionIdentityAndPersistedReport: true,
        conditionalProjectionRerun: true,
      },
    });
  });

  it("derives the exact hard identity and conditional numerical CI authority from executable structure", () => {
    expect(assessSelectedSemiconductorCiWiringV1(WORKFLOW, HARNESS_PACKAGE)).toEqual({
      implemented: true,
      checks: {
        exactHarnessCommand: true,
        workflowExecutionDefaultsAbsent: true,
        unfilteredPushAndPullRequestTriggers: true,
        uniqueNativeComparisonJob: true,
        uniqueNativeVersionDetection: true,
        selectedPassiveNumericalAnchor: true,
        orderedSelectedSemiconductorSteps: true,
        hardPersistedArtifactAndProductionIdentity: true,
        conditionalSelectedSemiconductorNumericalRerun: true,
      },
    });
  });

  it("requires an ordered hard projection validation before the conditional native/WASM rerun", () => {
    expect(assessSelectedSemiconductorRdsonProjectionCiWiringV1(WORKFLOW, HARNESS_PACKAGE)).toEqual({
      implemented: true,
      checks: {
        exactHarnessCommand: true,
        aggregateHarnessIncludesProjection: true,
        workflowExecutionDefaultsAbsent: true,
        unfilteredPushAndPullRequestTriggers: true,
        uniqueNativeComparisonJob: true,
        orderedHardValidationThenConditionalRerun: true,
        hardProjectionIdentityAndPersistedReport: true,
        conditionalProjectionRerun: true,
      },
    });

    const hardSoftForgeries = [
      WORKFLOW.replace(
        `${HARD_PROJECTION_VALIDATION_STEP}\n${PROJECTION_RERUN_STEP}`,
        `${PROJECTION_RERUN_STEP}\n${HARD_PROJECTION_VALIDATION_STEP}`,
      ),
      WORKFLOW.replace(
        `${HARD_PROJECTION_VALIDATION_STEP}\n${PROJECTION_RERUN_STEP}`,
        `${HARD_PROJECTION_VALIDATION_STEP}\n      - run: echo decoy\n${PROJECTION_RERUN_STEP}`,
      ),
      WORKFLOW.replace(
        HARD_PROJECTION_VALIDATION_STEP,
        `${HARD_PROJECTION_VALIDATION_STEP}\n${HARD_PROJECTION_VALIDATION_STEP}`,
      ),
      WORKFLOW.replace(
        HARD_PROJECTION_VALIDATION_STEP,
        HARD_PROJECTION_VALIDATION_STEP.replace("        shell: bash", "        shell: bash\n        continue-on-error: true"),
      ),
      WORKFLOW.replace(
        HARD_PROJECTION_VALIDATION_STEP,
        HARD_PROJECTION_VALIDATION_STEP.replace("        if: always()", "        if: false"),
      ),
      WORKFLOW.replace(
        HARD_PROJECTION_VALIDATION_STEP,
        HARD_PROJECTION_VALIDATION_STEP.replace(
          "        run: npm --prefix ../.. exec --workspace=@opencircuit/sim-engine -- vitest run test/selected-semiconductor-rdson-projection.test.ts && node --test test/selected-semiconductor-rdson-projection-report.test.mjs",
          "        run: echo skipped",
        ),
      ),
      WORKFLOW.replace(
        PROJECTION_RERUN_STEP,
        PROJECTION_RERUN_STEP.replace(`        continue-on-error: ${CONDITIONAL_EXPRESSION}`, "        continue-on-error: true"),
      ),
      WORKFLOW.replace(
        PROJECTION_RERUN_STEP,
        PROJECTION_RERUN_STEP.replace(
          "        run: npm --prefix ../.. run build --workspace=@opencircuit/sim-engine && node selected-semiconductor-rdson-projection.mjs --verify-persisted-report",
          "        run: npm run test:selected-semiconductor-rdson-projection",
        ),
      ),
    ];
    for (const forged of hardSoftForgeries) {
      expect(assessSelectedSemiconductorRdsonProjectionCiWiringV1(forged, HARNESS_PACKAGE).implemented).toBe(false);
    }

    const missingHarness = JSON.stringify({ scripts: { test: "echo skipped" } });
    expect(assessSelectedSemiconductorRdsonProjectionCiWiringV1(WORKFLOW, missingHarness).implemented).toBe(false);
  });

  it("rejects skipped or inert projection evidence even when marker strings remain", () => {
    const identityTest = readFileSync(
      new URL("../../sim-engine/test/selected-semiconductor-rdson-projection.test.ts", import.meta.url),
      "utf8",
    );
    const reportTest = readFileSync(
      new URL("../../../tools/native-ngspice-reference/test/selected-semiconductor-rdson-projection-report.test.mjs", import.meta.url),
      "utf8",
    );
    const runner = readFileSync(
      new URL("../../../tools/native-ngspice-reference/selected-semiconductor-rdson-projection.mjs", import.meta.url),
      "utf8",
    );
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      reportTest,
      runner,
    )).toEqual({
      implemented: true,
      checks: {
        exactIdentityTestContentHash: true,
        exactReportTestContentHash: true,
        exactRunnerContentHash: true,
        activeCurrentIdentityTestSuite: true,
        activePersistedReportTamperTests: true,
        executableRunnerMain: true,
      },
      sourceContentHashes: {
        expected: EXECUTABLE_EVIDENCE_HASHES,
        actual: EXECUTABLE_EVIDENCE_HASHES,
      },
    });

    const skippedSuite = identityTest.replace(
      'describe("current selected-semiconductor ideal reviewed-RDS(on) projection", () => {',
      'describe.skip("current selected-semiconductor ideal reviewed-RDS(on) projection", () => {',
    );
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      skippedSuite,
      reportTest,
      runner,
    ).checks.activeCurrentIdentityTestSuite).toBe(false);

    const skippedTamperTest = reportTest.replace(
      'test("rejects projection identity, quantity, evidence, receipt, numerical, and claim drift", async () => {',
      'test.skip("rejects projection identity, quantity, evidence, receipt, numerical, and claim drift", async () => {',
    );
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      skippedTamperTest,
      runner,
    ).checks.activePersistedReportTamperTests).toBe(false);

    const inertIdentityCallbacks = [
      'describe("current selected-semiconductor ideal reviewed-RDS(on) projection", () => {',
      '  it("binds only the reviewed maximum resistance, its exact conditions, and four ideal resistor instances", () => {});',
      '  it("regenerates the exact current ineligible candidate and selected quantity without adding simulation authority", async () => {});',
      "});",
      "// expect(CONTRACT); currentExternalMotorObservation(); request.constraints.allowUnknownHardConstraints = true",
    ].join("\n");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      inertIdentityCallbacks,
      reportTest,
      runner,
    ).checks.activeCurrentIdentityTestSuite).toBe(false);

    const unreachableIdentityCallbacks = [
      'describe("current selected-semiconductor ideal reviewed-RDS(on) projection", () => {',
      '  it("binds only the reviewed maximum resistance, its exact conditions, and four ideal resistor instances", () => {',
      "    if (false) { expect(CONTRACT); }",
      "  });",
      '  it("regenerates the exact current ineligible candidate and selected quantity without adding simulation authority", async () => {',
      "    if (false) { await currentExternalMotorObservation(); expect(true); }",
      "  });",
      "});",
    ].join("\n");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      unreachableIdentityCallbacks,
      reportTest,
      runner,
    ).checks.activeCurrentIdentityTestSuite).toBe(false);

    const inertReportCallbacks = [
      'test("strictly validates the persisted ideal reviewed-RDS(on) projection", async () => {});',
      'test("rejects projection identity, quantity, evidence, receipt, numerical, and claim drift", async () => {});',
      'test("strictly validates the reviewed profile and ideal-resistor contract on the persisted path", async () => {});',
      'test("binds every persisted browser-WASM voltage and receipt field compared with a fresh run", async () => {});',
      "// validateSelectedSemiconductorRdsonProjectionReport assert.throws assert.notDeepEqual",
    ].join("\n");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      inertReportCallbacks,
      runner,
    ).checks.activePersistedReportTamperTests).toBe(false);

    const unreachableReportCallbacks = [
      'test("strictly validates the persisted ideal reviewed-RDS(on) projection", async () => {',
      "  if (false) { validateSelectedSemiconductorRdsonProjectionReport(report, contract, hash); }",
      "});",
      'test("rejects projection identity, quantity, evidence, receipt, numerical, and claim drift", async () => {',
      "  if (false) { assert.throws(() => validateSelectedSemiconductorRdsonProjectionReport(report, contract, hash)); }",
      "});",
      'test("strictly validates the reviewed profile and ideal-resistor contract on the persisted path", async () => {',
      "  if (false) { assert.throws(() => { validateSelectedSemiconductorRdsonProjectionContract(contract); validateSelectedSemiconductorRdsonProjectionReport(report, contract, hash); }); }",
      "});",
      'test("binds every persisted browser-WASM voltage and receipt field compared with a fresh run", async () => {',
      "  if (false) { assert.notDeepEqual(selectedSemiconductorRdsonProjectionExecutionIdentity(report), selectedSemiconductorRdsonProjectionExecutionIdentity(report)); }",
      "});",
    ].join("\n");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      unreachableReportCallbacks,
      runner,
    ).checks.activePersistedReportTamperTests).toBe(false);

    const disabledEntrypoint = runner.replace("if (isMain) {", "if (false && isMain) {");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      reportTest,
      disabledEntrypoint,
    ).checks.executableRunnerMain).toBe(false);

    const inertMain = `${runner.replace(
      "await runSelectedSemiconductorRdsonProjection()",
      "await Promise.resolve({ report: {}, contract: {}, contractContentHash: null })",
    )}\n// await runSelectedSemiconductorRdsonProjection()`;
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      reportTest,
      inertMain,
    ).checks.executableRunnerMain).toBe(false);

    const earlyReturnMain = runner.replace("async function main() {", "async function main() {\n  return;");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      reportTest,
      earlyReturnMain,
    ).checks.executableRunnerMain).toBe(false);

    const earlyReturnVerification = runner.replace(
      'if (args[0] === "--verify-persisted-report") {',
      'if (args[0] === "--verify-persisted-report") {\n    return;',
    );
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      identityTest,
      reportTest,
      earlyReturnVerification,
    ).checks.executableRunnerMain).toBe(false);

    const numericIdentityBypass = unreachableIdentityCallbacks.replaceAll("if (false)", "if (0)");
    const numericReportBypass = unreachableReportCallbacks.replaceAll("if (false)", "if (0)");
    const numericRunnerBypass = runner.replace("async function main() {", "async function main() {\n  if (1) return;");
    expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
      numericIdentityBypass,
      numericReportBypass,
      numericRunnerBypass,
    )).toMatchObject({
      implemented: false,
      checks: {
        exactIdentityTestContentHash: false,
        exactReportTestContentHash: false,
        exactRunnerContentHash: false,
        activeCurrentIdentityTestSuite: true,
        activePersistedReportTamperTests: true,
        executableRunnerMain: true,
      },
    });

    for (const falsyGuard of ["0", '""', "null", "void 0", "1 === 2"]) {
      const guardedIdentity = numericIdentityBypass.replaceAll("if (0)", `if (${falsyGuard})`);
      expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
        guardedIdentity,
        reportTest,
        runner,
      )).toMatchObject({
        implemented: false,
        checks: { exactIdentityTestContentHash: false },
      });
    }

    for (const truthyGuard of ["1", '"truthy"', "!false", "1 === 1"]) {
      const guardedRunner = runner.replace(
        "async function main() {",
        `async function main() {\n  if (${truthyGuard}) return;`,
      );
      expect(assessSelectedSemiconductorRdsonProjectionExecutableEvidenceV1(
        identityTest,
        reportTest,
        guardedRunner,
      )).toMatchObject({
        implemented: false,
        checks: { exactRunnerContentHash: false },
      });
    }
  });

  it("rejects comments, block scalars, duplicate jobs or ids, split jobs, order drift, guards, and command drift", () => {
    expect(assessSelectedSemiconductorCiWiringV1(
      WORKFLOW.split("\n").map((line) => `# ${line}`).join("\n"),
      HARNESS_PACKAGE,
    ).implemented).toBe(false);

    const stepLines = WORKFLOW.split("\n").slice(WORKFLOW.split("\n").indexOf("    steps:") + 1);
    const blockScalarDecoy = [
      "on:",
      "  push:",
      "  pull_request:",
      "jobs:",
      "  native-comparison:",
      "    name: Native versus WASM comparison",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: |",
      ...stepLines.map((line) => `  ${line}`),
    ].join("\n");
    expect(assessSelectedSemiconductorCiWiringV1(blockScalarDecoy, HARNESS_PACKAGE).implemented).toBe(false);

    const unrelatedJob = [
      WORKFLOW.replace(`${HARD_IDENTITY_STEP}\n${NUMERICAL_RERUN_STEP}\n`, "").trimEnd(),
      "  unrelated-job:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      HARD_IDENTITY_STEP,
      NUMERICAL_RERUN_STEP,
      "",
    ].join("\n");
    expect(assessSelectedSemiconductorCiWiringV1(unrelatedJob, HARNESS_PACKAGE)).toMatchObject({
      implemented: false,
      checks: {
        hardPersistedArtifactAndProductionIdentity: false,
        conditionalSelectedSemiconductorNumericalRerun: false,
        orderedSelectedSemiconductorSteps: false,
      },
    });

    const forgeries = [
      `env:\n  BASH_ENV: /tmp/noop\n${WORKFLOW}`,
      WORKFLOW.replace("  push:\n  pull_request:", "  push:\n    paths:\n      - docs/**\n  pull_request:"),
      WORKFLOW.replace("  native-comparison:\n", "  native-comparison:\n    if: false\n"),
      `${WORKFLOW}\n  native-comparison:\n    name: Native versus WASM comparison\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n`,
      WORKFLOW.replace(HARD_IDENTITY_STEP, `${HARD_IDENTITY_STEP}\n${HARD_IDENTITY_STEP}`),
      WORKFLOW.replace(`${HARD_IDENTITY_STEP}\n${NUMERICAL_RERUN_STEP}`, `${NUMERICAL_RERUN_STEP}\n${HARD_IDENTITY_STEP}`),
      WORKFLOW.replace(`${HARD_IDENTITY_STEP}\n${NUMERICAL_RERUN_STEP}`, `${HARD_IDENTITY_STEP}\n      - run: echo decoy\n${NUMERICAL_RERUN_STEP}`),
      WORKFLOW.replace("        id: selected-semiconductor-identity\n        if: always()", "        id: selected-semiconductor-identity\n        if: always()\n        continue-on-error: true"),
      WORKFLOW.replace(`        continue-on-error: ${CONDITIONAL_EXPRESSION}`, "        continue-on-error: true"),
      WORKFLOW.replace("        run: npm run test:selected-semiconductor-application-golden", "        run: echo skipped"),
    ];
    for (const forged of forgeries) {
      expect(assessSelectedSemiconductorCiWiringV1(forged, HARNESS_PACKAGE).implemented).toBe(false);
    }

    expect(assessSelectedSemiconductorCiWiringV1(WORKFLOW, JSON.stringify({
      description: HARNESS_PACKAGE,
      scripts: {},
    })).checks.exactHarnessCommand).toBe(false);
  });

  it("requires strict dual-engine stored validation and exact native/browser bench bytes", () => {
    const assess = (value: unknown) => assessSelectedSemiconductorStoredValidationV1(
      typeof value === "string" ? value : JSON.stringify(value),
      MODEL_TEXT,
      RDSON_BENCH_TEXT,
      THRESHOLD_BENCH_TEXT,
    );
    expect(assess(storedValidationFixture())).toEqual({
      implemented: true,
      checks: {
        aggregatePass: true,
        strictDualEngineExpectations: true,
        exactStoredEngineIdentities: true,
        exactModelArtifactHash: true,
        exactOperatingPointBenchSetAndHashes: true,
        everyNativeAndBrowserCheckPassed: true,
      },
    });
    const mutations: Array<(value: ReturnType<typeof storedValidationFixture>) => void> = [
      (value) => { value.native_wasm_all_pass = false; },
      (value) => { value.expectation_pass_count = 1; },
      (value) => { value.strict_dual_engine_expectations = false; },
      (value) => { value.engines.native.version = "ngspice-45"; },
      (value) => { value.engines.browser_wasm.version = "legacy-wasm"; },
      (value) => { value.engines.browser_wasm.ngspice_version = "ngspice-45"; },
      (value) => { value.artifact_hashes.model_cir = `sha256:${"0".repeat(64)}`; },
      (value) => { value.artifact_hashes.benches["rdson.cir"] = `sha256:${"1".repeat(64)}`; },
      (value) => { value.benches[0]!.bench_sha256 = `sha256:${"2".repeat(64)}`; },
      (value) => { value.benches[0]!.analysis = "dc"; },
      (value) => { value.benches[0]!.engines.native.version = "ngspice-45"; },
      (value) => { value.benches[0]!.checks[0]!.pass = false; },
      (value) => { value.benches[0]!.checks[0]!.native.pass = false; },
      (value) => { value.benches[0]!.checks[0]!.browser_wasm.pass = false; },
      (value) => { value.benches.pop(); },
    ];
    for (const mutate of mutations) {
      const forged = storedValidationFixture();
      mutate(forged);
      expect(assess(forged).implemented).toBe(false);
    }
    expect(assess("not JSON").implemented).toBe(false);
    expect(assessSelectedSemiconductorStoredValidationV1(
      JSON.stringify(storedValidationFixture()),
      MODEL_TEXT,
      `${RDSON_BENCH_TEXT}drift`,
      THRESHOLD_BENCH_TEXT,
    ).implemented).toBe(false);
  });

  it("rejects empty, non-F1, substituted, or widened model-expectation cohorts", () => {
    const fixture = () => ({
      evidence_cohorts: [
        {
          cohort_id: "sha256:02b284f52a9973b82b3a440a0f5d4461bea078e4c34f34f3761c9f0cdc933d89",
          fidelity_tier: "F1",
          evidence_ids: ["sha256:cd106948f4a3205f7238690b5bd1cde3af99a32125edb10874af70c3b10ce6d3"],
        },
        {
          cohort_id: "sha256:eb68271ddc9729ee19cfb3bb44aa0c5ba4d4134252043fa463e8e50da57d5615",
          fidelity_tier: "F1",
          evidence_ids: ["sha256:19133942b07fa7ec8aeb66d49d0039dcf1b57358b9631f6eac4ee121f59513f0"],
        },
        {
          cohort_id: "sha256:f1f021bf67ae0521041b2438945e13ea99d77dff4e92f8b47b8409aeaf9ebe7a",
          fidelity_tier: "F1",
          evidence_ids: [
            "sha256:c6554cce55d6c54b3c2ea46ec96c17f5523cec2e21c4093dcdf3a990ecf273db",
            "sha256:df51d02877ef95c19fcb8b751bad82db8e17349a42e69b07386a8e1e1bf56d4a",
            "sha256:6e675e85780c42ebedf5133e9ced47c54ad22c4ec572da1d0ebfe8fcbd9ceea8",
          ],
        },
      ],
    });
    expect(assessSelectedSemiconductorExpectationCohortsV1(JSON.stringify(fixture())).implemented).toBe(true);
    const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
      (value) => { value.evidence_cohorts = []; },
      (value) => { value.evidence_cohorts[0]!.fidelity_tier = "F2"; },
      (value) => { value.evidence_cohorts[0]!.evidence_ids = []; },
      (value) => { value.evidence_cohorts[0]!.cohort_id = `sha256:${"0".repeat(64)}`; },
      (value) => { value.evidence_cohorts[1]!.evidence_ids = [`sha256:${"1".repeat(64)}`]; },
      (value) => { value.evidence_cohorts.push(structuredClone(value.evidence_cohorts[0]!)); },
    ];
    for (const mutate of mutations) {
      const forged = fixture();
      mutate(forged);
      expect(assessSelectedSemiconductorExpectationCohortsV1(JSON.stringify(forged)).implemented).toBe(false);
    }
    expect(assessSelectedSemiconductorExpectationCohortsV1("not JSON").implemented).toBe(false);
  });

  it("retires only the coverage blocker with the ideal projection while leaving the dedicated device gate blocked", () => {
    const report = buildDesignerReleaseReadinessReportV1();
    const projection = report.gates.find((entry) => entry.id === "simulation.selected-semiconductor-ideal-rdson-projection-golden");
    const dedicated = report.gates.find((entry) => entry.id === "simulation.production-selected-semiconductor-dc-golden-contract");
    const coverage = report.gates.find((entry) => entry.id === "simulation.application-golden-coverage");
    expect(projection).toMatchObject({ status: "pass", blockers: [], evidence: { executionResultAttached: true } });
    expect(dedicated?.status).toBe("blocked");
    expect(dedicated?.evidence.executionResultAttached).toBe(false);
    expect(coverage?.evidence.idealReviewedRdsonProjectionImplemented).toBe(true);
    expect(coverage?.evidence.reviewedSelectedSemiconductorDcGoldenImplemented).toBe(false);
    expect(coverage?.blockers).not.toContain("reviewed_selected_semiconductor_native_wasm_golden_unverified");
    expect(coverage?.blockers).toContain("full_bom_selected_part_native_wasm_coverage_unverified");
  });
});
