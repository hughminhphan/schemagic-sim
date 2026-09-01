import { deserializeDesignRequest, serializeDesignRequest, type DesignRequest } from "@opencircuit/design-schema";
import type { ElectricalDesignRequest } from "./types";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function normalizeDesignRequest(request: DesignRequest): Readonly<DesignRequest> {
  return deepFreeze(deserializeDesignRequest(serializeDesignRequest(request)));
}

export function toElectricalDesignRequest(request: Readonly<DesignRequest>): Readonly<ElectricalDesignRequest> {
  const { sourcing: _sourcing, ...electrical } = request;
  return deepFreeze(electrical as ElectricalDesignRequest);
}
