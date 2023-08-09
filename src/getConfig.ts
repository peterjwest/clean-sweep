import { DEFAULT_CONFIG, ExtendedConfig } from './config';
import checkConfig from './checkConfig';
import combineConfig from './combineConfig';
import extendConfig from './extendConfig';
import { fileReadable, ErrorWithFailures } from './util';

/** Get full configuration, combining default with user config */
export default async function getConfig(): Promise<[ExtendedConfig, string | undefined]> {
  let configPath: string | undefined;
  if (await fileReadable('./clean-sweep.config.ts')) configPath = 'clean-sweep.config.ts';
  else if (await fileReadable('./clean-sweep.config.js')) configPath = 'clean-sweep.config.js';

  const userConfig = configPath ? (await import('../clean-sweep.config.js')).default(DEFAULT_CONFIG) : undefined;
  const config = userConfig ? combineConfig(DEFAULT_CONFIG, userConfig) : DEFAULT_CONFIG;

  const errors = checkConfig(config);
  if (errors.length) {
    throw new ErrorWithFailures('Config invalid', errors);
  }

  return [extendConfig(config), configPath];
}