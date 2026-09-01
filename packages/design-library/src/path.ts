import type { ManufacturerPartIdentity } from "@opencircuit/sourcing-schema";
import type { PartClassId } from "./types";

const SAFE_BYTE = /^[A-Za-z0-9_-]$/;

export function encodeMpnPathToken(mpn: string): string {
  let token = "";
  for (const byte of new TextEncoder().encode(mpn)) {
    const character = String.fromCharCode(byte);
    token += SAFE_BYTE.test(character) ? character : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return token;
}

export function decodeMpnPathToken(token: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < token.length;) {
    if (token[index] === "%") {
      const hex = token.slice(index + 1, index + 3);
      if (!/^[0-9A-F]{2}$/.test(hex)) throw new Error("MPN path token contains an invalid percent escape");
      bytes.push(Number.parseInt(hex, 16));
      index += 3;
    } else {
      const character = token[index]!;
      if (!SAFE_BYTE.test(character)) throw new Error("MPN path token contains an unescaped byte");
      bytes.push(character.charCodeAt(0));
      index += 1;
    }
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
}

export function designProfilePath(partClass: PartClassId, part: ManufacturerPartIdentity): string {
  return `packages/design-library/parts/${partClass}/${part.manufacturerId}/${encodeMpnPathToken(part.manufacturerPartNumber)}.json`;
}

export function designProfileId(partClass: PartClassId, part: ManufacturerPartIdentity): string {
  return designProfilePath(partClass, part);
}
