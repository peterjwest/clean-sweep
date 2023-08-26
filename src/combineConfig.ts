import lodash from 'lodash';
import type { Entries } from 'type-fest';

import { RuleConfig, Config, UserConfig, PlainConfigKey, Rulesets } from './config';

/** Helper type for a partial config, since user configs can be partially specified  */
export type PartialConfig<T> = {
  [P in keyof T]?: P extends PlainConfigKey ? T[P] : PartialConfigRules<T[P]>;
};

/** Helper type for partial config rules */
export type PartialConfigRules<T> = {
  [P in keyof T]?: PartialConfig<T[P]> | boolean;
};

/**
 * Combines the default rules of a ruleset, with user specified rules.
 * If a user rule is boolean it is expanded  to a full rule
 * If a user rule is undefined it is ignored
 */
function combineRules<Ruleset extends Rulesets>(defaultRules: Ruleset['rules'], rules: PartialConfigRules<Ruleset['rules']>): Ruleset['rules'] {
  return Object.fromEntries((Object.entries(defaultRules) as Entries<Ruleset['rules']>).map(([name, defaultRule]) => {
    const ruleName = name as keyof Ruleset['rules'];
    if (!(ruleName in rules)) return [ruleName, defaultRule];
    return [ruleName, defaultRule.rules ? combineRuleset(defaultRule, rules[ruleName]) : combineRule(defaultRule, rules[ruleName])];
  })) as Ruleset['rules'];
}

/**
 * Combines a default ruleset with a user specified ruleset.
 * If the user ruleset is boolean it is expanded to a full ruleset
 * If the user ruleset is undefined it is ignored
 */
function combineRuleset<Ruleset extends Rulesets>(defaultRuleset: Ruleset, ruleset: PartialConfig<Ruleset> | boolean | undefined): Ruleset {
  if (ruleset === undefined) return defaultRuleset;

  const expandedRule = typeof ruleset === 'boolean' ? { enabled: ruleset, rules: undefined } : ruleset;
  return {
    ...defaultRuleset,
    ...lodash.omitBy(expandedRule, (value) => value === undefined),
    rules: expandedRule.rules ? combineRules(defaultRuleset.rules, expandedRule.rules) : defaultRuleset.rules,
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
  return combineRuleset(defaultConfig, config);
}
