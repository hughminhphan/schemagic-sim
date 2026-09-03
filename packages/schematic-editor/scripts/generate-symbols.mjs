#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = join(packageRoot, "vendor", "kicad-symbols");
const partsPath = resolve(packageRoot, "..", "circuit-schema", "src", "parts.ts");

const SYMBOLS = [
  ["resistor", "Device.kicad_symdir/R_US.kicad_sym", "R_US"],
  ["capacitor", "Device.kicad_symdir/C.kicad_sym", "C"],
  ["inductor", "Device.kicad_symdir/L.kicad_sym", "L"],
  ["vsource", "Simulation_SPICE.kicad_symdir/VDC.kicad_sym", "VDC"],
  ["vsource_pulse", "Simulation_SPICE.kicad_symdir/VPULSE.kicad_sym", "VPULSE"],
  ["vsource_sine", "Simulation_SPICE.kicad_symdir/VSIN.kicad_sym", "VSIN"],
  ["isource", "Simulation_SPICE.kicad_symdir/IDC.kicad_sym", "IDC"],
  ["ground", "power.kicad_symdir/GND.kicad_sym", "GND"],
  ["switch_spst", "Switch.kicad_symdir/SW_SPST.kicad_sym", "SW_SPST"],
  ["potentiometer", "Device.kicad_symdir/R_Potentiometer_US.kicad_sym", "R_Potentiometer_US"],
  ["diode", "Device.kicad_symdir/D.kicad_sym", "D"],
  ["led", "Device.kicad_symdir/LED.kicad_sym", "LED"],
  ["bjt_npn", "Simulation_SPICE.kicad_symdir/NPN.kicad_sym", "NPN"],
  ["bjt_pnp", "Simulation_SPICE.kicad_symdir/PNP.kicad_sym", "PNP"],
  ["nmos", "Simulation_SPICE.kicad_symdir/NMOS.kicad_sym", "NMOS"],
  ["pmos", "Simulation_SPICE.kicad_symdir/PMOS.kicad_sym", "PMOS"],
  ["opamp_ideal", "Simulation_SPICE.kicad_symdir/OPAMP.kicad_sym", "OPAMP"],
];
const POT_WIPER_TRAVEL = [-2, 2];

function fail(message) {
  throw new Error(`[generate-symbols] ${message}`);
}

function tokenize(source, sourceName) {
  const tokens = [];
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push("(");
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push(")");
      index += 1;
      continue;
    }
    if (char === '"') {
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\") {
          index += 1;
          if (index >= source.length) fail(`unterminated escape in ${sourceName}`);
          const escaped = source[index];
          value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
          index += 1;
        } else {
          value += source[index];
          index += 1;
        }
      }
      if (source[index] !== '"') fail(`unterminated string in ${sourceName}`);
      tokens.push(value);
      index += 1;
      continue;
    }
    let end = index;
    while (end < source.length && !/[\s()]/.test(source[end])) end += 1;
    tokens.push(source.slice(index, end));
    index = end;
  }
  return tokens;
}

function parseSExpression(source, sourceName) {
  const tokens = tokenize(source, sourceName);
  let cursor = 0;
  function parseList() {
    if (tokens[cursor] !== "(") fail(`expected '(' in ${sourceName}`);
    cursor += 1;
    const list = [];
    while (cursor < tokens.length && tokens[cursor] !== ")") {
      list.push(tokens[cursor] === "(" ? parseList() : tokens[cursor++]);
    }
    if (tokens[cursor] !== ")") fail(`unterminated list in ${sourceName}`);
    cursor += 1;
    return list;
  }
  const root = parseList();
  if (cursor !== tokens.length) fail(`trailing tokens in ${sourceName}`);
  return root;
}

function children(node, tag) {
  return node.filter((child) => Array.isArray(child) && child[0] === tag);
}

function child(node, tag) {
  return children(node, tag)[0];
}

function numberAt(node, index, context) {
  const value = Number(node?.[index]);
  if (!Number.isFinite(value)) fail(`invalid number for ${context}`);
  return value;
}

function parseParts() {
  const source = readFileSync(partsPath, "utf8");
  const parts = new Map();
  const matcher = /\{ type: "([^"]+)"[^\n]*?pins: (\[\[[^\n]*?\]\])/g;
  for (const match of source.matchAll(matcher)) {
    parts.set(match[1], JSON.parse(match[2]));
  }
  for (const [type] of SYMBOLS) {
    if (!parts.has(type)) fail(`could not read PARTS pins for ${type} from ${partsPath}`);
  }
  return parts;
}

function findKicadFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...findKicadFiles(path));
    else if (entry.name.endsWith(".kicad_sym")) files.push(path);
  }
  return files.sort();
}

function loadDefinitions() {
  const definitions = new Map();
  for (const path of findKicadFiles(vendorRoot)) {
    const root = parseSExpression(readFileSync(path, "utf8"), relative(vendorRoot, path));
    if (root[0] !== "kicad_symbol_lib") fail(`${relative(vendorRoot, path)} is not a KiCad symbol library`);
    for (const definition of children(root, "symbol")) {
      const name = definition[1];
      if (definitions.has(name)) fail(`duplicate vendored symbol ${name}`);
      definitions.set(name, { definition, path });
    }
  }
  return definitions;
}

function includedSubsymbol(name) {
  const match = /_(\d+)_(\d+)$/.exec(name);
  if (!match) return false;
  const unit = Number(match[1]);
  const demorgan = Number(match[2]);
  return (unit === 0 || unit === 1) && demorgan !== 2;
}

function collectDefinition(name, definitions, stack = []) {
  if (stack.includes(name)) fail(`symbol inheritance cycle: ${[...stack, name].join(" -> ")}`);
  const entry = definitions.get(name);
  if (!entry) fail(`missing parent symbol ${name} required by ${stack.at(-1) ?? "mapping"}`);
  const extendsNode = child(entry.definition, "extends");
  const inherited = extendsNode ? collectDefinition(extendsNode[1], definitions, [...stack, name]) : { graphics: [], pins: [] };
  const graphics = [...inherited.graphics];
  const pins = [...inherited.pins];
  for (const subsymbol of children(entry.definition, "symbol")) {
    const subsymbolName = subsymbol[1];
    if (!includedSubsymbol(subsymbolName)) continue;
    for (const node of subsymbol.slice(2)) {
      if (!Array.isArray(node)) continue;
      if (["polyline", "circle", "rectangle", "arc"].includes(node[0])) {
        graphics.push({ node, subsymbolName });
      } else if (node[0] === "pin") {
        pins.push(parsePin(node, subsymbolName));
      }
    }
  }
  return { graphics, pins };
}

