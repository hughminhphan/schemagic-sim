import { assertValidCircuit, canonicalizeCircuit, migrateCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
import type { MeasurementResult, QuantityDimension, SignalDefinition, SignalSeries } from "@opencircuit/signal-workbench";
import {
  normalizeMeasurementWorkbenchState,
  type MeasurementWorkbenchState,
} from "./measurement-state";

const DATABASE_NAME = "schemagic-simulator";
const DATABASE_VERSION = 2;
const WORKSPACE_STORE = "workspaces";
const CAPTURE_STORE = "captures";
const ACTIVE_WORKSPACE_KEY = "schemagic.active-workspace";
const CAPTURE_BUNDLE_VERSION = 1 as const;

export const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_CAPTURE_BYTES = 24 * 1024 * 1024;

export interface Workspace {
  id: string;
  name: string;
  updatedAt: number;
  document: CircuitDocument;
  instrumentState?: MeasurementWorkbenchState;
}

export interface CaptureModelIdentity {
  componentId: string;
  modelId: string;
  contentHash?: string;
}

export interface CaptureIdentity {
  circuitHash: string;
  engine: string;
  runKey: string;
  modelIdentities: CaptureModelIdentity[];
  analysisSettings: unknown;
}

export interface CaptureSignal {
  definition: SignalDefinition;
  runKey: string;
  axis: {
    id: string;
    quantity: "time" | "frequency" | "dimensionless";
    unit: "s" | "Hz" | "1";
    values: Float64Array;
  };
  signal: {
    kind: "real" | "complex";
    unit: string;
    dimension: QuantityDimension;
    length: number;
    canonicalExpression: string;
    values: Float64Array;
  };
  segment?: number;
}

export interface SavedCapture {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
  identity: CaptureIdentity;
  signals: CaptureSignal[];
  measurements: MeasurementResult[];
  sizeBytes: number;
}

export type SavedCaptureInput = Omit<SavedCapture, "sizeBytes">;
export type CaptureMetadata = Omit<SavedCapture, "signals" | "measurements"> & {
  signalCount: number;
  measurementCount: number;
};

interface EncodedCaptureSignal extends Omit<CaptureSignal, "axis" | "signal"> {
  axis: Omit<CaptureSignal["axis"], "values"> & { valuesBase64: string };
  signal: Omit<CaptureSignal["signal"], "values"> & { valuesBase64: string };
}

interface EncodedSavedCapture extends Omit<SavedCapture, "signals"> {
  signals: EncodedCaptureSignal[];
}

interface CaptureBundle {
  format: "schemagic-workspace-bundle";
  version: typeof CAPTURE_BUNDLE_VERSION;
  workspace: Workspace;
  captures: EncodedSavedCapture[];
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) db.createObjectStore(WORKSPACE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CAPTURE_STORE)) {
        const captures = db.createObjectStore(CAPTURE_STORE, { keyPath: "id" });
        captures.createIndex("workspaceId", "workspaceId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the workspace database"));
  });
}

async function singleRequest<T>(
  storeName: typeof WORKSPACE_STORE | typeof CAPTURE_STORE,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("IndexedDB transaction was aborted")); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("IndexedDB transaction failed")); };
  });
}

function restoredWorkspace(row: Workspace): Workspace {
  return {
    ...row,
    document: migrateCircuit(row.document),
    ...(row.instrumentState ? { instrumentState: normalizeMeasurementWorkbenchState(row.instrumentState) } : {}),
  };
}

function storedWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    document: JSON.parse(canonicalizeCircuit(workspace.document)) as CircuitDocument,
    ...(workspace.instrumentState ? { instrumentState: normalizeMeasurementWorkbenchState(workspace.instrumentState) } : {}),
  };
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const rows = await singleRequest<Workspace[]>(WORKSPACE_STORE, "readonly", (store) => store.getAll());
  return rows.sort((left, right) => right.updatedAt - left.updatedAt).map(restoredWorkspace);
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  await singleRequest<IDBValidKey>(WORKSPACE_STORE, "readwrite", (store) => store.put(storedWorkspace(workspace)));
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
}

export async function deleteWorkspace(id: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([WORKSPACE_STORE, CAPTURE_STORE], "readwrite");
    transaction.objectStore(WORKSPACE_STORE).delete(id);
    const captureStore = transaction.objectStore(CAPTURE_STORE);
    const keys = captureStore.index("workspaceId").getAllKeys(IDBKeyRange.only(id));
    keys.onsuccess = () => { for (const key of keys.result) captureStore.delete(key); };
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("Workspace deletion was aborted")); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("Workspace deletion failed")); };
  });
  if (localStorage.getItem(ACTIVE_WORKSPACE_KEY) === id) localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}

export async function loadWorkspace(id: string): Promise<Workspace | undefined> {
  const row = await singleRequest<Workspace | undefined>(WORKSPACE_STORE, "readonly", (store) => store.get(id));
  return row ? restoredWorkspace(row) : undefined;
}

