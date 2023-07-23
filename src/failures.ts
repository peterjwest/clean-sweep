import { Rule } from './rules';

interface SomeFailure { type: Rule }

interface DsStoreFailure extends SomeFailure {
  type: 'DS_STORE';
}

interface UppercaseExtensionFailure extends SomeFailure {
  type: 'UPPERCASE_EXTENSION';
}

interface InvalidByteFailure extends SomeFailure {
  type: 'INVALID_BYTE';
  value: string;
  line: number;
}

interface UnexpectedContinuationByteFailure extends SomeFailure {
  type: 'UNEXPECTED_CONTINUATION_BYTE';
  value: string;
  line: number;
}

interface MissingContinuationByteFailure extends SomeFailure {
  type: 'MISSING_CONTINUATION_BYTE';
  expectedBytes: number;
  value: string;
  line: number;
}

interface MalformedEncodingFailure extends SomeFailure {
  type: 'MALFORMED_ENCODING';
  guessedEncoding: string;
  confidence: number;
}

interface UnexpectedEncodingFailure extends SomeFailure {
  type: 'UNEXPECTED_ENCODING';
  encoding: string;
}

interface CarriageReturnFailure extends SomeFailure {
  type: 'CARRIAGE_RETURN';
  line: number;
}

interface TabFailure extends SomeFailure {
  type: 'TAB';
  line: number;
}

interface TrailingWhitespaceFailure extends SomeFailure {
  type: 'TRAILING_WHITESPACE';
  line: number;
}

interface MultipleFinalNewlinesFailure extends SomeFailure {
  type: 'MULTIPLE_FINAL_NEWLINES';
  line: number;
}

interface NoFinalNewlineFailure extends SomeFailure {
  type: 'NO_FINAL_NEWLINE';
  line: number;
}

interface UnexpectedCharacterFailure extends SomeFailure {
  type: 'UNEXPECTED_CHARACTER';
  value: string;
  line: number;
}

export type Failure = (
  | DsStoreFailure
  | UppercaseExtensionFailure
  | InvalidByteFailure
  | UnexpectedContinuationByteFailure
  | MissingContinuationByteFailure
  | MalformedEncodingFailure
  | UnexpectedEncodingFailure
  | CarriageReturnFailure
  | TabFailure
  | TrailingWhitespaceFailure
  | MultipleFinalNewlinesFailure
  | NoFinalNewlineFailure
  | UnexpectedCharacterFailure
);

export const FAILURE_MESSAGES = {
  DS_STORE: 'Committed .DS_Store files',
  UPPERCASE_EXTENSION: 'Uppercase file extension',
  INVALID_BYTE: 'Invalid byte',
  UNEXPECTED_CONTINUATION_BYTE: 'Unexpected continuation byte',
  MISSING_CONTINUATION_BYTE: 'Missing continuation byte',
  MALFORMED_ENCODING: 'Malformed encoding',
  UNEXPECTED_ENCODING: 'Unexpected encoding',
  CARRIAGE_RETURN: 'Uses carriage returns',
  TAB: 'Uses tabs',
  TRAILING_WHITESPACE: 'Has trailing whitespace',
  MULTIPLE_FINAL_NEWLINES: 'Has multiple final newlines',
  NO_FINAL_NEWLINE: 'Does not have a final newline',
  UNEXPECTED_CHARACTER: 'Has a non-ASCII, non-unicode letter, non-emoji character',
} as const satisfies { [Key in Rule]: string };