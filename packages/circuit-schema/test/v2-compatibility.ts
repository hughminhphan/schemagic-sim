import {
  canonicalizeCircuit,
  deserializeCircuit,
  generateNetlist,
  migrateCircuit,
  type AnyCircuitDocument,
  type CircuitDocument,
  type CircuitDocumentV1,
  type CircuitDocumentV2,
} from "../src";

declare const v1: CircuitDocument;
declare const v2: CircuitDocumentV2;

const alias: CircuitDocumentV1 = v1;
const unionOne: AnyCircuitDocument = alias;
const unionTwo: AnyCircuitDocument = v2;
const deserializeSignature: (source: string) => CircuitDocument = deserializeCircuit;
const migrateSignature: (input: unknown) => CircuitDocument = migrateCircuit;
const canonicalSignature: (document: CircuitDocument, includeView?: boolean) => string = canonicalizeCircuit;
const generateSignature: (document: CircuitDocument) => ReturnType<typeof generateNetlist> = generateNetlist;

void [unionOne, unionTwo, deserializeSignature, migrateSignature, canonicalSignature, generateSignature];

// @ts-expect-error Existing v1-only API must not silently accept CircuitDocumentV2.
canonicalizeCircuit(v2);
// @ts-expect-error Existing v1-only netlist API must not silently accept CircuitDocumentV2.
generateNetlist(v2);
