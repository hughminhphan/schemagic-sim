import type { Quantity } from "@opencircuit/design-schema";
import { unitConversion } from "./units";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function formatIdentifier(value: string): string {
  return value
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

const UNIT_LABELS: Record<string, string> = {
  "1": "",
  m2: "m²",
  ohm: "Ω",
  rad_per_s: "rad/s",
  V_s_per_rad: "V·s/rad",
};

export function formatQuantity(quantity: Quantity | undefined): string {
  if (!quantity) return "Not reported";
  const displayUnit = quantity.displayUnit || quantity.unit;
  const unit = UNIT_LABELS[displayUnit] ?? displayUnit;
  const displayValue = unitConversion(quantity.unit, displayUnit).fromCanonical(quantity.value);
  const value = Number.isInteger(displayValue)
    ? String(displayValue)
    : Number(displayValue.toPrecision(6)).toString();
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function statusChip(status: string): string {
  return `<span class="designer-chip" data-status="${escapeHtml(status)}">${escapeHtml(formatIdentifier(status))}</span>`;
}
