const { resolve } = require('path');
const { readdir, readFile } = require('fs').promises;
const path = require('path');
const { detect } = require('jschardet');
const util = require('util');
const childProcess = require('child_process');

const exec = util.promisify(childProcess.exec);


const IGNORED_PATHS = [
  '.git',
  'node_modules',
];

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
];

const INVALID_TYPES = {
  uppercaseExtension: "Uppercase file extension",
  dsStore: "Committed .DS_Store files",
  malformedEncoding: 'Malformed encoding',
  unexpectedEncoding: 'Unexpected encoding',
  carriageReturn: 'Uses carriage returns',
  carriageReturnOnly: 'Uses carriage returns without line feeds',
  tab: 'Uses tabs',
  trailingWhitespace: 'Has trailing whitespace',
  multipleFinalNewlines: 'Has multiple final newlines',
  noFinalNewline: 'Does not have a final newline',
  oddIndentation: 'Has odd (uneven) indentation',
  unexpectedCharacter: 'Has a non-ASCII, non-unicode letter, non-emoji character',
}

function getLineNumber(text, index) {
  const match = text.slice(0, index).match(/\r\n|\r|\n/g)
  return (match ? match.length : 0) + 1;
}

function getLineNumber2(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      line++;
    }
    if (text[i] === '\r') {
      // A line feed after a carriage return counts as part of the same newline
      if (text[i + 1] === '\n') {
        i++;
      }
      line++;
    }
  }
  return line;
}