function parsePin(node, subsymbolName) {
  const at = child(node, "at");
  const length = child(node, "length");
  const name = child(node, "name");
  const number = child(node, "number");
  if (!at || !length || !name || !number) fail(`incomplete pin in ${subsymbolName}`);
  return {
    at: [numberAt(at, 1, `${subsymbolName} pin x`), numberAt(at, 2, `${subsymbolName} pin y`)],
    angle: numberAt(at, 3, `${subsymbolName} pin angle`),
    length: numberAt(length, 1, `${subsymbolName} pin length`),
    name: String(name[1]),
    number: String(number[1]),
  };
}

function propertyPoint(definition, propertyName, type) {
  const matches = children(definition, "property").filter((node) => node[1] === propertyName);
  if (matches.length !== 1) fail(`${type}: expected exactly one ${propertyName} property, found ${matches.length}`);
  const at = child(matches[0], "at");
  if (!at) fail(`${type}: ${propertyName} property is missing its anchor`);
  return [numberAt(at, 1, `${type} ${propertyName} x`), numberAt(at, 2, `${type} ${propertyName} y`)];
}

function selectPins(type, pins) {
  const byName = (name) => pins.filter((pin) => pin.name === name);
  const byNumber = (number) => pins.filter((pin) => pin.number === number);
  const unique = (matches, description) => {
    if (matches.length !== 1) fail(`${type}: expected exactly one ${description} pin, found ${matches.length}`);
    return matches[0];
  };
  const names = {
    diode: [["A", 0], ["K", 1]],
    led: [["A", 0], ["K", 1]],
    bjt_npn: [["C", 0], ["B", 1], ["E", 2]],
    bjt_pnp: [["C", 0], ["B", 1], ["E", 2]],
    nmos: [["D", 0], ["G", 1], ["S", 2]],
    pmos: [["D", 0], ["G", 1], ["S", 2]],
  };
  if (names[type]) {
    return names[type].map(([name, targetIndex]) => ({ pin: unique(byName(name), `named ${name}`), targetIndex }));
  }
  if (type === "opamp_ideal") {
    if (pins.length !== 5) fail(`${type}: expected the verified 5-pin OPAMP source, found ${pins.length} pins`);
    const plus = unique(byName("+"), "non-inverting (+)");
    const minus = unique(byName("-"), "inverting (-)");
    const output = unique(byNumber("5"), "output number 5");
    const positiveRail = unique(byName("V+"), "dropped positive rail V+");
    const negativeRail = unique(byName("V-"), "dropped negative rail V-");
    if (output.name !== "" || positiveRail.number !== "3" || negativeRail.number !== "4") {
      fail(`${type}: OPAMP pin contract changed; expected output 5, V+ 3, V- 4`);
    }
    return [{ pin: plus, targetIndex: 0 }, { pin: minus, targetIndex: 1 }, { pin: output, targetIndex: 2 }];
  }
  if (["vsource", "vsource_pulse", "vsource_sine", "isource"].includes(type)) {
    const positive = byName("+");
    const negative = byName("-");
    if (positive.length === 1 && negative.length === 1) {
      return [{ pin: positive[0], targetIndex: 0 }, { pin: negative[0], targetIndex: 1 }];
    }
    if (pins.some((pin) => pin.name !== "")) fail(`${type}: source pins are neither named +/- nor all unnamed`);
    return [
      { pin: unique(byNumber("1"), "positive terminal number 1"), targetIndex: 0 },
      { pin: unique(byNumber("2"), "negative terminal number 2"), targetIndex: 1 },
    ];
  }
  const numberOrder = type === "potentiometer" ? ["1", "2", "3"] : type === "ground" ? ["1"] : ["1", "2"];
  return numberOrder.map((number, targetIndex) => ({ pin: unique(byNumber(number), `number ${number}`), targetIndex }));
}

function rotateAfterYFlip([x, y], theta) {
  const flippedY = -y;
  switch (theta) {
    case 0: return [x, flippedY];
    case 90: return [-flippedY, x];
    case 180: return [-x, -flippedY];
    case 270: return [flippedY, -x];
    default: fail(`unsupported rotation ${theta}`);
  }
}

function solveAxis(source, target) {
  const sourceMean = source.reduce((sum, value) => sum + value, 0) / source.length;
  const targetMean = target.reduce((sum, value) => sum + value, 0) / target.length;
  let variance = 0;
  let covariance = 0;
  for (let index = 0; index < source.length; index += 1) {
    variance += (source[index] - sourceMean) ** 2;
    covariance += (source[index] - sourceMean) * (target[index] - targetMean);
  }
  if (variance < 1e-12) {
    if (target.some((value) => Math.abs(value - targetMean) > 1e-9)) return { invalid: true };
    return { scale: null, offset: null, sourceMean, targetMean };
  }
  const scale = covariance / variance;
  return { scale, offset: targetMean - scale * sourceMean, sourceMean, targetMean };
}

function solveTransform(type, selectedPins, targets) {
  if (type === "ground") {
    const pin = selectedPins[0]?.pin;
    if (!pin || selectedPins.length !== 1 || targets.length !== 1) fail("ground: expected one pin");
    const scale = 0.52493;
    const rotated = rotateAfterYFlip(pin.at, 0);
    return { theta: 0, a: scale, b: targets[0][0] - scale * rotated[0], c: scale, d: targets[0][1] - scale * rotated[1] };
  }
  for (const theta of [0, 90, 180, 270]) {
    const sourcePoints = selectedPins.map(({ pin }) => rotateAfterYFlip(pin.at, theta));
    const targetPoints = selectedPins.map(({ targetIndex }) => targets[targetIndex]);
    const xSolution = solveAxis(sourcePoints.map((point) => point[0]), targetPoints.map((point) => point[0]));
    const ySolution = solveAxis(sourcePoints.map((point) => point[1]), targetPoints.map((point) => point[1]));
    if (xSolution.invalid || ySolution.invalid) continue;
    let a = xSolution.scale;
    let c = ySolution.scale;
    if (a === null && c === null) continue;
    if (a === null) a = Math.abs(c);
    if (c === null) c = Math.abs(a);
    const b = xSolution.offset ?? xSolution.targetMean - a * xSolution.sourceMean;
    const d = ySolution.offset ?? ySolution.targetMean - c * ySolution.sourceMean;
    const validScale = a > 0 && (c > 0 || (type === "opamp_ideal" && c < 0));
    if (!validScale) continue;
    const transform = { theta, a, b, c, d };
    const exact = sourcePoints.every((point, index) => {
      const actual = [a * point[0] + b, c * point[1] + d];
      const expected = targetPoints[index];
      return Math.abs(actual[0] - expected[0]) <= 1e-6 && Math.abs(actual[1] - expected[1]) <= 1e-6;
    });
    if (exact) return transform;
  }
  fail(`${type}: no non-mirroring affine transform maps the selected KiCad pins to PARTS`);
}

