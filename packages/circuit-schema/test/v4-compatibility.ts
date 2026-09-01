import {
  canonicalizeCircuit,
  canonicalizeCircuitV4,
  deserializeAnyCircuit,
  deserializeCircuit,
  deserializeCircuitV4,
  generateNetlist,
  generateScenarioNetlist,
  migrateCircuit,
  type AnyCircuitDocument,
  type CircuitDocument,
  type CircuitDocumentV1,
  type CircuitDocumentV2,
  type CircuitDocumentV4,
} from "../src";

declare const v1: CircuitDocumentV1;
declare const v2: CircuitDocumentV2;
declare const v3: CircuitDocument;
declare const v4: CircuitDocumentV4;

const unionOne: AnyCircuitDocument = v1;
const unionTwo: AnyCircuitDocument = v2;
const unionThree: AnyCircuitDocument = v3;
const unionFour: AnyCircuitDocument = v4;
const deserializeV3Signature: (source: string) => CircuitDocument = deserializeCircuit;
const deserializeV4Signature: (source: string) => CircuitDocumentV4 = deserializeCircuitV4;
const deserializeAnySignature: (source: string) => AnyCircuitDocument = deserializeAnyCircuit;
const migrateSignature: (input: unknown) => CircuitDocument = migrateCircuit;

void [
  unionOne,
  unionTwo,
  unionThree,
  unionFour,
  deserializeV3Signature,
  deserializeV4Signature,
  deserializeAnySignature,
  migrateSignature,
];

// @ts-expect-error The Simulator canonicalizer only accepts current flat V3 documents.
canonicalizeCircuit(v4);
// @ts-expect-error The Simulator netlist path must not silently accept a V4 Designer document.
generateNetlist(v4);
// @ts-expect-error The V4 canonicalizer must not silently accept a flat Simulator V2 document.
canonicalizeCircuitV4(v2);
// @ts-expect-error The V4 scenario netlist path must not silently accept a flat Simulator V3 document.
generateScenarioNetlist(v3, "default");
