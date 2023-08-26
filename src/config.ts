import { z } from "zod";

import { DEFAULT_CONTENT_EXCLUDED } from './constants';
import { ExpandRecursive } from './util';
import { RULES, RULESETS } from './rules';

export type PlainConfigKey = 'exclude' | 'enabled' | 'allowed';
export type HelperKey = 'enabledFor' | 'filterFiles';

/** Helper type to extend a ruleset with utility functions */
export type ExtendRuleset<T extends Rulesets> = (T & {
  rules: ExtendRules<T['rules']>;
  enabledFor: (filePath: string) => boolean;
  filterFiles: (filePaths: string[]) => string[];
});

/** Helper type to extend a rule with utility functions */
export type ExtendRule<T> = {
  [P in keyof T | HelperKey]: (
    (P extends keyof T ? T[P] :
      (P extends 'enabledFor' ? (filePath: string) => boolean : (filePaths: string[]) => string[])
    )
  );
};

/** Helper type to extend a rules object with utility functions */
export type ExtendRules<T extends Rulesets['rules']> = {
  [P in keyof T]: (T[P] extends Rulesets ? ExtendRuleset<T[P]> : ExtendRule<T[P]>);
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

function partialRules<RulesType extends z.ZodRawShape>({ rules }: { rules: z.ZodObject<RulesType> }) {
  return { rules: rules.partial() };
}

function createPartialRule<Type extends z.ZodRawShape>(rule: z.ZodObject<Type>) {
  return z.union([rule.partial(), z.boolean()]);
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
export type Rulesets = Config | PathRuleset | ContentRuleset | Utf8Ruleset;

export type ExtendedConfig = ExtendRuleset<Config>;
export type ExtendedPathConfig = ExtendedConfig['rules']['PATH_VALIDATION'];
export type ExtendedContentConfig = ExtendedConfig['rules']['CONTENT_VALIDATION'];
export type ExtendedUtf8Config = ExtendedContentConfig['rules']['UTF8_VALIDATION'];

const PartialRuleConfig = createPartialRule(RuleConfig);

export const UserConfig = RulesetConfig.extend(partialRules(createRules({
  PATH_VALIDATION: createPartialRule(
    RulesetConfig.extend(partialRules(createRules({
      DS_STORE: PartialRuleConfig,
      UPPERCASE_EXTENSION: PartialRuleConfig,
      IGNORED_COMMITTED_FILE: PartialRuleConfig,
    }))),
  ),
  CONTENT_VALIDATION: createPartialRule(
    RulesetConfig.extend(partialRules(createRules({
      MALFORMED_ENCODING: PartialRuleConfig,
      UNEXPECTED_ENCODING: PartialRuleConfig,
      CARRIAGE_RETURN: PartialRuleConfig,
      TAB: PartialRuleConfig,
      TRAILING_WHITESPACE: PartialRuleConfig,
      MULTIPLE_FINAL_NEWLINES: PartialRuleConfig,
      NO_FINAL_NEWLINE: createPartialRule(RuleConfig),
      UNEXPECTED_CHARACTER: createPartialRule(
        RuleConfig.extend({ allowed: z.array(z.string()).readonly() }),
      ),
      UTF8_VALIDATION: createPartialRule(
        RulesetConfig.extend(partialRules(createRules({
          INVALID_BYTE: createPartialRule(RuleConfig),
          UNEXPECTED_CONTINUATION_BYTE: createPartialRule(RuleConfig),
          MISSING_CONTINUATION_BYTE: createPartialRule(RuleConfig),
          OVERLONG_BYTE_SEQUENCE: createPartialRule(RuleConfig),
          INVALID_CODE_POINT: createPartialRule(RuleConfig),
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
