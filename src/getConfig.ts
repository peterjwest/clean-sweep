import { join, resolve } from 'path';


import { DEFAULT_CONFIG, ExtendedConfig, UserConfig } from './config';
import checkConfig from './checkConfig';
import combineConfig from './combineConfig';
import extendConfig from './extendConfig';
import { fileReadable, ErrorWithFailures } from './util';

/** Get full configuration, combining default with user config */
export default async function getConfig(projectDir: string, userConfigPath?: string): Promise<[ExtendedConfig, string | undefined]> {
  const DEFAULT_TS_CONFIG = join(projectDir, 'unlint.config.ts');
  const DEFAULT_JS_CONFIG = join(projectDir, 'unlint.config.js');
  const DEFAULT_JSON_CONFIG = join(projectDir, 'unlint.config.json');

  let configPath: string | undefined;

  if (userConfigPath) configPath = resolve(process.cwd(), userConfigPath);
  else if (await fileReadable(DEFAULT_TS_CONFIG)) configPath = DEFAULT_TS_CONFIG;
  else if (await fileReadable(DEFAULT_JS_CONFIG)) configPath = DEFAULT_JS_CONFIG;
  else if (await fileReadable(DEFAULT_JSON_CONFIG)) configPath = DEFAULT_JSON_CONFIG;

  // TODO: Check extension, respond appropriately
  // import { readFile } from 'fs/promises';
  // const json = JSON.parse(await readFile());

  const configModule: unknown = configPath ? await import(configPath) : undefined;
  // Unwrap default export if it exists
  const configEntity = configModule && typeof configModule === 'object' && 'default' in configModule ? configModule.default : configModule;
  // If the config is a function, run it with the default config
  const configObject: unknown = typeof configEntity === 'function' ? configEntity(DEFAULT_CONFIG) : configEntity;

  // TODO: Validate with ZOD
  const userConfig: UserConfig | undefined = configObject ? configObject : undefined;
  const config = userConfig ? combineConfig(DEFAULT_CONFIG, userConfig) : DEFAULT_CONFIG;

  const errors = checkConfig(config);
  if (errors.length) {
    throw new ErrorWithFailures('Config invalid', errors);
  }

  return [extendConfig(config), userConfigPath ? userConfigPath : configPath];
}
