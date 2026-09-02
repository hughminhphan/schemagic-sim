import { readFileSync } from "node:fs";
import {
  deserializeDesignRequest,
  type DesignCandidate,
  type DesignRequest,
  type DesignResult,
} from "@opencircuit/design-schema";
import { SYNTHETIC_SOURCING_FIXTURES } from "@opencircuit/sourcing-schema/fixtures";
import { describe, expect, it } from "vitest";
import { applicationChooser, resultsMarkup } from "./DesignerRoute";
import { renderSourcingStatus } from "./SourcingStatus";
import {
  createSchemaParameterFormContract,
  type DesignerApplicationAdapter,
  type DesignerNumberField,
} from "./contracts";

function requestFixture(name: string): DesignRequest {
  const url = new URL(`../../../../../packages/design-schema/test/fixtures/requests/${name}`, import.meta.url);
  return deserializeDesignRequest(readFileSync(url, "utf8"));
}

const motorRequest = requestFixture("m1-compact.design-request.json");
const powerRequest = requestFixture("p1-compact.design-request.json");

function candidate(request: DesignRequest): DesignCandidate {
  const stale = SYNTHETIC_SOURCING_FIXTURES.staleSnapshot!;
  return {
    schemaVersion: 1,
    id: "candidate:shared-ui",
    requestHash: "request:shared-ui",
    recipeId: "synthetic.recipe",
    libraryVersion: request.libraryVersion,
    components: [{
      id: "driver",
      role: "primary switch",
      profileId: "profile:synthetic",
      part: { manufacturerId: "synthetic-components", manufacturerPartNumber: "SYN-DRIVER-A" },
      quantityPerAssembly: 1,
      evidence: [{ sourceId: "source:<unsafe>", locator: "table 4", licenseNote: "Synthetic evidence" }],
    }],
    derivedValues: [],
    constraints: [
      {
        ruleId: "thermal.margin",
        status: "warning",
        actual: { value: 390, unit: "K", displayUnit: "°C" },
        limit: { value: 398.15, unit: "K", displayUnit: "°C" },
        explanation: "Thermal estimate depends on the declared board assumption.",
        evidence: [{ sourceId: "rule:thermal", locator: "equation 2", licenseNote: "Synthetic rule" }],
      },
      {
        ruleId: "soa.coverage",
        status: "unknown",
        explanation: "Complete safe-operating-area evidence is unavailable.",
        evidence: [],
      },
    ],
    metrics: {
      values: [
        {
          id: "efficiency",
          value: { value: 0.91, unit: "1", displayUnit: "%" },
          state: "calculated",
          explanation: "Calculated at the declared operating point.",
          evidence: [{ sourceId: "equation:efficiency", locator: "v1", licenseNote: "Synthetic rule" }],
        },
        {
          id: "loop_phase_margin",
          value: null,
          state: "unknown",
          explanation: "No reviewed control model is attached.",
          evidence: [],
        },
      ],
      warningCount: 1,
      estimateCount: 0,
      unknownCount: 2,
    },
    sourcing: stale.metrics,
    simulationCoverage: [{ scenarioId: "steady_state", modelTier: "unavailable", limitations: ["No redistributable model"] }],
    circuit: {
      format: "opencircuit-circuit",
      version: 3,
      meta: { title: "Synthetic shared UI candidate" },
      components: [],
      wires: [],
      probes: [],
      sim: { mode: "op" },
    },
    warnings: ["Synthetic warning for presentation coverage"],
  };
}

function result(request: DesignRequest): DesignResult {
  const selected = candidate(request);
  return {
    format: "schemagic-design-result",
    schemaVersion: 1,
    request,
    requestHash: selected.requestHash,
    libraryVersion: request.libraryVersion,
    libraryContentHash: "library:synthetic",
    candidates: [selected],
    rejectedCandidates: [],
    diagnostics: [],
  };
}

