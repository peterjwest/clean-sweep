import { promises as fs, constants } from 'fs';
import { promisify } from 'util';
import childProcess from 'child_process';
import lodash from 'lodash';

import { Failure } from './failures';

const exec = promisify(childProcess.exec);

const GIT_LIST_BUFFER_SIZE = 10 * 1024 * 1024;

/** Expands a named type to show its contents */
export type Expand<Type> = Type extends infer Obj ? { [Key in keyof Obj]: Obj[Key] } : never;

/** Expands a named type to show its contents recursively */
export type ExpandRecursive<Type> = (
  Type extends (...args: infer Args) => infer Return ? (...args: ExpandRecursive<Args>) => ExpandRecursive<Return> :
  Type extends object ? (Type extends infer O ? { [K in keyof O]: ExpandRecursive<O[K]> } : never) : Type
);

/** Takes a string tuple and converts it into an object where the key & value are identical */
type ObjectFromTuple<Type extends readonly string[]> = {
  [Key in (keyof Type & `${number}`) as Type[Key]]: Type[Key]
}

/** Takes a string tuple and inverts it to an object */
type InvertTuple<Type extends readonly string[]> = {
  [Key in (keyof Type & `${number}`) as Type[Key]]: Key
}

/** Creates an enum from a string tuple */
export function createEnum<const T extends readonly string[]>(arr: T): Expand<ObjectFromTuple<T>> {
  return Object.fromEntries(arr.map((value) => [value, value])) as Expand<ObjectFromTuple<T>>;
}

/** Creates an enum from a string tuple */
export function createEnumNumeric<const T extends readonly string[]>(arr: T): Expand<InvertTuple<T>> {
  return Object.fromEntries(arr.map((value, index) => [value, index])) as Expand<InvertTuple<T>>;
}

/** Checks if a file is readable */
export async function fileReadable(path: string): Promise<boolean> {
  return fs.access(path, constants.R_OK).then(() => true).catch(() => false);
}

/** Returns the result of a `git ls-files` command with the full-name option */
export async function gitListFiles(directory: string, options: string): Promise<string[]> {
  const data = (await exec(`git ls-files --full-name ${options}`, { cwd: directory, maxBuffer: GIT_LIST_BUFFER_SIZE })).stdout;
  return data.trim().split('\n').filter((file) => file);
}

/** Get all committed files which should be ignored */
export async function getIgnoredCommittedFiles(directory: string): Promise<string[]> {
  return gitListFiles(directory, '--cached --ignored --exclude-standard');
}

/** Get all committed & untracked files */
export async function getProjectFiles(directory: string): Promise<string[]> {
  const deleted = await gitListFiles(directory, '--deleted --exclude-standard');
  const files = await gitListFiles(directory, '--cached --others --exclude-standard');
  return lodash.difference(files, deleted);
}

/** Returns the Git root directory of a directory */
export async function getProjectDir(directory: string) {
  return (await exec(`git rev-parse --show-toplevel`, { cwd: directory })).stdout.trim();
}

/** Checks if an error is a Node system error */
function isSystemError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error);
}

/** Returns the contents of a file, returns undefined if it is a directory */
export async function getFileContent(path: string): Promise<Buffer | undefined> {
  return fs.readFile(path).catch((error) => {
    if (isSystemError(error) && error.code === 'EISDIR') return undefined;
    throw error;
  });
}

/** Async delay */
export async function delay(milliseconds: number) {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Outputs a date in the format HH:MM:SS (YYYY-MM-DD) */
export function toDateString(date: Date) {
  return date.toISOString().replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).\d{3}Z/, '$4:$5:$6 ($1-$2-$3)');
}


/** Finds the difference between two dates in seconds as a formatted string */
export function differenceInSeconds(start: Date, end: Date): string {
  return ((end.valueOf() - start.valueOf()) / 1000).toFixed(2);
}

/** Error type including specific failures */
export class ErrorWithFailures extends Error {
  failures: string[];

  constructor(message: string, failures: string[]) {
    super(message);
    this.failures = failures;
  }
}

/** Results for a file, with helper methods */
export class FileResult {
  checks: number = 0;
  failures: Failure[] = [];

  /** Adds a number of failures into this result */
  addFailures(failures: Failure[]) {
    this.failures = this.failures.concat(failures);
  }

  /** Merges another result into this one */
  mergeWith(fileResult: FileResult) {
    this.addFailures(fileResult.failures);
    this.checks += fileResult.checks;
  }
}

export type Results = Record<string, FileResult>;

/** Gets or creates FileResult for a set of results */
export function getFileResult(results: Results, filePath: string): FileResult {
  const fileResult = results[filePath] || new FileResult();
  return results[filePath] = fileResult;
}

export interface ResultStats {
  files: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: {
    total: number;
    passed: number;
    failed: number;
  };
}

/** Counts failures and totals in a Results object */
export function getResultStats(results: Results): ResultStats {
  const fileResults = Object.values(results);
  const failedFileResults = Object.values(results).filter((result) => result.failures.length);

  const fileCount = fileResults.length;
  const checkCount = lodash.sum(fileResults.map((fileData) => fileData.checks));

  const filesFailed = failedFileResults.length;
  const checksFailed = lodash.sum(fileResults.map((fileResult) => Object.values(lodash.groupBy(fileResult.failures, (failure) => failure.type)).length));

  return {
    files: {
      total: fileCount,
      passed: fileCount - filesFailed,
      failed: filesFailed,
    },
    checks: {
      total: checkCount,
      passed: checkCount - checksFailed,
      failed: checksFailed,
    },
  };
}
