import path from 'path';

import { RULES } from './rules';
import { ExtendedPathConfig } from './config';
import { FileResult } from './util';

/** Gets the extension for a file (including multiple extensions), or undefined if it has no extension */
export function getExtension(filePath: string): string | undefined {
  const match = path.basename(filePath).match(/(\.[^.]+)+$/);
  return match ? match[0] : undefined;
}

/** Runs checks on file paths, returning FileResult of those checks */
export default function checkFilePath(filePath: string, config: ExtendedPathConfig): FileResult {
  const result = new FileResult();
  const extension = getExtension(filePath);

  if (config.rules.DS_STORE.enabledFor(filePath)) {
    result.checks++;
    if (extension === '.DS_Store') {
      result.failures.push({ type: RULES.DS_STORE });
    }
  }

  if (config.rules.UPPERCASE_EXTENSION.enabledFor(filePath)) {
    result.checks++;
    if (extension && extension.match(/[A-Z]/) && extension !== '.DS_Store') {
      result.failures.push({ type: RULES.UPPERCASE_EXTENSION });
    }
  }

  return result;
}
