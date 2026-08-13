import crypto from "node:crypto";

export function stableIdentityValue(value) {
  if (Array.isArray(value)) return value.map(stableIdentityValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableIdentityValue(value[key])]));
  }
  return value;
}

export function canonicalIdentityJson(value) {
  const encode = (item) => {
    if (item === null) return "null";
    if (typeof item === "string") return JSON.stringify(item);
    if (typeof item === "boolean") return item ? "true" : "false";
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new Error("identity material numbers must be finite");
      return JSON.stringify(Object.is(item, -0) ? 0 : item);
    }
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    if (item && typeof item === "object") {
      return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${encode(item[key])}`).join(",")}}`;
    }
    throw new Error(`identity material contains non-JSON value: ${typeof item}`);
  };
  return encode(value);
}

export function identityHash(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalIdentityJson(value)).digest("hex")}`;
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

export function directEvidenceUnionErrors(bound, evidenceValues, label = "operating-region bound") {
  if (bound?.derivation !== "direct_evidence_union") return [];
  const values = evidenceValues.map(Number).filter(Number.isFinite);
  if (!values.length) return [`${label} direct_evidence_union has no referenced values for its quantity`];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (bound.kind === "enumerated") {
    const expected = [...new Set(values)].sort((left, right) => left - right);
    return JSON.stringify(bound.values) === JSON.stringify(expected)
      ? []
      : [`${label} direct_evidence_union values must exactly equal the sorted unique referenced values`];
  }
  if (bound.kind === "minimum" && bound.minimum !== minimum) {
    return [`${label} direct_evidence_union minimum must equal the referenced minimum`];
  }
  if (bound.kind === "maximum" && bound.maximum !== maximum) {
    return [`${label} direct_evidence_union maximum must equal the referenced maximum`];
  }
  if (bound.kind === "range" && (bound.minimum !== minimum || bound.maximum !== maximum)) {
    return [`${label} direct_evidence_union range must exactly equal the referenced extrema`];
  }
  return [];
}

export function directEvidenceIntersectionErrors(bound, evidenceDomains, label = "operating-region bound") {
  if (bound?.derivation !== "direct_evidence_intersection") return [];
  const domains = evidenceDomains.map((domain) => {
    if (Array.isArray(domain?.values)) {
      const values = [...new Set(domain.values.map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
      return values.length ? { kind: "enumerated", values } : null;
    }
    const minimum = Number(domain?.minimum);
    const maximum = Number(domain?.maximum);
    return Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum
      ? { kind: "range", minimum, maximum }
      : null;
  });
  if (domains.some((domain) => !domain) || !domains.length) {
    return [`${label} direct_evidence_intersection cannot represent every referenced canonical value, range, or enumeration`];
  }
  const discrete = domains.filter((domain) => domain.kind === "enumerated");
  if (discrete.length) {
    let values = discrete[0].values;
    for (const domain of domains) {
      values = values.filter((value) => domain.kind === "enumerated"
        ? domain.values.includes(value)
        : value >= domain.minimum && value <= domain.maximum);
    }
    if (!values.length) return [`${label} direct_evidence_intersection is empty`];
    return bound.kind === "enumerated" && JSON.stringify(bound.values) === JSON.stringify(values)
      ? []
      : [`${label} direct_evidence_intersection values must exactly equal the sorted unique referenced overlap`];
  }
  const minimum = Math.max(...domains.map((domain) => domain.minimum));
  const maximum = Math.min(...domains.map((domain) => domain.maximum));
  if (minimum > maximum) return [`${label} direct_evidence_intersection is empty`];
  if (minimum === maximum) {
    if (bound.kind === "enumerated" && JSON.stringify(bound.values) === JSON.stringify([minimum])) return [];
    if (bound.kind === "range" && bound.minimum === minimum && bound.maximum === maximum) return [];
    return [`${label} direct_evidence_intersection must exactly equal the singleton referenced overlap`];
  }
  return bound.kind === "range" && bound.minimum === minimum && bound.maximum === maximum
    ? []
    : [`${label} direct_evidence_intersection range must exactly equal the referenced overlap`];
}

export function activeVdmosModelCard(modelText, modelName = null) {
  const activeLines = String(modelText ?? "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\*/.test(line))
    .map((line) => line.replace(/\s+\$.*$/, ""));
  const active = activeLines.join("\n");
  const cards = [...active.matchAll(/^\s*\.model\s+(\S+)\s+VDMOS\s*\(([^)]*)\)/gim)]
    .map((match) => ({ name: match[1], body: match[2] }));
  const instanceModels = [...new Set(activeLines.flatMap((line) => {
    const match = /^\s*M\S*\s+\S+\s+\S+\s+\S+\s+(\S+)\s*$/i.exec(line);
    return match ? [match[1]] : [];
  }))];
  let selected;
  if (modelName) selected = cards.filter((card) => card.name.toLowerCase() === String(modelName).toLowerCase());
  else {
    const referenced = cards.filter((card) => instanceModels.some((name) => name.toLowerCase() === card.name.toLowerCase()));
    selected = referenced.length ? referenced : cards.filter((card) => card.name.toLowerCase() === "dut");
    if (!selected.length && cards.length === 1) selected = cards;
  }
  if (selected.length !== 1) throw new Error(`model.cir must resolve exactly one active DUT VDMOS model card; found ${selected.length}`);
  const body = selected[0].body;
  const parameters = new Map();
  for (const match of body.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*([^\s(){}]+)/gi)) {
    const value = Number(match[2]);
    if (Number.isFinite(value)) parameters.set(match[1].toUpperCase(), value);
  }
  return {
    name: selected[0].name,
    pchan: /(?:^|\s)pchan(?:\s|$)/i.test(body),
    parameters
  };
}

export const MOSFET_F2_WORST_GATE = 0.20;
export const MOSFET_F2_RMS_GATE = 0.12;
export const MOSFET_RELATIVE_ERROR_FLOOR = 1e-12;

export function mosfetResidualRelativeError(row) {
  const target = Number(row?.datasheet_value);
  const fitted = Number(row?.fitted_value);
  if (!Number.isFinite(target) || !Number.isFinite(fitted)) return NaN;
  const denominator = Math.max(Math.abs(target), MOSFET_RELATIVE_ERROR_FLOOR);
  return row?.evidence_role === "inequality_constraint" && Object.hasOwn(row ?? {}, "maximum")
    ? Math.max(fitted - target, 0) / denominator
    : Math.abs(fitted - target) / denominator;
}

export function summarizeMosfetResiduals(residuals) {
  const rows = (residuals ?? []).map((row) => ({ row, relativeError: mosfetResidualRelativeError(row) }));
  if (!rows.length || rows.some(({ relativeError }) => !Number.isFinite(relativeError))) {
    return { rows, rms: NaN, worst: null, gatePass: false, quantities: new Map() };
  }
  const worst = rows.reduce((current, candidate) => candidate.relativeError > current.relativeError ? candidate : current);
  const rms = Math.sqrt(rows.reduce((sum, item) => sum + item.relativeError ** 2, 0) / rows.length);
  const quantities = new Map();
  for (const item of rows) {
    const key = item.row?.gate_quantity;
    if (typeof key !== "string" || !key) continue;
    const group = quantities.get(key) ?? [];
    group.push(item.relativeError);
    quantities.set(key, group);
  }
  const gatePass = quantities.size > 0 && [...quantities.values()].every((values) => {
    const quantityWorst = Math.max(...values);
    const quantityRms = Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length);
    return quantityWorst <= MOSFET_F2_WORST_GATE && quantityRms <= MOSFET_F2_RMS_GATE;
  });
  return { rows, rms, worst, gatePass, quantities };
}
