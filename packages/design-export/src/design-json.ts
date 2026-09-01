import {
  parseDesignResultV2 as parseDesignResultV2Document,
  serializeDesignResultV2 as serializeDesignResultV2Document,
  type DesignResultV2,
  type PersistedDesignResultV1,
} from "@opencircuit/design-schema";
import { canonicalJson } from "./canonical";

/** Serialize a complete, versioned scheMAGIC Designer result deterministically. */
export function serializeDesignResult(result: Readonly<PersistedDesignResultV1>): string {
  if (result.format !== "schemagic-design-result" || result.schemaVersion !== 1) {
    throw new Error("Unsupported scheMAGIC design result version");
  }
  return canonicalJson(result);
}

/** Byte-identical, explicitly versioned alias for the frozen V1 serializer. */
export function serializeDesignResultV1(result: Readonly<PersistedDesignResultV1>): string {
  return serializeDesignResult(result);
}

/** Strictly parse and detach an electrical-only scheMAGIC Designer V2 result. */
export function parseDesignResultV2(input: unknown): DesignResultV2 {
  return parseDesignResultV2Document(input);
}

/** Strictly validate before returning the canonical V2 result bytes. */
export function serializeDesignResultV2(result: Readonly<DesignResultV2>): string {
  return serializeDesignResultV2Document(parseDesignResultV2Document(result));
}