function applyTransform(point, transform) {
  const rotated = rotateAfterYFlip(point, transform.theta);
  return [transform.a * rotated[0] + transform.b, transform.c * rotated[1] + transform.d];
}

function pinLeadEndpoint(pin) {
  const radians = pin.angle * Math.PI / 180;
  return [pin.at[0] + pin.length * Math.cos(radians), pin.at[1] + pin.length * Math.sin(radians)];
}

function pointsFromPolyline(node, context) {
  const pts = child(node, "pts");
  if (!pts) fail(`${context}: polyline missing pts`);
  return children(pts, "xy").map((xy) => [numberAt(xy, 1, `${context} x`), numberAt(xy, 2, `${context} y`)]);
}

function primitiveFill(node) {
  return String(child(child(node, "fill") ?? [], "type")?.[1] ?? "none");
}

function primitiveWidth(node) {
  return Number(child(child(node, "stroke") ?? [], "width")?.[1] ?? 0);
}

function primitiveClasses(node, extra = []) {
  const classes = [...extra];
  const fill = primitiveFill(node);
  if (fill === "background") classes.push("sym-bg");
  else if (fill === "outline") classes.push("sym-solid");
  else if (fill !== "none") fail(`unsupported fill type ${fill}`);
  if (primitiveWidth(node) >= 0.4) classes.push("sym-bold");
  return classes;
}

function normalizeAngle(angle) {
  const full = 2 * Math.PI;
  return ((angle % full) + full) % full;
}

function arcGeometry(start, mid, end, context) {
  const denominator = 2 * (start[0] * (mid[1] - end[1]) + mid[0] * (end[1] - start[1]) + end[0] * (start[1] - mid[1]));
  if (Math.abs(denominator) < 1e-10) fail(`${context}: collinear arc points`);
  const startSquared = start[0] ** 2 + start[1] ** 2;
  const midSquared = mid[0] ** 2 + mid[1] ** 2;
  const endSquared = end[0] ** 2 + end[1] ** 2;
  const center = [
    (startSquared * (mid[1] - end[1]) + midSquared * (end[1] - start[1]) + endSquared * (start[1] - mid[1])) / denominator,
    (startSquared * (end[0] - mid[0]) + midSquared * (start[0] - end[0]) + endSquared * (mid[0] - start[0])) / denominator,
  ];
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const midAngle = Math.atan2(mid[1] - center[1], mid[0] - center[0]);
  const endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]);
  const clockwiseDelta = normalizeAngle(endAngle - startAngle);
  const clockwiseMid = normalizeAngle(midAngle - startAngle);
  const sweep = clockwiseMid <= clockwiseDelta + 1e-8 ? 1 : 0;
  const delta = sweep ? clockwiseDelta : normalizeAngle(startAngle - endAngle);
  return { center, radius, startAngle, delta, sweep, largeArc: delta > Math.PI ? 1 : 0 };
}

function arcBounds(center, radiusX, radiusY, geometry) {
  const points = [];
  const progress = (angle) => geometry.sweep
    ? normalizeAngle(angle - geometry.startAngle)
    : normalizeAngle(geometry.startAngle - angle);
  for (const angle of [geometry.startAngle, geometry.startAngle + (geometry.sweep ? geometry.delta : -geometry.delta), 0, Math.PI / 2, Math.PI, Math.PI * 3 / 2]) {
    if (progress(angle) <= geometry.delta + 1e-8) {
      points.push([center[0] + radiusX * Math.cos(angle), center[1] + radiusY * Math.sin(angle)]);
    }
  }
  return points;
}

function fmtPrecision(value, precision) {
  const factor = 10 ** precision;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return String(Object.is(rounded, -0) || Math.abs(rounded) < 0.5 / factor ? 0 : rounded);
}

function fmt(value) {
  return fmtPrecision(value, 4);
}

function fmtArc(value) {
  return fmtPrecision(value, 6);
}

function classAttribute(classes) {
  return classes.length ? ` class="${classes.join(" ")}"` : "";
}

function renderPrimitive(graphic, transform, type) {
  const { node, subsymbolName } = graphic;
  const tag = node[0];
  const context = `${type}/${subsymbolName}/${tag}`;
  const classes = primitiveClasses(node);
  const bounds = [];
  let markup;
  if (tag === "polyline") {
    const points = pointsFromPolyline(node, context).map((point) => applyTransform(point, transform));
    if (points.length < 2) fail(`${context}: expected at least two points`);
    bounds.push(...points);
    const closed = points.length > 2 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1e-8;
    const pathPoints = closed ? points.slice(0, -1) : points;
    const commands = pathPoints.map((point, index) => `${index === 0 ? "M" : "L"}${fmt(point[0])} ${fmt(point[1])}`).join(" ");
    markup = `<path${classAttribute(classes)} d="${commands}${closed ? " Z" : ""}"/>`;
  } else if (tag === "rectangle") {
    const start = child(node, "start");
    const end = child(node, "end");
    if (!start || !end) fail(`${context}: rectangle missing start/end`);
    const corners = [
      [numberAt(start, 1, `${context} start x`), numberAt(start, 2, `${context} start y`)],
      [numberAt(end, 1, `${context} end x`), numberAt(start, 2, `${context} start y`)],
      [numberAt(end, 1, `${context} end x`), numberAt(end, 2, `${context} end y`)],
      [numberAt(start, 1, `${context} start x`), numberAt(end, 2, `${context} end y`)],
    ].map((point) => applyTransform(point, transform));
    bounds.push(...corners);
    markup = `<path${classAttribute(classes)} d="${corners.map((point, index) => `${index === 0 ? "M" : "L"}${fmt(point[0])} ${fmt(point[1])}`).join(" ")} Z"/>`;
  } else if (tag === "circle") {
    const centerNode = child(node, "center");
    const radiusNode = child(node, "radius");
    if (!centerNode || !radiusNode) fail(`${context}: circle missing center/radius`);
    const center = applyTransform([numberAt(centerNode, 1, `${context} center x`), numberAt(centerNode, 2, `${context} center y`)], transform);
    const sourceRadius = numberAt(radiusNode, 1, `${context} radius`);
    const radiusX = sourceRadius * Math.abs(transform.a);
    const radiusY = sourceRadius * Math.abs(transform.c);
    bounds.push([center[0] - radiusX, center[1] - radiusY], [center[0] + radiusX, center[1] + radiusY]);
    markup = Math.abs(radiusX - radiusY) <= 1e-8
      ? `<circle${classAttribute(classes)} cx="${fmt(center[0])}" cy="${fmt(center[1])}" r="${fmt(radiusX)}"/>`
      : `<ellipse${classAttribute(classes)} cx="${fmt(center[0])}" cy="${fmt(center[1])}" rx="${fmt(radiusX)}" ry="${fmt(radiusY)}"/>`;
  } else if (tag === "arc") {
    const startNode = child(node, "start");
    const midNode = child(node, "mid");
    const endNode = child(node, "end");
    if (!startNode || !midNode || !endNode) fail(`${context}: arc missing start/mid/end`);
    const sourcePoints = [startNode, midNode, endNode].map((point, index) => [numberAt(point, 1, `${context} point ${index} x`), numberAt(point, 2, `${context} point ${index} y`)]);
    const [start, mid, end] = sourcePoints.map((point) => applyTransform(point, transform));
    const sourceGeometry = arcGeometry(sourcePoints[0], sourcePoints[1], sourcePoints[2], context);
    const center = applyTransform(sourceGeometry.center, transform);
    const radiusX = sourceGeometry.radius * Math.abs(transform.a);
    const radiusY = sourceGeometry.radius * Math.abs(transform.c);
    const normalizedPoints = [start, mid, end].map((point) => [
      (point[0] - center[0]) / radiusX,
      (point[1] - center[1]) / radiusY,
    ]);
    const geometry = arcGeometry(normalizedPoints[0], normalizedPoints[1], normalizedPoints[2], context);
    // Arc coordinates need two extra decimals so SVG's endpoint-to-center conversion
    // preserves slightly off-semicircle KiCad arcs instead of inflating their bounds.
    markup = `<path${classAttribute(classes)} d="M${fmtArc(start[0])} ${fmtArc(start[1])} A${fmtArc(radiusX)} ${fmtArc(radiusY)} 0 ${geometry.largeArc} ${geometry.sweep} ${fmtArc(end[0])} ${fmtArc(end[1])}"/>`;
    bounds.push(...arcBounds(center, radiusX, radiusY, geometry), start, mid, end);
  } else {
    fail(`${context}: unsupported primitive ${tag}`);
  }
  return { markup, bounds, background: classes.includes("sym-bg") };
}

