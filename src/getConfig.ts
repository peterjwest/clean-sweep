import { join, resolve } from 'path';
import z from 'zod';

import { DEFAULT_CONFIG, Config, UserConfig } from './config';
import checkConfig from './checkConfig';
import combineConfig from './combineConfig';
import { currentDirectory, importModule, getZodErrors, fileReadable, ErrorWithFailures } from './util';

/** Parses a Config with zod and wraps any ZodErrors */
export function parseConfig(configObject: unknown): UserConfig {
  try {
    return UserConfig.parse(configObject);
  } catch (error: unknown) {
    throw new ErrorWithFailures('Config invalid', getZodErrors(error as z.ZodError));
  }
}

/** Gets the specified or inferred path for the config */
export async function getConfigPath(
  projectDir: string,
  userConfigPath?: string,
  deps = { fileReadable, currentDirectory }
): Promise<string | undefined> {
  const DEFAULT_TS_CONFIG = join(projectDir, 'unlinted.config.ts');
  const DEFAULT_JS_CONFIG = join(projectDir, 'unlinted.config.js');
  const DEFAULT_JSON_CONFIG = join(projectDir, 'unlinted.config.json');

  if (userConfigPath) return resolve(deps.currentDirectory(), userConfigPath);
  else if (await deps.fileReadable(DEFAULT_TS_CONFIG)) return DEFAULT_TS_CONFIG;
  else if (await deps.fileReadable(DEFAULT_JS_CONFIG)) return DEFAULT_JS_CONFIG;
  else if (await deps.fileReadable(DEFAULT_JSON_CONFIG)) return DEFAULT_JSON_CONFIG;
}

/** Get full configuration, combining default with user config */
export default async function getConfig(
  projectDir: string,
  userConfigPath?: string,
  deps = { getConfigPath, importModule },
): Promise<[Config, string | undefined]> {
  const configPath = await deps.getConfigPath(projectDir, userConfigPath);
  const configModule: unknown = configPath ? await deps.importModule(configPath) : undefined;

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

  return [config, userConfigPath ? userConfigPath : configPath];
}
