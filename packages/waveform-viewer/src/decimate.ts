export interface DecimatedPoint {
  index: number;
  x: number;
  y: number;
}

export function decimateMinMax(
  xValues: Float64Array,
  yValues: Float64Array,
  xMin: number,
  xMax: number,
  pixelWidth: number,
  logScale = false,
): DecimatedPoint[] {
  const length = Math.min(xValues.length, yValues.length);
  const columns = Math.floor(pixelWidth);
  if (length === 0 || columns <= 0 || xMax <= xMin) return [];
  const transformedMin = logScale ? Math.log10(xMin) : xMin;
  const transformedMax = logScale ? Math.log10(xMax) : xMax;
  const transformedSpan = transformedMax - transformedMin;
  if (!(transformedSpan > 0)) return [];

  const minIndexes = new Int32Array(columns);
  const maxIndexes = new Int32Array(columns);
  minIndexes.fill(-1);
  maxIndexes.fill(-1);
  const minimums = new Float64Array(columns);
  const maximums = new Float64Array(columns);
  minimums.fill(Infinity);
  maximums.fill(-Infinity);
  const columnScale = columns / transformedSpan;

  for (let index = 0; index < length; index += 1) {
    const x = xValues[index] ?? 0;
    const y = yValues[index] ?? 0;
    if (x < xMin || x > xMax || !Number.isFinite(y) || (logScale && x <= 0)) continue;
    const transformedX = logScale ? Math.log10(x) : x;
    const column = Math.max(0, Math.min(columns - 1, Math.floor((transformedX - transformedMin) * columnScale)));
    if (y < (minimums[column] ?? Infinity)) {
      minimums[column] = y;
      minIndexes[column] = index;
    }
    if (y > (maximums[column] ?? -Infinity)) {
      maximums[column] = y;
      maxIndexes[column] = index;
    }
  }

  const result: DecimatedPoint[] = [];
  for (let column = 0; column < columns; column += 1) {
    const minIndex = minIndexes[column] ?? -1;
    const maxIndex = maxIndexes[column] ?? -1;
    if (minIndex < 0) continue;
    if (minIndex === maxIndex) {
      result.push({ index: minIndex, x: xValues[minIndex] ?? 0, y: yValues[minIndex] ?? 0 });
      continue;
    }
    const first = Math.min(minIndex, maxIndex);
    const second = Math.max(minIndex, maxIndex);
    result.push(
      { index: first, x: xValues[first] ?? 0, y: yValues[first] ?? 0 },
      { index: second, x: xValues[second] ?? 0, y: yValues[second] ?? 0 },
    );
  }
  return result;
}
