#!/usr/bin/env node

import chalk from 'chalk';

import command from './command';
import { ErrorWithFailures } from './util';

command(process.argv).catch((error: Error) => {
  if (error instanceof ErrorWithFailures) {
    console.log(chalk.red(`Error: ${error.message}`));
    for (const failure of error.failures) {
      console.log(chalk.red(`> ${failure}`));
    }
  } else {
    console.log(chalk.red(`Error: ${error.message}`));
  }
  process.exit(1);
});
