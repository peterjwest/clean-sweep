import assert from 'assert';
import { describe, test } from 'vitest';
import sinon, { SinonSpy } from 'sinon';
import multiline from 'multiline-ts';
import assertStub from 'sinon-assert-stub';
import { constants } from 'fs';
import z from 'zod';

import { RULES } from './rules';

import {
  mergeResults,
  createEnum,
  createEnumNumeric,
  getLineNumber,
  currentDirectory,
  exitProcess,
  getZodErrors,
  fileReadable,
  gitListFiles,
  getIgnoredCommittedFiles,
  getProjectFiles,
  getProjectDir,
  getFileContent,
  isSystemError,
  delay,
  currentDate,
  toDateString,
  differenceInSeconds,
  getResultStats,
  FileResult,
  Results,
  GIT_LIST_BUFFER_SIZE,
} from './util';

class MockSystemError extends Error {
  code: string;
  errno: number;
  syscall: string;

  constructor(message: string, code: string, errno: number, syscall: string) {
    super(message);
    this.code = code;
    this.errno = errno;
    this.syscall = syscall;
  }
}

describe('createEnum', () => {
  test('Converts an array to a object where the values equal the keys', () => {
    assert.deepStrictEqual(createEnum(['APPLE', 'BANANA', 'ORANGE']), {
      APPLE: 'APPLE',
      BANANA: 'BANANA',
      ORANGE: 'ORANGE',
    });
  });

  test('Converts an empty array to an empty object', () => {
    assert.deepStrictEqual(createEnum([]), {});
  });
});

describe('createEnumNumeric', () => {
  test('Converts an array to a object where the values equal the indexes', () => {
    assert.deepStrictEqual(createEnumNumeric(['APPLE', 'BANANA', 'ORANGE']), {
      APPLE: 0,
      BANANA: 1,
      ORANGE: 2,
    });
  });

  test('Converts an empty array to an empty object', () => {
    assert.deepStrictEqual(createEnumNumeric([]), {});
  });
});

describe('getLineNumber', () => {
  test('Returns the line number for an index in a string', () => {
    const value = 'foo\n😅\n\nあ\r\r\n©\n\r\rbar';

    assert.strictEqual(getLineNumber(value, 0), 1);
    assert.strictEqual(getLineNumber(value, 3), 1); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(value, 4), 2); // Start of 😅
    assert.strictEqual(getLineNumber(value, 5), 2); // End of 😅
    assert.strictEqual(getLineNumber(value, 8), 4); // あ
    assert.strictEqual(getLineNumber(value, 10), 5); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(value, 11), 5); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(value, 13), 6); // ©
    assert.strictEqual(getLineNumber(value, 14), 7); // Newlines considered part of the preceeding line
    assert.strictEqual(getLineNumber(value, 16), 9);
  });

  test('Throws an error if the index is not in the buffer', () => {
    const value = 'abc';

    assert.throws(() => getLineNumber(value, -1), new Error('Index -1 out of range'));
    assert.throws(() => getLineNumber(value, 3), new Error('Index 3 out of range'));
  });
});

describe('currentDirectory', () => {
  test('Converts an array to a object where the values equal the indexes', () => {
    const mockProcess = { ...process, cwd: sinon.mock().returns('/foo/bar') };

    assert.strictEqual(currentDirectory({ process: mockProcess }), '/foo/bar');
  });
});

describe('exitProcess', () => {
  test('Runs process.exit with the specified code', () => {
    const exit = sinon.mock() as unknown as SinonSpy<any[], never>;

    exitProcess(1, { process: { ...process, exit } });
    assertStub.calledOnceWith(exit, [1]);
  });

  test('Runs process.exit with no code', () => {
    const exit = sinon.mock() as unknown as SinonSpy<any[], never>;

    exitProcess(undefined, { process: { ...process, exit } });
    assertStub.calledOnceWith(exit, [undefined]);
  });
});

describe('getZodErrors', () => {
  test('Returns a list of errors from a ZodError', () => {
    const MockSchema = z.object({
      value: z.union([z.boolean(), z.string()]),
      items: z.array(z.string()).readonly(),
    }).strict();

    const result = MockSchema.safeParse({ value: true, items: [1, '2', '3'], banana: 'Hello' });
    assert.strictEqual(result.success, false);

    assert.deepStrictEqual(getZodErrors(result.error), [
      'Expected string, received number at "items[0]"',
      `Unrecognized key(s) in object: 'banana'`,
    ]);
  });
});