function isPotentiometerWiperGraphic(graphic) {
  if (graphic.node[0] !== "polyline" || !graphic.subsymbolName.endsWith("_0_1")) return false;
  const points = pointsFromPolyline(graphic.node, "potentiometer wiper classification");
  return points.length > 0 && points.every(([x]) => x >= 1.1);
}

function isSwitchLeverGraphic(graphic) {
  return graphic.node[0] === "polyline" && graphic.subsymbolName.endsWith("_0_0");
}

function renderPinLead(pin, transform) {
  const outer = applyTransform(pin.at, transform);
  const inner = applyTransform(pinLeadEndpoint(pin), transform);
  return {
    markup: `<path class="pin-lead" d="M${fmt(inner[0])} ${fmt(inner[1])} L${fmt(outer[0])} ${fmt(outer[1])}"/>`,
    bounds: [inner, outer],
    background: false,
    inner,
    outer,
  };
}

function renderOpampGlyphs(transform) {
  const plusCenter = applyTransform([-4.445, 2.54], transform);
  const minusCenter = applyTransform([-4.445, -2.54], transform);
  const horizontal = Math.abs(transform.a) * 0.35;
  const vertical = Math.abs(transform.c) * 0.35;
  return [
    {
      markup: `<path d="M${fmt(plusCenter[0] - horizontal)} ${fmt(plusCenter[1])} L${fmt(plusCenter[0] + horizontal)} ${fmt(plusCenter[1])} M${fmt(plusCenter[0])} ${fmt(plusCenter[1] - vertical)} L${fmt(plusCenter[0])} ${fmt(plusCenter[1] + vertical)}"/>`,
      bounds: [[plusCenter[0] - horizontal, plusCenter[1] - vertical], [plusCenter[0] + horizontal, plusCenter[1] + vertical]],
      background: false,
    },
    {
      markup: `<path d="M${fmt(minusCenter[0] - horizontal)} ${fmt(minusCenter[1])} L${fmt(minusCenter[0] + horizontal)} ${fmt(minusCenter[1])}"/>`,
      bounds: [[minusCenter[0] - horizontal, minusCenter[1]], [minusCenter[0] + horizontal, minusCenter[1]]],
      background: false,
    },
  ];
}

function sortedMarkup(elements) {
  return [...elements].sort((left, right) => Number(right.background) - Number(left.background)).map((element) => element.markup).join("");
}

