import { describe, test } from 'vitest';
import assert from 'assert';
import sinon from 'sinon';
import assertStub from 'sinon-assert-stub';

import { RULES } from './rules';
import extendConfig from './extendConfig';
import { DEFAULT_CONFIG } from './config';
import ProgressManager from './ProgressManager';
import { FileResult } from './util';
import unlinted, { checkIgnoredCommitted } from './index';

describe('checkIgnoredCommitted', () => {
  test('Runs the check successfully for no ignored, committed files', async () => {
    const directory = 'dir/';

    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const config = extendConfig(DEFAULT_CONFIG).rules.PATH_VALIDATION.rules.IGNORED_COMMITTED_FILE;

    const getIgnoredCommittedFiles = sinon.stub().resolves([]);

    const results = await checkIgnoredCommitted(directory, progress, config, { getIgnoredCommittedFiles });

    assert.deepStrictEqual(results, {});
    assertStub.calledWith(addSection, [['Checking for ignored committed files']]);
  });

  test('Runs the check with failures for ignored, committed files', async () => {
    const directory = 'dir/';

    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const config = extendConfig(DEFAULT_CONFIG).rules.PATH_VALIDATION.rules.IGNORED_COMMITTED_FILE;

    const getIgnoredCommittedFiles = sinon.stub().resolves(['bar.ts', 'zim.txt']);

    const results = await checkIgnoredCommitted(directory, progress, config, { getIgnoredCommittedFiles });

    assert.deepStrictEqual(results, {
      'bar.ts': new FileResult(1, [{ type: RULES.IGNORED_COMMITTED_FILE }]),
      'zim.txt': new FileResult(1, [{ type: RULES.IGNORED_COMMITTED_FILE }]),
    });
    assertStub.calledWith(addSection, [['Checking for ignored committed files']]);
  });
});

