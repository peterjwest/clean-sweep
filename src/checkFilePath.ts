import path from 'path';

import { RULES } from './rules';
import { PathConfig } from './config';
import { Failure } from './failures';

/** Gets the extension for a file (including multiple extensions), or undefined if it has no extension */
function getExtension(filePath: string): string | undefined {
  const match = path.basename(filePath).match(/(\.[^.]+)+$/);
  return match ? match[0] : undefined;
}

/** Runs checks on the file path */
export default function checkFilePath(filePath: string, config: PathConfig): Failure[] {
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