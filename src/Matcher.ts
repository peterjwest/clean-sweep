import ignore, { Ignore } from 'ignore';

export default class Matcher {
  excludes: readonly string[];
  ignore: Ignore;
  constructor(excludes: readonly string[]) {
    this.excludes = excludes;
    this.ignore = ignore();
    if (this.excludes.length) this.ignore.add(this.excludes);
  }

  filter(filePaths: readonly string[]): string[] {
    return this.ignore.filter(filePaths);
  }

  matches(filePath: string): boolean {
    return !this.ignore.ignores(filePath);
  }

  extend(excludes: readonly string[]): Matcher {
    return new Matcher([... this.excludes, ...excludes]);
  }
}