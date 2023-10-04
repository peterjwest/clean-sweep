import { describe, test } from 'vitest';
import assert from 'assert';
import sinon from 'sinon';
import assertStub from 'sinon-assert-stub';

import { DEFAULT_CONFIG, UserConfig } from './config';
import { ErrorWithFailures } from './util';
import combineConfig from './combineConfig';
import getConfig, { getConfigPath, parseConfig } from './getConfig';

describe('getConfig', () => {
  test('Resolves with a default config and no path', async () => {
    const getConfigPath = sinon.stub().resolves(undefined);
    const importModule = sinon.stub();

    assert.deepStrictEqual(
      await getConfig('/foo/bar/zim', undefined, { getConfigPath, importModule }),
      [DEFAULT_CONFIG, undefined],
    );
    assertStub.notCalled(importModule);
  });

  test('Resolves with an empty config and path', async () => {
    const getConfigPath = sinon.stub().resolves('/foo/bar/unlinted.config.ts');
    const importModule = sinon.stub().resolves({});

    assert.deepStrictEqual(
      await getConfig('/foo/bar/zim', undefined, { getConfigPath, importModule }),
      [DEFAULT_CONFIG, '/foo/bar/unlinted.config.ts'],
    );
  });

  test('Resolves with a user config and path', async () => {
    const userConfig: UserConfig = {
      exclude: () => [],
      rules: {
        PATH_VALIDATION: { enabled: true, exclude: () => ['x'] },
        CONTENT_VALIDATION: {
          rules: { TRAILING_WHITESPACE: false },
        },
      },
    };

    const getConfigPath = sinon.stub().resolves('/foo/bar/unlinted.config.ts');
    const importModule = sinon.stub().resolves(userConfig);

    assert.deepStrictEqual(
      await getConfig('/foo/bar/zim', undefined, { getConfigPath, importModule }),
      [combineConfig(DEFAULT_CONFIG, userConfig), '/foo/bar/unlinted.config.ts'],
    );
  });

  test('Resolves with a user config from an ES module ', async () => {
    const userConfig: UserConfig = {
      exclude: () => [],
      rules: {
        PATH_VALIDATION: { enabled: true, exclude: () => ['x'] },
        CONTENT_VALIDATION: {
          rules: { TRAILING_WHITESPACE: false },
        },
      },
    };

    const getConfigPath = sinon.stub().resolves('/foo/bar/unlinted.config.ts');
    const importModule = sinon.stub().resolves({ default: userConfig });

    assert.deepStrictEqual(
      await getConfig('/foo/bar/zim', undefined, { getConfigPath, importModule }),
      [combineConfig(DEFAULT_CONFIG, userConfig), '/foo/bar/unlinted.config.ts'],
    );
  });

  test('Resolves with a user config from a custom path', async () => {
    const userConfig: UserConfig = {
      rules: {
        CONTENT_VALIDATION: false,
      },
    };

    const getConfigPath = sinon.stub().resolves('/foo/bar/.unlinted/config.ts');
    const importModule = sinon.stub().resolves(userConfig);

    assert.deepStrictEqual(
      await getConfig('/foo/bar/zim', '.unlinted/config.ts', { getConfigPath, importModule }),
      [combineConfig(DEFAULT_CONFIG, userConfig), '.unlinted/config.ts'],
    );
  });

  test('Rejects with an invalid config', async () => {
    const userConfig: unknown = {
      rules: {
        BANANA: true,
      },
    };

    const getConfigPath = sinon.stub().resolves('/foo/bar/unlinted.config.ts');
    const importModule = sinon.stub().resolves(userConfig);

    await assert.rejects(
      getConfig('/foo/bar/zim', undefined, { getConfigPath, importModule }),
      new ErrorWithFailures('Config invalid', [`Unrecognized key(s) in object: 'BANANA' at "rules"`]),
    );
  });

  test('Rejects with a config which fails checks', async () => {
    const userConfig: unknown = {
      rules: {
        CONTENT_VALIDATION: {
          rules: { UNEXPECTED_ENCODING: false },
        },
      },
    };

    const getConfigPath = sinon.stub().resolves('/foo/bar/unlinted.config.ts');
    const importModule = sinon.stub().resolves(userConfig);

    await assert.rejects(
      getConfig('/foo/bar/zim', undefined, { getConfigPath, importModule }),
      new ErrorWithFailures('Config invalid', [
        'MALFORMED_ENCODING and UNEXPECTED_ENCODING must be enabled for CARRIAGE_RETURN, TAB, TRAILING_WHITESPACE, MULTIPLE_FINAL_NEWLINES, NO_FINAL_NEWLINE, UNEXPECTED_CHARACTER, UTF8_VALIDATION to be enabled',
      ]),
    );
  });
});

