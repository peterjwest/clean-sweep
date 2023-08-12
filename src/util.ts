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

/** Creates an enum from a string tuple */
export function createEnum<const T extends readonly string[]>(arr: T): Expand<ObjectFromTuple<T>> {
  return Object.fromEntries(arr.map((value) => [value, value])) as Expand<ObjectFromTuple<T>>;
}

/** Checks if a file is readable */
export async function fileReadable(path: string): Promise<boolean> {
  return fs.access(path, constants.R_OK).then(() => true).catch(() => false);
}

/** Returns the result of a `git ls-files` command */
export async function gitListFiles(directory: string, options: string): Promise<string[]> {
  const data = (await exec(`git ls-files ${options}`, { cwd: directory, maxBuffer: GIT_LIST_BUFFER_SIZE })).stdout;
  return data.trim().split('\n').filter((file) => file);
}

/** Get all committed files which should be ignored */
export async function getIgnoredCommittedFiles(directory: string): Promise<string[]> {
  return gitListFiles(directory, 'ls-files --cached --ignored --exclude-standard');
}

/** Get all committed & untracked files */
export async function getProjectFiles(directory: string): Promise<string[]> {
  const deleted = await gitListFiles(directory, '--deleted --exclude-standard');
  const files = await gitListFiles(directory, '--cached --others --exclude-standard');
  return lodash.difference(files, deleted);
}

/** Error type including specific failures */
export class ErrorWithFailures extends Error {
  failures: string[];

  constructor(message: string, failures: string[]) {
    super(message);
    this.failures = failures;
  }
}
