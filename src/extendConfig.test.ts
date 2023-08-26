import { describe, test } from 'vitest';
import assert from 'assert';

import { ContentRuleset, ExtendRuleset, DEFAULT_CONFIG } from './config';
import GitignoreMatcher from './GitignoreMatcher';
import extendConfig, { extendRuleset, extendRule } from './extendConfig';

const ruleset: ContentRuleset = {
  enabled: true,
  exclude: ['foo'],
  rules: {
    MALFORMED_ENCODING: { enabled: true, exclude: ['zig'] },
    UNEXPECTED_ENCODING: { enabled: true, exclude: [] },
    CARRIAGE_RETURN: { enabled: true, exclude: [] },
    TAB: { enabled: true, exclude: ['bar'] },
    TRAILING_WHITESPACE: { enabled: true, exclude: [] },
    MULTIPLE_FINAL_NEWLINES: { enabled: true, exclude: [] },
    NO_FINAL_NEWLINE: { enabled: true, exclude: [] },
    UNEXPECTED_CHARACTER: { enabled: true, exclude: [], allowed: [] },
    UTF8_VALIDATION: {
      enabled: true,
      exclude: ['zim'],
      rules: {
        INVALID_BYTE: { enabled: true, exclude: ['yip'] },
        UNEXPECTED_CONTINUATION_BYTE: { enabled: true, exclude: [] },
        MISSING_CONTINUATION_BYTE: { enabled: true, exclude: [] },
        OVERLONG_BYTE_SEQUENCE: { enabled: true, exclude: [] },
        INVALID_CODE_POINT: { enabled: false, exclude: [] },
      },
    },
  },
};

describe('extendRuleset', () => {
  test('Returns an extended Ruleset with helper methods', () => {
    const matcher = new GitignoreMatcher(['gir']);

    const actual = extendRuleset(ruleset, matcher);

    const expected: ExtendRuleset<ContentRuleset> = {
      enabled: true,
      exclude: ['foo'],
      enabledFor: actual.enabledFor,
      filterFiles: actual.filterFiles,
      rules: {
        MALFORMED_ENCODING: {
          enabled: true,
          exclude: ['zig'],
          enabledFor: actual.rules.MALFORMED_ENCODING.enabledFor,
          filterFiles: actual.rules.MALFORMED_ENCODING.filterFiles,
          rules: undefined,
        },
        UNEXPECTED_ENCODING: {
          enabled: true,
          exclude: [],
          enabledFor: actual.rules.UNEXPECTED_ENCODING.enabledFor,
          filterFiles: actual.rules.UNEXPECTED_ENCODING.filterFiles,
          rules: undefined,
        },
        CARRIAGE_RETURN: {
          enabled: true,
          exclude: [],
          enabledFor: actual.rules.CARRIAGE_RETURN.enabledFor,
          filterFiles: actual.rules.CARRIAGE_RETURN.filterFiles,
          rules: undefined,
        },
        TAB: {
          enabled: true,
          exclude: ['bar'],
          enabledFor: actual.rules.TAB.enabledFor,
          filterFiles: actual.rules.TAB.filterFiles,
          rules: undefined,
        },
        TRAILING_WHITESPACE: {
          enabled: true,
          exclude: [],
          enabledFor: actual.rules.TRAILING_WHITESPACE.enabledFor,
          filterFiles: actual.rules.TRAILING_WHITESPACE.filterFiles,
          rules: undefined,
        },
        MULTIPLE_FINAL_NEWLINES: {
          enabled: true,
          exclude: [],
          enabledFor: actual.rules.MULTIPLE_FINAL_NEWLINES.enabledFor,
          filterFiles: actual.rules.MULTIPLE_FINAL_NEWLINES.filterFiles,
          rules: undefined,
        },
        NO_FINAL_NEWLINE: {
          enabled: true,
          exclude: [],
          enabledFor: actual.rules.NO_FINAL_NEWLINE.enabledFor,
          filterFiles: actual.rules.NO_FINAL_NEWLINE.filterFiles,
          rules: undefined,
        },
        UNEXPECTED_CHARACTER: {
          enabled: true,
          exclude: [],
          allowed: [],
          enabledFor: actual.rules.UNEXPECTED_CHARACTER.enabledFor,
          filterFiles: actual.rules.UNEXPECTED_CHARACTER.filterFiles,
          rules: undefined,
        },
        UTF8_VALIDATION: {
          enabled: true,
          exclude: ['zim'],
          enabledFor: actual.rules.UTF8_VALIDATION.enabledFor,
          filterFiles: actual.rules.UTF8_VALIDATION.filterFiles,
          rules: {
            INVALID_BYTE: {
              enabled: true,
              exclude: ['yip'],
              enabledFor: actual.rules.UTF8_VALIDATION.rules.INVALID_BYTE.enabledFor,
              filterFiles: actual.rules.UTF8_VALIDATION.rules.INVALID_BYTE.filterFiles,
              rules: undefined,
            },
            UNEXPECTED_CONTINUATION_BYTE: {
              enabled: true,
              exclude: [],
              enabledFor: actual.rules.UTF8_VALIDATION.rules.UNEXPECTED_CONTINUATION_BYTE.enabledFor,
              filterFiles: actual.rules.UTF8_VALIDATION.rules.UNEXPECTED_CONTINUATION_BYTE.filterFiles,
              rules: undefined,
            },
            MISSING_CONTINUATION_BYTE: {
              enabled: true,
              exclude: [],
              enabledFor: actual.rules.UTF8_VALIDATION.rules.MISSING_CONTINUATION_BYTE.enabledFor,
              filterFiles: actual.rules.UTF8_VALIDATION.rules.MISSING_CONTINUATION_BYTE.filterFiles,
              rules: undefined,
            },
            OVERLONG_BYTE_SEQUENCE: {
              enabled: true,
              exclude: [],
              enabledFor: actual.rules.UTF8_VALIDATION.rules.OVERLONG_BYTE_SEQUENCE.enabledFor,
              filterFiles: actual.rules.UTF8_VALIDATION.rules.OVERLONG_BYTE_SEQUENCE.filterFiles,
              rules: undefined,
            },
            INVALID_CODE_POINT: {
              enabled: false,
              exclude: [],
              enabledFor: actual.rules.UTF8_VALIDATION.rules.INVALID_CODE_POINT.enabledFor,
              filterFiles: actual.rules.UTF8_VALIDATION.rules.INVALID_CODE_POINT.filterFiles,
              rules: undefined,
            },
          },
        },
      },
    };

    assert.deepStrictEqual(actual, expected);

    assert.deepStrictEqual(actual.filterFiles(['foo', 'src/bar', 'build/gir', 'zim']), ['src/bar', 'zim']);
    assert.strictEqual(actual.enabledFor('build/gir'), false);

    assert.deepStrictEqual(actual.rules.TAB.filterFiles(['foo', 'src/bar', 'build/gir', 'zim']), ['zim']);
    assert.strictEqual(actual.rules.TAB.enabledFor('build/gir'), false);

    const invalidByteConfig = actual.rules.UTF8_VALIDATION.rules.INVALID_BYTE;
    assert.deepStrictEqual(invalidByteConfig.filterFiles(['foo', 'src/bar', 'build/gir', 'zim', 'public/yip']), ['src/bar']);
    assert.strictEqual(invalidByteConfig.enabledFor('build/gir'), false);

    const invalidCodePoint = actual.rules.UTF8_VALIDATION.rules.INVALID_CODE_POINT;
    assert.deepStrictEqual(invalidCodePoint.filterFiles(['foo', 'src/bar', 'build/gir', 'zim', 'public/yip']), []);
    assert.strictEqual(invalidCodePoint.enabledFor('build/gir'), false);
  });

  test('Returns a disabled extended Ruleset with helper methods', () => {
    const matcher = new GitignoreMatcher(['gir']);

    const actual = extendRuleset({ ...ruleset, enabled: false }, matcher);

    assert.deepStrictEqual(actual.filterFiles(['foo', 'src/bar', 'build/gir', 'zim']), []);
    assert.strictEqual(actual.enabledFor('banana'), false);
  });
});