function generateSymbol(type, sourcePath, symbolName, targets, definitions) {
  const entry = definitions.get(symbolName);
  if (!entry) fail(`${type}: missing source symbol ${symbolName} from ${sourcePath}`);
  if (relative(vendorRoot, entry.path) !== sourcePath) fail(`${type}: ${symbolName} resolved from ${relative(vendorRoot, entry.path)}, expected ${sourcePath}`);
  const collected = collectDefinition(symbolName, definitions);
  if (type !== "opamp_ideal" && collected.pins.length !== targets.length) {
    fail(`${type}: KiCad source has ${collected.pins.length} pins but PARTS defines ${targets.length}`);
  }
  const selectedPins = selectPins(type, collected.pins);
  if (selectedPins.length !== targets.length) fail(`${type}: selected ${selectedPins.length} pins but PARTS defines ${targets.length}`);
  const transform = solveTransform(type, selectedPins, targets);
  const refdesAnchor = applyTransform(propertyPoint(entry.definition, "Reference", type), transform);
  const valueAnchor = applyTransform(propertyPoint(entry.definition, "Value", type), transform);
  const markupElements = [];
  const wiperElements = [];
  const leverElements = [];
  const allBounds = [];
  const bodyBounds = [];
  let wiperAnchor;

  for (const graphic of collected.graphics) {
    const rendered = renderPrimitive(graphic, transform, type);
    if (type === "potentiometer" && isPotentiometerWiperGraphic(graphic)) {
      wiperElements.push(rendered);
      for (const [x, y] of rendered.bounds) {
        const travelBounds = [[x, y + POT_WIPER_TRAVEL[0]], [x, y + POT_WIPER_TRAVEL[1]]];
        allBounds.push(...travelBounds);
        bodyBounds.push(...travelBounds);
      }
    } else {
      allBounds.push(...rendered.bounds);
      bodyBounds.push(...rendered.bounds);
      if (type === "switch_spst" && isSwitchLeverGraphic(graphic)) leverElements.push(rendered);
      else markupElements.push(rendered);
    }
  }
  if (type === "opamp_ideal") {
    const glyphs = renderOpampGlyphs(transform);
    markupElements.push(...glyphs);
    allBounds.push(...glyphs.flatMap((glyph) => glyph.bounds));
    bodyBounds.push(...glyphs.flatMap((glyph) => glyph.bounds));
  }
  for (const { pin, targetIndex } of selectedPins) {
    const rendered = renderPinLead(pin, transform);
    allBounds.push(...rendered.bounds);
    markupElements.push(rendered);
    if (type === "potentiometer" && targetIndex === 1) wiperAnchor = rendered.inner;
  }

  if (markupElements.length === 0) fail(`${type}: generated empty markup`);
  if (type === "potentiometer" && wiperElements.length === 0) fail("potentiometer: failed to isolate wiper artwork");
  if (type === "potentiometer" && (!wiperAnchor || !wiperElements.some((element) => element.bounds.some((point) => Math.hypot(point[0] - wiperAnchor[0], point[1] - wiperAnchor[1]) <= 1e-8)))) {
    fail("potentiometer: fixed pin lead and movable wiper do not share an anchor");
  }
  if (type === "switch_spst" && leverElements.length !== 1) fail(`switch_spst: expected one movable lever, found ${leverElements.length}`);
  if (bodyBounds.length === 0) fail(`${type}: generated empty body bounds`);
  const xs = allBounds.map((point) => point[0]);
  const ys = allBounds.map((point) => point[1]);
  const bodyXs = bodyBounds.map((point) => point[0]);
  const bodyYs = bodyBounds.map((point) => point[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const bodyBbox = [Math.min(...bodyXs), Math.min(...bodyYs), Math.max(...bodyXs), Math.max(...bodyYs)];
  const result = { type, markup: sortedMarkup(markupElements), refdesAnchor, valueAnchor, bodyBbox, bbox, pins: targets.map((point) => [...point]) };
  if (type === "potentiometer") {
    result.wiper = sortedMarkup(wiperElements);
    result.wiperAnchor = wiperAnchor;
    result.wiperTravel = [...POT_WIPER_TRAVEL];
  }
  if (type === "switch_spst") {
    result.lever = sortedMarkup(leverElements);
    result.leverPivot = applyTransform([-2.032, 0], transform);
  }
  return { result, transform };
}

// ---------------------------------------------------------------------------
// Catalog-only symbols.
//
// These are original OpenCircuit artwork, not KiCad-derived: the CC-BY-SA
// vendor libraries carry no matching symbol for a generic labelled IC block,
// so nothing here is covered by the vendor notice.
// ---------------------------------------------------------------------------

const BLOCK_TYPES = [
  "timer_555",
  "ic_block_2", "ic_block_3", "ic_block_4", "ic_block_5", "ic_block_6",
  "ic_block_8", "ic_block_9", "ic_block_14", "ic_block_16",
];

const STATIC_PIN_LABELS = Object.freeze({
  timer_555: ["GND", "TRIG", "OUT", "RESET", "CONT", "THRES", "DISCH", "VCC"],
  vreg_linear_3: ["IN", "OUT", "GND/ADJ"],
  comparator: ["IN+", "IN−", "OUT", "VCC", "GND"],
  jfet_n: ["D", "G", "S"],
  optocoupler_led: ["A", "K"],
  ...Object.fromEntries(BLOCK_TYPES.filter((type) => type.startsWith("ic_block_"))
    .map((type) => [type, Array.from({ length: Number(type.slice("ic_block_".length)) }, (_, index) => String(index + 1))])),
});

const xmlText = (value) => String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);

function pinLabelMarkup(type, pins, bodyBbox) {
  const names = STATIC_PIN_LABELS[type];
  if (!names || names.length !== pins.length) fail(`${type}: static pin-label count does not match its pins`);
  const [minX, minY, maxX, maxY] = bodyBbox;
  const inset = 0.45;
  return pins.map(([pinX, pinY], index) => {
    let x = Math.max(minX + inset, Math.min(maxX - inset, pinX));
    let y = Math.max(minY + inset, Math.min(maxY - inset, pinY));
    let anchor = "middle";
    if (pinX < minX) { x = minX + inset; anchor = "start"; }
    else if (pinX > maxX) { x = maxX - inset; anchor = "end"; }
    else if (pinY < minY) y = minY + inset;
    else if (pinY > maxY) y = maxY - inset;
    return `<text class="sym-pin-label" data-pin-label-index="${index}" x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" dominant-baseline="middle">${xmlText(names[index])}</text>`;
  }).join("");
}

function withPinLabels(result) {
  return { ...result, markup: `${result.markup}${pinLabelMarkup(result.type, result.pins, result.bodyBbox)}` };
}

function rect(minX, minY, maxX, maxY, classes = "") {
  const attribute = classes ? ` class="${classes}"` : "";
  return `<path${attribute} d="M${fmt(minX)} ${fmt(minY)} L${fmt(maxX)} ${fmt(minY)} L${fmt(maxX)} ${fmt(maxY)} L${fmt(minX)} ${fmt(maxY)} Z"/>`;
}

function lead(inner, outer) {
  return `<path class="pin-lead" d="M${fmt(inner[0])} ${fmt(inner[1])} L${fmt(outer[0])} ${fmt(outer[1])}"/>`;
}

function blockSymbol(type, targets) {
  const bodyHalfWidth = 4;
  for (const [x, y] of targets) {
    if (Math.abs(x) !== 6 || !Number.isInteger(y)) fail(`${type}: catalog block pins must sit on the x = +/-6 lead columns`);
  }
  const ys = targets.map(([, y]) => y);
  const bodyMinY = Math.min(...ys) - 1;
  const bodyMaxY = Math.max(...ys) + 1;
  const body = [rect(-bodyHalfWidth, bodyMinY, bodyHalfWidth, bodyMaxY, "sym-bg")];
  const bodyBounds = [[-bodyHalfWidth, bodyMinY], [bodyHalfWidth, bodyMaxY]];
  if (type === "timer_555") {
    // DIP orientation notch, kept inside the body so it cannot widen the bounds.
    body.push(`<path d="M-0.6667 ${fmt(bodyMinY)} A0.666667 0.666667 0 0 0 0.6667 ${fmt(bodyMinY)}"/>`);
  }
  const leads = targets.map(([x, y]) => lead([Math.sign(x) * bodyHalfWidth, y], [x, y]));
  const allBounds = [...bodyBounds, ...targets.map((point) => [...point])];
  const xs = allBounds.map((point) => point[0]);
  const boundsYs = allBounds.map((point) => point[1]);
  return {
    type,
    markup: [...body, ...leads].join(""),
    refdesAnchor: [0, bodyMinY - 1.3333],
    valueAnchor: [0, bodyMaxY + 1.3333],
    bodyBbox: [-bodyHalfWidth, bodyMinY, bodyHalfWidth, bodyMaxY],
    bbox: [Math.min(...xs), Math.min(...boundsYs), Math.max(...xs), Math.max(...boundsYs)],
    pins: targets.map((point) => [...point]),
  };
}

function regulatorSymbol(targets) {
  const expected = [[-4, 0], [4, 0], [0, 3]];
  assertTargets("vreg_linear_3", targets, expected);
  return {
    type: "vreg_linear_3",
    markup: [
      rect(-3, -2, 3, 2, "sym-bg"),
      lead([-3, 0], [-4, 0]),
      lead([3, 0], [4, 0]),
      lead([0, 2], [0, 3]),
    ].join(""),
    refdesAnchor: [0, -3.3333],
    valueAnchor: [0, 4.3333],
    bodyBbox: [-3, -2, 3, 2],
    bbox: [-4, -2, 4, 3],
    pins: targets.map((point) => [...point]),
  };
}

function comparatorSymbol(targets) {
  const expected = [[-6, -2], [-6, 2], [6, 0], [0, -5], [0, 5]];
  assertTargets("comparator", targets, expected);
  return {
    type: "comparator",
    markup: [
      `<path class="sym-bg" d="M4 0 L-4 -4 L-4 4 Z"/>`,
      `<path d="M-3.8 -2 L-3.2 -2 M-3.5 -2.3 L-3.5 -1.7"/>`,
      `<path d="M-3.8 2 L-3.2 2"/>`,
      lead([-4, -2], [-6, -2]),
      lead([-4, 2], [-6, 2]),
      lead([4, 0], [6, 0]),
      lead([0, -2], [0, -5]),
      lead([0, 2], [0, 5]),
    ].join(""),
    refdesAnchor: [-2, -5.3333],
    valueAnchor: [-2, 5.3333],
    bodyBbox: [-4, -4, 4, 4],
    bbox: [-6, -5, 6, 5],
    pins: targets.map((point) => [...point]),
  };
}

function jfetSymbol(targets) {
  const expected = [[2, -3], [-2, 0], [2, 3]];
  assertTargets("jfet_n", targets, expected);
  return {
    type: "jfet_n",
    markup: [
      `<circle cx="0.8" cy="0" r="1.8"/>`,
      `<path class="sym-bold" d="M0.8 -1.5 L0.8 1.5"/>`,
      `<path d="M0.8 -1.5 L2 -1.5"/>`,
      `<path d="M0.8 1.5 L2 1.5"/>`,
      `<path d="M-0.6667 0 L0.8 0"/>`,
      `<path class="sym-solid" d="M0.2 0 L-0.3 -0.25 L-0.3 0.25 Z"/>`,
      lead([2, -1.5], [2, -3]),
      lead([-0.6667, 0], [-2, 0]),
      lead([2, 1.5], [2, 3]),
    ].join(""),
    refdesAnchor: [3.3333, -0.75],
    valueAnchor: [3.3333, 0.75],
    bodyBbox: [-1, -1.8, 2.6, 1.8],
    bbox: [-2, -3, 2.6, 3],
    pins: targets.map((point) => [...point]),
  };
}

function optocouplerSymbol(targets) {
  const expected = [[0, -2], [0, 2]];
  assertTargets("optocoupler_led", targets, expected);
  return {
    type: "optocoupler_led",
    markup: [
      rect(-1.7333, -1.7333, 1.7333, 1.7333, "sym-bg"),
      `<path d="M-0.6667 0.6667 L0.6667 0.6667"/>`,
      `<path d="M-0.6667 -0.6667 L0.6667 -0.6667 L0 0.6667 Z"/>`,
      `<path d="M0 -0.6667 L0 0.6667"/>`,
      `<path d="M0.8 -0.4 L1.4667 -0.4 L1.2 -0.6 M1.4667 -0.4 L1.2 -0.2"/>`,
      `<path d="M0.8 0.2667 L1.4667 0.2667 L1.2 0.0667 M1.4667 0.2667 L1.2 0.4667"/>`,
      lead([0, -0.6667], [0, -2]),
      lead([0, 0.6667], [0, 2]),
    ].join(""),
    refdesAnchor: [-2.6667, 0],
    valueAnchor: [2.6667, 0],
    bodyBbox: [-1.7333, -1.7333, 1.7333, 1.7333],
    bbox: [-1.7333, -2, 1.7333, 2],
    pins: targets.map((point) => [...point]),
  };
}

function assertTargets(type, targets, expected) {
  if (JSON.stringify(targets) !== JSON.stringify(expected)) {
    fail(`${type}: PARTS pins ${JSON.stringify(targets)} do not match the authored symbol ${JSON.stringify(expected)}`);
  }
}

function authoredSymbol(type, targets, expected, specification) {
  assertTargets(type, targets, expected);
  return {
    type,
    ...specification,
    pins: targets.map((point) => [...point]),
  };
}

function simulatorV3Symbols(parts) {
  const build = (type, expected, specification) => {
    const targets = parts.get(type);
    if (!targets) fail(`could not read PARTS pins for ${type} from ${partsPath}`);
    return { result: authoredSymbol(type, targets, expected, specification) };
  };
  const contact = (x, y) => `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="0.2"/>`;
  const sourceLeads = [lead([0, -1], [0, -2]), lead([0, 1], [0, 2])].join("");
  const diamond = `<path class="sym-bg" d="M0 -2 L2 0 L0 2 L-2 0 Z"/>`;
  const dependentLeads = [lead([0, -2], [0, -3]), lead([0, 2], [0, 3]), lead([-2, -1], [-3, -1]), lead([-2, 1], [-3, 1])].join("");
  return [
    build("isource_pulse", [[0, -2], [0, 2]], {
      markup: `<circle class="sym-bg" cx="0" cy="0" r="1"/><path d="M-0.72 0.35 L-0.48 0.35 L-0.38 -0.35 L0.08 -0.35 L0.18 0.35 L0.62 0.35"/><path d="M-0.12 0.75 L0 0.92 L0.12 0.75 M0 0.92 L0 0.52"/>${sourceLeads}`,
      refdesAnchor: [1, -1], valueAnchor: [1, 0], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2],
    }),
    build("switch_spdt", [[-2, 0], [2, -1], [2, 1]], {
      markup: `${contact(-0.8, 0)}${contact(0.8, -0.6)}${contact(0.8, 0.6)}${lead([-1, 0], [-2, 0])}${lead([1, -1], [2, -1])}${lead([1, 1], [2, 1])}`,
      lever: `<path d="M-0.6 -0.08 L0.6 -0.55"/>`, leverPivot: [-0.8, 0],
      refdesAnchor: [0, -2], valueAnchor: [0, 2], bodyBbox: [-1, -1, 1, 1], bbox: [-2, -1, 2, 1],
    }),
    build("switch_dpdt", [[-3, -2], [3, -3], [3, -1], [-3, 2], [3, 1], [3, 3]], {
      markup: `${contact(-1.8, -2)}${contact(1.8, -2.6)}${contact(1.8, -1.4)}${contact(-1.8, 2)}${contact(1.8, 1.4)}${contact(1.8, 2.6)}${lead([-2, -2], [-3, -2])}${lead([2, -3], [3, -3])}${lead([2, -1], [3, -1])}${lead([-2, 2], [-3, 2])}${lead([2, 1], [3, 1])}${lead([2, 3], [3, 3])}`,
      refdesAnchor: [0, -4.3333], valueAnchor: [0, 4.3333], bodyBbox: [-2, -3, 2, 3], bbox: [-3, -3, 3, 3],
    }),
    ...["switch_pushbutton", "switch_toggle"].map((type) => build(type, [[-2, 0], [2, 0]], {
      markup: `${contact(-0.8, 0)}${contact(0.8, 0)}${lead([-1, 0], [-2, 0])}${lead([1, 0], [2, 0])}${type === "switch_pushbutton" ? `<path d="M0 -1.35 L0 -0.65 M-0.45 -1.35 L0.45 -1.35"/>` : `<path d="M-0.8 -0.7 L-0.3 -1.25"/>`}`,
      lever: `<path d="M-0.6 -0.1 L0.6 -0.7"/>`, leverPivot: [-0.8, 0],
      refdesAnchor: [0, -2], valueAnchor: [0, 1.4], bodyBbox: [-1, -1.35, 1, 0.2], bbox: [-2, -1.35, 2, 0.2],
    })),
    build("switch_vcontrolled", [[-3, -1], [3, -1], [-1, 3], [1, 3]], {
      markup: `<path class="sym-bg" d="M-1.5 -2 L1.5 -2 L1.5 1 L-1.5 1 Z"/><path d="M-0.8 -1 L0.65 -1.55"/><path d="M-0.55 0.45 L0 0 L0.55 0.45 M0 0 L0 0.8"/>${lead([-1.5, -1], [-3, -1])}${lead([1.5, -1], [3, -1])}${lead([-1, 1], [-1, 3])}${lead([1, 1], [1, 3])}`,
      refdesAnchor: [0, -3.3333], valueAnchor: [0, 4.3333], bodyBbox: [-1.5, -2, 1.5, 1], bbox: [-3, -2, 3, 3],
    }),
    ...[["vcvs", "+", "−"], ["vccs", "↓", ""], ["cccs", "↓", ""], ["ccvs", "+", "−"]].map(([type, upper, lower]) => build(type, [[0, -3], [0, 3], [-3, -1], [-3, 1]], {
      markup: `${diamond}<path d="M-0.45 -0.35 L0.45 -0.35${upper === "↓" ? " M0 -0.75 L0 0.85 M-0.25 0.55 L0 0.85 L0.25 0.55" : " M0 -0.8 L0 0.1"}${lower ? " M-0.35 0.65 L0.35 0.65" : ""}"/>${dependentLeads}`,
      refdesAnchor: [2.6, -2], valueAnchor: [2.6, 2], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -3, 2, 3],
    })),
    build("behavioral_source", [[0, -2], [0, 2]], {
      markup: `<circle class="sym-bg" cx="0" cy="0" r="1"/><path d="M-0.45 -0.55 L-0.45 0.55 L0.1 0.55 A0.4 0.4 0 0 0 0.1 -0.25 L-0.45 -0.25 M0.35 -0.55 L0.35 0.55"/>${sourceLeads}`,
      refdesAnchor: [1, -1], valueAnchor: [1, 0], bodyBbox: [-1, -1, 1, 1], bbox: [-1, -2, 1, 2],
    }),
    build("transformer", [[-3, -2], [-3, 2], [3, -2], [3, 2]], {
      markup: `<path d="M-1.25 -2 A0.5 0.5 0 0 1 -1.25 -1 M-1.25 -1 A0.5 0.5 0 0 1 -1.25 0 M-1.25 0 A0.5 0.5 0 0 1 -1.25 1 M-1.25 1 A0.5 0.5 0 0 1 -1.25 2 M1.25 -2 A0.5 0.5 0 0 0 1.25 -1 M1.25 -1 A0.5 0.5 0 0 0 1.25 0 M1.25 0 A0.5 0.5 0 0 0 1.25 1 M1.25 1 A0.5 0.5 0 0 0 1.25 2 M-0.35 -2 L-0.35 2 M0.35 -2 L0.35 2"/>${lead([-1.25, -2], [-3, -2])}${lead([-1.25, 2], [-3, 2])}${lead([1.25, -2], [3, -2])}${lead([1.25, 2], [3, 2])}`,
      refdesAnchor: [0, -3.3333], valueAnchor: [0, 3.3333], bodyBbox: [-1.75, -2, 1.75, 2], bbox: [-3, -2, 3, 2],
    }),
    build("crystal", [[-2, 0], [2, 0]], {
      markup: `<path class="sym-bg" d="M-0.7 -0.8 L0.7 -0.8 L0.7 0.8 L-0.7 0.8 Z"/><path d="M-1 -1 L-1 1 M1 -1 L1 1"/>${lead([-1, 0], [-2, 0])}${lead([1, 0], [2, 0])}`,
      refdesAnchor: [0, -2], valueAnchor: [0, 2], bodyBbox: [-1, -1, 1, 1], bbox: [-2, -1, 2, 1],
    }),
    build("transmission_line", [[-3, -1], [-3, 1], [3, -1], [3, 1]], {
      markup: `<path class="sym-bg" d="M-2 -2 L2 -2 L2 2 L-2 2 Z"/><path d="M-1.5 -1 L1.5 -1 M-1.5 1 L1.5 1 M-1.15 -1.35 L-1.5 -1 L-1.15 -0.65 M1.15 0.65 L1.5 1 L1.15 1.35"/>${lead([-2, -1], [-3, -1])}${lead([-2, 1], [-3, 1])}${lead([2, -1], [3, -1])}${lead([2, 1], [3, 1])}`,
      refdesAnchor: [0, -3.3333], valueAnchor: [0, 3.3333], bodyBbox: [-2, -2, 2, 2], bbox: [-3, -2, 3, 2],
    }),
    build("zener", [[0, -2], [0, 2]], {
      markup: `<path d="M-0.6667 -0.6667 L0.6667 -0.6667 L0 0.6667 Z M-0.6667 0.6667 L0.6667 0.6667 M-0.6667 0.6667 L-0.9 0.9 M0.6667 0.6667 L0.9 0.4333"/>${lead([0, -0.6667], [0, -2])}${lead([0, 0.6667], [0, 2])}`,
      refdesAnchor: [-1.3333, 0], valueAnchor: [1.3333, 0], bodyBbox: [-0.9, -0.6667, 0.9, 0.9], bbox: [-0.9, -2, 0.9, 2],
    }),
    build("battery", [[0, -2], [0, 2]], {
      markup: `<path d="M-1 -0.35 L1 -0.35 M-0.55 0.35 L0.55 0.35"/>${lead([0, -0.35], [0, -2])}${lead([0, 0.35], [0, 2])}`,
      refdesAnchor: [1.3333, -0.7], valueAnchor: [1.3333, 0.7], bodyBbox: [-1, -0.35, 1, 0.35], bbox: [-1, -2, 1, 2],
    }),
    build("fuse", [[-2, 0], [2, 0]], {
      markup: `<path class="sym-bg" d="M-1.2 -0.6 L1.2 -0.6 L1.2 0.6 L-1.2 0.6 Z"/><path d="M-1.2 0 C-0.6 -0.55 0.6 0.55 1.2 0"/>${lead([-1.2, 0], [-2, 0])}${lead([1.2, 0], [2, 0])}`,
      refdesAnchor: [0, -1.6], valueAnchor: [0, 1.6], bodyBbox: [-1.2, -0.6, 1.2, 0.6], bbox: [-2, -0.6, 2, 0.6],
    }),
  ];
}

