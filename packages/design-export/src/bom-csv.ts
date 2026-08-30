import type { DesignCandidate, SelectedComponent } from "@opencircuit/design-schema";

const BOM_HEADERS = [
  "candidate_id",
  "bom_line_id",
  "role",
  "manufacturer_id",
  "manufacturer_part_number",
  "profile_id",
  "quantity_per_assembly",
  "value_si",
  "value_unit",
  "value_display_unit",
  "evidence_source_ids",
  "sourcing_data_status",
  "line_sourcing_status",
  "distributor_id",
  "distributor_sku",
  "packaging",
  "lifecycle",
  "stock_quantity",
  "purchase_quantity",
  "buildable_quantity",
  "extended_cost",
  "extended_cost_currency",
  "lead_time_days",
  "lead_time_kind",
  "warnings",
] as const;

function scalar(value: number | string | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot export a non-finite BOM value");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  return value;
}

function csvCell(value: number | string | undefined): string {
  const text = scalar(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function componentOrder(left: SelectedComponent, right: SelectedComponent): number {
  return left.id.localeCompare(right.id)
    || left.role.localeCompare(right.role)
    || left.part.manufacturerId.localeCompare(right.part.manufacturerId)
    || left.part.manufacturerPartNumber.localeCompare(right.part.manufacturerPartNumber);
}

/** Export the candidate BOM without inventing missing sourcing or evidence data. */
export function exportCandidateBomCsv(candidate: Readonly<DesignCandidate>): string {
  const sourcingByLine = new Map(candidate.sourcing?.lines.map((line) => [line.bomLineId, line]));
  const rows = [...candidate.components].sort(componentOrder).map((component) => {
    const sourcing = sourcingByLine.get(component.id);
    const evidenceSourceIds = [...new Set(component.evidence.map((entry) => entry.sourceId))]
      .sort((a, b) => a.localeCompare(b))
      .join("; ");
    const warnings = sourcing?.warnings.join("; ") ?? "";
    const values = [
      candidate.id,
      component.id,
      component.role,
      component.part.manufacturerId,
      component.part.manufacturerPartNumber,
      component.profileId,
      component.quantityPerAssembly,
      component.value?.value,
      component.value?.unit,
      component.value?.displayUnit,
      evidenceSourceIds,
      candidate.sourcing?.status,
      sourcing?.status,
      sourcing?.selectedOffer?.distributor,
      sourcing?.selectedOffer?.distributorSku,
      sourcing?.packaging,
      sourcing?.lifecycle,
      sourcing?.stockQuantity,
      sourcing?.purchaseQuantity,
      sourcing?.buildableQuantity,
      sourcing?.extendedCost?.amount,
      sourcing?.extendedCost?.currency,
      sourcing?.leadTimeDays,
      sourcing?.leadTimeKind,
      warnings,
    ];
    return values.map(csvCell).join(",");
  });
  return `${BOM_HEADERS.join(",")}\n${rows.length > 0 ? `${rows.join("\n")}\n` : ""}`;
}
