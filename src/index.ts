import { promises as fs } from 'fs';
import path from 'path';
import { detect } from 'jschardet';
import util from 'util';
import childProcess from 'child_process';

const exec = util.promisify(childProcess.exec);

const IGNORED_PATHS = [
  '.git',
  'node_modules',
] as const;

const BINARY_EXTENSIONS = [
  '.DS_Store',
  '.sln',
  '.wav',
  '.mp3',
  '.raw',
  '.webm',
  '.jpg',
  '.jpeg',
  '.gif',
  '.png',
  '.bmp',
  '.ico',
  '.ttf',
  '.eot',
  '.woff',
  '.woff2',
  '.deb',
  '.bin',
  '.exe',
  '.pdf',
  '.svg',
  '.z',
  '.cod',
  '.fwu',
  '.tar',
  '.gz',
  '.zip',
  '.7z',
  '.7zip',
  // Non-standard / erroneous?
  '.sln16',
  '.sn',
  '.sln16_copy_of_original',
] as const;

const INVALID_TYPES = {
  DsStore: 'Committed .DS_Store files',
  UppercaseExtension: 'Uppercase file extension',
  InvalidByte: 'Invalid byte',
  UnexpectedContinuationByte: 'Unexpected continuation byte',
  MissingContinuationByte: 'Missing continuation byte',
  MalformedEncoding: 'Malformed encoding',
  UnexpectedEncoding: 'Unexpected encoding',
  CarriageReturn: 'Uses carriage returns',
  Tab: 'Uses tabs',
  TrailingWhitespace: 'Has trailing whitespace',
  MultipleFinalNewlines: 'Has multiple final newlines',
  NoFinalNewline: 'Does not have a final newline',
  UnexpectedCharacter: 'Has a non-ASCII, non-unicode letter, non-emoji character',
} as const;

interface SomeFailure {
  type: keyof typeof INVALID_TYPES;
}

interface DsStoreFailure extends SomeFailure {
  type: 'DsStore';
}

interface UppercaseExtensionFailure extends SomeFailure {
  type: 'UppercaseExtension';
}

interface InvalidByteFailure extends SomeFailure {
  type: 'InvalidByte';
  value: string;
  line: number;
}

interface UnexpectedContinuationByteFailure extends SomeFailure {
  type: 'UnexpectedContinuationByte';
  value: string;
  line: number;
}

interface MissingContinuationByteFailure extends SomeFailure {
  type: 'MissingContinuationByte';
  expectedBytes: number;
  value: string;
  line: number;
}

interface MalformedEncodingFailure extends SomeFailure {
  type: 'MalformedEncoding';
  guessedEncoding: string;
  confidence: number;
}

interface UnexpectedEncodingFailure extends SomeFailure {
  type: 'UnexpectedEncoding';
  encoding: string;
}

interface CarriageReturnFailure extends SomeFailure {
  type: 'CarriageReturn';
  line: number;
}

interface TabFailure extends SomeFailure {
  type: 'Tab';
  line: number;
}

interface TrailingWhitespaceFailure extends SomeFailure {
  type: 'TrailingWhitespace';
  line: number;
}

interface MultipleFinalNewlinesFailure extends SomeFailure {
  type: 'MultipleFinalNewlines';
  line: number;
}

interface NoFinalNewlineFailure extends SomeFailure {
  type: 'NoFinalNewline';
  line: number;
}

interface UnexpectedCharacterFailure extends SomeFailure {
  type: 'UnexpectedCharacter';
  value: string;
  line: number;
}

type Failure = (
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

function getLineNumber(text: string, index: number): number {
  const match = text.slice(0, index).match(/\r\n|\r|\n/g);
  return (match ? match.length : 0) + 1;
}

function getLineBufferNumber(buffer: Buffer, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (buffer[i] === 0xA) {
      line++;
    }
    if (buffer[i] === 0xD) {
      // A line feed after a carriage return counts as part of the same newline
      if (buffer[i + 1] === 0xA) {
        i++;
      }
      line++;
    }
  }
  return line;
}

function isContinuationByte(value: number): boolean {
  return value >= 0x80 && value <= 0xBF;
}

function getByteCount(value: number): number {
  if (isLeadingTwoByte(value)) return 2;
  if (isLeadingThreeByte(value)) return 3;
  if (isLeadingFourByte(value)) return 4;
  return 1;
}

function isLeadingTwoByte(value: number): boolean {
  return value >= 0xC2 && value <= 0xDF;
}

function isLeadingThreeByte(value: number): boolean {
  return value >= 0xE0 && value <= 0xEF;
}

function isLeadingFourByte(value: number): boolean {
  return value >= 0xF0 && value <= 0xF4;
}

function isInvalidByte(value: number): boolean {
  return value >= 0xF5 || (value >= 0xC0 && value <= 0xC1);
}

function outputBytes(values: Buffer | number[]): string {
  return Array.from(values).map((value) => `0x${value.toString(16)}`).join(' ');
}

function getExtension(filename: string): string | undefined {
  const match = path.basename(filename).match(/(\.[^.]+)+$/);
  return match ? match[0] : undefined;
}

async function getGitFiles(directory: string): Promise<string[]> {
  const options = { cwd: directory, maxBuffer: 10 * 1024 * 1024 };
  const data = (await exec('git ls-files --cached --others --exclude-standard', options)).stdout;
  return data.trim().split('\n').filter((path) => {
    const parts = path.split('/');
    return !IGNORED_PATHS.find((ignoredPath) => parts.includes(ignoredPath));
  });
}

