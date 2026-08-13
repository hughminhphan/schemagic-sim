import crypto from "node:crypto";

export function stableIdentityValue(value) {
  if (Array.isArray(value)) return value.map(stableIdentityValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableIdentityValue(value[key])]));
  }
  return value;
}

export function identityHash(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(stableIdentityValue(value))).digest("hex")}`;
}

export function claimedIdentityMaterial(value, idField) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== idField));
}

export function citationCohortMaterial(characteristic, conditionId, citation) {
  return {
    characteristic,
    condition_id: conditionId,
    ...Object.fromEntries(
      ["source_sha256", "page", "table", "row", "figure", "curve", "trace"]
        .filter((key) => Object.hasOwn(citation, key))
        .map((key) => [key, citation[key]])
    )
  };
}

export function curveIdentityMaterial(curve, conditionId, citationId) {
  return {
    schema_version: "1.0.0",
    characteristic: curve.characteristic,
    x_axis: curve.x_axis,
    y_axis: curve.y_axis,
    condition_id: conditionId,
    citation_id: citationId,
    points: curve.points.map(({ point_index, x_si, y_si }) => ({ point_index, x_si, y_si }))
  };
}

export function curveCohortMaterial(characteristic, conditionId, citationId, curveId) {
  return { characteristic, condition_id: conditionId, citation_id: citationId, curve_id: curveId };
}

export function scalarEvidenceMaterial(characteristic, evidence, quantity, valueSi, unitSi) {
  return {
    characteristic,
    role: evidence.role,
    quantity,
    value_si: valueSi,
    unit_si: unitSi,
    condition_id: evidence.condition_id,
    citation_id: evidence.citation_id
  };
}

export function pointEvidenceMaterial(characteristic, point, evidence) {
  return {
    characteristic,
    role: evidence.role,
    point_index: point.point_index,
    x_si: point.x_si,
    y_si: point.y_si,
    condition_id: evidence.condition_id,
    citation_id: evidence.citation_id,
    cohort_id: evidence.cohort_id,
    curve_id: evidence.curve_id
  };
}

export function operatingRegionBoundMaterial(bound) {
  return Object.fromEntries(
    Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))
  );
}
