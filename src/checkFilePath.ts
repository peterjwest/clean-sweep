import path from 'path';

import { RULES } from './rules';
import { Failure } from './failures';

function getExtension(filename: string): string | undefined {
  const match = path.basename(filename).match(/(\.[^.]+)+$/);
  return match ? match[0] : undefined;
}

export default function checkFilePath(filePath: string): Failure[] {
  const failures: Failure[] = [];

  const extension = getExtension(filePath);
  if (extension === '.DS_Store') {
    failures.push({ type: RULES.DS_STORE });
    return failures;
  }

  if (extension && extension.match(/[A-Z]/)) {
    failures.push({ type: RULES.UPPERCASE_EXTENSION });
  }

  return failures;
}