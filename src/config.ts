import { ExpandRecursive } from './util';
import { RuleName, RulesetName } from './rules';

/** Helper type for a rule which contains other rules */
type RulesetConfig<Type> = ExpandRecursive<{
  enabled: boolean;
  exclude: readonly string[];
  rules: {
    [Key in keyof Type]: Key extends RuleName | RulesetName ? Type[Key] : never;
  };
}>

export type RuleConfig = {
  enabled: boolean;
  exclude: readonly string[];
}

/** Helper type for a partial config, since user configs can be partially specified  */
export type PartialConfig<T> = ExpandRecursive<{
  [P in keyof T]?: P extends 'exclude' | 'enabled' ? T[P] : PartialConfigRules<T[P]>;
}>;

/** Helper type for partial config rules */
export type PartialConfigRules<T> = {
  [P in keyof T]?: PartialConfig<T[P]> | boolean;
};

/** Generic rules dictionary, used for manipulating rules */
export interface GenericRules {
  [key: string]: GenericRulesetConfig | RuleConfig;
}

/** Generic ruleset, used for manipulating rules */
export interface GenericRulesetConfig {
  enabled: boolean;
  exclude: readonly string[];
  rules: GenericRules;
}

/** Helper type to extend a config with utility functions */
export type ExtendConfig<T> = ExpandRecursive<{
  [P in keyof T | 'enabledFor' | 'filterFiles']: (
    (P extends keyof T ?
      (P extends 'exclude' | 'enabled' ? T[P] :
        (P extends 'rules' ? ExtendConfigRules<T[P]> :
          never
        )
      ) :
      (P extends 'enabledFor' ? (filePath: string) => boolean : (filePaths: string[]) => string[])
    )
  );
}>;

type ExtendConfigRules<T> = {
  [P in keyof T]: ExtendConfig<T[P]>;
};

/** Full configuration type */
export type Config = RulesetConfig<{
  PATH_VALIDATION: RulesetConfig<{
    DS_STORE: RuleConfig;
    UPPERCASE_EXTENSION: RuleConfig;
    IGNORED_COMMITTED_FILE: RuleConfig;
  }>;
  CONTENT_VALIDATION: RulesetConfig<{
    MALFORMED_ENCODING: RuleConfig;
    UNEXPECTED_ENCODING: RuleConfig;
    CARRIAGE_RETURN: RuleConfig;
    TAB: RuleConfig;
    TRAILING_WHITESPACE: RuleConfig;
    MULTIPLE_FINAL_NEWLINES: RuleConfig;
    NO_FINAL_NEWLINE: RuleConfig;
    UNEXPECTED_CHARACTER: RuleConfig;
    UTF8_VALIDATION: RulesetConfig<{
      INVALID_BYTE: RuleConfig;
      UNEXPECTED_CONTINUATION_BYTE: RuleConfig;
      MISSING_CONTINUATION_BYTE: RuleConfig;
      OVERLONG_BYTE_SEQUENCE: RuleConfig;
      INVALID_CODE_POINT: RuleConfig;
    }>;
  }>;
}>;

export type UserConfig = PartialConfig<Config>;

/**
 * Files which are excluded from content checks by default
 * Either because they are binary, or not usually edited as plaintext
 */
const DEFAULT_CONTENT_EXCLUDED = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.DS_Store',
  '*.sln',
  '*.wav',
  '*.mp3',
  '*.raw',
  '*.webm',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.png',
  '*.bmp',
  '*.ico',
  '*.ttf',
  '*.eot',
  '*.woff',
  '*.woff2',
  '*.deb',
  '*.bin',
  '*.exe',
  '*.pdf',
  '*.svg',
  '*.z',
  '*.cod',
  '*.fwu',
  '*.tar',
  '*.gz',
  '*.zip',
  '*.7z',
  '*.7zip',
] as const;

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
        UNEXPECTED_CHARACTER: { enabled: true, exclude: [] },
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
} as const satisfies GenericRulesetConfig;

export type ExtendedConfig = ExtendConfig<Config>;
export type ExtendedPathConfig = ExtendedConfig['rules']['PATH_VALIDATION'];
export type ExtendedContentConfig = ExtendedConfig['rules']['CONTENT_VALIDATION'];
export type ExtendedUtf8Config = ExtendedContentConfig['rules']['UTF8_VALIDATION'];