describe('extendRule', () => {
  test('Returns an extended Rule with helper methods', () => {
    const matcher = new GitignoreMatcher(['gir']);

    const actual = extendRule(ruleset.rules.MALFORMED_ENCODING, matcher);

    const expected = {
      enabled: true,
      exclude: ['zig'],
      enabledFor: actual.enabledFor,
      filterFiles: actual.filterFiles,
      rules: undefined,
    };

    assert.deepStrictEqual(actual, expected);

    assert.deepStrictEqual(actual.filterFiles(['foo', 'src/bar', 'build/gir', 'zig']), ['foo', 'src/bar']);
    assert.strictEqual(actual.enabledFor('build/zig'), false);
  });

  test('Returns a disabled extended Rule with helper methods', () => {
    const matcher = new GitignoreMatcher(['gir']);

    const actual = extendRule({ ...ruleset.rules.MALFORMED_ENCODING, enabled: false }, matcher);

    const expected = {
      enabled: false,
      exclude: ['zig'],
      enabledFor: actual.enabledFor,
      filterFiles: actual.filterFiles,
      rules: undefined,
    };

    assert.deepStrictEqual(actual, expected);

    assert.deepStrictEqual(actual.filterFiles(['foo', 'src/bar', 'build/gir', 'zig']), []);
    assert.strictEqual(actual.enabledFor('foo'), false);
  });
});

describe('extendConfig', () => {
  test('Returns an extended Rule with helper methods', () => {
    const actual = extendConfig(DEFAULT_CONFIG);

    assert.deepStrictEqual(
      actual.filterFiles(['foo.zip', 'package-lock.json', 'moo.bmp']),
      ['foo.zip', 'package-lock.json', 'moo.bmp'],
    );
    assert.deepStrictEqual(
      actual.rules.CONTENT_VALIDATION.filterFiles(['foo.zip', 'package-lock.json', 'moo.bmp']),
      [],
    );
  });
});