describe('fileReadable', () => {
  test('Resolves with true when a file is readable', async () => {
    const access = sinon.stub().resolves();

    assert.strictEqual(await fileReadable('real.txt', { access }), true);
    assertStub.calledOnceWith(access, ['real.txt', constants.R_OK]);
  });

  test('Resolves with false when a file is not readable', async () => {
    const access = sinon.stub().rejects(new Error('Some error'));

    assert.strictEqual(await fileReadable('fake.txt', { access }), false);
    assertStub.calledOnceWith(access, ['fake.txt', constants.R_OK]);
  });
});

describe('gitListFiles', () => {
  test('Resolves with git repository files', async () => {
    const files = multiline`
      foo.txt
      bar.js
      zim.ts
    `;
    const exec = sinon.stub().resolves({ stdout: files });

    assert.deepStrictEqual(await gitListFiles('src', '', { exec }), ['foo.txt', 'bar.js', 'zim.ts']);
    assertStub.calledOnceWith(exec, [
      'git ls-files --full-name',
      { cwd: 'src', maxBuffer: GIT_LIST_BUFFER_SIZE },
    ]);
  });

  test('Resolves with git repository files with options', async () => {
    const files = multiline`
      foo.txt
      bar.js
      zim.ts
    `;
    const exec = sinon.stub().resolves({ stdout: files });

    assert.deepStrictEqual(await gitListFiles('src', '--cached --ignored', { exec }), ['foo.txt', 'bar.js', 'zim.ts']);
    assertStub.calledOnceWith(exec, [
      'git ls-files --full-name --cached --ignored',
      { cwd: 'src', maxBuffer: GIT_LIST_BUFFER_SIZE },
    ]);
  });

  test('Rejects when not a git repository', async () => {
    const error = new Error(multiline`
      Command failed: git ls-files --full-name'
      fatal: not a git repository (or any of the parent directories): .git
    `);
    const exec = sinon.stub().rejects(error);

    await assert.rejects(gitListFiles('src', '', { exec }), error);
    assertStub.calledOnceWith(exec, [
      'git ls-files --full-name',
      { cwd: 'src', maxBuffer: GIT_LIST_BUFFER_SIZE },
    ]);
  });
});

describe('getIgnoredCommittedFiles', () => {
  test('Resolves with ignored committed files', async () => {
    const files =  ['foo.txt', 'bar.js', 'zim.ts'];
    const gitListFiles = sinon.stub().resolves(files);

    assert.deepStrictEqual(await getIgnoredCommittedFiles('src', { gitListFiles }), files);
    assertStub.calledOnceWith(gitListFiles, [
      'src',
      '--cached --ignored --exclude-standard',
    ]);
  });

  test('Rejects if gitListFiles rejects', async () => {
    const error = new Error('Some error');
    const gitListFiles = sinon.stub().rejects(error);

    await assert.rejects(getIgnoredCommittedFiles('src', { gitListFiles }), error);
    assertStub.calledOnceWith(gitListFiles, [
      'src',
      '--cached --ignored --exclude-standard',
    ]);
  });
});

describe('getProjectFiles', () => {
  test('Resolves with git files, but without removed files', async () => {
    const gitListFiles = sinon.stub();
    gitListFiles.withArgs(sinon.match.any, '--cached --others --exclude-standard').resolves(['foo.txt', 'bar.js', 'zim.ts']);
    gitListFiles.withArgs(sinon.match.any, '--deleted --exclude-standard').resolves(['bar.js']);

    assert.deepStrictEqual(await getProjectFiles('src', { gitListFiles }), ['foo.txt', 'zim.ts']);
  });

  test('Resolves with git files, with no removed files', async () => {
    const gitListFiles = sinon.stub();
    gitListFiles.withArgs(sinon.match.any, '--cached --others --exclude-standard').resolves(['foo.txt', 'bar.js', 'zim.ts']);
    gitListFiles.withArgs(sinon.match.any, '--deleted --exclude-standard').resolves([]);

    assert.deepStrictEqual(await getProjectFiles('src', { gitListFiles }), ['foo.txt', 'bar.js', 'zim.ts']);
  });

  test('Resolves with no files, since all removed', async () => {
    const gitListFiles = sinon.stub();
    gitListFiles.withArgs(sinon.match.any, '--cached --others --exclude-standard').resolves(['foo.txt', 'bar.js']);
    gitListFiles.withArgs(sinon.match.any, '--deleted --exclude-standard').resolves(['foo.txt', 'bar.js']);

    assert.deepStrictEqual(await getProjectFiles('src', { gitListFiles }), []);
  });
});

