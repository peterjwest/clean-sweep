import ignore from 'ignore';

/**
 * A class to match files against gitignore rules
 * @param rules - A list of gitignore rules
 */
export default class GitignoreMatcher {
  rules: readonly string[];
  constructor(rules: readonly string[]) {
    this.rules = rules;
  }

  /** Filters out ignored files from a list of file paths */
  filter(filePaths: readonly string[]): string[] {
    return ignore().add(this.rules).filter(filePaths);
  }

  /** Returns whether a filePath is matched (not ignored) */
  matches(filePath: string): boolean {
    return !ignore().add(this.rules).ignores(filePath);
  }

  /** Creates a copy of this matcher with additional gitignore rules */
  extend(rules: readonly string[]): GitignoreMatcher {
    return new GitignoreMatcher([...this.rules, ...rules]);
  }
}
