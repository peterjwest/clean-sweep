import lodash from 'lodash';

import { RuleConfig, Config, UserConfig, PartialConfig, PartialConfigRules, GenericRules, GenericRulesetConfig } from './config';

function compileRules(defaultRules: GenericRules, rules: PartialConfigRules<GenericRules>): GenericRules {
  return lodash.mapValues(defaultRules, (defaultRule, name) => {
    if (!(name in rules)) return defaultRule;
    // Casts here because we assume that the default config structure matches the partial structure
    if ('rules' in defaultRule) {
      return compileRuleset(defaultRule, rules[name]);
    }
    return compileRule(defaultRule, rules[name]);
  });
}

function compileRuleset(defaultRule: GenericRulesetConfig, rawRule: PartialConfig<GenericRulesetConfig> | boolean | undefined): GenericRulesetConfig {
  const rule = typeof rawRule === 'object' ? rawRule : (typeof rawRule === 'boolean' ? { enabled: rawRule } : undefined);
  if (!rule) return defaultRule;

  return {
    enabled: rule.enabled !== undefined ? rule.enabled : defaultRule.enabled,
    exclude: rule.exclude ? rule.exclude : defaultRule.exclude,
    rules: rule.rules ? compileRules(defaultRule.rules, rule.rules) : defaultRule.rules,
  };
}

function compileRule(rawDefaultRule: RuleConfig | boolean, rawRule: PartialConfig<RuleConfig> | boolean | undefined): RuleConfig {
  const defaultRule = typeof rawDefaultRule === 'object' ? rawDefaultRule : { enabled: rawDefaultRule, exclude: [] };
  const rule = typeof rawRule === 'object' ? rawRule : (typeof rawRule === 'boolean' ? { enabled: rawRule } : undefined);

  return {
    enabled: rule && rule.enabled !== undefined ? rule.enabled : defaultRule.enabled,
    exclude: rule && rule.exclude ? rule.exclude : defaultRule.exclude,
  };
}

export default function compileConfig(defaultConfig: Config, config: UserConfig): Config {
  // Cast here as we transition from generic back to specific rules
  return compileRuleset(defaultConfig, config) as Config;
}