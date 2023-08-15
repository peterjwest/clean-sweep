import multiline from 'multiline-ts';
import chalk from 'chalk';
import lodash from 'lodash';

import packageData from '../package.json';
import cleanSweep from './index';
import argvParser from './argvParser';
import { FAILURE_MESSAGES } from './failures';
import { toDateString, differenceInSeconds } from './util';
import ProgressManager from './ProgressManager';

export const commandHelp = multiline`
  Project-wide linting and hygiene

  Usage: npx clean-sweep [<path>] [--help] [--config=<config-path>]
  Description:
    Runs various checks on files in your git project.
    Includes staged & unstaged files, excluding gitignored files.

  Arguments:
    <path>
      Directory to run on, uses the Git project root if not specified

  Options:
    --config=<config-path>
      A path to the the TS, JS or JSON config file.
      The default value is "clean-sweep.config.ts" in the Git project root,
      falls back to "clean-sweep.config.js", and then "clean-sweep.config.json"

    --help
      Display this message
`;

/** Tests snippets as a command */
export default async function command(argv: string[]) {
  const { args, options } = argvParser(argv);
  const startedAt = new Date();

  console.log('\n' + chalk.inverse(chalk.bold.cyan(' clean-sweep ')) + chalk.cyan(' version ' + packageData.version) + '\n');

  if (options.help) {
    console.log(chalk.grey(commandHelp));
    return;
  }

  if (options.config === true) {
    throw new Error('--config must have a value with the format: --config=value');
  }

  const progressManager = new ProgressManager(process.stdout);

  const failures = await cleanSweep(progressManager, args.length > 0 ? args[0] : undefined, typeof options.config === 'string' ? options.config : undefined);

  progressManager.end();

  for (const file in failures) {
    // Non-null assertion since we're iterating over keys
    failures[file]!.sort((a, b) => ('line' in a ? a.line : 0) - ('line' in b ? b.line : 0));
  }

  console.log('');

  for (const file in failures) {
    // Non-null assertion since we're iterating over keys
    if (failures[file]!.length) {
      console.log(chalk.red.bold('×'), file);
      for (const failure of failures[file]!) {
        console.log(
          chalk.red(`${FAILURE_MESSAGES[failure.type]} ${'line' in failure ? `on line ${failure.line}` : ''}`),
          failure,
        );
      }
      console.log('');
    }
  }

  const fileFailures = Object.values(failures);
  const allFailures = lodash.flatten(fileFailures);
  const finishedAt = new Date();

  if (allFailures.length === 0) {
    console.log(chalk.inverse(chalk.bold.green(' Success ')));
  } else {
    console.log(chalk.inverse(chalk.bold.red(' Failure ')));

    console.log(chalk.grey(`Files checked  ${chalk.red(`${fileFailures.length} failed`)} / ${chalk.green(`<TODO> passed`)}`));
    console.log(chalk.grey(`Checks         ${chalk.red(`${allFailures.length} failed`)} / ${chalk.green(`<TODO> passed`)}`));
    console.log(chalk.grey(`Started at     ${toDateString(startedAt)}`));
    console.log(chalk.grey(`Duration       ${differenceInSeconds(startedAt, finishedAt)} seconds`));
    console.log('');

    process.exit(1);
  }
}
