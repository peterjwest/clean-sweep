import "@total-typescript/ts-reset";
import { promises as fs } from 'fs';

import { FAILURE_MESSAGES, Failure } from './failures';
import { RULES } from './rules';
import { getProjectFiles, getIgnoredCommittedFiles } from './util';
import validateUtf8 from './validateUtf8';
import checkContent from './checkContent';
import checkFilePath from './checkFilePath';
import getConfig from './getConfig';

async function main(): Promise<void> {
  const [config, configPath] = await getConfig();
  console.log(configPath ? 'Using default config' : `Using config file: ${configPath}`);

  if (!config.enabled) {
    console.log('All checks disabled, exiting.');
    return;
  }

  const directory = './';
  const projectFiles = await getProjectFiles(directory);
  const failures: Record<string, Failure[]> = {};

  const files = config.filterFiles(projectFiles);

  const pathConfig = config.rules.PATH_VALIDATION;
  const ignoreCommittedConfig = pathConfig.rules.IGNORED_COMMITTED_FILE;
  if (pathConfig.enabled && ignoreCommittedConfig.enabled) {
    const ignoredFiles = await getIgnoredCommittedFiles(directory);

    for (const file of ignoreCommittedConfig.filterFiles(ignoredFiles)) {
      failures[file] = [{
        type: RULES.IGNORED_COMMITTED_FILE,
      }];
    }
  }

  for (const file of pathConfig.filterFiles(files)) {
    failures[file] = (failures[file] || []).concat(checkFilePath(file, pathConfig));
  }

  const contentConfig = config.rules.CONTENT_VALIDATION;
  for (const file of contentConfig.filterFiles(files)) {
    let fileFailures = failures[file] || [];

    const data = await fs.readFile(file);
    if (data.length) {
      if (contentConfig.rules.UTF8_VALIDATION.enabled) {
        fileFailures = fileFailures.concat(validateUtf8(file, data, contentConfig.rules.UTF8_VALIDATION));
      }
      fileFailures = fileFailures.concat(checkContent(file, data, contentConfig));
    }

    failures[file] = fileFailures;
  }

  for (const file in failures) {
    const fileFailures = failures[file];
    // TODO: Improve types to remove condition here
    if (fileFailures) {
      fileFailures.sort((a, b) => ('line' in a ? a.line : 0) - ('line' in b ? b.line : 0));
    }
  }

  for (const file in failures) {
    const fileFailures = failures[file];
    // TODO: Improve types to remove condition here
    if (fileFailures && fileFailures.length) {
      console.log(file);
      for (const failure of fileFailures) {
        console.log(FAILURE_MESSAGES[failure.type], failure);
      }
      console.log('');
    }
  }
}

main().catch(console.error);