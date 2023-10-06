import lodash from 'lodash';

import { RULES } from './rules';
import { createEnumNumeric, delay, FileResult } from './util';
import { Failure } from './failures';
import { ExtendedUtf8Config } from './config';

/** Types of UTF8 byte */
export const BYTE_TYPE = createEnumNumeric([
  'INVALID',
  'LEADING_FOUR_BYTE',
  'LEADING_THREE_BYTE',
  'LEADING_TWO_BYTE',
  'CONTINUATION',
  'ASCII',
]);

/** Union of different byte types */
type ByteType = (typeof BYTE_TYPE)[keyof typeof BYTE_TYPE];

/** Valid sequences of UTF8 bytes */
export type ByteSequence = [number] | [number, number] | [number, number, number] | [number, number, number, number];

/** Expected number of bytes for each type */
const BYTE_TYPE_COUNT = {
  [BYTE_TYPE.INVALID]: 1,
  [BYTE_TYPE.LEADING_FOUR_BYTE]: 4,
  [BYTE_TYPE.LEADING_THREE_BYTE]: 3,
  [BYTE_TYPE.LEADING_TWO_BYTE]: 2,
  [BYTE_TYPE.CONTINUATION]: 1,
  [BYTE_TYPE.ASCII]: 1,
} as const satisfies { [Property in ByteType]: number };

/** The offset for each leading byte */
const LEADING_BYTE_OFFSETS = {
  1: 0x00,
  2: 0xC0,
  3: 0xE0,
  4: 0xF0,
} as const;

const CONTINUATION_BYTE_OFFSET = 0x80;

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

/**
 * Checks if UTF8 content is valid by converting it to a string and back to a buffer
 * Any parsing errors will lead to differences in the data
 */
export function isValidUtf8(buffer: Buffer) {
  return Buffer.from(buffer.toString('utf-8')).equals(buffer);
}

/** Gets the type of a UTF8 byte */
export function getByteType(value: number): ByteType {
  if (value < 0 || value > 0xFF) throw new Error(`Invalid byte value ${serialiseBytes([value])}`);
  if (value >= 0xF8) return BYTE_TYPE.INVALID;
  if (value >= 0xF0) return BYTE_TYPE.LEADING_FOUR_BYTE;
  if (value >= 0xE0) return BYTE_TYPE.LEADING_THREE_BYTE;
  if (value >= 0xC0) return BYTE_TYPE.LEADING_TWO_BYTE;
  if (value >= 0x80) return BYTE_TYPE.CONTINUATION;
  return BYTE_TYPE.ASCII;
}

/** Gets the UTF8 byte sequence for a character from a Buffer */
export function getBytes(data: Buffer, index: number, byteCount: 1 | 2 | 3 | 4): ByteSequence {
  if (index < 0 || index + byteCount > data.length) {
    throw new Error(`Byte sequence length ${byteCount} at index ${index} is out of range`);
  }
  return Array.from(data.subarray(index, index + byteCount)) as ByteSequence;
}

/** Combines a byte sequence into a single value */
export function combineBytes(bytes: ByteSequence): number {
  let value = bytes[0];
  for (const byte of bytes.slice(1)) {
    value = (value * 256) + byte;
  }
  return value;
}

/** Gets a unicode code point from a UTF8 byte sequence */
export function getCodePoint(bytes: ByteSequence) {
  let value = bytes[0] - LEADING_BYTE_OFFSETS[bytes.length];
  for (const byte of bytes.slice(1)) {
    value = (value * 64) + byte - CONTINUATION_BYTE_OFFSET;
  }
  return value;
}

/** Serialise a list of bytes in hexadecimal */
export function serialiseBytes(values: Buffer | number[]) {
  return Array.from(values).map((value) =>{
    return `${value < 0 ? '-' : ''}0x${Math.abs(value).toString(16).toUpperCase().padStart(2, '0')}`;
  }).join(' ');
}

/** Serialise a code point */
export function serialiseCodePoint(value: number) {
  return 'U+' + value.toString(16).toUpperCase().padStart(4, '0');
}

