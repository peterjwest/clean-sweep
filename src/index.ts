import { promises as fs } from 'fs';

import { BINARY_EXTENSIONS } from './defaults';
import { FAILURE_MESSAGES, Failure } from './failures';
import { RULES } from './rules';
import getProjectFiles from './getProjectFiles';
import getIgnoredCommittedFiles from './getIgnoredCommittedFiles';
import validateUtf8 from './validateUtf8';
import checkContent from './checkContent';
import checkFilePath from './checkFilePath';

async function main(): Promise<void> {
  const directory = './';
  const files = await getProjectFiles(directory);
  const failures: Record<string, Failure[]> = {};

  const nonBinaryFiles = files.filter((file) => !BINARY_EXTENSIONS.find((extension) => file.endsWith(extension)));

  const ignoredFiles = await getIgnoredCommittedFiles(directory);
  for (const file of ignoredFiles) {
    failures[file] = [{
      type: RULES.IGNORED_COMMITTED_FILE,
    }];
  }

  for (const file of nonBinaryFiles) {
    failures[file] = failures[file] || [];

    failures[file] = failures[file].concat(checkFilePath(file));

    const data = await fs.readFile(file);
    if (data.length) {
      failures[file] = failures[file].concat(validateUtf8(data));
      failures[file] = failures[file].concat(checkContent(data));
    }
  }

  for (const file in failures) {
    failures[file].sort((a, b) => ('line' in a ? a.line : 0) - ('line' in b ? b.line : 0));
  }

  for (const file in failures) {
    if (failures[file].length) {
      console.log(file);
      for (const failure of failures[file]) {
        console.log(FAILURE_MESSAGES[failure.type], failure);
      }
      console.log('');
    }
  }
}

main().catch(console.error);