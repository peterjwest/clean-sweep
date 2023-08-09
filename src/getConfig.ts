import { DEFAULT_CONFIG, Config, ExtendedConfig } from './config';
import checkConfig from './checkConfig';
import compileConfig from './compileConfig';
import extendConfig from './extendConfig';
import { fileReadable, ErrorWithFailures } from './util';

/** Get full configuration, combining default with user config */
export default async function getConfig(): Promise<[ExtendedConfig, string | undefined]> {
  let config: Config;
  let configPath: string | undefined;

  if (await fileReadable('./clean-sweep.config.ts')) {
    configPath = 'clean-sweep.config.ts';
    const userConfig = (await import('../clean-sweep.config')).default;
    config = compileConfig(DEFAULT_CONFIG, userConfig(DEFAULT_CONFIG));
  }
  else if (await fileReadable('./clean-sweep.config.js')) {
    configPath = 'clean-sweep.config.js';
    const userConfig = (await import('../clean-sweep.config.js')).default;
    config = compileConfig(DEFAULT_CONFIG, userConfig(DEFAULT_CONFIG));
  }
  else {
    config = DEFAULT_CONFIG;
  }

  const errors = checkConfig(config);
  if (errors.length) {
    throw new ErrorWithFailures('Config invalid', errors);
  }

  return [extendConfig(config), configPath];
}