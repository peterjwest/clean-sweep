#!/usr/bin/env node

import chalk from 'chalk';

import command, { formatCommandError } from './command';

command(process.argv).catch((error: unknown) => {
  console.error(chalk.red(formatCommandError(error)));
  process.exit(1);
});
