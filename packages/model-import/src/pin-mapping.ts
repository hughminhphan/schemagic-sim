import type { ImportedSubckt, PinMappingSpec, PinMappingValidation, SuggestedSymbol } from "./types";

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function suggestSymbol(subckt: ImportedSubckt): SuggestedSymbol {
  const name = subckt.name.toLowerCase();
  const pins = subckt.pins.map((pin) => pin.toLowerCase());
  const joined = `${name} ${pins.join(" ")}`;

  if (subckt.pins.length === 2) {
    return includesAny(joined, ["diode", "rect", "zener", "led", " anode", " cathode"]) ? "diode" : "two-terminal";
  }
  if (subckt.pins.length === 3) {
    if (includesAny(joined, ["mos", "fet", " gate", " drain", " source"])) return "mosfet";
    if (includesAny(joined, ["npn", "pnp", "bjt", "transistor", " base", "collector", "emitter"])) return "bjt";
    if (includesAny(joined, ["reg", "ldo", "vout", "vin", "gnd"])) return "regulator";
    return "three-terminal";
  }
  if (subckt.pins.length === 5 && includesAny(joined, ["opamp", "op_amp", "op-amp", "amp", "v+", "v-", "out"])) {
    return "opamp";
  }
  return "generic";
}

function symbolPins(symbol: SuggestedSymbol, count: number): string[] {
  switch (symbol) {
    case "diode":
      return ["A", "K"];
    case "bjt":
      return ["C", "B", "E"];
    case "mosfet":
      return ["D", "G", "S"];
    case "regulator":
      return ["IN", "GND", "OUT"];
    case "opamp":
      return ["IN+", "IN-", "V+", "V-", "OUT"];
    case "two-terminal":
    case "three-terminal":
    case "generic":
      return Array.from({ length: count }, (_, index) => `PIN${index + 1}`);
  }
}

export function derivePinMappingSpec(subckt: ImportedSubckt): PinMappingSpec {
  const suggestedSymbol = suggestSymbol(subckt);
  const labels = symbolPins(suggestedSymbol, subckt.pins.length);
  return {
    subcktName: subckt.name,
    modelPins: [...subckt.pins],
    suggestedSymbol,
    userMapping: Object.fromEntries(labels.map((label, index) => [label, index])),
  };
}

export function validatePinMapping(spec: PinMappingSpec): PinMappingValidation {
  const errors: string[] = [];
  const entries = Object.entries(spec.userMapping);
  if (spec.modelPins.length === 0) errors.push("A subcircuit must expose at least one model pin");
  if (entries.length !== spec.modelPins.length) {
    errors.push(`Mapping must contain exactly ${spec.modelPins.length} symbol pins`);
  }

  const seenIndices = new Set<number>();
  for (const [symbolPin, nodeIndex] of entries) {
    if (!symbolPin.trim()) errors.push("Symbol pin names must not be empty");
    if (!Number.isInteger(nodeIndex)) {
      errors.push(`Mapping for ${symbolPin} must be an integer node index`);
      continue;
    }
    if (nodeIndex < 0 || nodeIndex >= spec.modelPins.length) {
      errors.push(`Mapping for ${symbolPin} is outside model pin range`);
      continue;
    }
    if (seenIndices.has(nodeIndex)) errors.push(`Model pin index ${nodeIndex} is mapped more than once`);
    seenIndices.add(nodeIndex);
  }

  for (let index = 0; index < spec.modelPins.length; index += 1) {
    if (!seenIndices.has(index)) errors.push(`Model pin index ${index} is not mapped`);
  }

  const normalizedPins = spec.modelPins.map((pin) => pin.toLowerCase());
  if (new Set(normalizedPins).size !== normalizedPins.length) errors.push("Model pin names must be unique ignoring case");
  return { valid: errors.length === 0, errors };
}
