import { UserConfig } from './src';

export default {
  exclude: ['tests/snippets/node_modules', 'tests/snippets/files'],
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UNEXPECTED_CHARACTER: {
          allowed: ['✓', '×', '▰', '▱'],
        },
      },
    },
  },
} satisfies UserConfig;