describe('getConfigPath', () => {
  test('Resolves with the default TS config path, if readable and no user config passed', async () => {
    const currentDirectory = sinon.stub().returns('/foo/bar/zim');
    const fileReadable = sinon.stub().resolves(true);

    assert.strictEqual(
      await getConfigPath('/foo/bar', undefined, { currentDirectory, fileReadable }),
      '/foo/bar/unlinted.config.ts',
    );
  });

  test('Resolves with the default JS config path, if TS not readable and no user config passed', async () => {
    const currentDirectory = sinon.stub().returns('/foo/bar/zim');
    const fileReadable = sinon.stub().resolves(true);
    fileReadable.resolves(true);
    fileReadable.withArgs('/foo/bar/unlinted.config.ts').resolves(false);

    assert.strictEqual(
      await getConfigPath('/foo/bar', undefined, { currentDirectory, fileReadable }),
      '/foo/bar/unlinted.config.js',
    );
  });

  test('Resolves with the default JSON config path, if TS and JS not readable and no user config passed', async () => {
    const currentDirectory = sinon.stub().returns('/foo/bar/zim');
    const fileReadable = sinon.stub().resolves(true);
    fileReadable.resolves(true);
    fileReadable.withArgs('/foo/bar/unlinted.config.ts').resolves(false);
    fileReadable.withArgs('/foo/bar/unlinted.config.js').resolves(false);

    assert.strictEqual(
      await getConfigPath('/foo/bar', undefined, { currentDirectory, fileReadable }),
      '/foo/bar/unlinted.config.json',
    );
  });

  test('Resolves with undefined, no default path is readable and no user config passed', async () => {
    const currentDirectory = sinon.stub().returns('/foo/bar/zim');
    const fileReadable = sinon.stub().resolves(false);

    assert.strictEqual(
      await getConfigPath('/foo/bar', undefined, { currentDirectory, fileReadable }),
      undefined,
    );
  });

  test('Resolves with the user config path if passed', async () => {
    const currentDirectory = sinon.stub().returns('/foo/bar/zim');
    const fileReadable = sinon.stub().resolves(true);
    fileReadable.resolves(true);

    assert.strictEqual(
      await getConfigPath('/foo/bar', '.config.ts', { currentDirectory, fileReadable }),
      '/foo/bar/zim/.config.ts',
    );
  });

  test('Resolves with the user config path to a parent directory if passed', async () => {
    const currentDirectory = sinon.stub().returns('/foo/bar/zim');
    const fileReadable = sinon.stub().resolves(true);
    fileReadable.resolves(true);

    assert.strictEqual(
      await getConfigPath('/foo/bar', '../.config.ts', { currentDirectory, fileReadable }),
      '/foo/bar/.config.ts',
    );
  });
});

describe('parseConfig', () => {
  test('Parses an empty config correctly', () => {
    const userConfig: unknown = {};

    assert.deepStrictEqual(parseConfig(userConfig), {});
  });

  test('Parses a sparse config correctly', () => {
    const userConfig: UserConfig = {
      exclude: [],
      rules: {
        PATH_VALIDATION: {
          enabled: true,
          exclude: ['x'],
          rules: {
            DS_STORE: undefined,
          },
        },
        CONTENT_VALIDATION: {
          rules: {
            MALFORMED_ENCODING: { enabled: false, exclude: ['y'] },
            UNEXPECTED_CHARACTER: { allowed: ['✓'] },
            UTF8_VALIDATION: undefined,
            TRAILING_WHITESPACE: false,
          },
        },
      },
    };

    assert.deepStrictEqual(parseConfig(userConfig), userConfig);
  });

  test('Parses the default config correctly', () => {
    assert.deepStrictEqual(parseConfig(DEFAULT_CONFIG), DEFAULT_CONFIG);
  });

  test('Fails to parse an invalid config', () => {
    const userConfig: unknown = {
      exclude: () => [],
      rules: {
        PATH_VALIDATION: {
          enabled: true,
          banana: true,
          rules: {
            DS_STORE: undefined,
          },
        },
        CONTENT_VALIDATION: {
          rules: {
            MALFORMED_ENCODING: { exclude: () => [3] },
            FAKE_RULE: true,
          },
        },
      },
    };

    assert.throws(() => parseConfig(userConfig), new ErrorWithFailures('Config invalid', [
      `Unrecognized key(s) in object: 'banana' at "rules.PATH_VALIDATION"`,
      `Unrecognized key(s) in object: 'FAKE_RULE' at "rules.CONTENT_VALIDATION.rules"`,
    ]));
  });

  test('Fails to parse no config', () => {
    const userConfig: unknown = null;

    assert.throws(() => parseConfig(userConfig), new ErrorWithFailures('Config invalid', [
      'Expected object, received null',
    ]));
  });
});
