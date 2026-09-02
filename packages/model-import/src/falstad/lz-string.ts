const URI_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
const URI_VALUES = new Map([...URI_ALPHABET].map((character, index) => [character, index]));

interface BitReader {
  value: number;
  position: number;
  index: number;
}

const MAX_DECOMPRESSED_CHARACTERS = 2_000_000;

function readBits(bitCount: number, reader: BitReader, input: string): number {
  let bits = 0;
  let power = 1;
  const maximum = 1 << bitCount;
  while (power !== maximum) {
    const bit = reader.value & reader.position;
    reader.position >>= 1;
    if (reader.position === 0) {
      reader.position = 32;
      const character = input.charAt(reader.index++);
      const next = URI_VALUES.get(character);
      if (next === undefined) throw new Error("CircuitJS ctz payload contains an invalid character");
      reader.value = next;
    }
    if (bit !== 0) bits |= power;
    power <<= 1;
  }
  return bits;
}

/** LZString decompressFromEncodedURIComponent, kept inline to avoid a runtime dependency. */
export function decompressFromEncodedURIComponent(input: string): string {
  const source = input.replace(/ /g, "+");
  if (!source) throw new Error("CircuitJS ctz payload is empty");
  if (source.length > 2_000_000) throw new Error("CircuitJS ctz payload is too large");
  const first = URI_VALUES.get(source.charAt(0));
  if (first === undefined) throw new Error("CircuitJS ctz payload contains an invalid character");

  const dictionary: string[] = ["", "", ""];
  const reader: BitReader = { value: first, position: 32, index: 1 };
  let enlargeIn = 4;
  let dictionarySize = 4;
  let bitCount = 3;
  let character: string;
  switch (readBits(2, reader, source)) {
    case 0: character = String.fromCharCode(readBits(8, reader, source)); break;
    case 1: character = String.fromCharCode(readBits(16, reader, source)); break;
    case 2: return "";
    default: throw new Error("CircuitJS ctz payload is malformed");
  }

  dictionary[3] = character;
  let previous = character;
  const output = [character];
  let outputLength = character.length;
  while (true) {
    if (reader.index > source.length) throw new Error("CircuitJS ctz payload ended unexpectedly");
    let code = readBits(bitCount, reader, source);
    if (code === 0) {
      dictionary[dictionarySize++] = String.fromCharCode(readBits(8, reader, source));
      code = dictionarySize - 1;
      enlargeIn -= 1;
    } else if (code === 1) {
      dictionary[dictionarySize++] = String.fromCharCode(readBits(16, reader, source));
      code = dictionarySize - 1;
      enlargeIn -= 1;
    } else if (code === 2) {
      return output.join("");
    }
    if (enlargeIn === 0) {
      enlargeIn = 1 << bitCount;
      bitCount += 1;
    }

    const entry = dictionary[code] ?? (code === dictionarySize ? previous + previous.charAt(0) : undefined);
    if (entry === undefined) throw new Error("CircuitJS ctz payload is malformed");
    output.push(entry);
    outputLength += entry.length;
    if (outputLength > MAX_DECOMPRESSED_CHARACTERS) throw new Error("CircuitJS ctz payload expands beyond the import limit");
    dictionary[dictionarySize++] = previous + entry.charAt(0);
    enlargeIn -= 1;
    previous = entry;
    if (enlargeIn === 0) {
      enlargeIn = 1 << bitCount;
      bitCount += 1;
    }
  }
}
