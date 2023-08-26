import { describe, test } from 'vitest';
import assert from 'assert';
import multiline from 'multiline-ts';
import sinon from 'sinon';
import assertStub from 'sinon-assert-stub';
import chalk from 'chalk';

import packageData from '../package.json';
import { getResultStats, ErrorWithFailures, FileResult, Results } from './util';
import command, { formatCommandError, COMMAND_HELP } from './command';

describe('formatCommandError', () => {
  test('Returns the message for an ErrorWithFailures with no failures', () => {
    assert.strictEqual(formatCommandError(new ErrorWithFailures('Some error', [])), 'Error: Some error');
  });

  test('Returns the message for an ErrorWithFailures with failures', () => {
    assert.strictEqual(formatCommandError(
      new ErrorWithFailures('Some error', ['Failure 1', 'Failure 2'])),
      multiline`
        Error: Some error
        > Failure 1
        > Failure 2
      `,
    );
  });

  test('Returns the message for an Error', () => {
    assert.strictEqual(formatCommandError(new Error('Some error')), 'Error: Some error');
  });

  test('Returns the message for a string', () => {
    assert.strictEqual(formatCommandError('Some error'), 'Error: Some error');
  });
});

describe('command', () => {
  test('Outputs the help message when passed the --help option', async () => {
    const log = sinon.stub();
    const currentDate = sinon.stub().returns(new Date('2001-02-03T04:05:06.007Z'));
    const unlinted = sinon.stub().resolves();
    const reportResults = sinon.stub();
    const exitProcess = sinon.stub();

    await command(['tsx', 'command.ts', '--help'], { log, currentDate, unlinted, reportResults, exitProcess });

    assertStub.calledWith(log, [
      [''],
      [chalk.inverse(chalk.bold.cyan(' unlinted ')) + chalk.cyan(` version ${packageData.version}`)],
      [''],
      [COMMAND_HELP],
    ]);
    assertStub.notCalled(unlinted);
    assertStub.notCalled(reportResults);
    assertStub.notCalled(exitProcess);
  });

  test('Outputs the an error if the config option is not correctly passed', async () => {
    const log = sinon.stub();
    const currentDate = sinon.stub().returns(new Date('2001-02-03T04:05:06.007Z'));
    const unlinted = sinon.stub().resolves();
    const reportResults = sinon.stub();
    const exitProcess = sinon.stub();

    await assert.rejects(
      command(['tsx', 'command.ts', '--config', 'something'], { log, currentDate, unlinted, reportResults, exitProcess }),
      new Error('--config must have a value with the format: --config=value')
    );

    assertStub.calledWith(log, [
      [''],
      [chalk.inverse(chalk.bold.cyan(' unlinted ')) + chalk.cyan(` version ${packageData.version}`)],
      [''],
    ]);
    assertStub.notCalled(unlinted);
    assertStub.notCalled(reportResults);
    assertStub.notCalled(exitProcess);
  });

  test('Runs correctly when not passed a custom config option or project path', async () => {
    const results: Results = {
      'foo.TXT': new FileResult(),
      'src/bar.ts': new FileResult(),
      'docs/zim.md': new FileResult(),
    };
    const startedAt = new Date('2001-02-03T04:05:06.007Z');

    const log = sinon.stub();
    const currentDate = sinon.stub().returns(startedAt);
    const unlinted = sinon.stub().resolves(results);
    const reportResults = sinon.stub();
    const exitProcess = sinon.stub();

    await command(['tsx', 'command.ts'], { log, currentDate, unlinted, reportResults, exitProcess });

    const progressManager: unknown = unlinted.getCall(0).args[0];
    assertStub.calledWith(log, [
      [''],
      [chalk.inverse(chalk.bold.cyan(' unlinted ')) + chalk.cyan(` version ${packageData.version}`)],
      [''],
    ]);
    assertStub.calledOnceWith(unlinted, [progressManager, undefined, undefined]);
    assertStub.calledOnceWith(reportResults, [results, getResultStats(results), startedAt]);
    assertStub.notCalled(exitProcess);
  });

  test('Runs correctly when passed a custom config option', async () => {
    const results: Results = {
      'foo.TXT': new FileResult(),
      'src/bar.ts': new FileResult(),
      'docs/zim.md': new FileResult(),
    };
    const startedAt = new Date('2001-02-03T04:05:06.007Z');

    const log = sinon.stub();
    const currentDate = sinon.stub().returns(startedAt);
    const unlinted = sinon.stub().resolves(results);
    const reportResults = sinon.stub();
    const exitProcess = sinon.stub();

    await command(['tsx', 'command.ts', '--config=config.json'], { log, currentDate, unlinted, reportResults, exitProcess });

    const progressManager: unknown = unlinted.getCall(0).args[0];
    assertStub.calledOnceWith(unlinted, [progressManager, undefined, 'config.json']);
    assertStub.calledOnceWith(reportResults, [results, getResultStats(results), startedAt]);
    assertStub.notCalled(exitProcess);
  });

  test('Runs correctly when passed a custom project path', async () => {
    const results: Results = {
      'foo.TXT': new FileResult(),
      'src/bar.ts': new FileResult(),
      'docs/zim.md': new FileResult(),
    };
    const startedAt = new Date('2001-02-03T04:05:06.007Z');

    const log = sinon.stub();
    const currentDate = sinon.stub().returns(startedAt);
    const unlinted = sinon.stub().resolves(results);
    const reportResults = sinon.stub();
    const exitProcess = sinon.stub();

    await command(['tsx', 'command.ts', 'src/'], { log, currentDate, unlinted, reportResults, exitProcess });

    const progressManager: unknown = unlinted.getCall(0).args[0];
    assertStub.calledOnceWith(unlinted, [progressManager, 'src/', undefined]);
    assertStub.calledOnceWith(reportResults, [results, getResultStats(results), startedAt]);
    assertStub.notCalled(exitProcess);
  });

  test('Runs correctly and exits with a non-zero code due to failures', async () => {
    const foo = new FileResult();
    foo.checks = 12;
    foo.failures = [
      { type: 'IGNORED_COMMITTED_FILE' },
      { type: 'UPPERCASE_EXTENSION' },
    ];

    const results: Results = {
      'foo.TXT': foo,
      'src/bar.ts': new FileResult(),
      'docs/zim.md': new FileResult(),
    };
    const startedAt = new Date('2001-02-03T04:05:06.007Z');

    const log = sinon.stub();
    const currentDate = sinon.stub().returns(startedAt);
    const unlinted = sinon.stub().resolves(results);
    const reportResults = sinon.stub();
    const exitProcess = sinon.stub();

    await command(['tsx', 'command.ts'], { log, currentDate, unlinted, reportResults, exitProcess });

    const progressManager: unknown = unlinted.getCall(0).args[0];
    assertStub.calledWith(log, [
      [''],
      [chalk.inverse(chalk.bold.cyan(' unlinted ')) + chalk.cyan(` version ${packageData.version}`)],
      [''],
    ]);
    assertStub.calledOnceWith(unlinted, [progressManager, undefined, undefined]);
    assertStub.calledOnceWith(reportResults, [results, getResultStats(results), startedAt]);
    assertStub.calledOnceWith(exitProcess, [1]);
  });
});
