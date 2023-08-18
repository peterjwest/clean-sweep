import assert from 'assert';
import { describe, test } from 'vitest';
import sinon from 'sinon';
import multiline from 'multiline-ts';
import assertStub from 'sinon-assert-stub';
import { constants } from 'fs';

import {
  createEnum,
  createEnumNumeric,
  fileReadable,
  gitListFiles,
  getIgnoredCommittedFiles,
  getProjectFiles,
  getProjectDir,
  getFileContent,
  isSystemError,
  delay,
  toDateString,
  differenceInSeconds,
  getFileResult,
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

describe('fileReadable', () => {
  test('Resolves with true when a file is readable', async () => {
    const access = sinon.stub().resolves();

    assert.deepStrictEqual(await fileReadable('real.txt', { access }), true);
    assertStub.calledOnceWith(access, ['real.txt', constants.R_OK]);
  });

  test('Resolves with false when a file is not readable', async () => {
    const access = sinon.stub().rejects(new Error('Some error'));

    assert.deepStrictEqual(await fileReadable('fake.txt', { access }), false);
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

// /** Get all committed & untracked files */
// export async function getProjectFiles(directory: string): Promise<string[]> {
//   const deleted = await gitListFiles(directory, '--deleted --exclude-standard');
//   const files = await gitListFiles(directory, '--cached --others --exclude-standard');
//   return lodash.difference(files, deleted);
// }

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

    assert.deepStrictEqual(await getFileContent('file.txt', { readFile }), 'foo');
    assertStub.calledOnceWith(readFile, ['file.txt']);
  });

  test('Resolves with undefined if the path is a directory', async () => {
    const mockError = new MockSystemError(
      'EISDIR: illegal operation on a directory, read',
      'EISDIR',
      -21,
      'read',
    );
    const readFile = sinon.stub().rejects(mockError);

    assert.deepStrictEqual(await getFileContent('src', { readFile }), undefined);
    assertStub.calledOnceWith(readFile, ['src']);
  });

  test('Rejects if the file is not found', async () => {
    const mockError = new MockSystemError(
      'ENOENT: no such file or directory, open \'fake.txt\'',
      'ENOENT',
      -2,
      'open',
    );
    const readFile = sinon.stub().rejects(mockError);

    await assert.rejects(getFileContent('fake.txt', { readFile }), mockError);
    assertStub.calledOnceWith(readFile, ['fake.txt']);
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

describe('toDateString', () => {
  test('Converts a date to a string', () => {
    const date = new Date('2001-02-03T04:05:06.007Z');

    assert.deepStrictEqual(toDateString(date), '04:05:06 (2001-02-03)');
  });
});

describe('differenceInSeconds', () => {
  test('Finds the difference in seconds between two dates', () => {
    const first = new Date('2000-01-01T00:00:00.000Z');
    const second = new Date('2000-01-01T00:01:23.126Z');

    assert.deepStrictEqual(differenceInSeconds(first, second), '83.13');
  });

  test('Finds zero difference in seconds between the same date', () => {
    const date = new Date('2000-01-01T00:00:00.000Z');

    assert.deepStrictEqual(differenceInSeconds(date, date), '0.00');
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

describe('getFileResult', () => {
  test('Gets an existing file result from results', () => {
    const exampleFile = new FileResult();
    const results: Results = {
      'example.txt': exampleFile,
    };

    assert.strictEqual(getFileResult(results, 'example.txt'), exampleFile);
  });

  test('Gets/creates a new file result in results', () => {
    const exampleFile = new FileResult();
    exampleFile.addFailures([{ type: 'DS_STORE' }]);

    const results: Results = {
      'example.txt': exampleFile,
    };

    const returned = getFileResult(results, 'foo.ts');
    assert.deepStrictEqual(returned, new FileResult());
    assert.deepStrictEqual(results, { 'example.txt': exampleFile, 'foo.ts': new FileResult() });
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
