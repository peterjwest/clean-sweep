import "@total-typescript/ts-reset";
import { join, resolve } from 'path';

import { RULES } from './rules';
import { getProjectDir, getProjectFiles, getFileContent, getIgnoredCommittedFiles, getFileResult, Results } from './util';
import validateUtf8 from './validateUtf8';
import checkContent from './checkContent';
import checkFilePath from './checkFilePath';
import getConfig from './getConfig';
import ProgressManager from './ProgressManager';

export type { Config, UserConfig } from './config';

export default async function unlinted(
  progress: ProgressManager,
  userDirectory?: string,
  userConfigPath?: string,
): Promise<Results> {

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

  progress.addSection('Loading project file list');

  const files = config.filterFiles(await getProjectFiles(directory));
  const results: Results = {};

  const pathConfig = config.rules.PATH_VALIDATION;
  const ignoreCommittedConfig = pathConfig.rules.IGNORED_COMMITTED_FILE;

  if (pathConfig.enabled && ignoreCommittedConfig.enabled) {
    progress.addSection('Checking for ignored committed files');

    const ignoredFiles = ignoreCommittedConfig.filterFiles(await getIgnoredCommittedFiles(directory));

    if (ignoredFiles.length) {
      progress.sectionFailed();
      for (const file of ignoredFiles) {
        const fileResult = getFileResult(results, file);
        fileResult.failures.push({ type: RULES.IGNORED_COMMITTED_FILE });
        fileResult.checks++;
      }
    }
  }

  if (pathConfig.enabled) {
    progress.addSection('Checking file paths');

    for (const file of pathConfig.filterFiles(files)) {
      const fileResult = getFileResult(results, file);
      const result = checkFilePath(file, pathConfig);
      fileResult.mergeWith(result);

      if (result.failures.length) progress.sectionFailed();
    }
  }

  const contentConfig = config.rules.CONTENT_VALIDATION;
  if (contentConfig.enabled) {
    const contentFiles = contentConfig.filterFiles(files);
    progress.addSection('Checking file contents', contentFiles.length);

    for (const file of contentFiles) {
      progress.progressBarMessage(file);

      const data = await getFileContent(join(projectDir, file));
      if (!data.length) {
        progress.incrementProgress(true);
        continue;
      }

      const fileResult = getFileResult(results, file);
      const result = checkContent(file, data, contentConfig);
      fileResult.mergeWith(result);

      if (result.failures.length) progress.sectionFailed();
      progress.incrementProgress(result.failures.length === 0);
    }

    if (contentConfig.rules.UTF8_VALIDATION.enabled) {
      const utf8Files = contentConfig.filterFiles(files);
      progress.addSection('Checking UTF8 encoding', utf8Files.length);

      for (const file of utf8Files) {
        progress.progressBarMessage(file);

        const fileResult = getFileResult(results, file);

        // We only want to analyse files which are invalid UTF8
        if (!fileResult.failures.find((failure) => failure.type === RULES.MALFORMED_ENCODING)) {
          progress.incrementProgress(true);
          continue;
        }

        const data = await getFileContent(join(projectDir, file));
        if (!data.length) {
          progress.incrementProgress(true);
          continue;
        }

        const result = await validateUtf8(file, data, contentConfig.rules.UTF8_VALIDATION);
        fileResult.mergeWith(result);

        if (result.failures.length) progress.sectionFailed();
        progress.incrementProgress(result.failures.length === 0);
      }
    }
  }

  return results;
}
