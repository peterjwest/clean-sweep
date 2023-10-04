import { describe, test } from 'vitest';
import assert from 'assert';

import { RULES } from './rules';
import { combineRuleset } from './combineConfig';
import { extendRuleset } from './extendConfig';
import { DEFAULT_CONFIG } from './config';
import { FileResult } from './util';
import validateUtf8, {
  isValidUtf8,
  getByteType,
  getBytes,
  combineBytes,
  getCodePoint,
  serialiseBytes,
  serialiseCodePoint,
  validateCodePoint,
  getLineNumber,
  BYTE_TYPE,
  ByteSequence,
} from './validateUtf8';

const UTF8_CONFIG_DISABLED = extendRuleset(combineRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION, {
  rules: {
    INVALID_BYTE: false,
    UNEXPECTED_CONTINUATION_BYTE: false,
    MISSING_CONTINUATION_BYTE: { exclude: () => ['/docs'] },
    OVERLONG_BYTE_SEQUENCE: { exclude: () => ['*.txt'] },
    INVALID_CODE_POINT: { exclude: () => ['*.txt'] },
  },
}));

const UTF8_CONFIG = extendRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION);

describe('isValidUtf8', () => {
  test('Returns true for an empty file', () => {
    assert.deepStrictEqual(isValidUtf8(Buffer.from('')), true);
  });

  test('Returns true for a for a valid file', () => {
    assert.deepStrictEqual(isValidUtf8(Buffer.from('abc😛あ©\r\n123😅×✓𖼄🍉\n')), true);
  });

  test('Returns false for an invalid byte', () => {
    assert.deepStrictEqual(isValidUtf8(Buffer.from([0x31, 0xF8, 0x0D, 0xFF, 0x7E])), false);
  });

  test('Returns false for an unexpected continuation byte', () => {
    const buffer = Buffer.from([0x31, 0x0D, 0x0A, 0x80, 0x0D, 0xBF, 0x7E]);
    assert.deepStrictEqual(isValidUtf8(buffer), false);
  });

  test('Returns false for an overlong byte sequence', () => {
    const buffer = Buffer.from([0x31, 0x0A, 0xC0, 0xA0, 0x0D, 0xF0, 0x80, 0x80, 0x8A]);
    assert.deepStrictEqual(isValidUtf8(buffer), false);
  });

  test('Returns false for an invalid code point', () => {
    const buffer = Buffer.from([0xED, 0xB0, 0x93, 0x0D, 0x0D, 0xEE, 0x82, 0x80, 0x0A, 0xF1, 0xAF, 0xBF, 0xBE]);
    assert.deepStrictEqual(isValidUtf8(buffer), false);
  });

  test('Returns false for a missing continuation byte', () => {
    const buffer = Buffer.from([0x0A, 0xF0, 0x9F, 0x98, 0xE3, 0x81, 0x0D, 0xC2, 0x0A, 0xF0]);
    assert.deepStrictEqual(isValidUtf8(buffer), false);
  });
});

describe('getByteType', () => {
  test('Returns the type for an ASCII byte', () => {
    assert.strictEqual(getByteType(0x00), BYTE_TYPE.ASCII);
    assert.strictEqual(getByteType(0x7F), BYTE_TYPE.ASCII);
    assert.strictEqual(getByteType('a'.charCodeAt(0)), BYTE_TYPE.ASCII);
  });

  test('Returns the type for a continuation byte', () => {
    assert.strictEqual(getByteType(0x80), BYTE_TYPE.CONTINUATION);
    assert.strictEqual(getByteType(0xBF), BYTE_TYPE.CONTINUATION);

    const bytes = new TextEncoder().encode('©');
    assert.strictEqual(bytes.length, 2);
    assert.strictEqual(getByteType(bytes[1]!), BYTE_TYPE.CONTINUATION);
  });

  test('Returns the type for a leading byte of a 2 byte sequence', () => {
    assert.strictEqual(getByteType(0xC0), BYTE_TYPE.LEADING_TWO_BYTE);
    assert.strictEqual(getByteType(0xDF), BYTE_TYPE.LEADING_TWO_BYTE);

    const bytes = new TextEncoder().encode('©');
    assert.strictEqual(bytes.length, 2);
    assert.strictEqual(getByteType(bytes[0]!), BYTE_TYPE.LEADING_TWO_BYTE);
    assert.strictEqual(getByteType(bytes[1]!), BYTE_TYPE.CONTINUATION);
  });

  test('Returns the type for a leading byte of a 3 byte sequence', () => {
    assert.strictEqual(getByteType(0xE0), BYTE_TYPE.LEADING_THREE_BYTE);
    assert.strictEqual(getByteType(0xEF), BYTE_TYPE.LEADING_THREE_BYTE);

    const bytes = new TextEncoder().encode('あ');
    assert.strictEqual(bytes.length, 3);
    assert.strictEqual(getByteType(bytes[0]!), BYTE_TYPE.LEADING_THREE_BYTE);
    assert.strictEqual(getByteType(bytes[1]!), BYTE_TYPE.CONTINUATION);
    assert.strictEqual(getByteType(bytes[2]!), BYTE_TYPE.CONTINUATION);
  });

  test('Returns the type for a leading byte of a 4 byte sequence', () => {
    assert.strictEqual(getByteType(0xF0), BYTE_TYPE.LEADING_FOUR_BYTE);
    assert.strictEqual(getByteType(0xF7), BYTE_TYPE.LEADING_FOUR_BYTE);

    const bytes = new TextEncoder().encode('🙂');
    assert.strictEqual(bytes.length, 4);
    assert.strictEqual(getByteType(bytes[0]!), BYTE_TYPE.LEADING_FOUR_BYTE);
    assert.strictEqual(getByteType(bytes[1]!), BYTE_TYPE.CONTINUATION);
    assert.strictEqual(getByteType(bytes[2]!), BYTE_TYPE.CONTINUATION);
    assert.strictEqual(getByteType(bytes[3]!), BYTE_TYPE.CONTINUATION);
  });

  test('Returns the type for an invalid UTF8 byte', () => {
    assert.strictEqual(getByteType(0xF8), BYTE_TYPE.INVALID);
    assert.strictEqual(getByteType(0xFF), BYTE_TYPE.INVALID);
  });

  test('Returns the type for an incorrect byte value', () => {
    assert.throws(() => getByteType(-0x01), new Error('Invalid byte value -0x01'));
    assert.throws(() => getByteType(0x100), new Error('Invalid byte value 0x100'));
  });
});