export function activeWorkspaceId(): string | null {
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function makeWorkspace(document: CircuitDocument, name = document.meta.title): Workspace {
  return { id: crypto.randomUUID(), name, updatedAt: Date.now(), document: structuredClone(document) };
}

export function captureSignal(series: SignalSeries): CaptureSignal {
  return {
    definition: structuredClone(series.definition),
    runKey: series.runKey,
    axis: {
      id: series.axis.id,
      quantity: series.axis.quantity,
      unit: series.axis.unit,
      values: series.axis.values.slice(),
    },
    signal: {
      kind: series.signal.kind,
      unit: series.signal.unit,
      dimension: structuredClone(series.signal.dimension),
      length: series.signal.length,
      canonicalExpression: series.signal.canonicalExpression,
      values: series.signal.values.slice(),
    },
    ...(series.segment === undefined ? {} : { segment: series.segment }),
  };
}

function metadataForSize(capture: SavedCaptureInput | SavedCapture): unknown {
  return {
    id: capture.id,
    workspaceId: capture.workspaceId,
    name: capture.name,
    createdAt: capture.createdAt,
    identity: capture.identity,
    signals: capture.signals.map((signal) => ({
      definition: signal.definition,
      runKey: signal.runKey,
      axis: { id: signal.axis.id, quantity: signal.axis.quantity, unit: signal.axis.unit, length: signal.axis.values.length },
      signal: {
        kind: signal.signal.kind,
        unit: signal.signal.unit,
        dimension: signal.signal.dimension,
        length: signal.signal.length,
        canonicalExpression: signal.signal.canonicalExpression,
        valueCount: signal.signal.values.length,
      },
      ...(signal.segment === undefined ? {} : { segment: signal.segment }),
    })),
    measurements: capture.measurements,
  };
}

export function captureSizeBytes(capture: SavedCaptureInput | SavedCapture): number {
  const vectorBytes = capture.signals.reduce((total, signal) => (
    total + signal.axis.values.byteLength + signal.signal.values.byteLength
  ), 0);
  return vectorBytes + new TextEncoder().encode(JSON.stringify(metadataForSize(capture))).byteLength;
}

function boundedCapture(input: SavedCaptureInput): SavedCapture {
  const capture: SavedCapture = { ...structuredClone(input), sizeBytes: captureSizeBytes(input) };
  if (capture.sizeBytes > MAX_CAPTURE_BYTES) {
    throw new Error(`Capture exceeds the ${MAX_CAPTURE_BYTES} byte per-capture limit`);
  }
  return capture;
}

export async function saveCapture(input: SavedCaptureInput): Promise<SavedCapture> {
  const capture = boundedCapture(input);
  const db = await database();
  return new Promise<SavedCapture>((resolve, reject) => {
    const transaction = db.transaction(CAPTURE_STORE, "readwrite");
    const store = transaction.objectStore(CAPTURE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const existing = request.result as SavedCapture[];
      const used = existing.reduce((total, item) => total + (item.id === capture.id ? 0 : captureSizeBytes(item)), 0);
      if (used + capture.sizeBytes > MAX_TOTAL_CAPTURE_BYTES) {
        transaction.abort();
        return;
      }
      store.put(capture);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to inspect capture storage"));
    transaction.oncomplete = () => { db.close(); resolve(capture); };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error(`Saved captures exceed the ${MAX_TOTAL_CAPTURE_BYTES} byte total limit`));
    };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("Saving capture failed")); };
  });
}

export async function loadCapture(id: string): Promise<SavedCapture | undefined> {
  return singleRequest<SavedCapture | undefined>(CAPTURE_STORE, "readonly", (store) => store.get(id));
}

export async function deleteCapture(id: string): Promise<void> {
  await singleRequest<undefined>(CAPTURE_STORE, "readwrite", (store) => store.delete(id));
}

export async function listCaptureMetadata(workspaceId: string): Promise<CaptureMetadata[]> {
  const captures = await singleRequest<SavedCapture[]>(CAPTURE_STORE, "readonly", (store) => (
    store.index("workspaceId").getAll(IDBKeyRange.only(workspaceId))
  ));
  return captures
    .sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id))
    .map(({ signals, measurements, ...capture }) => ({
      ...capture,
      signalCount: signals.length,
      measurementCount: measurements.length,
    }));
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(value >>> 18) & 63] ?? "";
    result += BASE64_ALPHABET[(value >>> 12) & 63] ?? "";
    result += index + 1 < bytes.length ? BASE64_ALPHABET[(value >>> 6) & 63] : "=";
    result += index + 2 < bytes.length ? BASE64_ALPHABET[value & 63] : "=";
  }
  return result;
}

