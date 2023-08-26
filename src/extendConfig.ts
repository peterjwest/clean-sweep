import { RuleConfig, Config, ExtendRuleset, ExtendRules, ExtendedConfig, ExtendRule, Rulesets } from './config';
import GitignoreMatcher from './GitignoreMatcher';

/**
 * Extends a ruleset to include utility functions
 * @var ruleset - The ruleset config to be extended
 * @var parentMatcher - The matcher for the parent config, to inherit exclusion rules
 */
export function extendRuleset<Ruleset extends Rulesets>(ruleset: Ruleset, parentMatcher: GitignoreMatcher): ExtendRuleset<Ruleset> {
  const matcher = parentMatcher.extend(ruleset.exclude);
  const rules = Object.fromEntries(Object.entries(ruleset.rules).map(([name, rule]: [string, Rulesets | RuleConfig]) => {
    return [name, rule.rules ? extendRuleset(rule, matcher) : extendRule(rule, matcher)];
  })) as ExtendRules<Ruleset['rules']>;

  return {
    ...ruleset,
    rules: rules,
    filterFiles: (filePaths: string[]) => ruleset.enabled ? matcher.filter(filePaths) : [],
    enabledFor: (filePath: string) => ruleset.enabled && matcher.matches(filePath),
  };
}

/**
 * Extends a rule to include utility functions
 * @var rule - The rule config to be extended
 * @var parentMatcher - The matcher for the parent config, to inherit exclusion rules
 */
export function extendRule(rule: RuleConfig, parentMatcher: GitignoreMatcher): ExtendRule<RuleConfig> {
  const matcher = parentMatcher.extend(rule.exclude);
  return {
    ...rule,
    filterFiles: (filePaths: string[]) => rule.enabled ? matcher.filter(filePaths) : [],
    enabledFor: (filePath: string) => rule.enabled && matcher.matches(filePath),
    rules: undefined,
  };
}

/** Extends a config to include utility functions */
export default function extendConfig(config: Config): ExtendedConfig {
  return extendRuleset(config, new GitignoreMatcher([]));
}
