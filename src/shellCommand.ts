#!/usr/bin/env node

import chalk from 'chalk';

import command from './command';

command(process.argv).catch((error: Error) => {
  console.log(chalk.red(`Error: ${error.message}`));
  process.exit(1);
});
