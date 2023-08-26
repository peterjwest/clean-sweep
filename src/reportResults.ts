import chalk from 'chalk';

import { FAILURE_MESSAGES, Failure } from './failures';
import { currentDate, toDateString, differenceInSeconds, Results, ResultStats } from './util';

/** Outputs results of analysis */
export default function reportResults(results: Results, stats: ResultStats, startedAt: Date, deps = { log: console.log, currentDate }) {
  deps.log('');

  for (const file in results) {
    // Non-null assertion since we're iterating over keys
    const fileData = results[file]!;

    if (fileData.failures.length) {
      fileData.failures.sort((a, b) => ('line' in a ? a.line : 0) - ('line' in b ? b.line : 0));

      deps.log(chalk.red.bold('×'), file);
      for (const failure of fileData.failures) {
        const getMessage = FAILURE_MESSAGES[failure.type] as (failure: Failure) => string;
        deps.log(`${chalk.red(getMessage(failure))} ${chalk.grey('| ' + failure.type)}`);
      }
      deps.log('');
    }
  }

  deps.log(chalk.inverse(stats.checks.failed > 0 ? chalk.bold.red(' Failure ') : chalk.bold.green(' Success ')));

  const failedFiles = stats.files.failed > 0 ? `${chalk.red(`${stats.files.failed} failed`)} / ` : '';
  deps.log(chalk.grey(`Files checked  ${failedFiles}${chalk.green(`${stats.files.passed} passed`)}`));

  const failedChecks = stats.checks.failed > 0 ? `${chalk.red(`${stats.checks.failed} failed`)} / ` : '';
  deps.log(chalk.grey(`Checks         ${failedChecks}${chalk.green(`${stats.checks.passed} passed`)}`));

  deps.log(chalk.grey(`Started at     ${toDateString(startedAt)}`));
  deps.log(chalk.grey(`Duration       ${differenceInSeconds(startedAt, deps.currentDate())} seconds`));
  deps.log('');
}
