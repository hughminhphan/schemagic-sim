import {
  boundedDetachedFrozenDesignV2Value,
  canonicalDesignV2Payload,
  canonicalDesignV2Value,
  designSha256ContentHash,
  detachedFrozenDesignV2Value,
  projectElectricalDesignRequestIdentityV2,
} from "./v2-canonical";
import { DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES } from "./v2-limits";
import { parseElectricalDesignRequestV2 } from "./v2-request";
import type { ElectricalDesignRequestV2 } from "./v2-types";
import { ConstraintParseErrorV3, PRODUCTION_STRICT_CONSTRAINT_POLICY_V3, type ConstraintPolicyIdV3 } from "./v3-constraint-types";

type ElectricalRequestV3<Request extends ElectricalDesignRequestV2> = Request extends ElectricalDesignRequestV2
  ? Omit<Request, "schemaVersion" | "constraints"> & {
      schemaVersion: 3;
      constraintPolicy: ConstraintPolicyIdV3;
      constraints: Omit<Request["constraints"], "allowUnknownWarnings" | "allowUnknownHardConstraints">;
    }
  : never;

export type ElectricalDesignRequestV3 = ElectricalRequestV3<ElectricalDesignRequestV2>;
export type BrushedDcMotorDesignRequestV3 = Extract<ElectricalDesignRequestV3, { application: "motor.brushed-dc" }>;
export type BuckDesignRequestV3 = Extract<ElectricalDesignRequestV3, { application: "power.buck" }>;

export function parseElectricalDesignRequestV3(input: unknown): ElectricalDesignRequestV3 {
  let snapshot: unknown;
  try { snapshot = boundedDetachedFrozenDesignV2Value(input, "electrical_request", DESIGN_REQUEST_V2_MAX_CANONICAL_BYTES); }
  catch { throw new ConstraintParseErrorV3("invalid_document", "electrical_request", ""); }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "");
  const raw = canonicalDesignV2Value(snapshot) as Record<string, unknown>;
  if (raw.schemaVersion !== 3) throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/schemaVersion");
  if (raw.constraintPolicy !== PRODUCTION_STRICT_CONSTRAINT_POLICY_V3) throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/constraintPolicy");
  if (!raw.constraints || typeof raw.constraints !== "object" || Array.isArray(raw.constraints)) throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/constraints");
  const rawConstraints = raw.constraints as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(rawConstraints, "allowUnknownWarnings")) throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/constraints/allowUnknownWarnings");
  if (Object.prototype.hasOwnProperty.call(rawConstraints, "allowUnknownHardConstraints")) throw new ConstraintParseErrorV3("invalid_document", "electrical_request", "/constraints/allowUnknownHardConstraints");
  const { constraintPolicy: _constraintPolicy, ...withoutPolicy } = raw;
  let v2: ElectricalDesignRequestV2;
  try { v2 = parseElectricalDesignRequestV2({ ...withoutPolicy, schemaVersion: 2, constraints: { ...rawConstraints, allowUnknownWarnings: true, allowUnknownHardConstraints: true } }); }
  catch { throw new ConstraintParseErrorV3("invalid_document", "electrical_request", ""); }
  const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = v2.constraints;
  return detachedFrozenDesignV2Value({ ...v2, schemaVersion: 3, constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3, constraints } as ElectricalDesignRequestV3);
}

export function canonicalElectricalDesignRequestV3Payload(request: Readonly<ElectricalDesignRequestV3>): string {
  return canonicalDesignV2Payload(parseElectricalDesignRequestV3(request));
}

export function projectElectricalDesignRequestIdentityV3(request: Readonly<ElectricalDesignRequestV3>): Record<string, unknown> {
  const parsed = parseElectricalDesignRequestV3(request);
  const v2Identity = projectElectricalDesignRequestIdentityV2(projectElectricalDesignRequestV3ToObservationV2(parsed));
  const identityConstraints = v2Identity.constraints as Record<string, unknown>;
  const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _unknown, ...constraints } = identityConstraints;
  return { ...v2Identity, schemaVersion: 3, constraintPolicy: parsed.constraintPolicy, constraints };
}

export function designRequestHashV3(request: Readonly<ElectricalDesignRequestV3>): `sha256:${string}` {
  return designSha256ContentHash(canonicalDesignV2Payload(projectElectricalDesignRequestIdentityV3(request)));
}

/** The only V3-to-V2 bridge: observe all retained V2 outcomes, then decide in the V3 sidecar. */
export function projectElectricalDesignRequestV3ToObservationV2(request: Readonly<ElectricalDesignRequestV3>): ElectricalDesignRequestV2 {
  const parsed = parseElectricalDesignRequestV3(request);
  const { constraintPolicy: _policy, constraints, ...withoutPolicy } = parsed;
  return parseElectricalDesignRequestV2({
    ...withoutPolicy,
    schemaVersion: 2,
    constraints: { ...constraints, allowUnknownWarnings: true, allowUnknownHardConstraints: true },
  });
}
