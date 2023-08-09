import { detect } from 'jschardet';

import { RULES } from './rules';
import { ExtendedContentConfig } from './config';
import { Failure } from './failures';

/** Gets the line number of an index in a string */
function getLineNumber(text: string, index: number): number {
  const match = text.slice(0, index).match(/\r\n|\r|\n/g);
  return (match ? match.length : 0) + 1;
}

/** Runs checks on file contents */
export default function checkContent(filePath: string, data: Buffer, config: ExtendedContentConfig): Failure[] {
  let failures: Failure[] = [];
  const charset = detect(data);

  if (config.rules.MALFORMED_ENCODING.enabledFor(filePath)) {
    if (charset.confidence < 0.95) {
      failures.push({
        type: RULES.MALFORMED_ENCODING,
        guessedEncoding: charset.encoding,
        confidence: charset.confidence,
      });
      // If we can't determine the encoding, don't analyse any further
      return failures;
    }
  } else {
    return failures;
  }

  if (config.rules.UNEXPECTED_ENCODING.enabledFor(filePath)) {
    if (charset.encoding !== 'UTF-8' && charset.encoding !== 'ascii') {
      failures.push({
        type: RULES.UNEXPECTED_ENCODING,
        encoding: charset.encoding,
      });
      // If the encoding isn't UTF8, don't analyse any further
      return failures;
    }
  } else {
    return failures;
  }

  const content = data.toString('utf8');

  if (config.rules.CARRIAGE_RETURN.enabledFor(filePath)) {
    const carriageReturn = content.matchAll(/\r+/g);
    if (carriageReturn) {
      failures = failures.concat(Array.from(carriageReturn).map((match) => {
        return {
          type: RULES.CARRIAGE_RETURN,
          line: getLineNumber(content, match.index as number),
        };
      }));
    }
  }

  if (config.rules.TAB.enabledFor(filePath)) {
    const tab = content.matchAll(/\t+/g);
    if (tab) {
      failures = failures.concat(Array.from(tab).map((match) => {
        return {
          type: RULES.TAB,
          line: getLineNumber(content, match.index as number),
        };
      }));
    }
  }

  if (config.rules.TRAILING_WHITESPACE.enabledFor(filePath)) {
    const trailingWhitespace = content.matchAll(/ +(\n|$)/g);
    if (trailingWhitespace) {
      failures = failures.concat(Array.from(trailingWhitespace).map((match) => {
        return {
          type: RULES.TRAILING_WHITESPACE,
          line: getLineNumber(content, match.index as number),
        };
      }));
    }
  }

  if (config.rules.MULTIPLE_FINAL_NEWLINES.enabledFor(filePath)) {
    const multipleFinalNewlines = content.match(/\n\n+$/);
    if (multipleFinalNewlines) {
      failures.push({
        type: RULES.MULTIPLE_FINAL_NEWLINES,
        line: getLineNumber(content, multipleFinalNewlines.index as number),
      });
    }
  }

  if (config.rules.NO_FINAL_NEWLINE.enabledFor(filePath)) {
    const noFinalNewline = content.match(/[^\n]$/);
    if (noFinalNewline) {
      failures.push({
        type: RULES.NO_FINAL_NEWLINE,
        line: getLineNumber(content, noFinalNewline.index as number),
      });
    }
  }

  if (config.rules.UNEXPECTED_CHARACTER.enabledFor(filePath)) {
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
  }

  return failures;
}