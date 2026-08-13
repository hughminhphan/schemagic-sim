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

function fmt(value) {
  const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000;
  return String(Object.is(rounded, -0) || Math.abs(rounded) < 0.00005 ? 0 : rounded);
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
    const radius = sourceRadius * Math.sqrt(Math.abs(transform.a * transform.c));
    bounds.push([center[0] - radius, center[1] - radius], [center[0] + radius, center[1] + radius]);
    markup = `<circle${classAttribute(classes)} cx="${fmt(center[0])}" cy="${fmt(center[1])}" r="${fmt(radius)}"/>`;
  } else if (tag === "arc") {
    const startNode = child(node, "start");
    const midNode = child(node, "mid");
    const endNode = child(node, "end");
    if (!startNode || !midNode || !endNode) fail(`${context}: arc missing start/mid/end`);
    const sourcePoints = [startNode, midNode, endNode].map((point, index) => [numberAt(point, 1, `${context} point ${index} x`), numberAt(point, 2, `${context} point ${index} y`)]);
    const [start, mid, end] = sourcePoints.map((point) => applyTransform(point, transform));
    const geometry = arcGeometry(start, mid, end, context);
    const anisotropy = Math.abs(Math.abs(transform.a) - Math.abs(transform.c)) / Math.abs(transform.a);
    const radius = anisotropy > 0.02
      ? arcGeometry(...sourcePoints, context).radius * Math.sqrt(Math.abs(transform.a * transform.c))
      : geometry.radius;
    markup = `<path${classAttribute(classes)} d="M${fmt(start[0])} ${fmt(start[1])} A${fmt(radius)} ${fmt(radius)} 0 ${geometry.largeArc} ${geometry.sweep} ${fmt(end[0])} ${fmt(end[1])}"/>`;
    const signedDelta = geometry.sweep ? geometry.delta : -geometry.delta;
    for (let step = 0; step <= 64; step += 1) {
      const angle = geometry.startAngle + signedDelta * step / 64;
      bounds.push([geometry.center[0] + radius * Math.cos(angle), geometry.center[1] + radius * Math.sin(angle)]);
    }
    bounds.push(start, mid, end);
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
  const start = applyTransform(pin.at, transform);
  const end = applyTransform(pinLeadEndpoint(pin), transform);
  return {
    markup: `<path class="pin-lead" d="M${fmt(start[0])} ${fmt(start[1])} L${fmt(end[0])} ${fmt(end[1])}"/>`,
    bounds: [start, end],
    background: false,
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
  const markupElements = [];
  const wiperElements = [];
  const leverElements = [];
  const allBounds = [];

  for (const graphic of collected.graphics) {
    const rendered = renderPrimitive(graphic, transform, type);
    allBounds.push(...rendered.bounds);
    if (type === "potentiometer" && isPotentiometerWiperGraphic(graphic)) wiperElements.push(rendered);
    else if (type === "switch_spst" && isSwitchLeverGraphic(graphic)) leverElements.push(rendered);
    else markupElements.push(rendered);
  }
  if (type === "opamp_ideal") {
    const glyphs = renderOpampGlyphs(transform);
    markupElements.push(...glyphs);
    allBounds.push(...glyphs.flatMap((glyph) => glyph.bounds));
  }
  for (const { pin, targetIndex } of selectedPins) {
    const rendered = renderPinLead(pin, transform);
    allBounds.push(...rendered.bounds);
    if (type === "potentiometer" && targetIndex === 1) wiperElements.push(rendered);
    else markupElements.push(rendered);
  }

  if (markupElements.length === 0) fail(`${type}: generated empty markup`);
  if (type === "potentiometer" && wiperElements.length === 0) fail("potentiometer: failed to isolate wiper artwork");
  if (type === "switch_spst" && leverElements.length !== 1) fail(`switch_spst: expected one movable lever, found ${leverElements.length}`);
  const xs = allBounds.map((point) => point[0]);
  const ys = allBounds.map((point) => point[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const result = { type, markup: sortedMarkup(markupElements), bbox, pins: targets.map((point) => [...point]) };
  if (type === "potentiometer") result.wiper = sortedMarkup(wiperElements);
  if (type === "switch_spst") {
    result.lever = sortedMarkup(leverElements);
    result.leverPivot = applyTransform([-2.032, 0], transform);
  }
  return { result, transform };
}

function formatPoint(point) {
  return `[${fmt(point[0])}, ${fmt(point[1])}]`;
}

function formatSymbol(result) {
  const lines = [
    `  ${JSON.stringify(result.type)}: {`,
    `    type: ${JSON.stringify(result.type)},`,
    `    markup: ${JSON.stringify(result.markup)},`,
  ];
  if (result.wiper !== undefined) lines.push(`    wiper: ${JSON.stringify(result.wiper)},`);
  if (result.lever !== undefined) lines.push(`    lever: ${JSON.stringify(result.lever)},`);
  if (result.leverPivot !== undefined) lines.push(`    leverPivot: ${formatPoint(result.leverPivot)},`);
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
const generated = SYMBOLS.map(([type, sourcePath, symbolName]) => generateSymbol(type, sourcePath, symbolName, parts.get(type), definitions));
const source = `// AUTO-GENERATED by scripts/generate-symbols.mjs — DO NOT EDIT.
// Artwork derived from the KiCad symbol libraries (CC-BY-SA 4.0), see vendor/kicad-symbols/README.md.
import type { ComponentType, Point } from "@opencircuit/circuit-schema";
export interface EditorSymbol {
  type: ComponentType;
  /** SVG inner markup, editor grid units, y-down, origin = component anchor. Classes only: sym-bg, sym-solid, sym-bold, pin-lead. */
  markup: string;
  /** Present only for potentiometer / switch_spst. */
  wiper?: string;
  lever?: string;
  leverPivot?: Point;
  /** Tight bounding box incl. pin leads: [minX, minY, maxX, maxY], grid units. */
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
  const [type, sourcePath] = SYMBOLS[index];
  const { result, transform } = generated[index];
  console.log(`${type}\t${sourcePath}\ttheta=${transform.theta}\ta=${fmt(transform.a)}\tb=${fmt(transform.b)}\tc=${fmt(transform.c)}\td=${fmt(transform.d)}\tbbox=[${result.bbox.map(fmt).join(",")}]`);
}