/** Validates a unicode code point, returns an array of failures */
export function validateCodePoint(codePoint: number, lineNumber: number): Failure[] {
  const failures: Failure[] = [];

  if (codePoint > 0x10FFFF) {
    failures.push({
      type: RULES.INVALID_CODE_POINT,
      value: serialiseCodePoint(codePoint),
      line: lineNumber,
    });
  }

  for (const [lower, upper] of INVALID_CODE_POINT_RANGES) {
    if (codePoint >= lower && codePoint <= upper) {
      failures.push({
        type: RULES.INVALID_CODE_POINT,
        value: serialiseCodePoint(codePoint),
        line: lineNumber,
      });
    }
  }

  return failures;
}

/** Gets the line number for an index in a buffer */
export function getLineNumber(buffer: Buffer, index: number): number {
  if (index < 0 || index >= buffer.length) throw new Error(`Index ${index} out of range`);
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (buffer[i] === 0xA) {
      line++;
    }
    if (buffer[i] === 0xD) {
      // A line feed following a carriage return counts as part of the same newline, so ignore the carriage return
      if (buffer[i + 1] === 0xA) continue;
      line++;
    }
  }
  return line;
}

/** Validates a buffer presumed to contain UTF 8 data, returns an array of failures */
export default async function validateUtf8(filePath: string, data: Buffer, config: ExtendedUtf8Config): Promise<FileResult> {
  const result = new FileResult();
  const isEnabled = lodash.mapValues(config.rules, (rule) => rule.enabledFor(filePath));
  result.checks = lodash.sumBy(Object.values(isEnabled), (value) => value ? 1 : 0);

  if (isValidUtf8(data)) return result;

  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] as number;
    const type = getByteType(byte);

    // Allows this process to be interrupted
    if (count++ % 10000 === 0) {
      await delay(0);
    }

    if (type === BYTE_TYPE.ASCII) {
      continue;
    }

    if (type === BYTE_TYPE.INVALID) {
      if (isEnabled.INVALID_BYTE) {
        result.failures.push({
          type: RULES.INVALID_BYTE,
          value: serialiseBytes([byte]),
          line: getLineNumber(data, i),
        });
      }
      continue;
    }

    if (type === BYTE_TYPE.CONTINUATION) {
      if (isEnabled.UNEXPECTED_CONTINUATION_BYTE) {
        result.failures.push({
          type: RULES.UNEXPECTED_CONTINUATION_BYTE,
          value: serialiseBytes([byte]),
          line: getLineNumber(data, i),
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
        if (isEnabled.MISSING_CONTINUATION_BYTE) {
          result.failures.push({
            type: RULES.MISSING_CONTINUATION_BYTE,
            expectedBytes: byteCount,
            value: serialiseBytes(getBytes(data, startIndex, 1)),
            line: getLineNumber(data, startIndex),
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
        if (isEnabled.MISSING_CONTINUATION_BYTE) {
          result.failures.push({
            type: RULES.MISSING_CONTINUATION_BYTE,
            expectedBytes: byteCount,
            value: serialiseBytes(getBytes(data, startIndex, 2)),
            line: getLineNumber(data, startIndex),
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
        if (isEnabled.MISSING_CONTINUATION_BYTE) {
          result.failures.push({
            type: RULES.MISSING_CONTINUATION_BYTE,
            expectedBytes: byteCount,
            value: serialiseBytes(getBytes(data, startIndex, 3)),
            line: getLineNumber(data, startIndex),
          });
        }
        continue;
      }
    }

    if (isEnabled.OVERLONG_BYTE_SEQUENCE) {
      const bytes = getBytes(data, startIndex, byteCount);
      const utf8Value = combineBytes(bytes);

      for (const [lower, upper] of OVERLONG_RANGES) {
        if (utf8Value >= lower && utf8Value <= upper) {
          result.failures.push({
            type: RULES.OVERLONG_BYTE_SEQUENCE,
            value: serialiseBytes(bytes),
            line: getLineNumber(data, startIndex),
          });
        }
      }
    }

    if (isEnabled.INVALID_CODE_POINT) {
      const bytes = getBytes(data, startIndex, byteCount);
      result.addFailures(validateCodePoint(getCodePoint(bytes), getLineNumber(data, startIndex)));
    }
  }

  return result;
}
