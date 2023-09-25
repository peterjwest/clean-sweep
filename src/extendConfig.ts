import { RuleConfig, Config, ExtendRuleset, ExtendRules, ExtendRule, AnyRuleset } from './config';
import GitignoreMatcher from './GitignoreMatcher';


/** Filters a list of files in a Config, Ruleset or Rule */
export function filterFiles(this: { enabled: boolean; matcher: GitignoreMatcher }, filePaths: string[]): string[] {
  return this.enabled ? this.matcher.filter(filePaths) : [];
}

/** Returns if a file is enabled for a Config, Ruleset or Rule */
export function enabledFor(this: { enabled: boolean; matcher: GitignoreMatcher }, filePath: string): boolean {
  return this.enabled && this.matcher.matches(filePath);
}

/** Extends a config to include utility functions */
export default function extendConfig(config: Config): ExtendRuleset<Config> {
  return extendRuleset(config);
}

/**
 * Extends a ruleset to include utility functions
 * @var ruleset - The ruleset config to be extended
 * @var parentMatcher - The matcher for the parent config, to inherit exclusion rules
 */
export function extendRuleset<Ruleset extends AnyRuleset>(ruleset: Ruleset, parentMatcher?: GitignoreMatcher): ExtendRuleset<Ruleset> {
  const matcher = parentMatcher ? parentMatcher.extend(ruleset.exclude) : new GitignoreMatcher(ruleset.exclude);

  return {
    ...ruleset,
    rules: Object.fromEntries(Object.entries(ruleset.rules).map(([name, rule]: [string, AnyRuleset | RuleConfig]) => {
      return [name, rule.rules ? extendRuleset(rule, matcher) : extendRule(rule, matcher)];
    })) as ExtendRules<Ruleset>,
    matcher,
    filterFiles,
    enabledFor,
  };
}

/**
 * Extends a rule to include utility functions
 * @var rule - The rule config to be extended
 * @var parentMatcher - The matcher for the parent config, to inherit exclusion rules
 */
export function extendRule(rule: RuleConfig, parentMatcher: GitignoreMatcher): ExtendRule<RuleConfig> {
  return {
    ...rule,
    matcher: parentMatcher.extend(rule.exclude),
    filterFiles,
    enabledFor,
  };
}
