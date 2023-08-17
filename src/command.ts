import multiline from 'multiline-ts';
import chalk from 'chalk';


import packageData from '../package.json';
import unlinted from './index';
import argvParser from './argvParser';
import reportResults from './reportResults';
import ProgressManager from './ProgressManager';
import { getResultStats } from './util';

export const commandHelp = multiline`
${chalk.cyan('Project-wide linting and hygiene')}

  Usage: npx unlinted [<path>] [--help] [--config=<config-path>]
  Description:
    ${chalk.grey('Runs various checks on files in your git project.')}
    ${chalk.grey('Includes staged & unstaged files, excludes gitignored files.')}

  Arguments:
    <path>
    ${chalk.grey('Directory to run on, uses the Git project root if not specified')}

  Options:
    --config=<config-path>
      ${chalk.grey('A path to the the TS, JS or JSON config file.')}
      ${chalk.grey('The default value is "unlinted.config.ts" in the Git project root,')}
      ${chalk.grey('falls back to "unlinted.config.js", and then "unlinted.config.json"')}

    --help
    ${chalk.grey('Display this message')}

`;

/** Run unlinted as a command */
export default async function command(argv: string[]) {
  const { args, options } = argvParser(argv);
  const startedAt = new Date();

  console.log('\n' + chalk.inverse(chalk.bold.cyan(' unlinted ')) + chalk.cyan(' version ' + packageData.version) + '\n');

  if (options.help) {
    console.log(commandHelp);
    return;
  }

  if (options.config === true) {
    throw new Error('--config must have a value with the format: --config=value');
  }

  const results = await ProgressManager.manage(
    process.stdout,
    (progress) => unlinted(progress, args.length > 0 ? args[0] : undefined, typeof options.config === 'string' ? options.config : undefined),
  );


  const stats = getResultStats(results);
  reportResults(results, stats, startedAt);

  if (stats.files.failed > 0) {
    process.exit(1);
  }
}
