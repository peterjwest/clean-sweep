import { createEnum } from './util';

/** All possible rules to be checked */
export const RULES = createEnum([
  'DS_STORE',
  'UPPERCASE_EXTENSION',
  'IGNORED_COMMITTED_FILE',
  'INVALID_BYTE',
  'UNEXPECTED_CONTINUATION_BYTE',
  'MISSING_CONTINUATION_BYTE',
  'OVERLONG_BYTE_SEQUENCE',
  'INVALID_CODE_POINT',
  'MALFORMED_ENCODING',
  'UNEXPECTED_ENCODING',
  'CARRIAGE_RETURN',
  'TAB',
  'TRAILING_WHITESPACE',
  'MULTIPLE_FINAL_NEWLINES',
  'NO_FINAL_NEWLINE',
  'UNEXPECTED_CHARACTER',
]);

/** All groups of rules */
export const RULESETS = createEnum([
  'PATH_VALIDATION',
  'CONTENT_VALIDATION',
  'UTF8_VALIDATION',
]);

export type RuleName = keyof typeof RULES;
export type RulesetName = keyof typeof RULESETS;