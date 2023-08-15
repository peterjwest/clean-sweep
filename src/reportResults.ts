import chalk from 'chalk';

import { FAILURE_MESSAGES } from './failures';
import { toDateString, differenceInSeconds, Results, ResultStats } from './util';

export default function reportResults(results: Results, stats: ResultStats, startedAt: Date) {
  console.log('');

  for (const file in results) {
    // Non-null assertion since we're iterating over keys
    const fileData = results[file]!;

    if (fileData.failures.length) {
      fileData.failures.sort((a, b) => ('line' in a ? a.line : 0) - ('line' in b ? b.line : 0));

      console.log(chalk.red.bold('×'), file);
      for (const failure of fileData.failures) {
        console.log(
          chalk.red(`${FAILURE_MESSAGES[failure.type]} ${'line' in failure ? `on line ${failure.line}` : ''}`),
          failure,
        );
      }
      console.log('');
    }
  }

  console.log(chalk.inverse(stats.checks.failed > 0 ? chalk.bold.red(' Failure ') : chalk.bold.green(' Success ')));

  const failedFiles = stats.files.failed > 0 ? `${chalk.red(`${stats.files.failed} failed`)} / ` : '';
  console.log(chalk.grey(`Files checked  ${failedFiles}${chalk.green(`${stats.files.passed} passed`)}`));

  const failedChecks = stats.checks.failed > 0 ? `${chalk.red(`${stats.checks.failed} failed`)} / ` : '';
  console.log(chalk.grey(`Checks         ${failedChecks}${chalk.green(`${stats.checks.passed} passed`)}`));

  console.log(chalk.grey(`Started at     ${toDateString(startedAt)}`));
  console.log(chalk.grey(`Duration       ${differenceInSeconds(startedAt, new Date())} seconds`));
  console.log('');
}
