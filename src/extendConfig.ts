import lodash from 'lodash';

import { GenericRulesetConfig, RuleConfig, Config, ExtendConfig, ExtendedConfig } from './config';
import GitignoreMatcher from './GitignoreMatcher';

/**
 * Extends a ruleset to include utility functions
 * @var ruleset - The ruleset config to be extended
 * @var parentMatcher - The matcher for the parent config, to inherit exclusion rules
 */
function extendRuleset(ruleset: GenericRulesetConfig, parentMatcher: GitignoreMatcher): ExtendConfig<GenericRulesetConfig> {
  const matcher = parentMatcher.extend(ruleset.exclude);

  const rules = lodash.mapValues(ruleset.rules, (rule) => {
    return 'rules' in rule ? extendRuleset(rule, matcher) : extendRules(rule, matcher);
  });

  return {
    ...ruleset,
    rules,
    filterFiles: (filePaths: string[]) => ruleset.enabled ? matcher.filter(filePaths) : [],
    enabledFor: (filePath: string) => ruleset.enabled && matcher.matches(filePath),
  };
}

/**
 * Extends a rule to include utility functions
 * @var rule - The rule config to be extended
 * @var parentMatcher - The matcher for the parent config, to inherit exclusion rules
 */
function extendRules(rule: RuleConfig, parentMatcher: GitignoreMatcher): ExtendConfig<RuleConfig> {
  const matcher = parentMatcher.extend(rule.exclude);
  return {
    ...rule,
    filterFiles: (filePaths: string[]) => rule.enabled ? matcher.filter(filePaths) : [],
    enabledFor: (filePath: string) => rule.enabled && matcher.matches(filePath),
  };
}

/** Extends a config to include utility functions */
export default function extendConfig(config: Config): ExtendedConfig {
  // Cast here as we transition from generic back to specific rules
  return extendRuleset(config, new GitignoreMatcher([])) as ExtendedConfig;
}