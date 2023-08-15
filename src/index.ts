import "@total-typescript/ts-reset";
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

import { Failure } from './failures';
import { RULES } from './rules';
import { getProjectDir, getProjectFiles, getIgnoredCommittedFiles } from './util';
import validateUtf8 from './validateUtf8';
import checkContent from './checkContent';
import checkFilePath from './checkFilePath';
import getConfig from './getConfig';
import ProgressManager from './ProgressManager';

export default async function cleanSweep(progress: ProgressManager, userDirectory?: string, userConfigPath?: string): Promise<Record<string, Failure[]>> {
  const directory = userDirectory || './';

  const projectDir = await getProjectDir(directory).catch(() => {
    throw new Error(`The directory ${resolve(process.cwd(), directory)} is not a git project`);
  });
  progress.addSection(`Git project directory: ${projectDir}`);

  const [config, configPath] = await getConfig(projectDir, userConfigPath);
  progress.addSection(configPath ? `Using config file: ${configPath}` : 'Using default config');

  if (!config.enabled) {
    progress.addSection('All checks disabled, exiting');
    return {};
  }

  progress.addSection('Loading project files');

  const files = config.filterFiles(await getProjectFiles(directory));
  const failures: Record<string, Failure[]> = {};

  const pathConfig = config.rules.PATH_VALIDATION;
  const ignoreCommittedConfig = pathConfig.rules.IGNORED_COMMITTED_FILE;

  if (pathConfig.enabled && ignoreCommittedConfig.enabled) {
    progress.addSection('Checking for ignored committed files');

    const ignoredFiles = ignoreCommittedConfig.filterFiles(await getIgnoredCommittedFiles(directory));

    if (ignoredFiles.length) {
      progress.sectionFailed();
      for (const file of ignoredFiles) {
        failures[file] = [{ type: RULES.IGNORED_COMMITTED_FILE }];
      }
    }
  }

  if (pathConfig.enabled) {
    progress.addSection('Checking file paths');

    for (const file of pathConfig.filterFiles(files)) {
      const pathFailures = checkFilePath(file, pathConfig);

      if (pathFailures.length) progress.sectionFailed();
      failures[file] = (failures[file] || []).concat(pathFailures);
    }
  }

  const contentConfig = config.rules.CONTENT_VALIDATION;
  if (contentConfig.enabled) {
    const contentFiles = contentConfig.filterFiles(files);
    progress.addSection('Checking file contents', contentFiles.length);

    for (const file of contentFiles) {
      progress.progressBarMessage(file);

      let contentFailures = failures[file] || [];

      const data = await fs.readFile(join(projectDir, file));
      if (data.length) {
        contentFailures = contentFailures.concat(checkContent(file, data, contentConfig));
      }

      if (contentFailures.length) progress.sectionFailed();
      failures[file] = contentFailures;

      progress.incrementProgress(contentFailures.length === 0);
    }

    if (contentConfig.rules.UTF8_VALIDATION.enabled) {
      const utf8Files = contentConfig.filterFiles(files);
      progress.addSection('Checking UTF8 encoding', utf8Files.length);

      for (const file of utf8Files) {
        progress.progressBarMessage(file);

        let utfFailures = failures[file] || [];

        const data = await fs.readFile(join(projectDir, file));
        if (data.length) {
          utfFailures = utfFailures.concat(await validateUtf8(file, data, contentConfig.rules.UTF8_VALIDATION));
        }

        if (utfFailures.length) progress.sectionFailed();
        failures[file] = utfFailures;

        progress.incrementProgress(utfFailures.length === 0);
      }
    }
  }

  return failures;
}
