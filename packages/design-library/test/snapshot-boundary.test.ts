import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  detachedJsonSnapshot,
  getDesignProfileCodec,
  loadReviewedDesignLibrary,
  parseDesignCatalogRelease,
  parseDesignProfile,
  parseDesignProfileAdmission,
  parseManufacturerRegistry,
  validateDesignLibrary,
  type DesignLibraryDocuments,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedLibraryFixture, createSyntheticReviewedProfile } from "../src/fixtures";

function toggled<Value extends object>(target: Value, key: PropertyKey, next: unknown): { proxy: Value; reads: () => number } {
  let count = 0;
  return {
    proxy: new Proxy(target, {
      get(current, property, receiver) {
        if (property !== key) return Reflect.get(current, property, receiver);
        count += 1;
        return count === 1 ? Reflect.get(current, property, receiver) : next;
      },
    }),
    reads: () => count,
  };
}

function expectPlainJson(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect([Object.prototype, Array.prototype]).toContain(Object.getPrototypeOf(value));
  for (const nested of Array.isArray(value) ? value : Object.values(value)) expectPlainJson(nested);
}

describe("detached public parse and load boundaries", () => {
  it("preserves an own enumerable __proto__ key for canonical bytes and closed-contract rejection", () => {
    const hostile = JSON.parse('{"safe":1,"__proto__":{"polluted":true}}') as Record<string, unknown>;
    expect(Object.getOwnPropertyDescriptor(hostile, "__proto__")).toMatchObject({
      enumerable: true,
      value: { polluted: true },
    });
    expect(canonicalJson(hostile)).toBe('{"__proto__":{"polluted":true},"safe":1}');

    const snapshot = detachedJsonSnapshot(hostile);
    expect(Object.getOwnPropertyDescriptor(snapshot, "__proto__")).toMatchObject({
      enumerable: true,
      value: { polluted: true },
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    const profile = JSON.parse(JSON.stringify(createSyntheticReviewedProfile("shared.general-purpose-resistor"))) as Record<string, unknown>;
    Object.defineProperty(profile, "__proto__", { enumerable: true, configurable: true, writable: true, value: { polluted: true } });
    expect(() => parseDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/__proto__.*unknown_key/);

    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const path = Object.keys(documents.profiles)[0]!;
    const storedProfile = documents.profiles[path] as unknown as Record<string, unknown>;
    Object.defineProperty(storedProfile, "__proto__", { enumerable: true, configurable: true, writable: true, value: { polluted: true } });
    expect(() => loadReviewedDesignLibrary(documents)).toThrow(/__proto__.*unknown_key/);
  });

  it("captures a toggle Proxy once before profile validation", () => {
    const source = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    const toggle = toggled(source, "format", "attacker-format");
    const parsed = parseDesignProfile(toggle.proxy, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(toggle.reads()).toBe(1);
    expect(parsed.format).toBe("schemagic-design-profile");
    source.facts.resistance.value!.value = 99;
    expect((parsed.facts as any).resistance.value!.value).not.toBe(99);
    expectPlainJson(parsed);
  });

  it("snapshots every public parser, including codec facts", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const registry = parseManufacturerRegistry(documents.manufacturerRegistry);
    const admission = parseDesignProfileAdmission(documents.admission);
    const release = parseDesignCatalogRelease(documents.catalogRelease);
    const profile = Object.values(documents.profiles)[0] as ReturnType<typeof createSyntheticReviewedProfile<"shared.general-purpose-resistor">>;
    const factsToggle = toggled(profile.facts, "resistance", undefined);
    const facts = getDesignProfileCodec("shared.general-purpose-resistor").parseFacts(factsToggle.proxy, registry.manufacturers[0]);
    expect(factsToggle.reads()).toBe(1);
    expect(facts.resistance.value!.value).toBe(profile.facts.resistance.value!.value);
    expectPlainJson(registry); expectPlainJson(admission); expectPlainJson(release); expectPlainJson(facts);
  });

  it("reads an accessor or Proxy-backed profile path once during load", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const path = Object.keys(documents.profiles)[0]!;
    const profile = documents.profiles[path];
    let accessorReads = 0;
    const accessorProfiles: Record<string, unknown> = {};
    Object.defineProperty(accessorProfiles, path, { enumerable: true, get: () => { accessorReads += 1; return profile; } });
    const loadedFromAccessor = loadReviewedDesignLibrary({ ...documents, profiles: accessorProfiles });
    expect(accessorReads).toBe(1);
    expect(loadedFromAccessor.profiles).toHaveLength(1);

    const toggle = toggled(documents.profiles as Record<string, unknown>, path, undefined);
    const loadedFromProxy = loadReviewedDesignLibrary({ ...documents, profiles: toggle.proxy });
    expect(toggle.reads()).toBe(1);
    expect(loadedFromProxy).toEqual(loadedFromAccessor);
  });

  it("never resolves inherited profile paths or inherited profile fields", () => {
    const documents = createSyntheticReviewedLibraryFixture(["shared.general-purpose-resistor"]);
    const inheritedProfiles = Object.create(documents.profiles) as Record<string, unknown>;
    const inheritedDocuments: DesignLibraryDocuments = { ...documents, profiles: inheritedProfiles };
    expect(validateDesignLibrary(inheritedDocuments)).toContainEqual(expect.objectContaining({ code: "missing_profile" }));
    expect(() => loadReviewedDesignLibrary(inheritedDocuments)).toThrow(/missing_profile/);

    const inheritedProfile = Object.create(Object.values(documents.profiles)[0] as object) as unknown;
    expect(() => parseDesignProfile(inheritedProfile, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/invalid_object|missing_key/);
  });
});
