import type { DistributorId } from "./ids";
import type { DistributorOfferV2 } from "./v2";

const RFC3339_V2 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const NANOS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;

export interface ParsedRfc3339InstantV2 {
  original: string;
  epochNanoseconds: bigint;
}

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const values = [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  return values[month - 1] ?? 0;
}

// Howard Hinnant's proleptic-Gregorian civil-date conversion, with epoch
// 1970-01-01. It is integer-only and valid well beyond our accepted range.
function daysFromCivil(yearInput: number, monthInput: number, day: number): bigint {
  let year = yearInput;
  const month = monthInput;
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return BigInt(era * 146_097 + dayOfEra - 719_468);
}

const MIN_INSTANT_V2 = daysFromCivil(1, 1, 1) * SECONDS_PER_DAY * NANOS_PER_SECOND;
const MAX_INSTANT_V2 = (
  (daysFromCivil(9999, 12, 31) + 1n) * SECONDS_PER_DAY * NANOS_PER_SECOND
) - 1n;

export function parseRfc3339InstantV2(value: string): ParsedRfc3339InstantV2 {
  if (typeof value !== "string") throw new TypeError("RFC 3339 instant must be a string");
  const match = RFC3339_V2.exec(value);
  if (match === null) throw new RangeError("Invalid strict RFC 3339 instant");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError("Invalid Gregorian date");
  }
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError("Invalid RFC 3339 time");
  let offsetSeconds = 0;
  if (match[8] !== "Z") {
    const offsetHour = Number(match[10]);
    const offsetMinute = Number(match[11]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new RangeError("RFC 3339 offset exceeds 14 hours");
    }
    offsetSeconds = (offsetHour * 3_600 + offsetMinute * 60) * (match[9] === "+" ? 1 : -1);
  }
  const localSeconds = daysFromCivil(year, month, day) * SECONDS_PER_DAY
    + BigInt(hour * 3_600 + minute * 60 + second);
  const nanoseconds = (localSeconds - BigInt(offsetSeconds)) * NANOS_PER_SECOND
    + BigInt(fraction.padEnd(9, "0"));
  if (nanoseconds < MIN_INSTANT_V2 || nanoseconds > MAX_INSTANT_V2) {
    throw new RangeError("Normalized RFC 3339 instant is outside years 0001 through 9999");
  }
  return { original: value, epochNanoseconds: nanoseconds };
}

export function compareRfc3339InstantsV2(left: string, right: string): number {
  const leftNs = parseRfc3339InstantV2(left).epochNanoseconds;
  const rightNs = parseRfc3339InstantV2(right).epochNanoseconds;
  return leftNs < rightNs ? -1 : leftNs > rightNs ? 1 : 0;
}

function civilFromDays(daysInput: bigint): { year: number; month: number; day: number } {
  const z = Number(daysInput + 719_468n);
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1_460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

export function formatRfc3339InstantV2(epochNanoseconds: bigint): string {
  if (typeof epochNanoseconds !== "bigint" || epochNanoseconds < MIN_INSTANT_V2 || epochNanoseconds > MAX_INSTANT_V2) {
    throw new RangeError("Instant is outside years 0001 through 9999");
  }
  let wholeSeconds = epochNanoseconds / NANOS_PER_SECOND;
  let nanos = epochNanoseconds % NANOS_PER_SECOND;
  if (nanos < 0n) {
    wholeSeconds -= 1n;
    nanos += NANOS_PER_SECOND;
  }
  let days = wholeSeconds / SECONDS_PER_DAY;
  let secondOfDay = wholeSeconds % SECONDS_PER_DAY;
  if (secondOfDay < 0n) {
    days -= 1n;
    secondOfDay += SECONDS_PER_DAY;
  }
  const { year, month, day } = civilFromDays(days);
  const hour = Number(secondOfDay / 3_600n);
  const minute = Number((secondOfDay % 3_600n) / 60n);
  const second = Number(secondOfDay % 60n);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.${String(nanos).padStart(9, "0")}Z`;
}

function decimalExponent(numerator: bigint, denominator: bigint): number {
  const numeratorDigits = numerator.toString().length;
  const denominatorDigits = denominator.toString().length;
  let exponent = numeratorDigits - denominatorDigits;
  if (exponent >= 0) {
    if (numerator < denominator * (10n ** BigInt(exponent))) exponent -= 1;
  } else if (numerator * (10n ** BigInt(-exponent)) < denominator) {
    exponent -= 1;
  }
  return exponent;
}

export function canonicalCommercialRationalV2(numerator: bigint, denominator: bigint): number {
  if (typeof numerator !== "bigint" || typeof denominator !== "bigint" || numerator < 0n || denominator <= 0n) {
    throw new RangeError("Commercial rational must be non-negative with a positive denominator");
  }
  if (numerator === 0n) return 0;
  let exponent = decimalExponent(numerator, denominator);
  const scale = 11 - exponent;
  const scaledNumerator = scale >= 0 ? numerator * (10n ** BigInt(scale)) : numerator;
  const scaledDenominator = scale >= 0 ? denominator : denominator * (10n ** BigInt(-scale));
  let quotient = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  const doubled = remainder * 2n;
  if (doubled > scaledDenominator || (doubled === scaledDenominator && quotient % 2n !== 0n)) quotient += 1n;
  if (quotient === 1_000_000_000_000n) {
    quotient = 100_000_000_000n;
    exponent += 1;
  }
  const result = Number(`${quotient}e${exponent - 11}`);
  if (!Number.isFinite(result)) throw new RangeError("Commercial rational does not fit a finite number");
  return result;
}

export function canonicalCommercialNumberV2(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError("Commercial number must be finite");
  return Number(value.toPrecision(12));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export const DISTRIBUTOR_PRODUCT_LINK_HOSTS_V2: Readonly<Record<DistributorId, readonly string[]>> = deepFreeze({
  digikey: ["www.digikey.com"],
  lcsc: ["www.lcsc.com"],
  mouser: ["www.mouser.com"],
});

const SAFE_PRODUCT_URL_V2 = /^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*)?(\?[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*)?$/;

export function isStructurallySafeProductUrlV2(value: unknown): value is string {
  if (typeof value !== "string" || /%(?![0-9A-Fa-f]{2})/.test(value)) return false;
  const match = SAFE_PRODUCT_URL_V2.exec(value);
  if (match === null || match[1]!.includes(":")) return false;
  const hostname = match[1]!;
  if (hostname.length > 253 || hostname.split(".").some((label) => label.length === 0 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return false;
  return hostname === hostname.toLowerCase();
}

export function isVerifiedDistributorProductUrlV2(offer: Readonly<DistributorOfferV2>): boolean {
  if (!isStructurallySafeProductUrlV2(offer.productUrl)) return false;
  const hostname = SAFE_PRODUCT_URL_V2.exec(offer.productUrl)?.[1];
  const allowed = DISTRIBUTOR_PRODUCT_LINK_HOSTS_V2[offer.distributor];
  return hostname !== undefined && allowed !== undefined && allowed.includes(hostname);
}
