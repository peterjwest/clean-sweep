import lodash from 'lodash';

import { Config } from './config';

/** Checks a config for invalid rule combinations, returns a list of errors */
export default function checkConfig(config: Config): string[] {
  const errors: string[] = [];

  const contentConfig = config.rules.CONTENT_VALIDATION;

  if (!contentConfig.enabled) return errors;
  if (contentConfig.rules.MALFORMED_ENCODING.enabled && contentConfig.rules.UNEXPECTED_ENCODING.enabled) return errors;

  if (!contentConfig.rules.MALFORMED_ENCODING.enabled && contentConfig.rules.UNEXPECTED_ENCODING.enabled) {
    errors.push('MALFORMED_ENCODING must be enabled for UNEXPECTED_ENCODING to be enabled');
  }

  const enabledRules = Object.entries(
    lodash.omit(contentConfig.rules, ['MALFORMED_ENCODING', 'UNEXPECTED_ENCODING'])).filter((rule) => rule[1].enabled
  );
  if (enabledRules.length === 0) return errors;

  const enabledRuleList = enabledRules.map(([name]) => name).join(', ');
  errors.push(`MALFORMED_ENCODING and UNEXPECTED_ENCODING must be enabled for ${enabledRuleList} to be enabled`);

  return errors;
}