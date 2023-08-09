import lodash from 'lodash';

import { RuleConfig, Config, UserConfig, PartialConfig, PartialConfigRules, GenericRules, GenericRulesetConfig } from './config';

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
    enabled: expandedRule.enabled !== undefined ? expandedRule.enabled : defaultRule.enabled,
    exclude: expandedRule.exclude !== undefined ? expandedRule.exclude : defaultRule.exclude,
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
    enabled: expandedRule.enabled !== undefined ? expandedRule.enabled : defaultRule.enabled,
    exclude: expandedRule.exclude !== undefined ? expandedRule.exclude : defaultRule.exclude,
  };
}

/** Combines a default config with a user config  */
export default function combineConfig(defaultConfig: Config, config: UserConfig): Config {
  // Cast here as we transition from generic back to specific rules
  return combineRuleset(defaultConfig, config) as Config;
}