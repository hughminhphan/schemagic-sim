import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as library from "../src";
import { createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "../src/fixtures";
import type {
  DesignProfileCodec,
  DesignProfileFor,
  DesignProfileV1,
  ReviewedDesignLibrary,
} from "../src";

const V1_SCHEMA_SHA256 = Object.freeze({
  "admission.v1.schema.json": "e65c0f17d26659193cd7d15f4d463f50947fa5a62197acadfac59c4408c94210",
  "catalog-release.v1.schema.json": "c6a14de93274a990272c33d6c3539dfb2d2c29b3119d09fd95e49f3abebd0235",
  "facts/motor.full-bridge-gate-driver.v1.schema.json": "06f39d8e102ef7e20a9002df2631978c45d59252b1415e503fe112561dbfb79d",
  "facts/motor.integrated-h-bridge.v1.schema.json": "6dff856905136490eaf353669e1eea747435741e8c764140fe3a0598e75433b2",
  "facts/motor.supply-tvs-diode.v1.schema.json": "97e731a35065fe5e8f647ec758fb795d1b6a0e17ef89b9500ba9a038dd129937",
  "facts/power.external-fet-synchronous-buck-controller.v1.schema.json": "e6647b13e75029a8d11a1216a4300bfc6dfd7a6bbe975077a58006e65705b1a7",
  "facts/power.integrated-synchronous-buck-regulator.v1.schema.json": "334ae0360176a28cb989c88defdde80dd33fc0d9ca50b7a56223caedf74e76d1",
  "facts/power.power-inductor.v1.schema.json": "5f4f40738a66bc2e98199a922185cca7655d1ee30d43b6f7d1b4bb64cac7cc38",
  "facts/shared.bulk-capacitor.v1.schema.json": "ab2f6fe66af5041f6dcbcbe0379a82ee6b5fcda9864d9dbba999ca56daaabcae",
  "facts/shared.current-sense-resistor.v1.schema.json": "aa6d729fa7c9e8e36a3b9e15b7b3c1c818fe9bdb8efa99d29b547c3cc0b1d93c",
  "facts/shared.general-purpose-resistor.v1.schema.json": "b2af916a382e58c64956a9cd580e6444b4eabd9e2d40d99ca52d0106704fe9dd",
  "facts/shared.mlcc-capacitor.v1.schema.json": "1b1368459b37ea5496eb7da0499df83914e96e51e752e7d8b19a24f80ce2efab",
  "facts/shared.n-channel-power-mosfet.v1.schema.json": "7fba3bdc94b7ee06e1ca210aff15a6930bc1d4806155d2f2a35ff81aa7eda75f",
  "facts/shared.switching-diode.v1.schema.json": "e0a2ed9f4c68c1cf1bf401c200e38366c40ddf7ac1dcf609831449b33d76e1d5",
  "manufacturer-registry.v1.schema.json": "0f4d793154ae52ac703d12e3176fd880a5737af693c273b4600df153fbab5f97",
  "profile-envelope.v1.schema.json": "ce18238edde40da40091c741b7a3ec2caab95c8931fa4f6906c7689f3db55421",
  "profile.v1.schema.json": "9647814a956b565339c5cb20c0b97dc220f7b8cb5e08430940bf1e9edaa552f5",
});

const V1_PROFILE_HASHES = Object.freeze({
  "motor.integrated-h-bridge": "sha256:7bad1ca5c93d20adc5e7f4e0c7a62771d3cf0d92dc54cedf0a42ec62d987c71b",
  "motor.full-bridge-gate-driver": "sha256:74ab616d23400c4af737ceef74ded527c735de84a59ea09a073409a363ee4c99",
  "power.integrated-synchronous-buck-regulator": "sha256:a2578037b7d9ced29001008d58c85ddf2379677c7a04ae7e68c8e8430fd44051",
  "power.external-fet-synchronous-buck-controller": "sha256:b44d47b514940d0c816ca68daba38331f89ab24103239debc0c2a9f0c56caf31",
  "shared.n-channel-power-mosfet": "sha256:a08102c45f5e57af05e635aa00bbb4c3f02ac2b9c4dd7256d6d7ba3ba2c095ce",
  "shared.current-sense-resistor": "sha256:0114d708a14fd6220cd05d648b0288c2f9968072ca2e0324d56f73e17b9c1f79",
  "shared.general-purpose-resistor": "sha256:ac9763820c8fea6a03873eda3d9032c4dc7ea655ffb84be4deb9283b6f464d8d",
  "shared.switching-diode": "sha256:a1d9ef26a7ae6e11ebc6937a56756f2478837368de6ee22d0af5d9f3aa657139",
  "shared.mlcc-capacitor": "sha256:d2813c695f11d516f89b7d016c6da7692f97ce5424e9eaaf99cd37b23b9b1365",
  "shared.bulk-capacitor": "sha256:a6e25f122aae83b2bcc00d5a4ae669a8c899843904f27ab1e775a758fbeaadc0",
  "motor.supply-tvs-diode": "sha256:71042f5f3ed287ff9b29cc23d1fafe86ee9c9c5e108cf3394105629800f106c9",
  "power.power-inductor": "sha256:a2ffa10d2c585d6ee62be931d95881a56cd192ba5e18378d723b7ef28fa99d41",
});

const V1_PUBLIC_EXPORTS = Object.freeze([
  "ADMISSION_LEDGER_FORMAT", "CANONICAL_EVIDENCE_URL_PATTERN_SOURCE", "CATALOG_RELEASE_FORMAT",
  "COMMERCIAL_BOUNDARY_VOCABULARY", "COMMON_ADMISSION_CHECK_IDS", "DESIGN_PROFILE_CODECS",
  "DESIGN_PROFILE_FORMAT", "DESIGN_PROFILE_SCHEMA_VERSION", "EVIDENCE_TRUST_RULES", "FACTS_SCHEMA_VERSION",
  "MANUFACTURER_REGISTRY_FORMAT", "PART_CLASS_IDS", "PART_CLASS_SPECS", "TRUSTED_INDEPENDENT_EVIDENCE_HOSTS",
  "adaptMotorCapacitor", "adaptMotorGateDriver", "adaptMotorIntegratedBridge", "adaptMotorMosfet", "adaptMotorResistor",
  "adaptMotorShunt", "adaptPowerCapacitor", "adaptPowerExternalController", "adaptPowerInductor",
  "adaptPowerIntegratedRegulator", "adaptPowerMosfet", "adaptPowerResistor", "admissionContentHash",
  "assertValidDesignCatalogRelease", "assertValidDesignProfile", "assertValidDesignProfileAdmission",
  "assertValidManufacturerRegistry", "canonicalDesignProfile", "canonicalJson", "classifyCommercialBoundaryKey",
  "compareAscii", "contentHash", "decodeMpnPathToken", "deepFreeze", "designCatalogContentHash",
  "designProfileContentHash", "designProfileId", "designProfilePath", "detachedJsonSnapshot", "encodeMpnPathToken",
  "getBundledDesignLibraryDocuments", "getDesignProfileCodec", "loadReviewedDesignLibrary",
  "manufacturerRegistryContentHash", "migrateDesignProfile", "migrateDesignProfileFor", "parseCanonicalEvidenceUrl",
  "parseDesignCatalogRelease", "parseDesignProfile", "parseDesignProfileAdmission", "parseDesignProfileFor",
  "parseManufacturerRegistry", "requiredAdmissionCheckIds", "reviewedAdmissionEntries", "reviewedAdmissionProjection",
  "validateCodecRegistryBoundary", "validateCommercialDataBoundary", "validateDesignCatalogRelease",
  "validateDesignLibrary", "validateDesignProfile", "validateDesignProfileAdmission", "validateFactsForCodec",
  "validateManufacturerRegistry", "validateProfileAdmissionRules",
]);

const v1Codec: DesignProfileCodec<"shared.switching-diode"> = library.getDesignProfileCodec("shared.switching-diode");
const v1Profile: DesignProfileFor<"shared.switching-diode"> = library.parseDesignProfileFor(v1Codec, createSyntheticReviewedProfile("shared.switching-diode"));
const v1Envelope: DesignProfileV1 = v1Profile;
const v1Loader: ReviewedDesignLibrary = library.loadReviewedDesignLibrary(createSyntheticReviewedLibraryFixture());
void v1Envelope;
void v1Loader;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : entry.name.endsWith(".ts") ? [join(directory, entry.name)] : []);
}

