import { detect } from 'jschardet';

import { RULES } from './rules';
import { Failure } from './failures';

function getLineNumber(text: string, index: number): number {
  const match = text.slice(0, index).match(/\r\n|\r|\n/g);
  return (match ? match.length : 0) + 1;
}

export default function checkContent(data: Buffer): Failure[] {
  let failures: Failure[] = [];
  const charset = detect(data);

  if (charset.confidence < 0.95) {
    failures.push({
      type: RULES.MALFORMED_ENCODING,
      guessedEncoding: charset.encoding,
      confidence: charset.confidence,
    });
    return failures;
  }

  if (charset.encoding !== 'UTF-8' && charset.encoding !== 'ascii') {
    failures.push({
      type: RULES.UNEXPECTED_ENCODING,
      encoding: charset.encoding,
    });
    return failures;
  }

  const content = data.toString('utf8');

  const carriageReturn = content.matchAll(/\r+/g);
  if (carriageReturn) {
    failures = failures.concat(Array.from(carriageReturn).map((match) => {
      return {
        type: RULES.CARRIAGE_RETURN,
        line: getLineNumber(content, match.index as number),
      };
    }));
  }

  const tab = content.matchAll(/\t+/g);
  if (tab) {
    failures = failures.concat(Array.from(tab).map((match) => {
      return {
        type: RULES.TAB,
        line: getLineNumber(content, match.index as number),
      };
    }));
  }

  const trailingWhitespace = content.matchAll(/ +(\n|$)/g);
  if (trailingWhitespace) {
    failures = failures.concat(Array.from(trailingWhitespace).map((match) => {
      return {
        type: RULES.TRAILING_WHITESPACE,
        line: getLineNumber(content, match.index as number),
      };
    }));
  }

  const multipleFinalNewlines = content.match(/\n\n+$/);
  if (multipleFinalNewlines) {
    failures.push({
      type: RULES.MULTIPLE_FINAL_NEWLINES,
      line: getLineNumber(content, multipleFinalNewlines.index as number),
    });
  }

  const noFinalNewline = content.match(/[^\n]$/);
  if (noFinalNewline) {
    failures.push({
      type: RULES.NO_FINAL_NEWLINE,
      line: getLineNumber(content, noFinalNewline.index as number),
    });
  }

  const unexpectedCharacter = content.matchAll(/[^\n\t\r\x20-\xFF\p{L}\p{M}\p{Extended_Pictographic}]/ug);
  if (unexpectedCharacter) {
    failures = failures.concat(Array.from(unexpectedCharacter).map((match) => {
      return {
        type: RULES.UNEXPECTED_CHARACTER,
        value: match[0],
        line: getLineNumber(content, match.index as number),
      };
    }));
  }

  return failures;
}