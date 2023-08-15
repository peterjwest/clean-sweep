import { RuleName } from './rules';

interface SomeFailure { type: RuleName }

interface DsStoreFailure extends SomeFailure {
  type: 'DS_STORE';
}

interface UppercaseExtensionFailure extends SomeFailure {
  type: 'UPPERCASE_EXTENSION';
}

interface IgnoredCommittedFileFailure extends SomeFailure {
  type: 'IGNORED_COMMITTED_FILE';
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

interface OverlongByteSequenceFailure extends SomeFailure {
  type: 'OVERLONG_BYTE_SEQUENCE';
  value: string;
  line: number;
}

interface InvalidCodePointFailure extends SomeFailure {
  type: 'INVALID_CODE_POINT';
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
  lines: number[];
}

interface TrailingWhitespaceFailure extends SomeFailure {
  type: 'TRAILING_WHITESPACE';
  lines: number[];
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
  lines: number[];
}

/** Union of all possible failures */
export type Failure = (
  | DsStoreFailure
  | UppercaseExtensionFailure
  | IgnoredCommittedFileFailure
  | InvalidByteFailure
  | UnexpectedContinuationByteFailure
  | MissingContinuationByteFailure
  | OverlongByteSequenceFailure
  | InvalidCodePointFailure
  | MalformedEncodingFailure
  | UnexpectedEncodingFailure
  | CarriageReturnFailure
  | TabFailure
  | TrailingWhitespaceFailure
  | MultipleFinalNewlinesFailure
  | NoFinalNewlineFailure
  | UnexpectedCharacterFailure
);

/** Describe how many lines are affected */
function describeLines(lines: number[]) {
  const lineTerm = `line${lines.length > 1 ? 's' : ''}`;
  if (lines.length > 6) {
    return `${lines.length} different ${lineTerm}`;
  }
  return `${lineTerm} ${lines.join(', ')}`;
}

function getCodePoint(character: string) {
  return 'U+' + (character.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0');
}

/** Failure messages for each rule */
export const FAILURE_MESSAGES = {
  DS_STORE: () => 'Committed .DS_Store files',
  UPPERCASE_EXTENSION: () => 'Uppercase file extension',
  IGNORED_COMMITTED_FILE: () => 'Committed file which should be gitignored',
  INVALID_BYTE: (failure) => `Invalid character byte value "${failure.value}" on line ${failure.line}`,
  UNEXPECTED_CONTINUATION_BYTE: (failure) => `Invalid character: unexpected continuation byte "${failure.value}" on line ${failure.line}`,
  MISSING_CONTINUATION_BYTE: (failure) => `Invalid character: missing continuation byte "${failure.value}" on line ${failure.line}`,
  OVERLONG_BYTE_SEQUENCE: (failure) => `Invalid character: overlong encoding "${failure.value}" on line ${failure.line}`,
  INVALID_CODE_POINT: (failure) => `Invalid character unicode code point "${failure.value}" on line ${failure.line}`,
  MALFORMED_ENCODING: (failure) => `Malformed encoding, guessed to be ${failure.guessedEncoding}`,
  UNEXPECTED_ENCODING: (failure) => `Unexpected encoding ${failure.encoding}`,
  CARRIAGE_RETURN: (failure) => `Uses carriage returns on line ${failure.line}`,
  TAB: (failure) => `Uses tabs on ${describeLines(failure.lines)}`,
  TRAILING_WHITESPACE: (failure) => `Has trailing whitespace on ${describeLines(failure.lines)}`,
  MULTIPLE_FINAL_NEWLINES: () => 'Has multiple final newlines',
  NO_FINAL_NEWLINE: () => 'Does not have a final newline',
  UNEXPECTED_CHARACTER: (failure) => {
    return `Has a non-ASCII, non-unicode letter, non-emoji character "${failure.value}" ${getCodePoint(failure.value)} on ${describeLines(failure.lines)}`;
  },
} as const satisfies { [Key in RuleName]: <Type extends Failure & { type: Key }>(failure: Type) => string };
