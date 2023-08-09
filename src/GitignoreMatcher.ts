import ignore, { Ignore } from 'ignore';

/**
 * A class to match files against gitignore rules
 * @param rules - A list of gitignore rules
 */
export default class GitignoreMatcher {
  rules: readonly string[];
  ignore: Ignore;
  constructor(rules: readonly string[]) {
    this.rules = rules;
    this.ignore = ignore();
    if (this.rules.length) this.ignore.add(this.rules);
  }

  /** Filters out ignored files from a list of file paths */
  filter(filePaths: readonly string[]): string[] {
    return this.ignore.filter(filePaths);
  }

  /** Returns whether a filePath is matched (not ignored) */
  matches(filePath: string): boolean {
    return !this.ignore.ignores(filePath);
  }

  /** Creates a copy of this matcher with additional gitignore rules */
  extend(rules: readonly string[]): GitignoreMatcher {
    return new GitignoreMatcher([... this.rules, ...rules]);
  }
}