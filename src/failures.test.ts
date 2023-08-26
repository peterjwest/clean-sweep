import { describe, test } from 'vitest';
import assert from 'assert';

import { describeLines, getCodePoint, FAILURE_MESSAGES } from './failures';

describe('describeLines', () => {
  test('Returns a description of a single line', () => {
    assert.strictEqual(describeLines([42]), 'line 42');
  });

  test('Returns a description of 3 lines', () => {
    assert.strictEqual(describeLines([9, 12, 36]), 'lines 9, 12, 36');
  });

  test('Returns a description of 6 lines', () => {
    assert.strictEqual(describeLines([3, 6, 9, 12, 36, 42]), 'lines 3, 6, 9, 12, 36, 42');
  });

  test('Returns a description of 9 lines', () => {
    assert.strictEqual(describeLines([1, 2, 3, 6, 9, 12, 36, 42, 64]), '9 different lines');
  });

  test('Throws an error when passed no lines', () => {
    assert.throws(() => describeLines([]), new Error('No line numbers passed, expected one or more'));
  });
});

describe('getCodePoint', () => {
  test('Returns the code point for a character', () => {
    assert.strictEqual(getCodePoint('x'), 'U+0078');
    assert.strictEqual(getCodePoint('✓'), 'U+2713');
  });

  test('Throws an error for a string longer than one character', () => {
    assert.throws(() => getCodePoint('xyz'), new Error('Expected a single unicode character, got "xyz"'));
  });

  test('Throws an error for surrogate pair characters', () => {
    assert.throws(() => getCodePoint('😅'), new Error('Expected a single unicode character, got "😅"'));
  });
});

describe('FAILURE_MESSAGES', () => {
  test('Return expected messages', () => {
    assert.strictEqual(FAILURE_MESSAGES.DS_STORE(), 'Committed .DS_Store files');
    assert.strictEqual(FAILURE_MESSAGES.UPPERCASE_EXTENSION(), 'Uppercase file extension');
    assert.strictEqual(
      FAILURE_MESSAGES.IGNORED_COMMITTED_FILE(),
      'Committed file which should be gitignored',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.INVALID_BYTE({ value: '0xFF', line: 23 }),
      'Invalid character byte value "0xFF" on line 23',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.UNEXPECTED_CONTINUATION_BYTE({
        value: '?',
        line: 42,
      }),
      'Invalid character: unexpected continuation byte "?" on line 42',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.MISSING_CONTINUATION_BYTE({ value: '?', line: 72, expectedBytes: 3 }),
      'Invalid character: missing continuation byte "?" on line 72',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.OVERLONG_BYTE_SEQUENCE({ value: '?', line: 13 }),
      'Invalid character: overlong encoding "?" on line 13',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.INVALID_CODE_POINT({ value: '?', line: 36 }),
      'Invalid character unicode code point "?" on line 36',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.MALFORMED_ENCODING({ guessedEncoding: 'ascii', confidence: 0.53 }),
      'Malformed encoding, guessed to be ascii',
    );
    assert.strictEqual(
      FAILURE_MESSAGES.UNEXPECTED_ENCODING({ encoding: 'UTF16' }),
      'Unexpected encoding UTF16',
    );
    assert.strictEqual(FAILURE_MESSAGES.CARRIAGE_RETURN({ line: 7 }), 'Uses carriage returns on line 7');
    assert.strictEqual(FAILURE_MESSAGES.TAB({ lines: [1, 2, 3] }), 'Uses tabs on lines 1, 2, 3');
    assert.strictEqual(
      FAILURE_MESSAGES.TRAILING_WHITESPACE({ lines: [1, 2, 4, 8, 16, 32, 64] }),
      'Has trailing whitespace on 7 different lines',
    );
    assert.strictEqual(FAILURE_MESSAGES.MULTIPLE_FINAL_NEWLINES(), 'Has multiple final newlines');
    assert.strictEqual(FAILURE_MESSAGES.NO_FINAL_NEWLINE(), 'Does not have a final newline');
    assert.strictEqual(FAILURE_MESSAGES.UNEXPECTED_CHARACTER({ value: '✓', lines: [12] }),
      'Has a non-ASCII, non-unicode letter, non-emoji character "✓" U+2713 on line 12',
    );
  });
});