function base64ToBytes(source: string): Uint8Array {
  if (source.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(source)) throw new Error("Capture vector encoding is invalid");
  const padding = source.endsWith("==") ? 2 : source.endsWith("=") ? 1 : 0;
  const output = new Uint8Array(source.length / 4 * 3 - padding);
  let offset = 0;
  for (let index = 0; index < source.length; index += 4) {
    const value = ((BASE64_ALPHABET.indexOf(source[index] ?? "A") & 63) << 18)
      | ((BASE64_ALPHABET.indexOf(source[index + 1] ?? "A") & 63) << 12)
      | ((BASE64_ALPHABET.indexOf(source[index + 2] ?? "A") & 63) << 6)
      | (BASE64_ALPHABET.indexOf(source[index + 3] ?? "A") & 63);
    if (offset < output.length) output[offset++] = value >>> 16;
    if (offset < output.length) output[offset++] = value >>> 8;
    if (offset < output.length) output[offset++] = value;
  }
  return output;
}

function encodeFloat64(values: Float64Array): string {
  const bytes = new Uint8Array(values.length * 8);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index += 1) view.setFloat64(index * 8, values[index]!, true);
  return bytesToBase64(bytes);
}

function decodeFloat64(source: string): Float64Array {
  const bytes = base64ToBytes(source);
  if (bytes.byteLength % 8 !== 0) throw new Error("Capture vector byte length is invalid");
  const values = new Float64Array(bytes.byteLength / 8);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < values.length; index += 1) values[index] = view.getFloat64(index * 8, true);
  return values;
}

function stableJSON(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(Object.entries(candidate)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]));
    }
    if (typeof candidate === "number" && !Number.isFinite(candidate)) throw new Error("Export metadata contains a non-finite number");
    return candidate;
  };
  return JSON.stringify(normalize(value));
}

function encodeCapture(capture: SavedCapture): EncodedSavedCapture {
  return {
    ...capture,
    identity: {
      ...capture.identity,
      modelIdentities: capture.identity.modelIdentities.slice().sort((left, right) => left.componentId.localeCompare(right.componentId) || left.modelId.localeCompare(right.modelId)),
    },
    measurements: capture.measurements.slice().sort((left, right) => left.id.localeCompare(right.id)),
    signals: capture.signals
      .slice()
      .sort((left, right) => left.definition.id.localeCompare(right.definition.id))
      .map((item) => {
        const { values: axisValues, ...axis } = item.axis;
        const { values: signalValues, ...signal } = item.signal;
        return {
          ...item,
          axis: { ...axis, valuesBase64: encodeFloat64(axisValues) },
          signal: { ...signal, valuesBase64: encodeFloat64(signalValues) },
        };
      }),
  };
}

function decodeCapture(capture: EncodedSavedCapture): SavedCapture {
  const decoded: SavedCaptureInput = {
    ...capture,
    signals: capture.signals.map((item) => {
      const { valuesBase64: axisValues, ...axis } = item.axis;
      const { valuesBase64: signalValues, ...signal } = item.signal;
      return {
        ...item,
        axis: { ...axis, values: decodeFloat64(axisValues) },
        signal: { ...signal, values: decodeFloat64(signalValues) },
      };
    }),
  };
  return boundedCapture(decoded);
}

export function exportWorkspaceBundle(workspace: Workspace, captures: readonly SavedCapture[]): string {
  const scoped = captures.filter((capture) => capture.workspaceId === workspace.id);
  const sizes = scoped.map(captureSizeBytes);
  if (sizes.some((size) => size > MAX_CAPTURE_BYTES)) {
    throw new Error("Workspace export contains a capture beyond the per-capture limit");
  }
  if (sizes.reduce((total, size) => total + size, 0) > MAX_TOTAL_CAPTURE_BYTES) {
    throw new Error("Workspace capture export exceeds the total capture limit");
  }
  const bundle: CaptureBundle = {
    format: "schemagic-workspace-bundle",
    version: CAPTURE_BUNDLE_VERSION,
    workspace: storedWorkspace(workspace),
    captures: scoped.slice().sort((left, right) => left.id.localeCompare(right.id)).map(encodeCapture),
  };
  return stableJSON(bundle);
}

export function importWorkspaceBundle(source: string): { workspace: Workspace; captures: SavedCapture[] } {
  if (new TextEncoder().encode(source).byteLength > MAX_TOTAL_CAPTURE_BYTES * 2) throw new Error("Workspace bundle exceeds the import limit");
  const candidate = JSON.parse(source) as Partial<CaptureBundle>;
  if (candidate.format !== "schemagic-workspace-bundle" || candidate.version !== CAPTURE_BUNDLE_VERSION || !candidate.workspace || !Array.isArray(candidate.captures)) {
    throw new Error("Workspace bundle format is unsupported");
  }
  const workspace = restoredWorkspace(candidate.workspace);
  assertValidCircuit(workspace.document);
  const captures = candidate.captures.map(decodeCapture);
  if (captures.some((capture) => capture.workspaceId !== workspace.id)) throw new Error("Capture workspace identity does not match the bundle");
  if (captures.reduce((total, capture) => total + capture.sizeBytes, 0) > MAX_TOTAL_CAPTURE_BYTES) throw new Error("Imported captures exceed the total capture limit");
  return { workspace, captures };
}
