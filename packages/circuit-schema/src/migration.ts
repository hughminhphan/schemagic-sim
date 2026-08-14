import { defaultDCSweepConfig } from "./dc-sweep";
import { defaultNoiseConfig } from "./noise";
import { componentPinPoints, componentPoint } from "./parts";
import type { CircuitComponent, CircuitDocument, CircuitDocumentV1, ComponentType, Point } from "./types";

const AFFECTED_PIN_OFFSETS: Partial<Record<ComponentType, { old: readonly Point[]; current: readonly Point[] }>> = {
  potentiometer: { old: [[0,-6],[4,0],[0,6]], current: [[0,-2],[2,0],[0,2]] },
  bjt_npn: { old: [[2,-4],[-2,0],[2,4]], current: [[2,-3],[-2,0],[2,3]] },
  bjt_pnp: { old: [[2,-4],[-2,0],[2,4]], current: [[2,-3],[-2,0],[2,3]] },
  nmos: { old: [[2,-4],[-2,0],[2,4]], current: [[2,-3],[-2,0],[2,3]] },
  pmos: { old: [[2,-4],[-2,0],[2,4]], current: [[2,-3],[-2,0],[2,3]] },
};

interface PinMove { componentId: string; pinIndex: number; oldPoint: Point; newPoint: Point }
interface EndpointRef { wireIndex: number; endpointIndex: 0 | -1; neighbor: Point }

const pointKey = ([x,y]: Point): string => `${x},${y}`;
const samePoint = (left: Point, right: Point): boolean => left[0] === right[0] && left[1] === right[1];
const clonePoint = ([x,y]: Point): Point => [x,y];

function compactWire(points: readonly Point[], protectedKeys: ReadonlySet<string>): Point[] {
  const compacted: Point[] = [];
  for (const source of points) {
    const point = clonePoint(source);
    if (compacted.length && samePoint(compacted.at(-1)!, point)) continue;
    compacted.push(point);
    while (compacted.length >= 3) {
      const a = compacted.at(-3)!;
      const b = compacted.at(-2)!;
      const c = compacted.at(-1)!;
      const collinear = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
      if (!collinear || protectedKeys.has(pointKey(b))) break;
      compacted.splice(compacted.length - 2, 1);
    }
  }
  return compacted;
}

function oldPinPoints(component: CircuitComponent): Point[] {
  const offsets = AFFECTED_PIN_OFFSETS[component.type]?.old;
  return offsets ? offsets.map((offset) => componentPoint(component, offset)) : componentPinPoints(component);
}

function applyLegacySimDefaults(document: CircuitDocument): CircuitDocument {
  if (document.sim?.mode === "dc-sweep" && !document.sim.dcSweep) {
    const dcSweep = defaultDCSweepConfig(document);
    if (dcSweep) return { ...document, sim: { ...document.sim, dcSweep } };
  }
  if (document.sim?.mode === "noise" && !document.sim.noise) {
    const noise = defaultNoiseConfig(document);
    if (noise) return { ...document, sim: { ...document.sim, noise } };
  }
  return document;
}

export function legacyCircuitForNetlistHash(input: CircuitDocument): CircuitDocumentV1 {
  const document = structuredClone(input);
  const reverseTargets = new Map<string, Point[]>();
  for (const component of document.components) {
    const offsets = AFFECTED_PIN_OFFSETS[component.type];
    if (!offsets) continue;
    offsets.current.forEach((currentOffset, pinIndex) => {
      const currentPoint = componentPoint(component, currentOffset);
      const oldPoint = componentPoint(component, offsets.old[pinIndex]!);
      if (samePoint(currentPoint, oldPoint)) return;
      const targets = reverseTargets.get(pointKey(currentPoint)) ?? [];
      targets.push(oldPoint);
      reverseTargets.set(pointKey(currentPoint), targets);
    });
  }

  const blockedTargets = new Set(
    document.wires
      .filter((wire) => /^migration-v1-v2-\d+$/.test(wire.id) && wire.points.length === 2)
      .map((wire) => `${pointKey(wire.points[0]!)}>${pointKey(wire.points[1]!)}`),
  );
  const wires = document.wires
    .filter((wire) => !/^migration-v1-v2-\d+$/.test(wire.id))
    .map((wire) => {
      const points = wire.points.map(clonePoint);
      for (const endpointIndex of [0, points.length - 1]) {
        const endpoint = points[endpointIndex];
        if (!endpoint) continue;
        const targets = reverseTargets.get(pointKey(endpoint));
        const uniqueTargets = new Map((targets ?? []).map((target) => [pointKey(target), target]));
        if (uniqueTargets.size !== 1) continue;
        const target = [...uniqueTargets.values()][0]!;
        if (!blockedTargets.has(`${pointKey(endpoint)}>${pointKey(target)}`)) points[endpointIndex] = clonePoint(target);
      }
      return { ...wire, points };
    });

  return { ...document, version: 1, wires };
}

