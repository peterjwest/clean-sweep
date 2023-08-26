import { describe, test } from 'vitest';
import assert from 'assert';

import { RULES } from './rules';
import { UserConfig, DEFAULT_CONFIG } from './config';
import combineConfig from './combineConfig';
import extendConfig from './extendConfig';
import { FileResult } from './util';
import checkFilePath, { getExtension } from './checkFilePath';

const pathConfig = extendConfig(DEFAULT_CONFIG).rules.PATH_VALIDATION;

describe('checkFilePath', () => {
  test('Returns results with no errors for a compliant file path', () => {
    const expected = new FileResult();
    expected.checks = 2;
    assert.deepStrictEqual(checkFilePath('src/foo.ts', pathConfig), expected);
  });

  test('Returns results with an error for a .DS_Store file', () => {
    const expected = new FileResult();
    expected.failures.push({ type: RULES.DS_STORE });
    expected.checks = 2;
    assert.deepStrictEqual(checkFilePath('build/.DS_Store', pathConfig), expected);
  });

  test('Returns results with an error for file with an uppercase extension', () => {
    const expected = new FileResult();
    expected.failures.push({ type: RULES.UPPERCASE_EXTENSION });
    expected.checks = 2;
    assert.deepStrictEqual(checkFilePath('build/foo.Ts', pathConfig), expected);
    assert.deepStrictEqual(checkFilePath('build/foo.TS', pathConfig), expected);
    assert.deepStrictEqual(checkFilePath('build/foo.TeSt.ts', pathConfig), expected);
  });

  test('Returns results with no errors for a .DS_Store file if the rule is disabled', () => {
    const expected = new FileResult();
    expected.checks = 1;

    const userConfig: UserConfig = {
      rules: {
        PATH_VALIDATION: {
          rules: { DS_STORE: false },
        },
      },
    };
    const pathConfig = extendConfig(combineConfig(DEFAULT_CONFIG, userConfig)).rules.PATH_VALIDATION;

    assert.deepStrictEqual(checkFilePath('build/.DS_Store', pathConfig), expected);
  });

  test('Returns results with no errors for a file with an uppercase extension if the rule is disabled', () => {
    const expected = new FileResult();
    expected.checks = 1;

    const userConfig: UserConfig = {
      rules: {
        PATH_VALIDATION: {
          rules: { UPPERCASE_EXTENSION: false },
        },
      },
    };
    const pathConfig = extendConfig(combineConfig(DEFAULT_CONFIG, userConfig)).rules.PATH_VALIDATION;

    assert.deepStrictEqual(checkFilePath('build/foo.TS', pathConfig), expected);
  });

  test('Returns results with no errors or checks if all rules are disabled', () => {
    const expected = new FileResult();
    expected.checks = 0;

    const userConfig: UserConfig = {
      rules: {
        PATH_VALIDATION: {
          rules: { DS_STORE: false, UPPERCASE_EXTENSION: false },
        },
      },
    };
    const pathConfig = extendConfig(combineConfig(DEFAULT_CONFIG, userConfig)).rules.PATH_VALIDATION;

    assert.deepStrictEqual(checkFilePath('build/anything.ts', pathConfig), expected);
  });
});

describe('getExtension', () => {
  test('Returns the extension of a file, from its path', () => {
    assert.deepStrictEqual(getExtension('foo/bar/zim.ts'), '.ts');
  });

  test('Returns the multiple extensions of a file', () => {
    assert.deepStrictEqual(getExtension('foo/bar/zim.test.ts'), '.test.ts');
  });

  test('Returns the extension of a dotfile', () => {
    assert.deepStrictEqual(getExtension('foo/bar/.gitignore'), '.gitignore');
  });

  test('Returns undefined if a file has no extension', () => {
    assert.deepStrictEqual(getExtension('foo/bar/bin'), undefined);
  });
});