describe('getProjectDir', () => {
  test('Resolves with git root directory', async () => {
    const exec = sinon.stub().resolves({ stdout: '/path/to/git/repo' });

    assert.deepStrictEqual(await getProjectDir('src', { exec }), '/path/to/git/repo');
    assertStub.calledOnceWith(exec, [
      'git rev-parse --show-toplevel',
      { cwd: 'src' },
    ]);
  });

  test('Rejects when not a git repository', async () => {
    const error = new Error(multiline`
      Command failed: git rev-parse --show-toplevel'
      fatal: not a git repository (or any of the parent directories): .git
    `);
    const exec = sinon.stub().rejects(error);

    await assert.rejects(getProjectDir('src', { exec }), error);
    assertStub.calledOnceWith(exec, [
      'git rev-parse --show-toplevel',
      { cwd: 'src' },
    ]);
  });
});

describe('getFileContent', () => {
  test('Resolves with file contents', async () => {
    const readFile = sinon.stub().resolves('foo');

    assert.strictEqual(await getFileContent('dir/', 'file.txt', { readFile }), 'foo');
    assertStub.calledOnceWith(readFile, ['dir/file.txt']);
  });

  test('Resolves with an empty Buffer if the path is a directory', async () => {
    const mockError = new MockSystemError(
      'EISDIR: illegal operation on a directory, read',
      'EISDIR',
      -21,
      'read',
    );
    const readFile = sinon.stub().rejects(mockError);

    assert.deepStrictEqual(await getFileContent('dir', 'src', { readFile }), Buffer.from(''));
    assertStub.calledOnceWith(readFile, ['dir/src']);
  });

  test('Rejects if the file is not found', async () => {
    const mockError = new MockSystemError(
      `ENOENT: no such file or directory, open 'fake.txt'`,
      'ENOENT',
      -2,
      'open',
    );
    const readFile = sinon.stub().rejects(mockError);

    await assert.rejects(getFileContent('dir/', 'fake.txt', { readFile }), mockError);
    assertStub.calledOnceWith(readFile, ['dir/fake.txt']);
  });
});

describe('isSystemError', () => {
  test('Returns true when passed a node system error', () => {
    const mockError = new MockSystemError(
      'EISDIR: illegal operation on a directory, read',
      'EISDIR',
      -21,
      'read',
    );

    assert.strictEqual(isSystemError(mockError), true);
  });

  test('Returns false when passed a normal error', () => {
    assert.strictEqual(isSystemError(new Error('Some error')), false);
  });

  test('Returns false when passed a string', () => {
    assert.strictEqual(isSystemError('Some error'), false);
  });
});

describe('delay', () => {
  test('Resolves after a delay', async () => {
    await delay(10);
  });
});

describe('currentDate', () => {
  test('Returns the current date', () => {
    const date = new Date('2001-02-03T04:05:06.007Z');
    const clock = sinon.useFakeTimers(date);

    try {
      assert.deepStrictEqual(currentDate(), date);
    } finally {
      clock.restore();
    }
  });
});

describe('toDateString', () => {
  test('Converts a date to a string', () => {
    const date = new Date('2001-02-03T04:05:06.007Z');

    assert.strictEqual(toDateString(date), '04:05:06 (2001-02-03)');
  });
});

describe('differenceInSeconds', () => {
  test('Finds the difference in seconds between two dates', () => {
    const first = new Date('2000-01-01T00:00:00.000Z');
    const second = new Date('2000-01-01T00:01:23.126Z');

    assert.strictEqual(differenceInSeconds(first, second), '83.13');
  });

  test('Finds zero difference in seconds between the same date', () => {
    const date = new Date('2000-01-01T00:00:00.000Z');

    assert.strictEqual(differenceInSeconds(date, date), '0.00');
  });
});

describe('FileResult', () => {
  describe('addFailures', () => {
    test('Combines failures', () => {
      const fileResult = new FileResult();
      fileResult.failures = [{ type: 'IGNORED_COMMITTED_FILE' }];

      const expected = new FileResult();
      expected.failures = [{ type: 'IGNORED_COMMITTED_FILE' }, { type: 'DS_STORE' }];

      assert.deepStrictEqual(fileResult.addFailures([{ type: 'DS_STORE' }]), expected);
    });
  });

  describe('mergeWith', () => {
    test('Combines FileResults', () => {
      const fileResult1 = new FileResult();
      fileResult1.failures = [{ type: 'IGNORED_COMMITTED_FILE' }];
      fileResult1.checks = 5;

      const fileResult2 = new FileResult();
      fileResult2.failures = [{ type: 'DS_STORE' }];
      fileResult2.checks = 7;

      const expected = new FileResult();
      expected.failures = [{ type: 'IGNORED_COMMITTED_FILE' }, { type: 'DS_STORE' }];
      expected.checks = 12;

      assert.deepStrictEqual(fileResult1.mergeWith(fileResult2), expected);
    });
  });
});

