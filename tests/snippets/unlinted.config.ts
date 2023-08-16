import { Config, UserConfig } from 'unlinted';

export default function config(defaultConfig: Config): UserConfig {
  return {
    exclude: [...defaultConfig.exclude, 'example.txt'],
    rules: {
      PATH_VALIDATION: {
        rules: {
          DS_STORE: false,
        },
      },
    },
  };
}
