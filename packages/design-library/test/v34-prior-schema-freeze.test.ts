import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const schemaRoot = fileURLToPath(new URL("../schema/", import.meta.url));

const PRIOR_SCHEMA_SHA256 = {
  "admission.v1.schema.json": "e65c0f17d26659193cd7d15f4d463f50947fa5a62197acadfac59c4408c94210",
  "catalog-release.v1.schema.json": "c6a14de93274a990272c33d6c3539dfb2d2c29b3119d09fd95e49f3abebd0235",
  "facts/motor.full-bridge-gate-driver.v1.schema.json": "06f39d8e102ef7e20a9002df2631978c45d59252b1415e503fe112561dbfb79d",
  "facts/motor.full-bridge-gate-driver.v2.schema.json": "6c271d922e32338cfac4efd5637763f666b56de5c195839651401e06af9b7658",
  "facts/motor.full-bridge-gate-driver.v3-1.schema.json": "7c7cb38e2892ed031427b08ed186668cffd330321345aa182c686037f7a75712",
  "facts/motor.integrated-h-bridge.v1.schema.json": "6dff856905136490eaf353669e1eea747435741e8c764140fe3a0598e75433b2",
  "facts/motor.integrated-h-bridge.v2.schema.json": "4c1fe7f80b6b93decc58bd5b8cd5e33aee716a791e7f1c8b2ae3e167904a513a",
  "facts/motor.integrated-h-bridge.v3-2.schema.json": "9f0a6f3b6a92d177257b8c3e3afc4826b90259aec8503aaacb20f7e4ed8cc592",
  "facts/motor.supply-tvs-diode.v1.schema.json": "97e731a35065fe5e8f647ec758fb795d1b6a0e17ef89b9500ba9a038dd129937",
  "facts/motor.supply-tvs-diode.v2.schema.json": "e80b3a84d9f2494c09106526c950444074ae41d2f7a7e56f3c3ebf7ef800f458",
  "facts/motor.supply-tvs-diode.v3.schema.json": "1c03f24682b2c599e63f030f90134f2b60491270c00e2cfe9296c534e800331d",
  "facts/power.external-fet-synchronous-buck-controller.v1.schema.json": "e6647b13e75029a8d11a1216a4300bfc6dfd7a6bbe975077a58006e65705b1a7",
  "facts/power.external-fet-synchronous-buck-controller.v2.schema.json": "312ce88359e0980b7c0c26b16a0059d32c3958a2653a51771bb3df0c040cbcf5",
  "facts/power.integrated-synchronous-buck-regulator.v1.schema.json": "334ae0360176a28cb989c88defdde80dd33fc0d9ca50b7a56223caedf74e76d1",
  "facts/power.integrated-synchronous-buck-regulator.v2.schema.json": "d36edd5fd4fc6df931d5c7a069ac56f5ccc94800b964889153e3a2fcca07e279",
  "facts/power.integrated-synchronous-buck-regulator.v3-3.schema.json": "11bc49e84dceee05853f1242824cc670a350ed5085c432bfc444aa3f5c24b825",
  "facts/power.power-inductor.v1.schema.json": "5f4f40738a66bc2e98199a922185cca7655d1ee30d43b6f7d1b4bb64cac7cc38",
  "facts/power.power-inductor.v2.schema.json": "5972d294278b73397bd12086ed51ebac9419590bead9c0bf5be4de1ba2bdaa3e",
  "facts/shared.bulk-capacitor.v1.schema.json": "ab2f6fe66af5041f6dcbcbe0379a82ee6b5fcda9864d9dbba999ca56daaabcae",
  "facts/shared.bulk-capacitor.v2.schema.json": "332cfed186e3626d4f80dbf5127e0e74e7ef2a5f9332af3c56baf010877ce4e2",
  "facts/shared.current-sense-resistor.v1.schema.json": "aa6d729fa7c9e8e36a3b9e15b7b3c1c818fe9bdb8efa99d29b547c3cc0b1d93c",
  "facts/shared.current-sense-resistor.v2.schema.json": "d5098c4e55bff9ce1c5224eb21615a0926348124f1b565a0ce81a7d406485399",
  "facts/shared.general-purpose-resistor.v1.schema.json": "b2af916a382e58c64956a9cd580e6444b4eabd9e2d40d99ca52d0106704fe9dd",
  "facts/shared.general-purpose-resistor.v2.schema.json": "676e693dc9339faf12217ce13ea050c7a27219b4cba1a222c1bde83fea075be8",
  "facts/shared.mlcc-capacitor.v1.schema.json": "1b1368459b37ea5496eb7da0499df83914e96e51e752e7d8b19a24f80ce2efab",
  "facts/shared.mlcc-capacitor.v2.schema.json": "0366248d875f6a01dc1c11f365e276c290ebdb2cb1305f78f4d005e005f32235",
  "facts/shared.n-channel-power-mosfet.v1.schema.json": "7fba3bdc94b7ee06e1ca210aff15a6930bc1d4806155d2f2a35ff81aa7eda75f",
  "facts/shared.n-channel-power-mosfet.v2.schema.json": "704f9d41c2bea44e02d6d56f2829d3fdd5f89af28731f3c0cfd430c46a29e33a",
  "facts/shared.n-channel-power-mosfet.v3.schema.json": "7eb61930d6fa96be5533d8acdc0afd4e5c745ff44d2cae5416f1c34c028e078c",
  "facts/shared.switching-diode.v1.schema.json": "e0a2ed9f4c68c1cf1bf401c200e38366c40ddf7ac1dcf609831449b33d76e1d5",
  "facts/shared.switching-diode.v2.schema.json": "420ddc42da7a56ea043eb6807ac4f42b2ee091026d45bbd5d2eacf0ad25af567",
  "manufacturer-registry.v1.schema.json": "0f4d793154ae52ac703d12e3176fd880a5737af693c273b4600df153fbab5f97",
  "profile-envelope.facts-v2.schema.json": "d5d577bc81da5fe9904a7454845889a6dbc6902dcb2df0d51f8f8d26e058eaa4",
  "profile-envelope.facts-v3-1.schema.json": "e21c86e4d00d4ce7f8ec5b4a69e1e8216287187c8f72150ec9639ef2851612b9",
  "profile-envelope.facts-v3-2.schema.json": "1fc7864a7c4e9a12d1266c481ffd9b061ed8b60fc3e3feddbac6d31f6d3916ed",
  "profile-envelope.facts-v3-3.schema.json": "6996dc405055b78794c622c53f04b05675558d7a89d9d79ef7a17e30ce01c463",
  "profile-envelope.facts-v3.schema.json": "357ca04198194c1bc8435a9f1e51ed404486df2a7d2a88e7aff9f451cc39b830",
  "profile-envelope.v1.schema.json": "ce18238edde40da40091c741b7a3ec2caab95c8931fa4f6906c7689f3db55421",
  "profile.facts-v2.schema.json": "374f075a13dc5ad4f3fef0a8191706779fb11d6b01c06a4c720151612c3d604e",
  "profile.facts-v3-1.schema.json": "549483c8822c624cafc32720c899a4f6b1d700b7a41843731582140b668a146e",
  "profile.facts-v3-2.schema.json": "7e74aa1940fa76860860f8a7703545fc19ec45a6ce901d9cfc61d3bbaa36b7bf",
  "profile.facts-v3-3.schema.json": "b98d3d27e1654d65f4072ce41a47124c4f21c3cf79b1a86fe02806ffc4ae99ec",
  "profile.facts-v3.schema.json": "e98cc6577456d8bbf815446e4a9b5c8be2a530c37962e7c9eecdfb78fff9e9e3",
  "profile.v1.schema.json": "9647814a956b565339c5cb20c0b97dc220f7b8cb5e08430940bf1e9edaa552f5",
} as const;

function jsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? jsonFiles(join(directory, entry.name))
    : entry.name.endsWith(".json") ? [join(directory, entry.name)] : []);
}

/**
 * Reads the facts-schema version a schema file belongs to from its own name
 * rather than pinning the successor list. `…v3-4…` is 3.4, `…v3…` is 3.0, and a
 * file with no facts-version marker predates the versioned facts contracts.
 */
export function factsSchemaVersionForPath(path: string): { major: number; minor: number } | null {
  const match = /(?:^|[./-])v(\d+)(?:-(\d+))?(?=[./-])/.exec(path);
  if (!match) return null;
  const major = Number(match[1]);
  if (major < 3) return null;
  return { major, minor: match[2] === undefined ? 0 : Number(match[2]) };
}

function atOrAfter(path: string, major: number, minor: number): boolean {
  const version = factsSchemaVersionForPath(path);
  if (!version) return false;
  return version.major > major || (version.major === major && version.minor >= minor);
}

describe("facts 3.4.0 additive schema boundary", () => {
  it("keeps every pre-3.4 checked-in schema byte frozen", () => {
    const actual = Object.fromEntries(jsonFiles(schemaRoot)
      .map((path) => relative(schemaRoot, path))
      .filter((path) => !atOrAfter(path, 3, 4))
      .sort()
      .map((path) => [path, createHash("sha256").update(readFileSync(join(schemaRoot, path))).digest("hex")]));
    expect(actual).toEqual(PRIOR_SCHEMA_SHA256);
  });

  it("classifies each checked-in schema path by its own declared facts version", () => {
    expect(factsSchemaVersionForPath("profile.v1.schema.json")).toBeNull();
    expect(factsSchemaVersionForPath("facts/shared.mlcc-capacitor.v2.schema.json")).toBeNull();
    expect(factsSchemaVersionForPath("profile-envelope.facts-v3.schema.json")).toEqual({ major: 3, minor: 0 });
    expect(factsSchemaVersionForPath("facts/power.power-inductor.v3-4.schema.json")).toEqual({ major: 3, minor: 4 });
    expect(factsSchemaVersionForPath("facts/shared.mlcc-capacitor.v3-5.schema.json")).toEqual({ major: 3, minor: 5 });
  });
});
