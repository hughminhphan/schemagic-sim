import type { PrimaryPartCustomizationSidecarV1 } from "@opencircuit/design-schema";
import {
  decodeElectricalDesignRequestShare,
  type ElectricalDesignRequestTransfer,
} from "./RequestTransfer";
import {
  decodeImportedDesignResultShare,
  type ImportedDesignResultShareState,
} from "./ResultShare";
import {
  assertPrimaryPartCustomizationRequestBinding,
  decodePrimaryPartCustomizationShare,
} from "./PrimaryPartCustomizationTransfer";

export class DesignerShareStateError extends Error {
  constructor() {
    super("Designer URL contains an unsupported or conflicting share state.");
    this.name = "DesignerShareStateError";
  }
}

export type DesignerShareState =
  | Readonly<{ kind: "empty" }>
  | Readonly<{
      kind: "request";
      request: ElectricalDesignRequestTransfer;
      customization?: Readonly<PrimaryPartCustomizationSidecarV1>;
    }>
  | Readonly<{ kind: "result"; result: ImportedDesignResultShareState }>;

export function parseDesignerShareState(hash: string): DesignerShareState {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const keys = [...params.keys()];
  if (keys.length === 0) return Object.freeze({ kind: "empty" });
  const keySet = new Set(keys);
  if (keySet.size !== keys.length || [...keySet].some((key) => key !== "d" && key !== "r" && key !== "c")) {
    throw new DesignerShareStateError();
  }
  if (keySet.size === 1 && keySet.has("d")) {
    return Object.freeze({ kind: "result", result: decodeImportedDesignResultShare(params.get("d")!) });
  }
  if (keySet.size === 1 && keySet.has("r")) {
    return Object.freeze({ kind: "request", request: decodeElectricalDesignRequestShare(params.get("r")!) });
  }
  if (keySet.size === 2 && keySet.has("r") && keySet.has("c")) {
    const request = decodeElectricalDesignRequestShare(params.get("r")!);
    const customization = decodePrimaryPartCustomizationShare(params.get("c")!).sidecar;
    assertPrimaryPartCustomizationRequestBinding(customization, request.request);
    return Object.freeze({ kind: "request", request, customization });
  }
  throw new DesignerShareStateError();
}
