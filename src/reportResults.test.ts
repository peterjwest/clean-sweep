import { describe, test } from 'vitest';
import sinon from 'sinon';
import assertStub from 'sinon-assert-stub';
import chalk from 'chalk';

import reportResults from './reportResults';
import { getResultStats, FileResult, Results } from './util';

describe('reportResults', () => {
  test('Logs empty results', () => {
    const startedAt = new Date('2001-02-03T04:05:06.007Z');
    const endedAt = new Date('2001-02-03T04:06:07.089Z');

    const currentDate = sinon.stub().returns(endedAt);
    const log = sinon.stub();

    const results: Results = {};

    reportResults(results, getResultStats(results), startedAt, { log, currentDate });
    assertStub.calledWith(log, [
      [''],
      [chalk.inverse.bold.green(' Success ')],
      [chalk.grey(`Files checked  ${chalk.green('0 passed')}`)],
      [chalk.grey(`Checks         ${chalk.green('0 passed')}`)],
      [chalk.grey('Started at     04:05:06 (2001-02-03)')],
      [chalk.grey('Duration       61.08 seconds')],
      [''],
    ]);
  });

  test('Logs successful results', () => {
    const startedAt = new Date('2001-02-03T04:05:06.007Z');
    const endedAt = new Date('2001-02-03T04:06:07.089Z');

    const currentDate = sinon.stub().returns(endedAt);
    const log = sinon.stub();

    const foo = new FileResult();
    foo.checks = 12;

    const bar = new FileResult();
    bar.checks = 7;

    const results: Results = {
      foo,
      bar,
    };

    reportResults(results, getResultStats(results), startedAt, { log, currentDate });
    assertStub.calledWith(log, [
      [''],
      [chalk.inverse.bold.green(' Success ')],
      [chalk.grey(`Files checked  ${chalk.green('2 passed')}`)],
      [chalk.grey(`Checks         ${chalk.green('19 passed')}`)],
      [chalk.grey('Started at     04:05:06 (2001-02-03)')],
      [chalk.grey('Duration       61.08 seconds')],
      [''],
    ]);
  });

  test('Logs failed results', () => {
    const startedAt = new Date('2001-02-03T04:05:06.007Z');
    const endedAt = new Date('2001-02-03T04:06:07.089Z');

    const currentDate = sinon.stub().returns(endedAt);
    const log = sinon.stub();

    const foo = new FileResult();
    foo.checks = 12;
    foo.failures = [
      { type: 'IGNORED_COMMITTED_FILE' },
      { type: 'UPPERCASE_EXTENSION' },
    ];

    const bar = new FileResult();
    bar.checks = 7;
    bar.failures = [
      {
        type: 'MALFORMED_ENCODING',
        guessedEncoding: 'utf8',
        confidence: 95,
      },
      {
        type: 'TAB',
        lines: [1, 2, 3],
      },
      {
        type: 'CARRIAGE_RETURN',
        line: 18,
      },
      {
        type: 'NO_FINAL_NEWLINE',
        line: 6,
      },
      {
        type: 'CARRIAGE_RETURN',
        line: 7,
      },
    ];

    const zim = new FileResult();
    zim.checks = 3;

    const results: Results = {
      'foo.TXT': foo,
      'src/bar.ts': bar,
      'docs/zim.md': zim,
    };

    reportResults(results, getResultStats(results), startedAt, { log, currentDate });
    assertStub.calledWith(log, [
      [''],
      [chalk.red.bold('×'), 'foo.TXT'],
      [`${chalk.red('Committed file which should be gitignored')} ${chalk.grey(`| IGNORED_COMMITTED_FILE`)}`],
      [`${chalk.red('Uppercase file extension')} ${chalk.grey(`| UPPERCASE_EXTENSION`)}`],
      [''],
      [chalk.red.bold('×'), 'src/bar.ts'],
      [`${chalk.red('Malformed encoding, guessed to be utf8')} ${chalk.grey(`| MALFORMED_ENCODING`)}`],
      [`${chalk.red('Uses tabs on lines 1, 2, 3')} ${chalk.grey(`| TAB`)}`],
      [`${chalk.red('Does not have a final newline')} ${chalk.grey(`| NO_FINAL_NEWLINE`)}`],
      [`${chalk.red('Uses carriage returns on line 7')} ${chalk.grey(`| CARRIAGE_RETURN`)}`],
      [`${chalk.red('Uses carriage returns on line 18')} ${chalk.grey(`| CARRIAGE_RETURN`)}`],
      [''],
      [chalk.inverse.bold.red(' Failure ')],
      [chalk.grey(`Files checked  ${chalk.red('2 failed')} / ${chalk.green('1 passed')}`)],
      [chalk.grey(`Checks         ${chalk.red('6 failed')} / ${chalk.green('16 passed')}`)],
      [chalk.grey('Started at     04:05:06 (2001-02-03)')],
      [chalk.grey('Duration       61.08 seconds')],
      [''],
    ]);
  });
});
