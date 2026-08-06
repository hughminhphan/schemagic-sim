export function snapCursorIndex(xValues: Float64Array, target: number, logScale = false): number {
  if (xValues.length === 0) return -1;
  const comparableTarget = logScale ? Math.log10(Math.max(target, Number.MIN_VALUE)) : target;
  let low = 0;
  let high = xValues.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const value = logScale ? Math.log10(Math.max(xValues[middle] ?? 0, Number.MIN_VALUE)) : (xValues[middle] ?? 0);
    if (value < comparableTarget) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  const current = xValues[low] ?? 0;
  const previous = xValues[low - 1] ?? 0;
  const currentDistance = Math.abs((logScale ? Math.log10(current) : current) - comparableTarget);
  const previousDistance = Math.abs((logScale ? Math.log10(previous) : previous) - comparableTarget);
  return previousDistance <= currentDistance ? low - 1 : low;
}
