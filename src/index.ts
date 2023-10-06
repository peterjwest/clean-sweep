import "@total-typescript/ts-reset";
import { resolve } from 'path';
import lodash from 'lodash';

import { RULES } from './rules';
import { ExtendedPathConfig } from './config';
import { mergeResults, getProjectDir, getProjectFiles, getFileContent, getIgnoredCommittedFiles, Results, FileResult } from './util';
import validateUtf8 from './validateUtf8';
import checkContent from './checkContent';
import checkFilePath from './checkFilePath';
import getConfig from './getConfig';
import extendConfig from './extendConfig';
import runChecks from './runChecks';
import ProgressManager from './ProgressManager';

export type { Config, UserConfig } from './config';
export { DEFAULT_CONTENT_EXCLUDED } from './constants';

/** Checks for files which are both ignored and committed */
export async function checkIgnoredCommitted(
  directory: string,
  progress: ProgressManager,
  config: ExtendedPathConfig['rules']['IGNORED_COMMITTED_FILE'],
  deps = { getIgnoredCommittedFiles },
): Promise<Results> {
  progress.addSection('Checking for ignored committed files');
  const ignoredFiles = config.filterFiles(await deps.getIgnoredCommittedFiles(directory));

  if (ignoredFiles.length) progress.sectionFailed();
  return lodash.fromPairs(ignoredFiles.map((file) => [
    file,
    new FileResult(1, [{ type: RULES.IGNORED_COMMITTED_FILE }]),
  ]));
}

/** Lints a project with an optional user directory */
export default async function unlinted(
  progress: ProgressManager,
  userDirectory?: string,
  userConfigPath?: string,
  deps = {
    getProjectDir,
    getConfig,
    getProjectFiles,
    getIgnoredCommittedFiles,
    getFileContent,
    validateUtf8,
    extendConfig,
    checkIgnoredCommitted,
    checkFilePath,
    checkContent,
    cwd: process.cwd.bind(process),
  },
): Promise<Results> {

  const directory = userDirectory || './';
  const projectDir = await deps.getProjectDir(directory).catch(() => {
    throw new Error(`The directory ${resolve(deps.cwd(), directory)} is not a git project`);
  });

  progress.addSection(`Git project directory: ${projectDir}`);
  progress.addSection(`Directory to analyse: ${resolve(deps.cwd(), directory)}`);

  const [plainConfig, configPath] = await deps.getConfig(projectDir, userConfigPath);
  const config = deps.extendConfig(plainConfig);

  progress.addSection(configPath ? `Using config file: ${configPath}` : 'Using default config');

  let results: Results = {};

  if (!config.enabled) {
    progress.addSection('All checks disabled, exiting');
    return results;
  }

  progress.addSection('Loading project file list');
  const files = config.filterFiles(await deps.getProjectFiles(directory));

  const pathConfig = config.rules.PATH_VALIDATION;
  const ignoreCommittedConfig = pathConfig.rules.IGNORED_COMMITTED_FILE;

  if (pathConfig.enabled) {
    if (ignoreCommittedConfig.enabled) {
      results = mergeResults(results, await deps.checkIgnoredCommitted(directory, progress, ignoreCommittedConfig));
    }

    results = mergeResults(results, await runChecks('Checking file paths', files, progress, pathConfig, (file, config) => {
      return deps.checkFilePath(file, config);
    }));
  }

  const contentConfig = config.rules.CONTENT_VALIDATION;
  if (contentConfig.enabled) {
    results = mergeResults(results, await runChecks('Checking file contents', files, progress, contentConfig, async (file, config) => {
      return deps.checkContent(file, await deps.getFileContent(projectDir, file), config);
    }));

    const utf8Config = contentConfig.rules.UTF8_VALIDATION;
    if (utf8Config.enabled) {
      results = mergeResults(results, await runChecks('Checking UTF8 encoding', files, progress, utf8Config, async (file, config) => {
        return deps.validateUtf8(file, await deps.getFileContent(projectDir, file), config);
      }));
    }
  }

  return results;
}
