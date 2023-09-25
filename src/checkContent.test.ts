import { describe, test } from 'vitest';
import assert from 'assert';

import { RULES } from './rules';
import { combineRuleset } from './combineConfig';
import { extendRuleset } from './extendConfig';
import { DEFAULT_CONFIG } from './config';
import { FileResult } from './util';
import checkContent from './checkContent';

const CONTENT_CONFIG_DISABLED = extendRuleset(combineRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION, {
  rules: {
    MALFORMED_ENCODING: false,
    UNEXPECTED_ENCODING: false,
    CARRIAGE_RETURN:false,
    TAB: false,
    TRAILING_WHITESPACE: false,
    MULTIPLE_FINAL_NEWLINES: false,
    NO_FINAL_NEWLINE: false,
    UNEXPECTED_CHARACTER: false,
  },
}));

const CONTENT_CONFIG_PARTIAL = extendRuleset(combineRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION, {
  rules: {
    MALFORMED_ENCODING: true,
    UNEXPECTED_ENCODING: true,
    CARRIAGE_RETURN:false,
    TAB: false,
    TRAILING_WHITESPACE: false,
    MULTIPLE_FINAL_NEWLINES: { exclude: () => ['/docs'] },
    NO_FINAL_NEWLINE: { exclude: () => ['*.txt'] },
    UNEXPECTED_CHARACTER: { exclude: () => ['*.txt'] },
  },
}));

const CONTENT_CONFIG_UNEXPECTED_DISABLED = extendRuleset(combineRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION, {
  rules: {
    UNEXPECTED_ENCODING: false,
  },
}));

const CONTENT_CONFIG_ALLOWED_CHARS = extendRuleset(combineRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION, {
  rules: {
    UNEXPECTED_CHARACTER: { allowed: ['×', '✓'] },
  },
}));

const CONTENT_CONFIG = extendRuleset(DEFAULT_CONFIG.rules.CONTENT_VALIDATION);

describe('checkContent', () => {
  test('Returns no failures for an empty file', () => {
    const buffer = Buffer.from('\n');

    const results = new FileResult();
    results.checks = 8;

    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns no failures for a valid file', () => {
    const buffer = Buffer.from('abc😛あ©\n123😅𖼄🍉\n');

    const results = new FileResult();
    results.checks = 8;

    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns no failures for a valid file with all rules disabled', () => {
    const buffer = Buffer.from('abc😛あ©\n123😅𖼄🍉\n');

    const results = new FileResult();
    results.checks = 0;

    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG_DISABLED), results);
  });

  test('Returns no failures for a valid file with some rules disabled', () => {
    const buffer = Buffer.from('abc😛あ©\n123😅𖼄🍉\n');

    const results = new FileResult();
    results.checks = 5;

    assert.deepStrictEqual(checkContent('foo.ts', buffer, CONTENT_CONFIG_PARTIAL), results);
  });

  test('Returns no failures for a valid file with unexpected encoding disabled', () => {
    const buffer = Buffer.from('abc😛あ©\n123😅𖼄🍉\n');

    const results = new FileResult();
    results.checks = 1;

    assert.deepStrictEqual(checkContent('foo.ts', buffer, CONTENT_CONFIG_UNEXPECTED_DISABLED), results);
  });

  test('Returns a failure for a malformed encoding', () => {
    const buffer = Buffer.from([0x31, 0x80, 0x0D, 0x30, 0xF0, 0x9F, 0x99, 0x82, 0x0D]);

    const results = new FileResult();
    results.checks = 1;
    results.addFailures([
      {
        type: RULES.MALFORMED_ENCODING,
        confidence: 0,
        guessedEncoding: undefined,
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for an unexpected encoding', () => {
    const buffer = Buffer.from([0x31, 0x80, 0x0D, 0x30, 0xF0, 0xFF]);

    const results = new FileResult();
    results.checks = 2;
    results.addFailures([
      {
        type: RULES.UNEXPECTED_ENCODING,
        encoding: 'windows-1252',
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for a carriage return', () => {
    const buffer = Buffer.from('abc\r😛あ©\r\n123😅\r𖼄🍉\n');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.CARRIAGE_RETURN,
        line: 1,
      },
      {
        type: RULES.CARRIAGE_RETURN,
        line: 2,
      },
      {
        type: RULES.CARRIAGE_RETURN,
        line: 3,
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for a carriage return', () => {
    const buffer = Buffer.from('abc\t\t😛\n\tあ©\n123😅\t\t\t𖼄🍉\n');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.TAB,
        lines: [1, 2, 3],
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for trailing whitespace', () => {
    const buffer = Buffer.from('abc😛  \nあ©   \n123😅𖼄🍉\n');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.TRAILING_WHITESPACE,
        lines: [1, 2],
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for multiple final newlines', () => {
    const buffer = Buffer.from('abc😛\nあ©\n123😅𖼄🍉\n\n\n');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.MULTIPLE_FINAL_NEWLINES,
        line: 3,
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for no final newline', () => {
    const buffer = Buffer.from('abc😛\nあ©\n123😅𖼄🍉');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.NO_FINAL_NEWLINE,
        line: 3,
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for unexpected characters', () => {
    const buffer = Buffer.from('abc😛あ©\n123😅×✓𖼄🍉\n');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.UNEXPECTED_CHARACTER,
        lines: [2],
        value: '×',
      },
      {
        type: RULES.UNEXPECTED_CHARACTER,
        lines: [2],
        value: '✓',
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG), results);
  });

  test('Returns a failure for unexpected characters but some are allowed', () => {
    const buffer = Buffer.from('abc😛▱あ©\n123😅×✓𖼄🍉\n');

    const results = new FileResult();
    results.checks = 8;
    results.addFailures([
      {
        type: RULES.UNEXPECTED_CHARACTER,
        lines: [1],
        value: '▱',
      },
    ]);
    assert.deepStrictEqual(checkContent('docs/foo.txt', buffer, CONTENT_CONFIG_ALLOWED_CHARS), results);
  });
});
