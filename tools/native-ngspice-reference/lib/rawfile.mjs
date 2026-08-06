const BINARY_MARKER = Buffer.from("Binary:");
const MAX_HEADER_BYTES = 8 * 1024 * 1024;
const MAX_DATA_BYTES = 2 * 1024 * 1024 * 1024;

function asBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  throw new TypeError("rawfile input must be a Buffer, Uint8Array, or ArrayBuffer");
}

function parseIntegerField(fields, name, { minimum = 0 } = {}) {
  const raw = fields.get(name.toLowerCase());
  if (raw === undefined) throw new Error(`ngspice rawfile is missing ${name}`);
  if (!/^\d+$/.test(raw)) throw new Error(`ngspice rawfile has invalid ${name}: ${raw}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`ngspice rawfile has out-of-range ${name}: ${raw}`);
  }
  return value;
}

function checkedProduct(values, label) {
  let product = 1;
  for (const value of values) {
    if (value !== 0 && product > Number.MAX_SAFE_INTEGER / value) {
      throw new Error(`ngspice rawfile ${label} exceeds safe integer range`);
    }
    product *= value;
  }
  return product;
}

function parseHeader(headerText) {
  if (headerText.includes("\0")) throw new Error("ngspice rawfile header contains a NUL byte");
  const lines = headerText.split(/\r?\n/);
  const fields = new Map();
  let variablesLine = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^Variables:\s*$/i.test(line)) {
      variablesLine = index;
      continue;
    }
    const match = /^([^:\r\n]+):\s*(.*)$/.exec(line);
    if (match) fields.set(match[1].trim().toLowerCase(), match[2].trim());
  }

  for (const required of ["title", "plotname", "flags", "no. variables", "no. points"]) {
    if (!fields.has(required)) throw new Error(`ngspice rawfile is missing ${required}`);
  }
  if (variablesLine < 0) throw new Error("ngspice rawfile is missing Variables:");

  const numVariables = parseIntegerField(fields, "No. Variables", { minimum: 1 });
  const numPoints = parseIntegerField(fields, "No. Points");
  const flags = fields.get("flags").toLowerCase().split(/\s+/).filter(Boolean);
  const hasReal = flags.includes("real");
  const hasComplex = flags.includes("complex");
  if (hasReal === hasComplex) {
    throw new Error(`ngspice rawfile Flags must contain exactly one of real or complex: ${fields.get("flags")}`);
  }

  const variables = [];
  for (let offset = 1; offset <= numVariables; offset += 1) {
    const line = lines[variablesLine + offset];
    if (line === undefined) throw new Error("ngspice rawfile variable table is truncated");
    const columns = line.trim().split(/\s+/);
    if (columns.length < 3 || !/^\d+$/.test(columns[0])) {
      throw new Error(`ngspice rawfile has invalid variable row: ${line}`);
    }
    const variableIndex = Number(columns[0]);
    if (variableIndex !== offset - 1) {
      throw new Error(`ngspice rawfile variable index ${variableIndex} is out of sequence`);
    }
    variables.push({ index: variableIndex, name: columns[1], type: columns[2] });
  }

  return {
    title: fields.get("title"),
    date: fields.get("date") ?? null,
    command: fields.get("command") ?? null,
    plotName: fields.get("plotname"),
    flags,
    dataType: hasComplex ? "complex" : "real",
    numVariables,
    numPoints,
    variables,
  };
}

export function parseRawfile(input) {
  const bytes = asBuffer(input);
  const markerAt = bytes.indexOf(BINARY_MARKER);
  if (markerAt < 0) throw new Error("ngspice rawfile has no Binary: marker");
  if (markerAt > MAX_HEADER_BYTES) throw new Error("ngspice rawfile header is unreasonably large");

  const afterMarker = markerAt + BINARY_MARKER.length;
  const nextByte = bytes[afterMarker];
  if (nextByte !== undefined && ![9, 10, 13, 32].includes(nextByte)) {
    throw new Error("ngspice rawfile Binary: marker is not followed by whitespace");
  }

  let dataOffset = afterMarker;
  while (dataOffset < bytes.length && [9, 10, 13, 32].includes(bytes[dataOffset])) dataOffset += 1;

  const headerText = bytes.subarray(0, markerAt).toString("utf8");
  const header = parseHeader(headerText);
  const components = header.dataType === "complex" ? 2 : 1;
  const valueCount = checkedProduct([header.numPoints, header.numVariables], "value count");
  const byteLength = checkedProduct([valueCount, components, 8], "binary byte length");
  const available = bytes.length - dataOffset;

  if (byteLength > MAX_DATA_BYTES) {
    throw new Error(`ngspice rawfile binary payload exceeds ${MAX_DATA_BYTES} bytes`);
  }
  if (available < byteLength) {
    throw new Error(`ngspice rawfile is truncated: expected ${byteLength} binary bytes, got ${available}`);
  }
  if (available > byteLength) {
    const trailing = bytes.subarray(dataOffset + byteLength);
    if (trailing.some((byte) => ![9, 10, 13, 32].includes(byte))) {
      throw new Error(`ngspice rawfile has ${available - byteLength} unexpected trailing bytes`);
    }
  }

  const vectorValues = Array.from({ length: header.numVariables }, () => new Array(header.numPoints));
  const view = new DataView(bytes.buffer, bytes.byteOffset + dataOffset, byteLength);
  let offset = 0;

  for (let point = 0; point < header.numPoints; point += 1) {
    for (let variable = 0; variable < header.numVariables; variable += 1) {
      const real = view.getFloat64(offset, true);
      offset += 8;
      if (header.dataType === "complex") {
        const img = view.getFloat64(offset, true);
        offset += 8;
        vectorValues[variable][point] = { real, img };
      } else {
        vectorValues[variable][point] = real;
      }
    }
  }

  const vectors = header.variables.map((variable, index) => ({
    ...variable,
    values: vectorValues[index],
  }));

  return {
    ...header,
    header: headerText,
    byteLength,
    vectors,
    data: new Map(vectors.map((vector) => [vector.name, vector.values])),
  };
}

export function canonicalVectorName(name, type = "") {
  const compact = String(name).trim().toLowerCase().replace(/\s+/g, "");
  const lowerType = String(type).trim().toLowerCase();
  if (compact === "time" || lowerType === "time") return "time";
  if (compact === "frequency" || lowerType === "frequency") return "frequency";

  const voltage = /^v\((.+)\)$/.exec(compact);
  if (voltage) return `v(${voltage[1]})`;
  const current = /^i\((.+)\)$/.exec(compact);
  if (current) return `i(${current[1]})`;
  const branch = /^(.+)#branch$/.exec(compact);
  if (branch) return `i(${branch[1]})`;
  if (lowerType === "voltage") return `v(${compact})`;
  if (lowerType === "current") return `i(${compact})`;
  return compact;
}
