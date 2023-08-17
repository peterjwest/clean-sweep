import { join, resolve } from 'path';
import z from 'zod';
import { fromZodError } from 'zod-validation-error';

import { DEFAULT_CONFIG, ExtendedConfig, UserConfig } from './config';
import checkConfig from './checkConfig';
import combineConfig from './combineConfig';
import extendConfig from './extendConfig';
import { fileReadable, ErrorWithFailures } from './util';

/** Return an array of (slightly) more user friendly errors from ZodError */
function getZodErrors(error: z.ZodError) {
  return fromZodError(error, { issueSeparator: '\n', prefix: null }).message.split('\n');
}

/** Parses a Config with zod and wraps any ZodErrors */
function parseConfig(configObject: unknown): UserConfig {
  try {
    return UserConfig.parse(configObject);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new ErrorWithFailures('Config invalid', getZodErrors(error));
    }
    throw error;
  }
}

/** Get full configuration, combining default with user config */
export default async function getConfig(projectDir: string, userConfigPath?: string): Promise<[ExtendedConfig, string | undefined]> {
  const DEFAULT_TS_CONFIG = join(projectDir, 'unlinted.config.ts');
  const DEFAULT_JS_CONFIG = join(projectDir, 'unlinted.config.js');
  const DEFAULT_JSON_CONFIG = join(projectDir, 'unlinted.config.json');

  let configPath: string | undefined;

  if (userConfigPath) configPath = resolve(process.cwd(), userConfigPath);
  else if (await fileReadable(DEFAULT_TS_CONFIG)) configPath = DEFAULT_TS_CONFIG;
  else if (await fileReadable(DEFAULT_JS_CONFIG)) configPath = DEFAULT_JS_CONFIG;
  else if (await fileReadable(DEFAULT_JSON_CONFIG)) configPath = DEFAULT_JSON_CONFIG;

  const configModule: unknown = configPath ? await import(configPath) : undefined;
  // Unwrap default export if it exists
  const configEntity = configModule && typeof configModule === 'object' && 'default' in configModule ? configModule.default : configModule;
  // If the config is a function, run it with the default config
  const configObject: unknown = typeof configEntity === 'function' ? configEntity(DEFAULT_CONFIG) : configEntity;
  // Parse with zod to ensure the type is correct
  const userConfig: UserConfig | undefined = configObject ? parseConfig(configObject) : undefined;
  const config = userConfig ? combineConfig(DEFAULT_CONFIG, userConfig) : DEFAULT_CONFIG;

  const errors = checkConfig(config);
  if (errors.length) {
    throw new ErrorWithFailures('Config invalid', errors);
  }

  return [extendConfig(config), userConfigPath ? userConfigPath : configPath];
}
