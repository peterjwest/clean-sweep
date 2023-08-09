import { createEnum } from './util';
import { Failure } from './failures';
import { ExtendedUtf8Config } from './config';

/** Types of UTF8 byte */
const BYTE_TYPE = createEnum([
  'INVALID',
  'LEADING_FOUR_BYTE',
  'LEADING_THREE_BYTE',
  'LEADING_TWO_BYTE',
  'CONTINUATION',
  'ASCII',
]);

/** Union of different byte types */
type ByteType = (typeof BYTE_TYPE)[keyof typeof BYTE_TYPE];

/** Expected number of bytes for each type */
const BYTE_TYPE_COUNT = {
  INVALID: 1,
  LEADING_FOUR_BYTE: 4,
  LEADING_THREE_BYTE: 3,
  LEADING_TWO_BYTE: 2,
  CONTINUATION: 1,
  ASCII: 1,
} as const satisfies { [Property in keyof typeof BYTE_TYPE]: number };

/** The offset for each leading byte */
const LEADING_BYTE_OFFSETS = {
  1: 0x00,
  2: 0xC0,
  3: 0xE0,
  4: 0xF0,
} as const;

/** Various invalid code point ranges for normal files */
const INVALID_CODE_POINT_RANGES: Array<[number, number]> = [
  // Private-use characters
  [0xE000, 0xF8FF],
  [0xF0000, 0xFFFFD],
  [0x100000, 0x10FFFD],
  // UTF16 Surrogates
  [0xD800, 0xDFFF],
  // "Noncharacters"
  [0xFDD0, 0xFDEF],
];
// "Noncharacters" for each plane
for (let i = 0; i <= 0x10; i++) {
  INVALID_CODE_POINT_RANGES.push([0xFFFE + 0x10000 * i, 0xFFFF + 0x10000 * i]);
}

/** UTF8 value ranges (inclusive) which are not allowed because they duplicate code points */
const OVERLONG_RANGES = [
  [0xC080, 0xC1BF],
  [0xE08080, 0xE0A07F],
  [0xF0808080, 0xF090807F],
] as const;

/** Gets the type of a UTF8 byte */
function getByteType(value: number): ByteType {
  if (value >= 0xF8) return BYTE_TYPE.INVALID;
  if (value >= 0xF0) return BYTE_TYPE.LEADING_FOUR_BYTE;
  if (value >= 0xE0) return BYTE_TYPE.LEADING_THREE_BYTE;
  if (value >= 0xC0) return BYTE_TYPE.LEADING_TWO_BYTE;
  if (value >= 0x80) return BYTE_TYPE.CONTINUATION;
  return BYTE_TYPE.ASCII;
}

type ByteSequence = [number] | [number, number] | [number, number, number] | [number, number, number, number];

/** Gets the UTF8 byte sequence for a character */
function getBytes(data: Buffer, index: number, byteCount: 1 | 2 | 3 | 4): ByteSequence {
  return Array.from(data.subarray(index, index + byteCount)) as ByteSequence;
}

/** Combines a byte sequence into a single value */
function combineBytes(bytes: ByteSequence): number {
  let value = bytes[0];
  for (const byte of bytes.slice(1)) {
    value = (value << 8) + byte;
  }
  return value;
}

/** Gets a unicode code point from a UTF8 byte sequence */
function getCodePoint(bytes: ByteSequence) {
  let value = bytes[0] - LEADING_BYTE_OFFSETS[bytes.length];
  for (const byte of bytes.slice(1)) {
    value = (value << 6) + byte - 0x80;
  }
  return value;
}

/** Serialise a list of bytes in hexadecimal */
function serialiseBytes(values: Buffer | number[]) {
  return Array.from(values).map((value) => `0x${value.toString(16).toUpperCase()}`).join(' ');
}

/** Serialise a code point */
function serialiseCodePoint(value: number) {
  return 'U+' + value.toString(16).toUpperCase();
}

/** Validates a unicode code point, returns an array of failures */
function validateCodePoint(codePoint: number, lineNumber: number): Failure[] {
  const failures: Failure[] = [];

  if (codePoint > 0x10FFFF) {
    failures.push({
      type: 'INVALID_CODE_POINT',
      value: serialiseCodePoint(codePoint),
      line: lineNumber,
    });
  }

  for (const [lower, upper] of INVALID_CODE_POINT_RANGES) {
    if (codePoint >= lower && codePoint <= upper) {
      failures.push({
        type: 'INVALID_CODE_POINT',
        value: serialiseCodePoint(codePoint),
        line: lineNumber,
      });
    }
  }

  return failures;
}