describe('getResultStats', () => {
  test('Extracts zero stats from empty results', () => {
    const results: Results = {};

    assert.deepStrictEqual(getResultStats(results), {
      files: {
        total: 0,
        passed: 0,
        failed: 0,
      },
      checks: {
        total: 0,
        passed: 0,
        failed: 0,
      },
    });
  });

  test('Extracts mixed stats from results', () => {
    const exampleFile1 = new FileResult();
    exampleFile1.addFailures([{ type: 'DS_STORE' }]);
    exampleFile1.addFailures([{ type: 'UPPERCASE_EXTENSION' }]);
    exampleFile1.checks = 3;

    const exampleFile2 = new FileResult();
    exampleFile2.addFailures([{ type: 'UPPERCASE_EXTENSION' }]);
    exampleFile2.addFailures([{ type: 'INVALID_BYTE', value: '0xFF', line: 3 }]);
    exampleFile2.addFailures([{ type: 'INVALID_BYTE', value: '0xFF', line: 4 }]);
    exampleFile2.checks = 7;

    const exampleFile3 = new FileResult();
    exampleFile3.checks = 3;

    const results: Results = {
      'example.txt': exampleFile1,
      'src/foo.ts': exampleFile2,
      '.bar': exampleFile3,
    };

    assert.deepStrictEqual(getResultStats(results), {
      files: {
        total: 3,
        passed: 1,
        failed: 2,
      },
      checks: {
        total: 13,
        passed: 9,
        failed: 4,
      },
    });
  });

  test('Extracts successful stats from results', () => {
    const exampleFile1 = new FileResult();
    exampleFile1.checks = 4;

    const exampleFile2 = new FileResult();
    exampleFile2.checks = 6;

    const exampleFile3 = new FileResult();
    exampleFile3.checks = 3;

    const results: Results = {
      'example.txt': exampleFile1,
      'src/foo.ts': exampleFile2,
      '.bar': exampleFile3,
    };

    assert.deepStrictEqual(getResultStats(results), {
      files: {
        total: 3,
        passed: 3,
        failed: 0,
      },
      checks: {
        total: 13,
        passed: 13,
        failed: 0,
      },
    });
  });

  test('Extracts failed stats from results', () => {
    const exampleFile1 = new FileResult();
    exampleFile1.addFailures([{ type: 'DS_STORE' }]);
    exampleFile1.addFailures([{ type: 'UPPERCASE_EXTENSION' }]);
    exampleFile1.checks = 2;

    const exampleFile2 = new FileResult();
    exampleFile2.addFailures([{ type: 'UPPERCASE_EXTENSION' }]);

    exampleFile2.checks = 1;

    const exampleFile3 = new FileResult();
    exampleFile3.addFailures([{ type: 'INVALID_BYTE', value: '0xFF', line: 4 }]);
    exampleFile3.checks = 1;

    const results: Results = {
      'example.txt': exampleFile1,
      'src/foo.ts': exampleFile2,
      '.bar': exampleFile3,
    };

    assert.deepStrictEqual(getResultStats(results), {
      files: {
        total: 3,
        passed: 0,
        failed: 3,
      },
      checks: {
        total: 4,
        passed: 0,
        failed: 4,
      },
    });
  });
});

describe('mergeResults', () => {
  test('Results an empty result which combines two empty results', () => {
    assert.deepStrictEqual(mergeResults({}, {}), {});
  });

  test('Returns a result which combines two results', () => {
    assert.deepStrictEqual(mergeResults({
      'foo.txt': new FileResult(3, [{ type: RULES.DS_STORE }]),
      'bar.ts': new FileResult(7, [{ type: RULES.TAB, lines: [1, 2, 3] }]),
    }, {
      'bar.ts': new FileResult(5, [{ type: RULES.INVALID_BYTE, value: '0xF8', line: 13 }]),
      'zim.zip': new FileResult(9, [{ type: RULES.NO_FINAL_NEWLINE, line: 72 }]),
    }), {
      'foo.txt': new FileResult(3, [{ type: RULES.DS_STORE }]),
      'bar.ts': new FileResult(12, [
        { type: RULES.TAB, lines: [1, 2, 3] },
        { type: RULES.INVALID_BYTE, value: '0xF8', line: 13 },
      ]),
      'zim.zip': new FileResult(9, [{ type: RULES.NO_FINAL_NEWLINE, line: 72 }]),
    });
  });
});
