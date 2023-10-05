#!/usr/bin/env ./node_modules/.bin/tsx

import argvParser from '../../../src/argvParser';
import { parseConfig } from '../../../src/getConfig';

(async function main() {
  const { args } = argvParser(process.argv);
  const path = '../' + args[0] as string;
  const config = (await import(path)).default;

  parseConfig(config)
  console.log('Config valid');

})().catch((error) => {
  console.error('Config invalid');
  console.error(error);
  process.exit(1);
})
