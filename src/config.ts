import { z } from "zod";

import GitignoreMatcher from './GitignoreMatcher';
import { DEFAULT_CONTENT_EXCLUDED } from './constants';
import { ExpandRecursive } from './util';
import { RULES, RULESETS } from './rules';

export type PlainConfigKey = 'exclude' | 'enabled' | 'allowed';

/** Helper type to extend a ruleset with utility functions */
export type ExtendRuleset<Ruleset extends AnyRuleset> = Ruleset & {
  rules: ExtendRules<Ruleset>;
  matcher: GitignoreMatcher;
  enabledFor: (this: { enabled: boolean; matcher: GitignoreMatcher }, filePath: string) => boolean;
  filterFiles: (this: { enabled: boolean; matcher: GitignoreMatcher }, filePaths: string[]) => string[];
};

/** Helper type to extend a rule with utility functions */
export type ExtendRule<Rule> = Rule & {
  matcher: GitignoreMatcher;
  enabledFor: (this: { enabled: boolean; matcher: GitignoreMatcher }, filePath: string) => boolean;
  filterFiles: (this: { enabled: boolean; matcher: GitignoreMatcher }, filePaths: string[]) => string[];
};

/** Helper type to extend a rules object with utility functions */
export type ExtendRules<Ruleset extends AnyRuleset> = {
  [Property in keyof Ruleset['rules']]: (
    Ruleset['rules'][Property] extends AnyRuleset ? ExtendRuleset<Ruleset['rules'][Property]> :
    ExtendRule<Ruleset['rules'][Property]>
  );
};

export const RuleConfig = z.object({
  enabled: z.boolean(),
  exclude: z.array(z.string()).readonly(),
  rules: z.undefined().optional(),
}).strict();

export type RuleConfig = z.infer<typeof RuleConfig>;

export const RulesetConfig = z.object({
  enabled: z.boolean(),
  exclude: z.array(z.string()).readonly(),
}).strict();

export function createRules<RulesType extends z.ZodRawShape>(rules: RulesType): { rules: z.ZodObject<RulesType> } {
  for (const key in rules) {
    if (!(key in RULES) && !(key in RULESETS)) {
      throw new Error(`Rule ${key} is not a valid rule`);
    }
  }
  return { rules: z.object(rules).strict() };
}

const Config = RulesetConfig.extend(createRules({
  PATH_VALIDATION: RulesetConfig.extend(createRules({
    DS_STORE: RuleConfig,
    UPPERCASE_EXTENSION: RuleConfig,
    IGNORED_COMMITTED_FILE: RuleConfig,
  })),
  CONTENT_VALIDATION: RulesetConfig.extend(createRules({
    MALFORMED_ENCODING: RuleConfig,
    UNEXPECTED_ENCODING: RuleConfig,
    CARRIAGE_RETURN: RuleConfig,
    TAB: RuleConfig,
    TRAILING_WHITESPACE: RuleConfig,
    MULTIPLE_FINAL_NEWLINES: RuleConfig,
    NO_FINAL_NEWLINE: RuleConfig,
    UNEXPECTED_CHARACTER: RuleConfig.extend({
      allowed: z.array(z.string()).readonly(),
    }),
    UTF8_VALIDATION: RulesetConfig.extend(createRules({
      INVALID_BYTE: RuleConfig,
      UNEXPECTED_CONTINUATION_BYTE: RuleConfig,
      MISSING_CONTINUATION_BYTE: RuleConfig,
      OVERLONG_BYTE_SEQUENCE: RuleConfig,
      INVALID_CODE_POINT: RuleConfig,
    })),
  })),
}));

export type Config = ExpandRecursive<z.infer<typeof Config>>;

export type PathRuleset = Config['rules']['PATH_VALIDATION'];
export type ContentRuleset = Config['rules']['CONTENT_VALIDATION'];
export type Utf8Ruleset = ContentRuleset['rules']['UTF8_VALIDATION'];
export type AnyRuleset = Config | PathRuleset | ContentRuleset | Utf8Ruleset;

export type ExtendedConfig = ExtendRuleset<Config>;
export type ExtendedPathConfig = ExtendedConfig['rules']['PATH_VALIDATION'];
export type ExtendedContentConfig = ExtendedConfig['rules']['CONTENT_VALIDATION'];
export type ExtendedUtf8Config = ExtendedContentConfig['rules']['UTF8_VALIDATION'];

function partialRules<RulesType extends z.ZodRawShape>({ rules }: { rules: z.ZodObject<RulesType> }) {
  return { rules: rules.partial().optional() };
}

function ruleOrBoolean<Type extends z.ZodRawShape>(rule: z.ZodObject<Type>) {
  return z.union([rule, z.boolean()]);
}

