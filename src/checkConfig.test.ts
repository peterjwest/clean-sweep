import { describe, test } from 'vitest';
import assert from 'assert';

import { UserConfig, DEFAULT_CONFIG } from './config';
import combineConfig from './combineConfig';
import checkConfig from './checkConfig';

describe('checkConfig', () => {
  test('Returns no errors for a default config', () => {
    const userConfig: UserConfig = {};
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), []);
  });

  test('Returns no errors when CONTENT_VALIDATION is disabled', () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: {
          enabled: false,
        },
      },
    };
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), []);
  });

  test('Returns errors when MALFORMED_ENCODING is disabled, but other content checks are not', () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: {
          rules: { MALFORMED_ENCODING: false },
        },
      },
    };
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), [
      'MALFORMED_ENCODING must be enabled for UNEXPECTED_ENCODING to be enabled',
      'MALFORMED_ENCODING and UNEXPECTED_ENCODING must be enabled for CARRIAGE_RETURN, TAB, TRAILING_WHITESPACE, MULTIPLE_FINAL_NEWLINES, NO_FINAL_NEWLINE, UNEXPECTED_CHARACTER, UTF8_VALIDATION to be enabled',
    ]);
  });

  test('Returns no errors when MALFORMED_ENCODING is disabled, but CONTENT_VALIDATION is also disabled', () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: {
          enabled: false,
          rules: { MALFORMED_ENCODING: false },
        },
      },
    };
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), []);
  });

  test('Returns errors when UNEXPECTED_ENCODING is disabled, but other content checks are not', () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: {
          rules: { UNEXPECTED_ENCODING: false },
        },
      },
    };
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), [
      'MALFORMED_ENCODING and UNEXPECTED_ENCODING must be enabled for CARRIAGE_RETURN, TAB, TRAILING_WHITESPACE, MULTIPLE_FINAL_NEWLINES, NO_FINAL_NEWLINE, UNEXPECTED_CHARACTER, UTF8_VALIDATION to be enabled',
    ]);
  });

  test('Returns no errors when all content checks are disabled', () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: {
          rules: {
            MALFORMED_ENCODING: false,
            UNEXPECTED_ENCODING: false,
            CARRIAGE_RETURN: false,
            TAB: false,
            TRAILING_WHITESPACE: false,
            MULTIPLE_FINAL_NEWLINES: false,
            NO_FINAL_NEWLINE: false,
            UNEXPECTED_CHARACTER: false,
            UTF8_VALIDATION: false,
          },
        },
      },
    };
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), []);
  });

  test('Returns an error when all MALFORMED_ENCODING is disabled but UNEXPECTED_ENCODING is not', () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: {
          rules: {
            MALFORMED_ENCODING: false,
            UNEXPECTED_ENCODING: true,
            CARRIAGE_RETURN: false,
            TAB: false,
            TRAILING_WHITESPACE: false,
            MULTIPLE_FINAL_NEWLINES: false,
            NO_FINAL_NEWLINE: false,
            UNEXPECTED_CHARACTER: false,
            UTF8_VALIDATION: false,
          },
        },
      },
    };
    const config = combineConfig(DEFAULT_CONFIG, userConfig);

    assert.deepStrictEqual(checkConfig(config), [
      'MALFORMED_ENCODING must be enabled for UNEXPECTED_ENCODING to be enabled',
    ]);
  });
});
