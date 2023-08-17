import lodash from 'lodash';

import { ExpandRecursive } from './util';
import { RuleConfig, Config, UserConfig, PlainConfigKey, GenericRules, GenericRulesetConfig } from './config';

/** Helper type for a partial config, since user configs can be partially specified  */
export type PartialConfig<T> = ExpandRecursive<{
  [P in keyof T]?: P extends PlainConfigKey ? T[P] : PartialConfigRules<T[P]>;
}>;

/** Helper type for partial config rules */
export type PartialConfigRules<T> = {
  [P in keyof T]?: PartialConfig<T[P]> | boolean;
};

/**
 * Combines the default rules of a ruleset, with user specified rules.
 * If a user rule is boolean it is expanded  to a full rule
 * If a user rule is undefined it is ignored
 */
function combineRules(defaultRules: GenericRules, rules: PartialConfigRules<GenericRules>): GenericRules {
  return lodash.mapValues(defaultRules, (defaultRule, name) => {
    if (!(name in rules)) return defaultRule;
    if ('rules' in defaultRule) {
      return combineRuleset(defaultRule, rules[name]);
    }
    return combineRule(defaultRule, rules[name]);
  });
}

/**
 * Combines a default ruleset with a user specified ruleset.
 * If the user ruleset is boolean it is expanded to a full ruleset
 * If the user ruleset is undefined it is ignored
 */
function combineRuleset(defaultRule: GenericRulesetConfig, rule: PartialConfig<GenericRulesetConfig> | boolean | undefined): GenericRulesetConfig {
  if (rule === undefined) return defaultRule;

  const expandedRule = typeof rule === 'boolean' ? { enabled: rule } : rule;
  return {
    ...defaultRule,
    ...lodash.omitBy(expandedRule, (value) => value === undefined),
    rules: expandedRule.rules !== undefined ? combineRules(defaultRule.rules, expandedRule.rules) : defaultRule.rules,
  };
}

/**
 * Combines a default rule with a user specified rule.
 * If the user rule is boolean it is expanded to a full rule
 * If the user rule is undefined it is ignored
 */
function combineRule(defaultRule: RuleConfig, rule: PartialConfig<RuleConfig> | boolean | undefined): RuleConfig {
  if (rule === undefined) return defaultRule;

  const expandedRule = typeof rule === 'boolean' ? { enabled: rule } : rule;
  return {
    ...defaultRule,
    ...lodash.omitBy(expandedRule, (value) => value === undefined),
  };
}

/** Combines a default config with a user config  */
export default function combineConfig(defaultConfig: Config, config: UserConfig): Config {
  // Cast here as we transition from generic back to specific rules
  return combineRuleset(defaultConfig, config) as Config;
}