/** This is messy because Zod cannot create a Function type with a readonly argument */
export type ExcludeFunction = (defaults: readonly string[]) => readonly string[];
export const ExcludeFunction = (
  z.function()
  .args(z.array(z.string()).readonly())
  .returns(z.array(z.string()).readonly())
) as unknown as z.ZodType<ExcludeFunction>;

export const PartialRuleConfig = z.object({
  enabled: z.boolean(),
  exclude: z.union([z.array(z.string()).readonly(), ExcludeFunction]),
  rules: z.undefined().optional(),
}).strict().partial();

export const PartialRulesetConfig = z.object({
  enabled: z.boolean(),
  exclude: z.union([z.array(z.string()).readonly(), ExcludeFunction]),
}).strict().partial();

export const UserConfig = PartialRulesetConfig.extend(partialRules(createRules({
  PATH_VALIDATION: ruleOrBoolean(
    PartialRulesetConfig.extend(partialRules(createRules({
      DS_STORE: ruleOrBoolean(PartialRuleConfig),
      UPPERCASE_EXTENSION: ruleOrBoolean(PartialRuleConfig),
      IGNORED_COMMITTED_FILE: ruleOrBoolean(PartialRuleConfig),
    }))),
  ),
  CONTENT_VALIDATION: ruleOrBoolean(
    PartialRulesetConfig.extend(partialRules(createRules({
      MALFORMED_ENCODING: ruleOrBoolean(PartialRuleConfig),
      UNEXPECTED_ENCODING: ruleOrBoolean(PartialRuleConfig),
      CARRIAGE_RETURN: ruleOrBoolean(PartialRuleConfig),
      TAB: ruleOrBoolean(PartialRuleConfig),
      TRAILING_WHITESPACE: ruleOrBoolean(PartialRuleConfig),
      MULTIPLE_FINAL_NEWLINES: ruleOrBoolean(PartialRuleConfig),
      NO_FINAL_NEWLINE: ruleOrBoolean(PartialRuleConfig),
      UNEXPECTED_CHARACTER: ruleOrBoolean(
        PartialRuleConfig.extend({ allowed: z.array(z.string()).readonly() }),
      ),
      UTF8_VALIDATION: ruleOrBoolean(
        PartialRulesetConfig.extend(partialRules(createRules({
          INVALID_BYTE: ruleOrBoolean(PartialRuleConfig),
          UNEXPECTED_CONTINUATION_BYTE: ruleOrBoolean(PartialRuleConfig),
          MISSING_CONTINUATION_BYTE: ruleOrBoolean(PartialRuleConfig),
          OVERLONG_BYTE_SEQUENCE: ruleOrBoolean(PartialRuleConfig),
          INVALID_CODE_POINT: ruleOrBoolean(PartialRuleConfig),
        }))),
      ),
    }))),
  ),
}))).partial();

export type UserConfig = ExpandRecursive<z.infer<typeof UserConfig>>;

/** Default full configuration */
export const DEFAULT_CONFIG: Config = {
  enabled: true,
  exclude: [],
  rules: {
    PATH_VALIDATION: {
      enabled: true,
      exclude: [],
      rules: {
        DS_STORE: { enabled: true, exclude: [] },
        UPPERCASE_EXTENSION: { enabled: true, exclude: [] },
        IGNORED_COMMITTED_FILE: { enabled: true, exclude: [] },
      },
    },
    CONTENT_VALIDATION: {
      enabled: true,
      exclude: DEFAULT_CONTENT_EXCLUDED,
      rules: {
        MALFORMED_ENCODING: { enabled: true, exclude: [] },
        UNEXPECTED_ENCODING: { enabled: true, exclude: [] },
        CARRIAGE_RETURN: { enabled: true, exclude: [] },
        TAB: { enabled: true, exclude: [] },
        TRAILING_WHITESPACE: { enabled: true, exclude: [] },
        MULTIPLE_FINAL_NEWLINES: { enabled: true, exclude: [] },
        NO_FINAL_NEWLINE: { enabled: true, exclude: [] },
        UNEXPECTED_CHARACTER: { enabled: true, exclude: [], allowed: [] },
        UTF8_VALIDATION: {
          enabled: true,
          exclude: [],
          rules: {
            INVALID_BYTE: { enabled: true, exclude: [] },
            UNEXPECTED_CONTINUATION_BYTE: { enabled: true, exclude: [] },
            MISSING_CONTINUATION_BYTE: { enabled: true, exclude: [] },
            OVERLONG_BYTE_SEQUENCE: { enabled: true, exclude: [] },
            INVALID_CODE_POINT: { enabled: true, exclude: [] },
          },
        },
      },
    },
  },
};
