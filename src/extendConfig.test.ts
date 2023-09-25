import { describe, test } from 'vitest';
import assert from 'assert';

import { ContentRuleset, ExtendRuleset, DEFAULT_CONFIG } from './config';
import GitignoreMatcher from './GitignoreMatcher';
import extendConfig, { extendRuleset, extendRule, filterFiles, enabledFor } from './extendConfig';

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
      matcher: new GitignoreMatcher(['gir', 'foo']),
      enabledFor,
      filterFiles,
      rules: {
        MALFORMED_ENCODING: {
          enabled: true,
          exclude: ['zig'],
          matcher: new GitignoreMatcher(['gir', 'foo', 'zig']),
          enabledFor,
          filterFiles,
        },
        UNEXPECTED_ENCODING: {
          enabled: true,
          exclude: [],
          matcher: new GitignoreMatcher(['gir', 'foo']),
          enabledFor,
          filterFiles,
        },
        CARRIAGE_RETURN: {
          enabled: true,
          exclude: [],
          matcher: new GitignoreMatcher(['gir', 'foo']),
          enabledFor,
          filterFiles,
        },
        TAB: {
          enabled: true,
          exclude: ['bar'],
          matcher: new GitignoreMatcher(['gir', 'foo', 'bar']),
          enabledFor,
          filterFiles,
        },
        TRAILING_WHITESPACE: {
          enabled: true,
          exclude: [],
          matcher: new GitignoreMatcher(['gir', 'foo']),
          enabledFor,
          filterFiles,
        },
        MULTIPLE_FINAL_NEWLINES: {
          enabled: true,
          exclude: [],
          matcher: new GitignoreMatcher(['gir', 'foo']),
          enabledFor,
          filterFiles,
        },
        NO_FINAL_NEWLINE: {
          enabled: true,
          exclude: [],
          matcher: new GitignoreMatcher(['gir', 'foo']),
          enabledFor,
          filterFiles,
        },
        UNEXPECTED_CHARACTER: {
          enabled: true,
          exclude: [],
          allowed: [],
          matcher: new GitignoreMatcher(['gir', 'foo']),
          enabledFor,
          filterFiles,
        },
        UTF8_VALIDATION: {
          enabled: true,
          exclude: ['zim'],
          matcher: new GitignoreMatcher(['gir', 'foo', 'zim']),
          enabledFor,
          filterFiles,
          rules: {
            INVALID_BYTE: {
              enabled: true,
              exclude: ['yip'],
              matcher: new GitignoreMatcher(['gir', 'foo', 'zim', 'yip']),
              enabledFor,
              filterFiles,
            },
            UNEXPECTED_CONTINUATION_BYTE: {
              enabled: true,
              exclude: [],
              matcher: new GitignoreMatcher(['gir', 'foo', 'zim']),
              enabledFor,
              filterFiles,
            },
            MISSING_CONTINUATION_BYTE: {
              enabled: true,
              exclude: [],
              matcher: new GitignoreMatcher(['gir', 'foo', 'zim']),
              enabledFor,
              filterFiles,
            },
            OVERLONG_BYTE_SEQUENCE: {
              enabled: true,
              exclude: [],
              matcher: new GitignoreMatcher(['gir', 'foo', 'zim']),
              enabledFor,
              filterFiles,
            },
            INVALID_CODE_POINT: {
              enabled: false,
              exclude: [],
              matcher: new GitignoreMatcher(['gir', 'foo', 'zim']),
              enabledFor,
              filterFiles,
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
      matcher: new GitignoreMatcher(['gir', 'zig']),
      enabledFor,
      filterFiles,
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
      matcher: new GitignoreMatcher(['gir', 'zig']),
      enabledFor,
      filterFiles,
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