async function main(): Promise<void> {
  // TODO: Expand up to git directory
  const files = await getGitFiles('./');
  const failures: Record<string, Failure[]> = {};

  const nonBinaryFiles = files.filter((file) => !BINARY_EXTENSIONS.find((extension) => file.endsWith(extension)));

  for (const file of nonBinaryFiles) {
    failures[file] = [];

    const extension = getExtension(file);
    if (extension === '.DS_Store') {
      failures[file].push({ type: 'DsStore' });
      continue;
    }

    if (extension && extension.match(/[A-Z]/)) {
      failures[file].push({ type: 'UppercaseExtension' });
    }

    const data = await fs.readFile(file);

    // TODO: Check for invalid code points or overlong encodings

    for (let i = 0; i < data.length; i++) {
      if (isInvalidByte(data[i])) {
        failures[file].push({
          type: 'InvalidByte',
          value: outputBytes([data[i]]),
          line: getLineBufferNumber(data, i),
        });
      }

      if (isContinuationByte(data[i])) {
        failures[file].push({
          type: 'UnexpectedContinuationByte',
          value: outputBytes([data[i]]),
          line: getLineBufferNumber(data, i),
        });
      }

      const byteCount = getByteCount(data[i]);
      const startIndex = i;

      if (byteCount >= 2) {
        if (data[i + 1] && isContinuationByte(data[i + 1])) {
          i++;
        }
        else {
          failures[file].push({
            type: 'MissingContinuationByte',
            expectedBytes: byteCount,
            value: outputBytes(data.subarray(startIndex, startIndex + 1)),
            line: getLineBufferNumber(data, startIndex),
          });
          continue;
        }
      }

      if (byteCount >= 3) {
        if (data[i + 1] && isContinuationByte(data[i + 1])) {
          i++;
        }
        else {
          failures[file].push({
            type: 'MissingContinuationByte',
            expectedBytes: byteCount,
            value: outputBytes(data.subarray(startIndex, startIndex + 2)),
            line: getLineBufferNumber(data, startIndex),
          });
          continue;
        }
      }

      if (byteCount === 4) {
        if (data[i + 1] && isContinuationByte(data[i + 1])) {
          i++;
        }
        else {
          failures[file].push({
            type: 'MissingContinuationByte',
            expectedBytes: byteCount,
            value: outputBytes(data.subarray(startIndex, startIndex + 3)),
            line: getLineBufferNumber(data, startIndex),
          });
          continue;
        }
      }
    }

    if (data.length) {
      const charset = detect(data);

      if (charset.confidence < 0.95) {
        failures[file].push({
          type: 'MalformedEncoding',
          guessedEncoding: charset.encoding,
          confidence: charset.confidence,
        });
        continue;
      }

      if (charset.encoding !== 'UTF-8' && charset.encoding !== 'ascii') {
        failures[file].push({
          type: 'UnexpectedEncoding',
          encoding: charset.encoding,
        });
        continue;
      }

      const content = data.toString('utf8');

      const carriageReturn = content.matchAll(/\r+/g);
      if (carriageReturn) {
        failures[file] = failures[file].concat(Array.from(carriageReturn).map((match) => {
          return {
            type: 'CarriageReturn',
            line: getLineNumber(content, match.index as number),
          };
        }));
      }

      const tab = content.matchAll(/\t+/g);
      if (tab) {
        failures[file] = failures[file].concat(Array.from(tab).map((match) => {
          return {
            type: 'Tab',
            line: getLineNumber(content, match.index as number),
          };
        }));
      }

      const trailingWhitespace = content.matchAll(/ +(\n|$)/g);
      if (trailingWhitespace) {
        failures[file] = failures[file].concat(Array.from(trailingWhitespace).map((match) => {
          return {
            type: 'TrailingWhitespace',
            line: getLineNumber(content, match.index as number),
          };
        }));
      }

      const multipleFinalNewlines = content.match(/\n\n+$/);
      if (multipleFinalNewlines) {
        failures[file].push({
          type: 'MultipleFinalNewlines',
          line: getLineNumber(content, multipleFinalNewlines.index as number),
        });
      }

      const noFinalNewline = content.match(/[^\n]$/);
      if (noFinalNewline) {
        failures[file].push({
          type: 'NoFinalNewline',
          line: getLineNumber(content, noFinalNewline.index as number),
        });
      }

      const unexpectedCharacter = content.matchAll(/[^\n\t\r\x20-\xFF\p{L}\p{M}\p{Extended_Pictographic}]/ug);
      if (unexpectedCharacter) {
        failures[file] = failures[file].concat(Array.from(unexpectedCharacter).map((match) => {
          return {
            type: 'UnexpectedCharacter',
            value: match[0],
            line: getLineNumber(content, match.index as number),
          };
        }));
      }
    }
  }

  for (const file in failures) {
    failures[file].sort((a, b) => ('line' in a ? a.line : 0) - ('line' in b ? b.line : 0));
  }

  for (const file in failures) {
    if (failures[file].length) {
      console.log(file);
      for (const failure of failures[file]) {
        console.log(INVALID_TYPES[failure.type], failure);
      }
      console.log('');
    }
  }
}

main().catch(console.error);