import { createEnum } from './util';
import { Failure } from './failures';

const BYTE_TYPE = createEnum([
  'INVALID',
  'LEADING_FOUR_BYTE',
  'LEADING_THREE_BYTE',
  'LEADING_TWO_BYTE',
  'CONTINUATION',
  'ASCII',
]);

type ByteType = (typeof BYTE_TYPE)[keyof typeof BYTE_TYPE];

const BYTE_TYPE_COUNT = {
  INVALID: 1,
  LEADING_FOUR_BYTE: 4,
  LEADING_THREE_BYTE: 3,
  LEADING_TWO_BYTE: 2,
  CONTINUATION: 1,
  ASCII: 1,
} as const satisfies { [Property in keyof typeof BYTE_TYPE]: number };

function getByteType(value: number): ByteType {
  if (value >= 0xF5) return BYTE_TYPE.INVALID;
  if (value >= 0xF0) return BYTE_TYPE.LEADING_FOUR_BYTE;
  if (value >= 0xE0) return BYTE_TYPE.LEADING_THREE_BYTE;
  if (value >= 0xC2) return BYTE_TYPE.LEADING_TWO_BYTE;
  if (value >= 0xC0) return BYTE_TYPE.INVALID;
  if (value >= 0x80) return BYTE_TYPE.CONTINUATION;
  return BYTE_TYPE.ASCII;
}

function outputBytes(values: Buffer | number[]): string {
  return Array.from(values).map((value) => `0x${value.toString(16)}`).join(' ');
}

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

/** Validates a buffer presumed to contin UTF 8 data, returns an array of failures */
export default function validateUtf8(data: Buffer): Failure[] {
  const errors: Failure[] = [];

  for (let i = 0; i < data.length; i++) {
    const type = getByteType(data[i]);

    if (type === BYTE_TYPE.INVALID) {
      errors.push({
        type: 'INVALID_BYTE',
        value: outputBytes([data[i]]),
        line: getLineBufferNumber(data, i),
      });
    }

    if (type === BYTE_TYPE.CONTINUATION) {
      errors.push({
        type: 'UNEXPECTED_CONTINUATION_BYTE',
        value: outputBytes([data[i]]),
        line: getLineBufferNumber(data, i),
      });
    }

    const byteCount = BYTE_TYPE_COUNT[type];
    const startIndex = i;

    if (byteCount >= 2) {
      if (data[i + 1] && getByteType(data[i + 1]) === BYTE_TYPE.CONTINUATION) {
        i++;
      }
      else {
        errors.push({
          type: 'MISSING_CONTINUATION_BYTE',
          expectedBytes: byteCount,
          value: outputBytes(data.subarray(startIndex, startIndex + 1)),
          line: getLineBufferNumber(data, startIndex),
        });
        continue;
      }
    }

    if (byteCount >= 3) {
      if (data[i + 1] && getByteType(data[i + 1]) === BYTE_TYPE.CONTINUATION) {
        i++;
      }
      else {
        errors.push({
          type: 'MISSING_CONTINUATION_BYTE',
          expectedBytes: byteCount,
          value: outputBytes(data.subarray(startIndex, startIndex + 2)),
          line: getLineBufferNumber(data, startIndex),
        });
        continue;
      }
    }

    if (byteCount === 4) {
      if (data[i + 1] && getByteType(data[i + 1]) === BYTE_TYPE.CONTINUATION) {
        i++;
      }
      else {
        errors.push({
          type: 'MISSING_CONTINUATION_BYTE',
          expectedBytes: byteCount,
          value: outputBytes(data.subarray(startIndex, startIndex + 3)),
          line: getLineBufferNumber(data, startIndex),
        });
        continue;
      }
    }
  }

  return errors;
}