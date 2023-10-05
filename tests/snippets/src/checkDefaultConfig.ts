#!/usr/bin/env ./node_modules/.bin/tsx

import assert from 'assert';

import { DEFAULT_CONFIG } from '../../../src/config';
import argvParser from '../../../src/argvParser';

(async function main() {
  const { args } = argvParser(process.argv);
  const path = '../' + args[0] as string;
  const config = (await import(path)).default;

  assert.deepStrictEqual(config, DEFAULT_CONFIG);
  console.log('Config matches default config');

})().catch((error) => {
  console.error('Config does not match default config');
  console.error(error);
  process.exit(1);
})
