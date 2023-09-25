import { UserConfig } from 'unlinted';

export default {
  exclude: (defaults) => [...defaults, 'example.txt'],
  rules: {
    PATH_VALIDATION: {
      rules: {
        DS_STORE: false,
      },
    },
  },
} satisfies UserConfig;