describe("frozen V1 compatibility and dependency inventory", () => {
  it("keeps every V1 schema byte hash unchanged", () => {
    for (const [relative, expected] of Object.entries(V1_SCHEMA_SHA256)) {
      const bytes = readFileSync(new URL(`../schema/${relative}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), relative).toBe(expected);
    }
  });

  it("keeps canonical V1 fixtures, release, and loader projections unchanged", () => {
    for (const partClass of library.PART_CLASS_IDS) {
      expect(library.designProfileContentHash(createSyntheticReviewedProfile(partClass)), partClass)
        .toBe(V1_PROFILE_HASHES[partClass]);
    }
    const documents = createSyntheticReviewedLibraryFixture();
    expect((documents.catalogRelease as { contentHash: string }).contentHash)
      .toBe("sha256:5aacd03897a35fdfb99f7e20fe5a5529c059a88eac61650e33d6dab9cd725da1");
    expect(library.contentHash(library.loadReviewedDesignLibrary(documents)))
      .toBe("sha256:a470e49a1f44b8c4701af9dabfacc48ecd7f7cdc0cdf4628fe1dc67ec4cd8832");
  });

  it("retains every frozen V1 root export while allowing named additive exports", () => {
    for (const name of V1_PUBLIC_EXPORTS) expect(library, name).toHaveProperty(name);
  });

  it("keeps design-library below recipes and engine in the dependency graph", () => {
    const sourceRoot = new URL("../src/", import.meta.url).pathname;
    for (const file of sourceFiles(sourceRoot)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/@opencircuit\/(?:design-recipes|design-engine)/);
    }
  });
});
