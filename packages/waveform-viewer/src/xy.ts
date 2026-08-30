export interface XYPoint {
  index: number;
  x: number;
  y: number;
}

/**
 * Bounds and thins an XY/VI series without sorting by X. Keeping source order is
 * essential for hysteresis loops and parametric device curves.
 */
export function orderedXYPoints(
  xValues: Float64Array,
  yValues: Float64Array,
  xMin: number,
  xMax: number,
  maximumPoints = 20_000,
): XYPoint[] {
  const length = Math.min(xValues.length, yValues.length);
  if (length === 0 || !(xMax > xMin) || maximumPoints < 2) return [];
  const visible: XYPoint[] = [];
  for (let index = 0; index < length; index += 1) {
    const x = xValues[index] ?? Number.NaN;
    const y = yValues[index] ?? Number.NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < xMin || x > xMax) continue;
    visible.push({ index, x, y });
  }
  if (visible.length <= maximumPoints) return visible;

  const output: XYPoint[] = [visible[0]!];
  const stride = (visible.length - 1) / (maximumPoints - 1);
  let previousIndex = 0;
  for (let slot = 1; slot < maximumPoints - 1; slot += 1) {
    const nextIndex = Math.max(previousIndex + 1, Math.min(visible.length - 2, Math.round(slot * stride)));
    output.push(visible[nextIndex]!);
    previousIndex = nextIndex;
  }
  output.push(visible.at(-1)!);
  return output;
}
