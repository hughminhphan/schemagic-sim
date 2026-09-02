import { readFileSync } from "node:fs";
import { deserializeDesignRequest, type DesignRequest } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import { renderRequirementsForm } from "./RequirementsForm";
import type {
  DesignerApplicationAdapter,
  DesignerNumberField,
  DesignerParameterFormContract,
  DesignerValidationIssue,
} from "./contracts";

const requestUrl = new URL(
  "../../../../../packages/design-schema/test/fixtures/requests/p1-compact.design-request.json",
  import.meta.url,
);
const request = deserializeDesignRequest(readFileSync(requestUrl, "utf8"));

function numberField(description?: string): DesignerNumberField {
  return {
    id: "requirements.dcOutputVoltageRegulation.maximum",
    label: "Maximum regulated output voltage",
    ...(description === undefined ? {} : { description }),
    section: "basic",
    control: "number",
    step: "any",
    unitOptions: [{
      value: "V",
      label: "V",
      fromCanonical: (value) => value,
      toCanonical: (value) => value,
    }],
    read: () => ({ value: 5.3, unit: "V" }),
    write: (current) => current,
  };
}

function adapter(field: DesignerNumberField): DesignerApplicationAdapter {
  const parameterForm: DesignerParameterFormContract = {
    fields: () => [field],
    validate: () => [],
  };
  return {
    application: request.application,
    name: "Robonyx Power Designer",
    shortName: "Buck converter",
    description: "Requirements form fixture",
    status: "ready",
    presets: [{
      id: "fixture",
      name: "Fixture",
      description: "Requirements form fixture",
      createRequest: () => structuredClone(request),
    }],
    parameterForm,
    generate: () => {
      throw new Error("Generation is outside this renderer fixture");
    },
  };
}

function render(field: DesignerNumberField, issues: readonly DesignerValidationIssue[] = []): string {
  return renderRequirementsForm(adapter(field), request as DesignRequest, issues, false, "fixture");
}

describe("Designer requirements field help", () => {
  it("omits an internal schema path when a field has no user-facing description", () => {
    const html = render(numberField());

    expect(html).toContain('<label for="designer-field-0">Maximum regulated output voltage</label>');
    expect(html).not.toContain("requirements.dcOutputVoltageRegulation.maximum");
    expect(html).not.toContain('id="designer-field-0-description"');
    expect(html).not.toContain('aria-describedby="designer-field-0-description"');
  });

  it("renders and associates concise engineering help when supplied", () => {
    const html = render(numberField("Highest acceptable steady-state DC output."));

    expect(html).toContain('<small id="designer-field-0-description">Highest acceptable steady-state DC output.</small>');
    expect(html).toContain('aria-describedby="designer-field-0-description"');
  });

  it("uses a validation error as the accessible description when helper copy is absent", () => {
    const html = render(numberField(), [{
      path: "requirements.dcOutputVoltageRegulation.maximum",
      message: "Enter a voltage above the minimum regulated output.",
    }]);

    expect(html).toContain('aria-describedby="designer-field-0-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('<p class="designer-field-error" id="designer-field-0-error">Enter a voltage above the minimum regulated output.</p>');
    expect(html).not.toContain('id="designer-field-0-description"');
  });
});
