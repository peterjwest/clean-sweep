import { detect } from 'jschardet';
import lodash from 'lodash';

import { RULES } from './rules';
import { ExtendedContentConfig } from './config';
import { FileResult } from './util';

/** Gets the line number of an index in a string */
function getLineNumber(text: string, index: number): number {
  const match = text.slice(0, index).match(/\r\n|\r|\n/g);
  return (match ? match.length : 0) + 1;
}

/** Runs checks on file contents */
export default function checkContent(filePath: string, data: Buffer, config: ExtendedContentConfig): FileResult {
  const result = new FileResult();
  const charset = detect(data);

  if (config.rules.MALFORMED_ENCODING.enabledFor(filePath)) {
    result.checks++;

    if (charset.confidence < 0.95) {
      result.failures.push({
        type: RULES.MALFORMED_ENCODING,
        guessedEncoding: charset.encoding,
        confidence: charset.confidence,
      });
      // If we can't determine the encoding, don't analyse any further
      return result;
    }
  } else {
    return result;
  }

  if (config.rules.UNEXPECTED_ENCODING.enabledFor(filePath)) {
    result.checks++;

    if (charset.encoding !== 'UTF-8' && charset.encoding !== 'ascii') {
      result.failures.push({
        type: RULES.UNEXPECTED_ENCODING,
        encoding: charset.encoding,
      });
      // If the encoding isn't UTF8, don't analyse any further
      return result;
    }
  } else {
    return result;
  }

  const content = data.toString('utf8');

  if (config.rules.CARRIAGE_RETURN.enabledFor(filePath)) {
    result.checks++;

    const carriageReturn = content.matchAll(/\r+/g);
    if (carriageReturn) {
      result.addFailures(Array.from(carriageReturn).map((match) => {
        return {
          type: RULES.CARRIAGE_RETURN,
          line: getLineNumber(content, match.index as number),
        };
      }));
    }
  }

  if (config.rules.TAB.enabledFor(filePath)) {
    result.checks++;

    const tabs = Array.from(content.matchAll(/\t+/g));
    if (tabs.length) {
      result.failures.push({
        type: RULES.TAB,
        lines: tabs.map((match) => getLineNumber(content, match.index as number)),
      });
    }
  }

  if (config.rules.TRAILING_WHITESPACE.enabledFor(filePath)) {
    result.checks++;

    const trailingWhitespace = Array.from(content.matchAll(/ +(\n|$)/g));
    if (trailingWhitespace.length) {
      result.failures.push({
        type: RULES.TRAILING_WHITESPACE,
        lines: trailingWhitespace.map((match) => getLineNumber(content, match.index as number)),
      });
    }
  }

  if (config.rules.MULTIPLE_FINAL_NEWLINES.enabledFor(filePath)) {
    result.checks++;

    const multipleFinalNewlines = content.match(/\n\n+$/);
    if (multipleFinalNewlines) {
      result.failures.push({
        type: RULES.MULTIPLE_FINAL_NEWLINES,
        line: getLineNumber(content, multipleFinalNewlines.index as number),
      });
    }
  }

  if (config.rules.NO_FINAL_NEWLINE.enabledFor(filePath)) {
    result.checks++;

    const noFinalNewline = content.match(/[^\n]$/);
    if (noFinalNewline) {
      result.failures.push({
        type: RULES.NO_FINAL_NEWLINE,
        line: getLineNumber(content, noFinalNewline.index as number),
      });
    }
  }

  if (config.rules.UNEXPECTED_CHARACTER.enabledFor(filePath)) {
    result.checks++;

    const unexpectedCharacters = Array.from(
      content.matchAll(/[^\n\t\r\x20-\xFF\p{L}\p{M}\p{Extended_Pictographic}]/ug),
    );
    if (unexpectedCharacters.length) {
      const groupedMatches = Object.values(lodash.groupBy(unexpectedCharacters, (match) => match[0]));

      result.addFailures(groupedMatches.map((matches) => ({
        type: RULES.UNEXPECTED_CHARACTER,
        value: matches[0]![0],
        lines: matches.map((match) => getLineNumber(content, match.index as number)),
      })));
    }
  }

  return result;
}
