export interface Tick {
  value: number;
  major: boolean;
  label?: string;
}

export function niceStep(span: number, targetCount = 8): number {
  if (!(span > 0) || !(targetCount > 0)) return 1;
  const rough = span / targetCount;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export function linearTicks(min: number, max: number, targetCount = 8): Tick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const step = niceStep(max - min, targetCount);
  const first = Math.ceil(min / step) * step;
  const ticks: Tick[] = [];
  for (let value = first; value <= max + step * 1e-9; value += step) {
    ticks.push({ value: Number(value.toPrecision(14)), major: true });
  }
  return ticks;
}

export function logTicks(min: number, max: number): Tick[] {
  if (!(min > 0) || max <= min) return [];
  const firstDecade = Math.floor(Math.log10(min));
  const lastDecade = Math.ceil(Math.log10(max));
  const ticks: Tick[] = [];
  for (let exponent = firstDecade; exponent <= lastDecade; exponent += 1) {
    const decade = 10 ** exponent;
    for (const multiplier of [1, 2, 5]) {
      const value = multiplier * decade;
      if (value >= min && value <= max) ticks.push({ value, major: multiplier === 1 });
    }
  }
  return ticks;
}