function generateCatalogSymbols(parts) {
  const results = [];
  for (const type of BLOCK_TYPES) {
    const targets = parts.get(type);
    if (!targets) fail(`could not read PARTS pins for ${type} from ${partsPath}`);
    results.push({ result: withPinLabels(blockSymbol(type, targets)) });
  }
  for (const [type, build] of [
    ["vreg_linear_3", regulatorSymbol],
    ["comparator", comparatorSymbol],
    ["jfet_n", jfetSymbol],
    ["optocoupler_led", optocouplerSymbol],
  ]) {
    const targets = parts.get(type);
    if (!targets) fail(`could not read PARTS pins for ${type} from ${partsPath}`);
    results.push({ result: withPinLabels(build(targets)) });
  }
  results.push(...simulatorV3Symbols(parts));
  return results;
}

function formatPoint(point) {
  return `[${fmt(point[0])}, ${fmt(point[1])}]`;
}

function formatSymbol(result) {
  const lines = [
    `  ${JSON.stringify(result.type)}: {`,
    `    type: ${JSON.stringify(result.type)},`,
    `    markup: ${JSON.stringify(result.markup)},`,
    `    refdesAnchor: ${formatPoint(result.refdesAnchor)},`,
    `    valueAnchor: ${formatPoint(result.valueAnchor)},`,
  ];
  if (result.wiper !== undefined) lines.push(`    wiper: ${JSON.stringify(result.wiper)},`);
  if (result.wiperAnchor !== undefined) lines.push(`    wiperAnchor: ${formatPoint(result.wiperAnchor)},`);
  if (result.wiperTravel !== undefined) lines.push(`    wiperTravel: [${result.wiperTravel.map(fmt).join(", ")}],`);
  if (result.lever !== undefined) lines.push(`    lever: ${JSON.stringify(result.lever)},`);
  if (result.leverPivot !== undefined) lines.push(`    leverPivot: ${formatPoint(result.leverPivot)},`);
  lines.push(`    bodyBbox: [${result.bodyBbox.map(fmt).join(", ")}],`);
  lines.push(`    bbox: [${result.bbox.map(fmt).join(", ")}],`);
  lines.push(`    pins: [${result.pins.map(formatPoint).join(", ")}],`);
  lines.push("  },");
  return lines.join("\n");
}