describe('unlinted', () => {
  test('Returns results with no failures', async () => {
    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const getProjectDir = sinon.stub().resolves('path/dir');
    const getConfig = sinon.stub().resolves([DEFAULT_CONFIG, 'unlinted.config.ts']);
    const getProjectFiles = sinon.stub().resolves(['foo.txt', 'bar.ts', 'zim.md']);
    const getIgnoredCommittedFiles = sinon.stub().resolves([]);
    const getFileContent = sinon.stub().resolves(Buffer.from('Example content'));
    const checkIgnoredCommitted = sinon.stub().resolves();
    const checkFilePath = sinon.stub().resolves(new FileResult(3));
    const checkContent = sinon.stub().resolves(new FileResult(4));
    const validateUtf8 = sinon.stub().resolves(new FileResult(5));

    const config = extendConfig(DEFAULT_CONFIG);

    const results = await unlinted(progress, undefined, undefined, {
      getProjectDir,
      getConfig,
      getProjectFiles,
      getIgnoredCommittedFiles,
      getFileContent,
      validateUtf8,
      checkIgnoredCommitted,
      checkFilePath,
      checkContent,
      extendConfig,
      cwd: () => '/absolute/dir',
    });

    assert.deepStrictEqual(results, {
      'foo.txt': new FileResult(12),
      'bar.ts': new FileResult(12),
      'zim.md': new FileResult(12),
    });

    assertStub.calledWith(getConfig, [['path/dir', undefined]]);
    assertStub.calledWith(getFileContent, [
      ['path/dir', 'foo.txt'],
      ['path/dir', 'bar.ts'],
      ['path/dir', 'zim.md'],
      ['path/dir', 'foo.txt'],
      ['path/dir', 'bar.ts'],
      ['path/dir', 'zim.md'],
    ]);
    assertStub.calledWith(checkFilePath, [
      ['foo.txt', config.rules.PATH_VALIDATION],
      ['bar.ts', config.rules.PATH_VALIDATION],
      ['zim.md', config.rules.PATH_VALIDATION],
    ]);
    assertStub.calledWith(checkContent, [
      ['foo.txt', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION],
      ['bar.ts', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION],
      ['zim.md', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION],
    ]);
    assertStub.calledWith(validateUtf8, [
      ['foo.txt', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION],
      ['bar.ts', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION],
      ['zim.md', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION],
    ]);

    assertStub.calledWith(addSection, [
      ['Git project directory: path/dir'],
      ['Using config file: unlinted.config.ts'],
      ['Loading project file list'],
      ['Checking file paths', 3],
      ['Checking file contents', 3],
      ['Checking UTF8 encoding', 3],
    ]);
  });

  test('Returns empty results when disabled entirely', async () => {
    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const getProjectDir = sinon.stub().resolves('path/dir');
    const getConfig = sinon.stub().resolves([{ ...DEFAULT_CONFIG, enabled: false }, 'unlinted.config.ts']);
    const getProjectFiles = sinon.stub().resolves(['foo.txt', 'bar.ts', 'zim.md']);
    const getIgnoredCommittedFiles = sinon.stub().resolves([]);
    const getFileContent = sinon.stub().resolves(Buffer.from('Example content'));
    const checkIgnoredCommitted = sinon.stub().resolves();
    const checkFilePath = sinon.stub().resolves(new FileResult(3));
    const checkContent = sinon.stub().resolves(new FileResult(4));
    const validateUtf8 = sinon.stub().resolves(new FileResult(5));

    const results = await unlinted(progress, undefined, undefined, {
      getProjectDir,
      getConfig,
      getProjectFiles,
      getIgnoredCommittedFiles,
      getFileContent,
      validateUtf8,
      checkIgnoredCommitted,
      checkFilePath,
      checkContent,
      extendConfig,
      cwd: () => '/absolute/dir',
    });

    assert.deepStrictEqual(results, {});

    assertStub.calledWith(getConfig, [['path/dir', undefined]]);

    assertStub.notCalled(getFileContent);
    assertStub.notCalled(checkFilePath);
    assertStub.notCalled(checkContent);
    assertStub.notCalled(validateUtf8);

    assertStub.calledWith(addSection, [
      ['Git project directory: path/dir'],
      ['Using config file: unlinted.config.ts'],
      ['All checks disabled, exiting'],
    ]);
  });

  test('Returns results with no failures using default config', async () => {
    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const getProjectDir = sinon.stub().resolves('path/dir');
    const getConfig = sinon.stub().resolves([DEFAULT_CONFIG, undefined]);
    const getProjectFiles = sinon.stub().resolves(['foo.txt', 'bar.ts', 'zim.md']);
    const getIgnoredCommittedFiles = sinon.stub().resolves([]);
    const getFileContent = sinon.stub().resolves(Buffer.from('Example content'));
    const checkIgnoredCommitted = sinon.stub().resolves();
    const checkFilePath = sinon.stub().resolves(new FileResult(3));
    const checkContent = sinon.stub().resolves(new FileResult(4));
    const validateUtf8 = sinon.stub().resolves(new FileResult(5));

    const results = await unlinted(progress, undefined, undefined, {
      getProjectDir,
      getConfig,
      getProjectFiles,
      getIgnoredCommittedFiles,
      getFileContent,
      validateUtf8,
      checkIgnoredCommitted,
      checkFilePath,
      checkContent,
      extendConfig,
      cwd: () => '/absolute/dir',
    });

    assert.deepStrictEqual(results,  {
      'foo.txt': new FileResult(12),
      'bar.ts': new FileResult(12),
      'zim.md': new FileResult(12),
    });

    assertStub.calledWith(addSection, [
      ['Git project directory: path/dir'],
      ['Using default config'],
      ['Loading project file list'],
      ['Checking file paths', 3],
      ['Checking file contents', 3],
      ['Checking UTF8 encoding', 3],
    ]);
  });

  test('Returns results with failures', async () => {
    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const getProjectDir = sinon.stub().resolves('path/dir');
    const getConfig = sinon.stub().resolves([DEFAULT_CONFIG, 'unlinted.config.ts']);
    const getProjectFiles = sinon.stub().resolves(['foo.txt', 'bar.ts', 'zim.md']);
    const getIgnoredCommittedFiles = sinon.stub().resolves([]);
    const getFileContent = sinon.stub().resolves(Buffer.from('Example content'));
    const checkIgnoredCommitted = sinon.stub().resolves();
    const checkFilePath = sinon.stub();
    checkFilePath.withArgs('foo.txt').resolves(new FileResult(3, [
      { type: RULES.MULTIPLE_FINAL_NEWLINES, line: 7 },
    ]));
    checkFilePath.withArgs('bar.ts').resolves(new FileResult(3));
    checkFilePath.withArgs('zim.md').resolves(new FileResult(3));

    const checkContent = sinon.stub();
    checkContent.withArgs('foo.txt').resolves(new FileResult(4));
    checkContent.withArgs('bar.ts').resolves(new FileResult(4, [
      { type: RULES.NO_FINAL_NEWLINE, line: 6 },
    ]));
    checkContent.withArgs('zim.md').resolves(new FileResult(4));

    const validateUtf8 = sinon.stub();
    validateUtf8.withArgs('foo.txt').resolves(new FileResult(5));
    validateUtf8.withArgs('bar.ts').resolves(new FileResult(5, [
      { type: RULES.MISSING_CONTINUATION_BYTE, value: '0xF0', expectedBytes: 4, line: 5 },
    ]));
    validateUtf8.withArgs('zim.md').resolves(new FileResult(5, [
      { type: RULES.INVALID_BYTE, value: '0xF8', line: 13 },
    ]));

    const config = extendConfig(DEFAULT_CONFIG);

    const results = await unlinted(progress, undefined, undefined, {
      getProjectDir,
      getConfig,
      getProjectFiles,
      getIgnoredCommittedFiles,
      getFileContent,
      validateUtf8,
      checkIgnoredCommitted,
      checkFilePath,
      checkContent,
      extendConfig,
      cwd: () => '/absolute/dir',
    });

    assert.deepStrictEqual(results,  {
      'foo.txt': new FileResult(12, [{ line: 7, type: 'MULTIPLE_FINAL_NEWLINES' }]),
      'bar.ts': new FileResult(12, [
        { line: 6, type: 'NO_FINAL_NEWLINE' },
        { type: RULES.MISSING_CONTINUATION_BYTE, value: '0xF0', expectedBytes: 4, line: 5 },
      ]),
      'zim.md': new FileResult(12, [
        { type: RULES.INVALID_BYTE, value: '0xF8', line: 13 },
      ]),
    });

    assertStub.calledWith(getConfig, [['path/dir', undefined]]);
    assertStub.calledWith(getFileContent, [
      ['path/dir', 'foo.txt'],
      ['path/dir', 'bar.ts'],
      ['path/dir', 'zim.md'],
      ['path/dir', 'foo.txt'],
      ['path/dir', 'bar.ts'],
      ['path/dir', 'zim.md'],
    ]);
    assertStub.calledWith(checkFilePath, [
      ['foo.txt', config.rules.PATH_VALIDATION],
      ['bar.ts', config.rules.PATH_VALIDATION],
      ['zim.md', config.rules.PATH_VALIDATION],
    ]);
    assertStub.calledWith(checkContent, [
      ['foo.txt', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION],
      ['bar.ts', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION],
      ['zim.md', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION],
    ]);
    assertStub.calledWith(validateUtf8, [
      ['foo.txt', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION],
      ['bar.ts', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION],
      ['zim.md', Buffer.from('Example content'), config.rules.CONTENT_VALIDATION.rules.UTF8_VALIDATION],
    ]);

    assertStub.calledWith(addSection, [
      ['Git project directory: path/dir'],
      ['Using config file: unlinted.config.ts'],
      ['Loading project file list'],
      ['Checking file paths', 3],
      ['Checking file contents', 3],
      ['Checking UTF8 encoding', 3],
    ]);
  });

  test('Throws if the getProjectDir throws', async () => {
    const addSection = sinon.stub();
    const incrementProgress = sinon.stub();
    const progressBarMessage = sinon.stub();
    const sectionFailed = sinon.stub();
    const progress = { addSection, incrementProgress, progressBarMessage, sectionFailed } as unknown as ProgressManager;

    const getProjectDir = sinon.stub().rejects(new Error('Some error'));
    const getConfig = sinon.stub().resolves([DEFAULT_CONFIG, 'unlinted.config.ts']);
    const getProjectFiles = sinon.stub().resolves(['foo.txt', 'bar.ts', 'zim.md']);
    const getIgnoredCommittedFiles = sinon.stub().resolves([]);
    const getFileContent = sinon.stub().resolves(Buffer.from('Example content'));
    const checkIgnoredCommitted = sinon.stub().resolves();
    const checkFilePath = sinon.stub().resolves(new FileResult(3));
    const checkContent = sinon.stub().resolves(new FileResult(4));
    const validateUtf8 = sinon.stub().resolves(new FileResult(5));

    await assert.rejects(() => unlinted(progress, undefined, undefined, {
      getProjectDir,
      getConfig,
      getProjectFiles,
      getIgnoredCommittedFiles,
      getFileContent,
      validateUtf8,
      checkIgnoredCommitted,
      checkFilePath,
      checkContent,
      extendConfig,
      cwd: () => '/absolute/dir',
    }), new Error('The directory /absolute/dir is not a git project'));

    assertStub.notCalled(getConfig);
    assertStub.notCalled(getFileContent);
    assertStub.notCalled(checkFilePath);
    assertStub.notCalled(checkContent);
    assertStub.notCalled(validateUtf8);

    assertStub.notCalled(addSection);
  });
});