function getLineBufferNumber(buffer, index) {
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

function isContinuationByte(value) {
  return value >= 0x80 && value <= 0xBF;
}

function getByteCount(value) {
  if (isLeadingTwoByte(value)) return 2;
  if (isLeadingThreeByte(value)) return 3;
  if (isLeadingFourByte(value)) return 4;
  return 1;
}

function isLeadingTwoByte(value) {
  return value >= 0xC2 && value <= 0xDF;
}

function isLeadingThreeByte(value) {
  return value >= 0xE0 && value <= 0xEF;
}

function isLeadingFourByte(value) {
  return value >= 0xF0 && value <= 0xF4;
}

function isInvalidByte(value) {
  return value >= 0xF5 || (value >= 0xC0 && value <= 0xC1);
}

function outputBytes(values) {
  return Array.from(values).map((value) => `0x${value.toString(16)}`).join(' ');
}

function getExtension(filename) {
  const match = path.basename(filename).match(/(\.[^.]+)+$/);
  return match ? match[0] : undefined;
}

function collectExtensions(files) {
  const extensions = {};
  for (const file of files) {
    const extension = getExtension(file);
    if (extension) extensions[extension] = (extensions[extension] || 0) + 1;
  }
  return extensions;
}

function splitArray(array, predicate) {
  let a = [];
  let b = [];
  for (let i = 0; i < array.length; i++) {
    predicate(array[i], i) ? a.push(array[i]) : b.push(array[i]);
  }
  return [a, b];
}

async function getGitFiles(directory) {
  const data = (await exec('git ls-files --cached --others --exclude-standard', { cwd: directory, maxBuffer: 10 * 1024 * 1024 })).stdout
  return data.trim().split('\n').filter((path) => {
    const parts = path.split('/');
    return !IGNORED_PATHS.find((ignoredPath) => parts.includes(ignoredPath))
  });
}

// async function getFiles(directory) {
//   const entries = (await readdir(directory, { withFileTypes: true }))
//   .filter((entry) => !IGNORED_PATHS.has(entry.name));

//   const [directoryEntries, fileEntries] = splitArray(entries, (entry) => entry.isDirectory())
//   let files = fileEntries.map((entry) => resolve(directory, entry.name));

//   for (const entry of directoryEntries) {
//   files = files.concat(await getFiles(resolve(directory, entry.name)));
//   }
//   return files;
// }

async function main() {
  // TODO: Expand up to git directory
  const files = await getGitFiles('./');
  const failures = {};

  const nonBinaryFiles = files.filter((file) => !BINARY_EXTENSIONS.find((extension) => file.endsWith(extension)));

  for (const file of nonBinaryFiles) {
    failures[file] = [];

    const extension = getExtension(file);
    if (extension === '.DS_Store') {
      failures[file].push({ type: 'dsStore' });
      continue;
    }

    if (extension && extension.match(/[A-Z]/)) {
      failures[file].push({ type: 'uppercaseExtension' });
    }

    const data = await readFile(file);

    // TODO: Check for invalid code points or overlong encodings

    for (let i = 0; i < data.length; i++) {
      if (isInvalidByte(data[i])) {
        failures[file].push({
          type: 'invalidByte',
          value: outputBytes([data[i]]),
          line: getLineBufferNumber(data, i)
        });
      }

      if (isContinuationByte(data[i])) {
        failures[file].push({
          type: 'unexpectedContinuationByte',
          value: outputBytes([data[i]]),
          line: getLineBufferNumber(data, i)
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
            type: 'missingContinuationByte',
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
            type: 'missingContinuationByte',
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
            type: 'missingContinuationByte',
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
          type: 'malformedEncoding',
          guessedEncoding: charset.encoding,
          confidence: charset.confidence,
        });
        continue;
      }

      if (charset.encoding !== 'UTF-8' && charset.encoding !== 'ascii') {
        failures[file].push({
          type: 'unexpectedEncoding',
          encoding: charset.encoding,
        });
        continue;
      }

      const content = data.toString('utf8');

      const carriageReturn = content.matchAll(/\r+/g);
      if (carriageReturn) {
        failures[file] = failures[file].concat(Array.from(carriageReturn).map((match) => {
          return {
            type: 'carriageReturn',
            line: getLineBufferNumber(data, match.index),
          };
        }));
      }

      const carriageReturnOnly = content.matchAll(/(\r([^\n]|$))+/g);
      if (carriageReturnOnly) {
        failures[file] = failures[file].concat(Array.from(carriageReturnOnly).map((match) => {
          return {
            type: 'carriageReturnOnly',
            line: getLineBufferNumber(data, match.index),
          };
        }));
      }

      const tab = content.matchAll(/\t+/g);
      if (tab) {
        failures[file] = failures[file].concat(Array.from(tab).map((match) => {
          return {
            type: 'tab',
            line: getLineBufferNumber(data, match.index),
          };
        }));
      }

      const trailingWhitespace = content.matchAll(/ +(\n|$)/g);
      if (trailingWhitespace) {
        failures[file] = failures[file].concat(Array.from(trailingWhitespace).map((match) => {
          return {
            type: 'trailingWhitespace',
            line: getLineBufferNumber(data, match.index),
          };
        }));
      }

      const multipleFinalNewlines = content.match(/\n\n+$/);
      if (multipleFinalNewlines) {
        failures[file].push({
          type: 'multipleFinalNewlines',
          line: getLineBufferNumber(data, multipleFinalNewlines.index),
        });
      }

      const noFinalNewline = content.match(/[^\n]$/);
      if (noFinalNewline) {
        failures[file].push({
          type: 'noFinalNewline',
          line: getLineBufferNumber(data, noFinalNewline.index),
        });
      }

      const oddIndentation = content.matchAll(/\n (  )*[^ ]/g);
      if (oddIndentation) {
        failures[file] = failures[file].concat(Array.from(oddIndentation).map((match) => {
          return {
            type: 'oddIndentation',
            line: getLineBufferNumber(data, match.index),
          };
        }));
      }

      const unexpectedCharacter = content.matchAll(/[^\n\t\r\x20-\xFF\p{L}\p{M}\p{Extended_Pictographic}]/ug);
      if (unexpectedCharacter) {
        failures[file] = failures[file].concat(Array.from(unexpectedCharacter).map((match) => {
          return {
            type: 'unexpectedCharacter',
            value: match[0],
            line: getLineBufferNumber(data, match.index),
          };
        }));
      }
    }
  }

  for (const file in failures) {
    failures[file].sort((a, b) => (a.line || 0) - (b.line || 0));
  }

  for (const file in failures) {
    if (failures[file].length) {
      console.log(file);
      for (const failure of failures[file]) {
        console.log(failure);
      }
      console.log('');
    }
  }
}

main().catch(console.error);

// const initialBuffer = Buffer.from([0x36, 0xC3, 0xE1, 0x80, 0x80, 0xF0, 0x98, 0x85, 0x39]);
// const string = initialBuffer.toString('utf8')
// const buffer = Buffer.from(string, 'utf8')

// console.log(Array.from(initialBuffer).map((value) => '0x' + value.toString(16).toUpperCase()));
// console.log(string);
// console.log(Array.from(buffer).map((value) => '0x' + value.toString(16).toUpperCase()));
