import ProgressManager from './ProgressManager';
import { AnyExtendedConfig } from './config';
import { Results, FileResult } from './util';

/** Runs checks against files included by a config */
export default async function runChecks<Config extends AnyExtendedConfig>(
  title: string,
  files: string[],
  progress: ProgressManager,
  config: Config,
  check: (file: string, config: Config) => FileResult | Promise<FileResult>,
): Promise<Results> {
  const includedFiles = config.filterFiles(files);
  progress.addSection(title, includedFiles.length);

  const results: Results = {};
  for (const file of includedFiles) {
    progress.progressBarMessage(file);

    const result = await check(file, config);
    if (result.failures.length) progress.sectionFailed();
    progress.incrementProgress(result.failures.length === 0);
    results[file] = result;
  }
  return results;
}
