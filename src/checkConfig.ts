import lodash from 'lodash';

import { Config } from './config';

export default function checkConfig(config: Config): string[] {
  const failures: string[] = [];

  const contentConfig = config.rules.CONTENT_VALIDATION;

  if (!contentConfig.enabled) return failures;
  if (contentConfig.rules.MALFORMED_ENCODING.enabled && contentConfig.rules.UNEXPECTED_ENCODING.enabled) return failures;

  if (!contentConfig.rules.MALFORMED_ENCODING.enabled && contentConfig.rules.UNEXPECTED_ENCODING.enabled) {
    failures.push('MALFORMED_ENCODING must be enabled for UNEXPECTED_ENCODING to be enabled');
  }

  const enabledRules = Object.entries(
    lodash.omit(contentConfig.rules, ['MALFORMED_ENCODING', 'UNEXPECTED_ENCODING'])).filter((rule) => rule[1].enabled
  );
  if (enabledRules.length === 0) return failures;

  const enabledRuleList = enabledRules.map(([name]) => name).join(', ');
  failures.push(`MALFORMED_ENCODING and UNEXPECTED_ENCODING must be enabled for ${enabledRuleList} to be enabled`);

  return failures;
}