import path from 'path';

import { RULES } from './rules';
import { ExtendedPathConfig } from './config';
import { Failure } from './failures';

/** Gets the extension for a file (including multiple extensions), or undefined if it has no extension */
function getExtension(filePath: string): string | undefined {
  const match = path.basename(filePath).match(/(\.[^.]+)+$/);
  return match ? match[0] : undefined;
}

/** Runs checks on file paths */
export default function checkFilePath(filePath: string, config: ExtendedPathConfig): Failure[] {
  const failures: Failure[] = [];
  const extension = getExtension(filePath);

  if (config.rules.DS_STORE.enabledFor(filePath)) {
    if (extension === '.DS_Store') {
      failures.push({ type: RULES.DS_STORE });
      return failures;
    }
  }

  if (config.rules.UPPERCASE_EXTENSION.enabledFor(filePath)) {
    if (extension && extension.match(/[A-Z]/)) {
      failures.push({ type: RULES.UPPERCASE_EXTENSION });
    }
  }

  return failures;
}