describe('getBytes', () => {
  test('Returns the bytes for ASCII characters in a buffer', () => {
    const buffer = Buffer.from('abc', "utf-8");

    assert.deepStrictEqual(getBytes(buffer, 0, 1), ['a'.charCodeAt(0)]);
    assert.deepStrictEqual(getBytes(buffer, 1, 1), ['b'.charCodeAt(0)]);
    assert.deepStrictEqual(getBytes(buffer, 2, 1), ['c'.charCodeAt(0)]);
  });

  test('Returns the bytes for emoji characters in a buffer', () => {
    const buffer = Buffer.from('🙂😛😭', "utf-8");

    assert.deepStrictEqual(Buffer.from(getBytes(buffer, 0, 4)).toString(), '🙂');
    assert.deepStrictEqual(Buffer.from(getBytes(buffer, 4, 4)).toString(), '😛');
    assert.deepStrictEqual(Buffer.from(getBytes(buffer, 8, 4)).toString(), '😭');
  });

  test('Throws an error if the byte sequence is out of range', () => {
    const buffer = Buffer.from('ab', "utf-8");

    assert.throws(() => getBytes(buffer, -1, 1), new Error('Byte sequence length 1 at index -1 is out of range'));
    assert.throws(() => getBytes(buffer, 0, 3), new Error('Byte sequence length 3 at index 0 is out of range'));
    assert.throws(() => getBytes(buffer, 1, 2), new Error('Byte sequence length 2 at index 1 is out of range'));
  });
});

describe('combineBytes', () => {
  test('Combines bytes from a ByteSequence', () => {
    assert.strictEqual(combineBytes([0x56]), 0x56);
    assert.strictEqual(combineBytes([0xC2, 0xA9]), 0xC2A9);
    assert.strictEqual(combineBytes([0xE3, 0x81, 0x82]), 0xE38182);
    assert.strictEqual(combineBytes([0xF0, 0x9F, 0x98, 0xAD]), 0xF09F98AD);
    assert.strictEqual(combineBytes([0xFF, 0xFF, 0xFF, 0xFF]), 0xFFFFFFFF);
  });
});

describe('getCodePoint', () => {
  test('Gets the Unicode code point from a valid UTF8 ByteSequence', () => {
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode(' ')) as ByteSequence), 0x20);
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode('@')) as ByteSequence), 0x40);
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode('©')) as ByteSequence), 0xA9);
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode('×')) as ByteSequence), 0xD7);
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode('✓')) as ByteSequence), 0x2713);
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode('あ')) as ByteSequence), 0x3042);
    assert.strictEqual(getCodePoint(Array.from(new TextEncoder().encode('😳')) as ByteSequence), 0x1F633);
  });

  test('Gets the Unicode code point from an invalid UTF8 byte sequence', () => {
    // Overlong sequences
    assert.strictEqual(getCodePoint([0xC0, 0xA0]), 0x20);
    assert.strictEqual(getCodePoint([0xF0, 0x8F, 0xBF, 0xBF]), 0xFFFF);
    // Surrogates
    assert.strictEqual(getCodePoint([0xED, 0xB0, 0x93]), 0xDC13);
    assert.strictEqual(getCodePoint([0xED, 0xA0, 0x80]), 0xD800);
    // Private use area
    assert.strictEqual(getCodePoint([0xEE, 0x82, 0x80]), 0xE080);
    // Undefined character
    assert.strictEqual(getCodePoint([0xF1, 0xAF, 0xBF, 0xBE]), 0x6FFFE);
  });
});