function adapter(request: DesignRequest, name: string): DesignerApplicationAdapter {
  return {
    application: request.application,
    name: `Robonyx ${name}`,
    shortName: name,
    description: `${name} shared-shell fixture`,
    status: "ready",
    presets: [{ id: "fixture", name: "Fixture", description: "Frozen contract fixture", createRequest: () => structuredClone(request) }],
    parameterForm: createSchemaParameterFormContract(),
    generate(input) {
      if (input.schemaVersion !== 1) throw new Error("Expected a V1 UI fixture request");
      return result(input);
    },
  };
}

describe("Robonyx Designer shared UI contract", () => {
  it("renders both frozen application families through the same chooser contract", () => {
    const html = applicationChooser([
      adapter(motorRequest, "Motor Designer"),
      adapter(powerRequest, "Power Designer"),
    ]);
    expect(html).toContain("Motor Designer");
    expect(html).toContain("Power Designer");
    expect(html.match(/data-designer-application=/g)).toHaveLength(2);
    expect(html).not.toContain("disabled\">Set requirements");
  });

  it.each([
    ["motor", motorRequest],
    ["power", powerRequest],
  ])("derives editable SI quantity fields for the %s request without application branches", (_label, request) => {
    const contract = createSchemaParameterFormContract();
    const fields = contract.fields(request);
    const ambient = fields.find((field): field is DesignerNumberField => field.id === "requirements.ambientTemperature" && field.control === "number");
    expect(ambient).toBeDefined();
    expect(ambient!.read(request)).toEqual({ value: 40, unit: "°C" });
    const updated = ambient!.write(request, 45, "°C");
    const updatedAmbient = updated.requirements.ambientTemperature;
    expect(updatedAmbient.value).toBeCloseTo(318.15, 8);
    expect(updatedAmbient.displayUnit).toBe("°C");
    expect(contract.validate(updated)).toEqual([]);
  });

  it("renders warning, unknown, evidence, stale sourcing, exports, and Simulator handoff explicitly", () => {
    const stale = SYNTHETIC_SOURCING_FIXTURES.staleSnapshot!;
    const designResult = result({ ...structuredClone(powerRequest), sourcing: stale.policy });
    const selected = designResult.candidates[0]!;
    const html = resultsMarkup(designResult, selected, new Set([selected.id]), stale.snapshots, "/");
    expect(html).toContain("Thermal estimate depends");
    expect(html).toContain("Complete safe-operating-area evidence is unavailable");
    expect(html).toContain("91 %");
    expect(html).toContain('data-status="unknown"');
    expect(html).toContain('data-status="stale"');
    expect(html).toContain("Refresh offers before relying on availability");
    expect(html).toContain("Design JSON");
    expect(html).not.toContain('data-designer-export="json"');
    expect(html).toContain("disabled for this audit-only artifact");
    expect(html).toContain("<button disabled>BOM CSV</button>");
    expect(html).toContain("<button disabled>SPICE netlist</button>");
    expect(html).toContain("BOM and SPICE export require the exact production V2 engineering and execution contexts");
    expect(html).toContain("Open in Robonyx Simulator");
    expect(html).toContain("source:&lt;unsafe&gt;");
    expect(html).not.toContain("source:<unsafe>");
  });

  it("renders every frozen synthetic sourcing state without provider-specific UI logic", () => {
    for (const fixture of Object.values(SYNTHETIC_SOURCING_FIXTURES)) {
      const html = renderSourcingStatus(fixture.metrics, fixture.snapshots, fixture.policy);
      expect(html).toContain(`data-status="${fixture.metrics.status}"`);
      expect(html).toContain("Robonyx Sourcing");
    }
  });

  it("preserves lead-time meaning for the overall bottleneck and each sourced BOM line", () => {
    const fixture = SYNTHETIC_SOURCING_FIXTURES.digikeyOnlyActiveInStockBuild100!;
    const html = renderSourcingStatus(fixture.metrics, fixture.snapshots, fixture.policy);
    expect(html.match(/14 days · Manufacturer/g)).toHaveLength(3);
  });
});
