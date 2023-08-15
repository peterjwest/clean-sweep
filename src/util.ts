import { promises as fs, constants } from 'fs';
import { promisify } from 'util';
import childProcess from 'child_process';
import lodash from 'lodash';

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

export async function getProjectDir(directory: string) {
  return (await exec(`git rev-parse --show-toplevel`, { cwd: directory })).stdout.trim();
}

export async function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

export function toDateString(date: Date) {
  return date.toISOString().replace(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).\d{3}Z/, '$4:$5:$6 ($1-$2-$3)');
}

export function differenceInSeconds(start: Date, end: Date) {
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
