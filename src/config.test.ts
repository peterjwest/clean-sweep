import { describe, test } from 'vitest';
import assert from 'assert';

import { createRules, RuleConfig, RulesetConfig } from './config';

describe('createRules', () => {
  test('Returns an object with a rules property with the supplied rules', () => {
    const rules = {
      UPPERCASE_EXTENSION: RuleConfig,
      UNEXPECTED_CONTINUATION_BYTE: RuleConfig,
      INVALID_CODE_POINT: RuleConfig,
      OVERLONG_BYTE_SEQUENCE: RuleConfig,
      CONTENT_VALIDATION: RuleConfig,
    };

    const rulesObject = createRules(rules);
    assert.deepStrictEqual(Object.keys(rulesObject), ['rules']);
    assert.strictEqual(rulesObject.rules.shape, rules);
  });

  test('Returns a nested object with a rules property with the supplied rules', () => {
    const rules = {
      UPPERCASE_EXTENSION: RuleConfig,
      UNEXPECTED_CONTINUATION_BYTE: RuleConfig,
      INVALID_CODE_POINT: RuleConfig,
      OVERLONG_BYTE_SEQUENCE: RuleConfig,
      UTF8_VALIDATION: RulesetConfig.extend(createRules({
        INVALID_BYTE: RuleConfig,
        UNEXPECTED_CONTINUATION_BYTE: RuleConfig,
        MISSING_CONTINUATION_BYTE: RuleConfig,
        OVERLONG_BYTE_SEQUENCE: RuleConfig,
        INVALID_CODE_POINT: RuleConfig,
      })),
    };

    const rulesObject = createRules(rules);
    assert.deepStrictEqual(Object.keys(rulesObject), ['rules']);
    assert.strictEqual(rulesObject.rules.shape, rules);
  });

  test('Throws an error if the rules have invalid names', () => {
    const rules = {
      UPPERCASE_EXTENSION: RuleConfig,
      UNEXPECTED_CONTINUATION_BYTE: RuleConfig,
      BANANA: RuleConfig,
      OVERLONG_BYTE_SEQUENCE: RuleConfig,
      CONTENT_VALIDATION: RuleConfig,
    };

    assert.throws(() => createRules(rules), new Error('Rule BANANA is not a valid rule'));
  });
});
