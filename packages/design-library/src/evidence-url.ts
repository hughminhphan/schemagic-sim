const HOSTNAME_LABEL_PATTERN_SOURCE = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOSTNAME_PATTERN_SOURCE = `(?:${HOSTNAME_LABEL_PATTERN_SOURCE})(?:\\.(?:${HOSTNAME_LABEL_PATTERN_SOURCE}))*`;
const PERCENT_ESCAPE_PATTERN_SOURCE = "%[0-9A-Fa-f]{2}";
const UNRESERVED_PATTERN_SOURCE = "[A-Za-z0-9._~-]";
const SUB_DELIMITER_PATTERN_SOURCE = "[!$&'()*+,;=]";
const PATH_CHARACTER_PATTERN_SOURCE = `(?:${UNRESERVED_PATTERN_SOURCE}|${PERCENT_ESCAPE_PATTERN_SOURCE}|${SUB_DELIMITER_PATTERN_SOURCE}|[:@])`;
const QUERY_OR_FRAGMENT_CHARACTER_PATTERN_SOURCE = `(?:${PATH_CHARACTER_PATTERN_SOURCE}|[/?])`;

/**
 * The sole persisted evidence-URL grammar used by both runtime validation and
 * generated JSON Schema. It deliberately validates the supplied bytes instead
 * of accepting a URL parser's normalized representation.
 */
export const CANONICAL_EVIDENCE_URL_PATTERN_SOURCE =
  `^https://${HOSTNAME_PATTERN_SOURCE}(?::[0-9]{1,5})?` +
  `(?:\\/(?:${PATH_CHARACTER_PATTERN_SOURCE})*)*` +
  `(?:\\?(?:${QUERY_OR_FRAGMENT_CHARACTER_PATTERN_SOURCE})*)?` +
  `(?:#(?:${QUERY_OR_FRAGMENT_CHARACTER_PATTERN_SOURCE})*)?$`;

const CANONICAL_EVIDENCE_URL_PATTERN = new RegExp(CANONICAL_EVIDENCE_URL_PATTERN_SOURCE);

export interface CanonicalEvidenceUrl {
  hostname: string;
}

/** Returns the exact lowercase ASCII host only when the raw URL matches the contract. */
export function parseCanonicalEvidenceUrl(value: string): CanonicalEvidenceUrl | undefined {
  if (!CANONICAL_EVIDENCE_URL_PATTERN.test(value)) return undefined;
  const authorityStart = "https://".length;
  const separatorIndexes = [value.indexOf("/", authorityStart), value.indexOf("?", authorityStart), value.indexOf("#", authorityStart)]
    .filter((index) => index >= 0);
  const authorityEnd = separatorIndexes.length === 0 ? value.length : Math.min(...separatorIndexes);
  const authority = value.slice(authorityStart, authorityEnd);
  const portSeparator = authority.indexOf(":");
  return { hostname: portSeparator < 0 ? authority : authority.slice(0, portSeparator) };
}
