import { describe, test } from 'vitest';
import assert from 'assert';

import { DEFAULT_CONTENT_EXCLUDED } from './constants';
import { Config, UserConfig, DEFAULT_CONFIG } from './config';
import combineConfig from './combineConfig';

describe('combineConfig', () => {
  test('Returns a default config when combined with an empty user config', () => {
    assert.deepStrictEqual(combineConfig(DEFAULT_CONFIG, {}), DEFAULT_CONFIG);
  });

  test('Returns a config with rulesets enabled/disabled with booleans', () => {
    const userConfig: UserConfig = {
      enabled: false,
      rules: {
        PATH_VALIDATION: false,
        CONTENT_VALIDATION: {
          enabled: true,
          rules: {
            UTF8_VALIDATION: false,
          },
        },
      },
    };

    assert.deepStrictEqual(combineConfig(DEFAULT_CONFIG, userConfig), {
      ...DEFAULT_CONFIG,
      enabled: false,
      rules: {
        PATH_VALIDATION: {
          ...DEFAULT_CONFIG.rules.PATH_VALIDATION,
          enabled: false,
        },
        CONTENT_VALIDATION: {
          ...DEFAULT_CONFIG.rules.CONTENT_VALIDATION,
          rules: {
            ...DEFAULT_CONFIG.rules.CONTENT_VALIDATION.rules,
            UTF8_VALIDATION: {
              ...DEFAULT_CONFIG.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION,
              enabled: false,
            },
          },
        },
      },
    });
  });

  test('Returns a config various changes to rules and rulesets', () => {
    const userConfig: UserConfig = {
      enabled: true,
      exclude: () => ['foo.txt'],
      rules: {
        PATH_VALIDATION: undefined,
        CONTENT_VALIDATION: {
          enabled: true,
          exclude: (defaults) => [...defaults.slice(0, 1), 'bar.zip', 'gir.ts'],
          rules: {
            UNEXPECTED_ENCODING: undefined,
            MALFORMED_ENCODING: {
              enabled: true,
              exclude: ['zip.txt'],
            },
            UNEXPECTED_CHARACTER: {
              enabled: false,
              exclude: undefined,
              allowed: ['✓'],
            },
            UTF8_VALIDATION: {
              enabled: false,
              exclude: ['zig.txt'],
              rules: {
                INVALID_BYTE: false,
                INVALID_CODE_POINT: true,
                OVERLONG_BYTE_SEQUENCE: {
                  enabled: undefined,
                  exclude: () => ['zim.js'],
                },
              },
            },
          },
        },
      },
    };

    const expected: Config = {
      enabled: true,
      exclude: ['foo.txt'],
      rules: {
        PATH_VALIDATION: {
          enabled: true,
          exclude: [],
          rules: {
            DS_STORE: { enabled: true, exclude: [] },
            UPPERCASE_EXTENSION: { enabled: true, exclude: [] },
            IGNORED_COMMITTED_FILE: { enabled: true, exclude: [] },
          },
        },
        CONTENT_VALIDATION: {
          enabled: true,
          exclude: [DEFAULT_CONTENT_EXCLUDED[0], 'bar.zip', 'gir.ts'],
          rules: {
            MALFORMED_ENCODING: { enabled: true, exclude: ['zip.txt'] },
            UNEXPECTED_ENCODING: { enabled: true, exclude: [] },
            CARRIAGE_RETURN: { enabled: true, exclude: [] },
            TAB: { enabled: true, exclude: [] },
            TRAILING_WHITESPACE: { enabled: true, exclude: [] },
            MULTIPLE_FINAL_NEWLINES: { enabled: true, exclude: [] },
            NO_FINAL_NEWLINE: { enabled: true, exclude: [] },
            UNEXPECTED_CHARACTER: { enabled: false, exclude: [], allowed: ['✓'] },
            UTF8_VALIDATION: {
              enabled: false,
              exclude: ['zig.txt'],
              rules: {
                INVALID_BYTE: { enabled: false, exclude: [] },
                UNEXPECTED_CONTINUATION_BYTE: { enabled: true, exclude: [] },
                MISSING_CONTINUATION_BYTE: { enabled: true, exclude: [] },
                OVERLONG_BYTE_SEQUENCE: { enabled: true, exclude: ['zim.js'] },
                INVALID_CODE_POINT: { enabled: true, exclude: [] },
              },
            },
          },
        },
      },
    };

    assert.deepStrictEqual(combineConfig(DEFAULT_CONFIG, userConfig), expected);
  });
});