/** Gets the line number for an index in a buffer */
function getLineBufferNumber(buffer: Buffer, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (buffer[i] === 0xA) {
      line++;
    }
    if (buffer[i] === 0xD) {
      // A line feed after a carriage return counts as part of the same newline
      if (buffer[i + 1] === 0xA) {
        i++;
      }
      line++;
    }
  }
  return line;
}

/** Validates a buffer presumed to contain UTF 8 data, returns an array of failures */
export default function validateUtf8(filePath: string, data: Buffer, config: ExtendedUtf8Config): Failure[] {
  let failures: Failure[] = [];

  for (let i = 0; i < data.length; i++) {
    const byte = data[i] as number;
    const type = getByteType(byte);

    if (type === BYTE_TYPE.INVALID) {
      if (config.rules.INVALID_BYTE.enabledFor(filePath)) {
        failures.push({
          type: 'INVALID_BYTE',
          value: serialiseBytes([byte]),
          line: getLineBufferNumber(data, i),
        });
      }
      continue;
    }

    if (type === BYTE_TYPE.CONTINUATION) {
      if (config.rules.UNEXPECTED_CONTINUATION_BYTE.enabledFor(filePath)) {
        failures.push({
          type: 'UNEXPECTED_CONTINUATION_BYTE',
          value: serialiseBytes([byte]),
          line: getLineBufferNumber(data, i),
        });
      }
      continue;
    }

    const byteCount = BYTE_TYPE_COUNT[type];
    const startIndex = i;

    if (byteCount >= 2) {
      const nextByte = data[i + 1];
      if (nextByte && getByteType(nextByte) === BYTE_TYPE.CONTINUATION) {
        i++;
      }
      else {
        if (config.rules.MISSING_CONTINUATION_BYTE.enabledFor(filePath)) {
          failures.push({
            type: 'MISSING_CONTINUATION_BYTE',
            expectedBytes: byteCount,
            value: serialiseBytes(getBytes(data, startIndex, 1)),
            line: getLineBufferNumber(data, startIndex),
          });
        }
        continue;
      }
    }

    if (byteCount >= 3) {
      const nextByte = data[i + 1];
      if (nextByte && getByteType(nextByte) === BYTE_TYPE.CONTINUATION) {
        i++;
      }
      else {
        if (config.rules.MISSING_CONTINUATION_BYTE.enabledFor(filePath)) {
          failures.push({
            type: 'MISSING_CONTINUATION_BYTE',
            expectedBytes: byteCount,
            value: serialiseBytes(getBytes(data, startIndex, 2)),
            line: getLineBufferNumber(data, startIndex),
          });
        }
        continue;
      }
    }

    if (byteCount === 4) {
      const nextByte = data[i + 1];
      if (nextByte && getByteType(nextByte) === BYTE_TYPE.CONTINUATION) {
        i++;
      }
      else {
        if (config.rules.MISSING_CONTINUATION_BYTE.enabledFor(filePath)) {
          failures.push({
            type: 'MISSING_CONTINUATION_BYTE',
            expectedBytes: byteCount,
            value: serialiseBytes(getBytes(data, startIndex, 3)),
            line: getLineBufferNumber(data, startIndex),
          });
        }
        continue;
      }
    }

    const bytes = getBytes(data, startIndex, byteCount);
    const utf8Value = combineBytes(bytes);

    if (config.rules.OVERLONG_BYTE_SEQUENCE.enabledFor(filePath)) {
      for (const [lower, upper] of OVERLONG_RANGES) {
        if (utf8Value >= lower && utf8Value <= upper) {
          failures.push({
            type: 'OVERLONG_BYTE_SEQUENCE',
            value: serialiseBytes(bytes),
            line: getLineBufferNumber(data, startIndex),
          });
        }
      }
    }

    if (config.rules.INVALID_CODE_POINT.enabledFor(filePath)) {
      failures = failures.concat(validateCodePoint(getCodePoint(bytes), getLineBufferNumber(data, startIndex)));
    }
  }

  return failures;
}
