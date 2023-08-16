import multiline from 'multiline-ts';
import chalk from 'chalk';


import packageData from '../package.json';
import unlinted from './index';
import argvParser from './argvParser';
import reportResults from './reportResults';
import ProgressManager from './ProgressManager';
import { getResultStats } from './util';

export const commandHelp = multiline`
  Project-wide linting and hygiene

  Usage: npx unlinted [<path>] [--help] [--config=<config-path>]
  Description:
    Runs various checks on files in your git project.
    Includes staged & unstaged files, excluding gitignored files.

  Arguments:
    <path>
      Directory to run on, uses the Git project root if not specified

  Options:
    --config=<config-path>
      A path to the the TS, JS or JSON config file.
      The default value is "unlinted.config.ts" in the Git project root,
      falls back to "unlinted.config.js", and then "unlinted.config.json"

    --help
      Display this message
`;

/** Tests snippets as a command */
export default async function command(argv: string[]) {
  const { args, options } = argvParser(argv);
  const startedAt = new Date();

  console.log('\n' + chalk.inverse(chalk.bold.cyan(' unlinted ')) + chalk.cyan(' version ' + packageData.version) + '\n');

  if (options.help) {
    console.log(chalk.grey(commandHelp));
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
