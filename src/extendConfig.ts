import lodash from 'lodash';

import { GenericRulesetConfig, RuleConfig, Config, ExtendConfig, ExtendedConfig } from './config';
import GitignoreMatcher from './GitignoreMatcher';

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

function extendRules(rule: RuleConfig, parentMatcher: GitignoreMatcher): ExtendConfig<RuleConfig> {
  const matcher = parentMatcher.extend(rule.exclude);
  return {
    ...rule,
    filterFiles: (filePaths: string[]) => rule.enabled ? matcher.filter(filePaths) : [],
    enabledFor: (filePath: string) => rule.enabled && matcher.matches(filePath),
  };
}

export default function extendConfig(config: Config): ExtendedConfig {
  // Cast here as we transition from generic back to specific rules
  return extendRuleset(config, new GitignoreMatcher([])) as ExtendedConfig;
}