function outputPathFromArgs(args) {
  if (args.length === 0) return join(packageRoot, "src", "symbols.generated.ts");
  if (args.length === 2 && args[0] === "--output") return resolve(args[1]);
  fail("usage: node scripts/generate-symbols.mjs [--output <path>]");
}

const parts = parseParts();
const definitions = loadDefinitions();
const generated = [
  ...SYMBOLS.map(([type, sourcePath, symbolName]) => generateSymbol(type, sourcePath, symbolName, parts.get(type), definitions)),
  ...generateCatalogSymbols(parts),
];
const source = `// AUTO-GENERATED by scripts/generate-symbols.mjs — DO NOT EDIT.
// Artwork derived from the KiCad symbol libraries (CC-BY-SA 4.0), see vendor/kicad-symbols/README.md.
import type { ComponentType, Point } from "@opencircuit/circuit-schema";
export interface EditorSymbol {
  type: ComponentType;
  /** SVG inner markup, editor grid units, y-down, origin = component anchor. Classes only: sym-bg, sym-solid, sym-bold, pin-lead. */
  markup: string;
  /** Canonical transformed KiCad property anchors. Runtime layout follows these anchors with normalized screen spacing; historical screen-oriented label offsets are ignored. */
  refdesAnchor: Point;
  valueAnchor: Point;
  /** Present only for potentiometer / switch_spst. */
  wiper?: string;
  /** Fixed zero-offset junction and allowed y-translation for the movable potentiometer artwork. */
  wiperAnchor?: Point;
  wiperTravel?: [number, number];
  lever?: string;
  leverPivot?: Point;
  /** Tight graphics-only bounding box excluding electrical pin leads. */
  bodyBbox: [number, number, number, number];
  /** Tight bounding box incl. pin leads and full declared motion: [minX, minY, maxX, maxY], grid units. */
  bbox: [number, number, number, number];
  /** Connection points; MUST deep-equal PARTS pins for this type, same order. */
  pins: Point[];
}
export const EDITOR_SYMBOLS: Record<ComponentType, EditorSymbol> = {
${generated.map(({ result }) => formatSymbol(result)).join("\n")}
};
`;
const outputPath = outputPathFromArgs(process.argv.slice(2));
writeFileSync(outputPath, source);
console.log(`wrote ${outputPath}`);
for (let index = 0; index < generated.length; index += 1) {
  const { result, transform } = generated[index];
  if (!transform) {
    console.log(`${result.type}\tauthored\tbbox=[${result.bbox.map(fmt).join(",")}]`);
    continue;
  }
  const [type, sourcePath] = SYMBOLS[index];
  console.log(`${type}\t${sourcePath}\ttheta=${transform.theta}\ta=${fmt(transform.a)}\tb=${fmt(transform.b)}\tc=${fmt(transform.c)}\td=${fmt(transform.d)}\tbbox=[${result.bbox.map(fmt).join(",")}]`);
}
