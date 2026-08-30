/**
 * Internal preflight for a CSV assembled as one complete header line followed
 * by rows of `${prefix},${row}\n`. This module is deliberately absent from the
 * package export map and grants no artifact-rendering authority.
 */
export function csvWithRepeatedPrefixFitsByteLimitV1(
  header: string,
  rows: readonly string[],
  prefix: string,
  maximumBytes: number,
): boolean {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) return false;
  if (header.length > maximumBytes || prefix.length > maximumBytes) return false;
  const encoder = new TextEncoder();
  const prefixBytes = encoder.encode(prefix).byteLength;
  let outputBytes = encoder.encode(header).byteLength;
  if (outputBytes > maximumBytes || prefixBytes > maximumBytes) return false;
  for (const row of rows) {
    outputBytes += prefixBytes + 1 + encoder.encode(row).byteLength + 1;
    if (outputBytes > maximumBytes) return false;
  }
  return true;
}