export function migrateCircuitV1toV2(input: CircuitDocumentV1): CircuitDocument {
  const components = structuredClone(input.components) as CircuitComponent[];
  const wires = structuredClone(input.wires);
  const moves: PinMove[] = [];

  for (const component of components) {
    const offsets = AFFECTED_PIN_OFFSETS[component.type];
    if (!offsets) continue;
    offsets.old.forEach((oldOffset, pinIndex) => {
      const oldPoint = componentPoint(component, oldOffset);
      const newPoint = componentPoint(component, offsets.current[pinIndex]!);
      if (!samePoint(oldPoint, newPoint)) moves.push({ componentId: component.id, pinIndex, oldPoint, newPoint });
    });
  }

  const endpointRefs = new Map<string, EndpointRef[]>();
  const interiorKeys = new Set<string>();
  const explicitConnectionKeys = new Set<string>();
  wires.forEach((wire, wireIndex) => {
    wire.points.forEach((point, pointIndex) => {
      const key = pointKey(point);
      explicitConnectionKeys.add(key);
      if (pointIndex > 0 && pointIndex < wire.points.length - 1) interiorKeys.add(key);
    });
    if (wire.points.length < 2) return;
    const start = wire.points[0]!;
    const end = wire.points.at(-1)!;
    const startRefs = endpointRefs.get(pointKey(start)) ?? [];
    startRefs.push({ wireIndex, endpointIndex: 0, neighbor: wire.points[1]! });
    endpointRefs.set(pointKey(start), startRefs);
    const endRefs = endpointRefs.get(pointKey(end)) ?? [];
    endRefs.push({ wireIndex, endpointIndex: -1, neighbor: wire.points.at(-2)! });
    endpointRefs.set(pointKey(end), endRefs);
  });

  const pinMovesByOld = new Map<string, PinMove[]>();
  for (const move of moves) {
    const group = pinMovesByOld.get(pointKey(move.oldPoint)) ?? [];
    group.push(move);
    pinMovesByOld.set(pointKey(move.oldPoint), group);
  }

  const staticPinKeys = new Set<string>();
  for (const component of components) {
    oldPinPoints(component).forEach((point, pinIndex) => {
      const move = moves.find((candidate) => candidate.componentId === component.id && candidate.pinIndex === pinIndex);
      if (!move) staticPinKeys.add(pointKey(point));
    });
  }

  const migratedEndpoints = new Map<string, Point>();
  const stubs: Array<{ from: Point; to: Point }> = [];
  for (const [oldKey, group] of pinMovesByOld) {
    const targets = new Map(group.map((move) => [pointKey(move.newPoint), move.newPoint]));
    const refs = endpointRefs.get(oldKey) ?? [];
    const hasStaticOldConnection = interiorKeys.has(oldKey) || staticPinKeys.has(oldKey);
    const hasConflictingTarget = targets.size !== 1 || [...targets.keys()].some((key) => explicitConnectionKeys.has(key) || staticPinKeys.has(key));
    const target = targets.size === 1 ? [...targets.values()][0]! : undefined;
    const wouldBecomeDiagonal = target ? refs.some((ref) => target[0] !== ref.neighbor[0] && target[1] !== ref.neighbor[1]) : true;
    const useStub = hasStaticOldConnection || hasConflictingTarget || wouldBecomeDiagonal;

    if (!useStub && target) {
      for (const ref of refs) migratedEndpoints.set(`${ref.wireIndex}:${ref.endpointIndex}`, target);
      continue;
    }

    const oldPoint = group[0]!.oldPoint;
    for (const newPoint of targets.values()) {
      if (!samePoint(oldPoint, newPoint)) stubs.push({ from: clonePoint(newPoint), to: clonePoint(oldPoint) });
    }
  }

  const rawWires = wires.map((wire, wireIndex) => {
    const start = migratedEndpoints.get(`${wireIndex}:0`);
    const end = migratedEndpoints.get(`${wireIndex}:-1`);
    const points = wire.points.map(clonePoint);
    if (start && points.length) points[0] = clonePoint(start);
    if (end && points.length) points[points.length - 1] = clonePoint(end);
    return { wire: { ...wire, points }, compact: Boolean(start || end), bothEndpointsMigratedTogether: Boolean(start && end && samePoint(start, end)) };
  });

  const ids = new Set([...components.map((component) => component.id), ...rawWires.map(({ wire }) => wire.id)]);
  const stubKeys = new Set<string>();
  let nextStub = 1;
  for (const stub of stubs) {
    const key = `${pointKey(stub.from)}>${pointKey(stub.to)}`;
    if (stubKeys.has(key)) continue;
    stubKeys.add(key);
    let id = `migration-v1-v2-${nextStub++}`;
    while (ids.has(id)) id = `migration-v1-v2-${nextStub++}`;
    ids.add(id);
    rawWires.push({ wire: { id, points: [stub.from, stub.to] }, compact: true, bothEndpointsMigratedTogether: false });
  }

  const wireIdsByPoint = new Map<string, Set<string>>();
  for (const { wire } of rawWires) {
    for (const point of wire.points) {
      const key = pointKey(point);
      const wireIds = wireIdsByPoint.get(key) ?? new Set<string>();
      wireIds.add(wire.id);
      wireIdsByPoint.set(key, wireIds);
    }
  }
  const protectedKeys = new Set(components.flatMap((component) => componentPinPoints(component).map(pointKey)));
  for (const [key, wireIds] of wireIdsByPoint) if (wireIds.size > 1) protectedKeys.add(key);

  const migratedWires = rawWires.flatMap(({ wire, compact, bothEndpointsMigratedTogether }) => {
    const compacted = compact ? compactWire(wire.points, protectedKeys) : wire.points.map(clonePoint);
    if (compacted.length < 2 && bothEndpointsMigratedTogether) return [];
    if (compacted.length < 2) {
      const point = clonePoint(compacted[0] ?? wire.points[0] ?? [0,0]);
      return [{ ...wire, points: [point, clonePoint(point)] }];
    }
    return [{ ...wire, points: compacted }];
  });

  const document: CircuitDocument = {
    ...structuredClone(input),
    version: 2,
    components,
    wires: migratedWires,
  };
  return applyLegacySimDefaults(document);
}