describe('serialiseBytes', () => {
  test('Returns serialised bytes from a ByteSequence', () => {
    assert.strictEqual(serialiseBytes([0x56]), '0x56');
    assert.strictEqual(serialiseBytes([0xC2, 0xA9]), '0xC2 0xA9');
    assert.strictEqual(serialiseBytes([0xE3, 0x81, 0x82]), '0xE3 0x81 0x82');
    assert.strictEqual(serialiseBytes([0xF0, 0x9F, 0x98, 0xAD]), '0xF0 0x9F 0x98 0xAD');
    assert.strictEqual(serialiseBytes([0xFF, 0xFF, 0xFF, 0xFF]), '0xFF 0xFF 0xFF 0xFF');
  });
});

describe('serialiseCodePoint', () => {
  test('Returns serialised unicode code point', () => {
    assert.strictEqual(serialiseCodePoint('V'.codePointAt(0)!), 'U+0056');
    assert.strictEqual(serialiseCodePoint('ฉ'.codePointAt(0)!), 'U+0E09');
    assert.strictEqual(serialiseCodePoint('슩'.codePointAt(0)!), 'U+C2A9');
    assert.strictEqual(serialiseCodePoint('𖼄'.codePointAt(0)!), 'U+16F04');
    assert.strictEqual(serialiseCodePoint('😂'.codePointAt(0)!), 'U+1F602');
  });
});

describe('validateCodePoint', () => {
  test('Returns no failures for valid code points', () => {
    assert.deepStrictEqual(validateCodePoint('z'.codePointAt(0)!, 1), []);
    assert.deepStrictEqual(validateCodePoint('~'.codePointAt(0)!, 1), []);
    assert.deepStrictEqual(validateCodePoint('슩'.codePointAt(0)!, 1), []);
    assert.deepStrictEqual(validateCodePoint('😛'.codePointAt(0)!, 1), []);
    assert.deepStrictEqual(validateCodePoint('あ'.codePointAt(0)!, 1), []);
    assert.deepStrictEqual(validateCodePoint('𖼄'.codePointAt(0)!, 1), []);
    assert.deepStrictEqual(validateCodePoint('😂'.codePointAt(0)!, 1), []);
  });

  test('Returns failures for invalid code points', () => {
    // Surrogates
    assert.deepStrictEqual(validateCodePoint(0xDC13, 1), [{
      type: RULES.INVALID_CODE_POINT,
      value: 'U+DC13',
      line: 1,
    }]);
    assert.deepStrictEqual(validateCodePoint(0xD800, 2), [{
      type: RULES.INVALID_CODE_POINT,
      value: 'U+D800',
      line: 2,
    }]);

    // Private use area
    assert.deepStrictEqual(validateCodePoint(0xE080, 3), [{
      type: RULES.INVALID_CODE_POINT,
      value: 'U+E080',
      line: 3,
    }]);

    // Undefined character
    assert.deepStrictEqual(validateCodePoint(0x6FFFE, 4), [{
      type: RULES.INVALID_CODE_POINT,
      value: 'U+6FFFE',
      line: 4,
    }]);

    // Out of range
    assert.deepStrictEqual(validateCodePoint(0x110000, 4), [{
      type: RULES.INVALID_CODE_POINT,
      value: 'U+110000',
      line: 4,
    }]);
  });
});

describe('getLineNumber', () => {
  test('Returns the line number for an index in a Buffer', () => {
    const buffer = Buffer.from('foo\n😛\n\nあ\r\r\n©\n\rbar');

    assert.strictEqual(getLineNumber(buffer, 0), 1);
    assert.strictEqual(getLineNumber(buffer, 3), 1); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(buffer, 4), 2); // Start of 😛
    assert.strictEqual(getLineNumber(buffer, 7), 2); // End of 😛
    assert.strictEqual(getLineNumber(buffer, 10), 4); // Start of あ
    assert.strictEqual(getLineNumber(buffer, 12), 4); // End of あ
    assert.strictEqual(getLineNumber(buffer, 14), 5); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(buffer, 15), 5); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(buffer, 16), 6); // Start of ©
    assert.strictEqual(getLineNumber(buffer, 17), 6); // End of ©
    assert.strictEqual(getLineNumber(buffer, 19), 7); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(buffer, 20), 8);
  });

  test('Throws an error if the index is not in the buffer', () => {
    const buffer = Buffer.from('abc');

    assert.throws(() => getLineNumber(buffer, -1), new Error('Index -1 out of range'));
    assert.throws(() => getLineNumber(buffer, 3), new Error('Index 3 out of range'));
  });
});

