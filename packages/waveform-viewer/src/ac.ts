export interface BodeData {
  magnitudeDb: Float64Array;
  phaseDeg: Float64Array;
}

export function complexToBode(interleaved: Float64Array, unwrapPhase = false): BodeData {
  if (interleaved.length % 2 !== 0) throw new Error("AC vectors must contain interleaved real and imaginary values");
  const length = interleaved.length / 2;
  const magnitudeDb = new Float64Array(length);
  const phaseDeg = new Float64Array(length);
  let previous = 0;
  let offset = 0;
  for (let index = 0; index < length; index += 1) {
    const real = interleaved[index * 2] ?? 0;
    const imaginary = interleaved[index * 2 + 1] ?? 0;
    magnitudeDb[index] = 20 * Math.log10(Math.hypot(real, imaginary));
    let phase = Math.atan2(imaginary, real) * 180 / Math.PI;
    if (unwrapPhase && index > 0) {
      const delta = phase + offset - previous;
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
      phase += offset;
    }
    phaseDeg[index] = phase;
    previous = phase;
  }
  return { magnitudeDb, phaseDeg };
}
