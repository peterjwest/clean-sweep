import { createEnum } from './util';

/** All possible rules to be checked */
export const RULES = createEnum([
  'DS_STORE',
  'UPPERCASE_EXTENSION',
  'IGNORED_COMMITTED_FILE',
  'INVALID_BYTE',
  'UNEXPECTED_CONTINUATION_BYTE',
  'MISSING_CONTINUATION_BYTE',
  'MALFORMED_ENCODING',
  'UNEXPECTED_ENCODING',
  'CARRIAGE_RETURN',
  'TAB',
  'TRAILING_WHITESPACE',
  'MULTIPLE_FINAL_NEWLINES',
  'NO_FINAL_NEWLINE',
  'UNEXPECTED_CHARACTER',
]);

export type Rule = keyof typeof RULES;