describe('validateUtf8', () => {
  test('Returns no failures for an empty file', async () => {
    const buffer = Buffer.from('');

    const results = new FileResult();
    results.checks = 5;

    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });

  test('Returns no failures for a valid file', async () => {
    const buffer = Buffer.from('abc😛あ©\r\n123😅×✓𖼄🍉\n');

    const results = new FileResult();
    results.checks = 5;

    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });

  test('Returns no failures for a valid file with all rules disabled', async () => {
    const buffer = Buffer.from('abc😛あ©\r\n123😅×✓𖼄🍉\n');

    const results = new FileResult();
    results.checks = 0;

    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG_DISABLED), results);
  });

  test('Returns no failures for a valid file with some rules disabled', async () => {
    const buffer = Buffer.from('abc😛あ©\r\n123😅×✓𖼄🍉\n');

    const results = new FileResult();
    results.checks = 3;

    assert.deepStrictEqual(await validateUtf8('foo.ts', buffer, UTF8_CONFIG_DISABLED), results);
  });

  test('Returns a failure for an invalid byte', async () => {
    const buffer = Buffer.from([0x31, 0xF8, 0x0D, 0xFF, 0x7E]);

    const results = new FileResult();
    results.checks = 5;
    results.addFailures([
      {
        type: RULES.INVALID_BYTE,
        value: '0xF8',
        line: 1,
      },
      {
        type: RULES.INVALID_BYTE,
        value: '0xFF',
        line: 2,
      },
    ]);
    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });

  test('Returns a failure for an unexpected continuation byte', async () => {
    const buffer = Buffer.from([0x31, 0x0D, 0x0A, 0x80, 0x0D, 0xBF, 0x7E]);

    const results = new FileResult();
    results.checks = 5;
    results.addFailures([
      {
        type: RULES.UNEXPECTED_CONTINUATION_BYTE,
        value: '0x80',
        line: 2,
      },
      {
        type: RULES.UNEXPECTED_CONTINUATION_BYTE,
        value: '0xBF',
        line: 3,
      },
    ]);
    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });

  test('Returns a failure for an overlong byte sequence', async () => {
    const buffer = Buffer.from([0x31, 0x0A, 0xC0, 0xA0, 0x0D, 0xF0, 0x80, 0x80, 0x8A]);

    const results = new FileResult();
    results.checks = 5;
    results.addFailures([
      {
        type: RULES.OVERLONG_BYTE_SEQUENCE,
        value: '0xC0 0xA0',
        line: 2,
      },
      {
        type: RULES.OVERLONG_BYTE_SEQUENCE,
        value: '0xF0 0x80 0x80 0x8A',
        line: 3,
      },
    ]);
    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });

  test('Returns a failure for an invalid code point', async () => {
    const buffer = Buffer.from([0xED, 0xB0, 0x93, 0x0D, 0x0D, 0xEE, 0x82, 0x80, 0x0A, 0xF1, 0xAF, 0xBF, 0xBE]);

    const results = new FileResult();
    results.checks = 5;
    results.addFailures([
      {
        type: RULES.INVALID_CODE_POINT,
        value: 'U+DC13',
        line: 1,
      },
      {
        type: RULES.INVALID_CODE_POINT,
        value: 'U+E080',
        line: 3,
      },
      {
        type: RULES.INVALID_CODE_POINT,
        value: 'U+6FFFE',
        line: 4,
      },
    ]);
    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });

  test('Returns a failure for a missing continuation byte', async () => {
    const buffer = Buffer.from([0x0A, 0xF0, 0x9F, 0x98, 0xE3, 0x81, 0x0D, 0xC2, 0x0A, 0xF0]);

    const results = new FileResult();
    results.checks = 5;
    results.addFailures([
      {
        type: RULES.MISSING_CONTINUATION_BYTE,
        value: '0xF0 0x9F 0x98',
        expectedBytes: 4,
        line: 2,
      },
      {
        type: RULES.MISSING_CONTINUATION_BYTE,
        value: '0xE3 0x81',
        expectedBytes: 3,
        line: 2,
      },
      {
        type: RULES.MISSING_CONTINUATION_BYTE,
        value: '0xC2',
        expectedBytes: 2,
        line: 3,
      },
      {
        type: RULES.MISSING_CONTINUATION_BYTE,
        value: '0xF0',
        expectedBytes: 4,
        line: 4,
      },
    ]);
    assert.deepStrictEqual(await validateUtf8('docs/foo.txt', buffer, UTF8_CONFIG), results);
  });
});
