# unlinted [![npm version][npm-badge]][npm-url] [![build status][circle-badge]][circle-url] [![coverage status][coverage-badge]][coverage-url]

General purpose project-wide linting and hygiene.

The aim of this project is lint across all plain text files in a codebase.
This project includes various general purpose whitespace and character checks, including a UTF8 validator.

## Installation:

```
npm install unlinted
```

## Usage

This will find your Git project root, and run checks on the whole project:

<!-- snippet: bash -->
```
npx unlinted
```

Or you can run on a subset of your project:

<!-- snippet: bash -->
```
npx unlinted src/
```

You can also specify a custom config file:

<!-- snippet: bash -->
```
npx unlinted src/ --config=unlinted.config.ts
```

## Configuration

By default unlinted looks in the root of your git repository for your config file named `unlinted.config.ts`, falling back to `unlinted.config.js` and then `unlinted.config.json`.

Alternatively, you can specify a custom JS, TS or JSON configuration file with `--config=<path>`.

The default config is as follows:

```js
import { DEFAULT_CONTENT_EXCLUDED } from 'unlinted';

export default {
  enabled: true,
  exclude: [],
  rules: {
    PATH_VALIDATION: {
      enabled: true,
      exclude: [],
      rules: {
        DS_STORE: { enabled: true, exclude: [] },
        UPPERCASE_EXTENSION: { enabled: true, exclude: [] },
        IGNORED_COMMITTED_FILE: { enabled: true, exclude: [] },
      },
    },
    CONTENT_VALIDATION: {
      enabled: true,
      exclude: DEFAULT_CONTENT_EXCLUDED,
      rules: {
        MALFORMED_ENCODING: { enabled: true, exclude: [] },
        UNEXPECTED_ENCODING: { enabled: true, exclude: [] },
        CARRIAGE_RETURN: { enabled: true, exclude: [] },
        TAB: { enabled: true, exclude: [] },
        TRAILING_WHITESPACE: { enabled: true, exclude: [] },
        MULTIPLE_FINAL_NEWLINES: { enabled: true, exclude: [] },
        NO_FINAL_NEWLINE: { enabled: true, exclude: [] },
        UNEXPECTED_CHARACTER: { enabled: true, exclude: [], allowed: [] },
        UTF8_VALIDATION: {
          enabled: true,
          exclude: [],
          rules: {
            INVALID_BYTE: { enabled: true, exclude: [] },
            UNEXPECTED_CONTINUATION_BYTE: { enabled: true, exclude: [] },
            MISSING_CONTINUATION_BYTE: { enabled: true, exclude: [] },
            OVERLONG_BYTE_SEQUENCE: { enabled: true, exclude: [] },
            INVALID_CODE_POINT: { enabled: true, exclude: [] },
          },
        },
      },
    },
  },
};
```

### Partial configuration

In your configuration, you can exclude any of these properties and the default value will be used.

### Boolean rules

You can also substitute any _rule_ with a boolean to either enable it with default settings, or disable it.

For example, this config disables the `PATH_VALIDATION` and `TAB` rules, while enabling `UTF8_VALIDATION` with default settings:

```js
export default {
  rules: {
    PATH_VALIDATION: false,
    CONTENT_VALIDATION: {
      rules: {
        TAB: false,
        UTF8_VALIDATION: true,
      },
    },
  },
};
```

### Typescript configuration

A `.ts` configuration file can use the `UserConfig` type to check the validity of a config in your editor:

```ts
import { UserConfig } from 'unlinted';

export default {
  rules: {
    PATH_VALIDATION: false,
  },
} satisfies UserConfig;
```

### Exclusions

Every rule has an `exclude` property which is either an array of gitignore rules to exclude from checks, or a function passed the default exclusions, which returns an array of gitignore rules.

It is recommended to use a function to preserve the default values:

```js
export default {
  exclude: (defaults) => [...defaults, '/build'],
}
```

#### Omitting exclusions

It's recommended to use `lodash.difference` to remove default exclusions, for example:

```js
import lodash from 'lodash'

export default {
  rules: {
    CONTENT_VALIDATION: {
      exclude: (defaults) => [...lodash.difference(defaults, ['*.svg'])],
    },
  },
}
```

It is recommended to read and understand [gitignore syntax](https://www.atlassian.com/git/tutorials/saving-changes/gitignore). Notably you can exclude files relative to your project root using forward slash, for example:

```js
export default {
  exclude: (defaults) => [...defaults, '/README.md', '/.circleci/config.yml'],
}
```

## Rules

All rules are enabled by default.

You can exclude files from all checks:

```js
export default {
  exclude: (defaults) => [...defaults, '/build'],
};
```

You can also disable all checks if you really want:

```js
export default {
  enabled: false,
};
```

### PATH_VALIDATION

A collection of rules which check the path of project files.

Example configuration:

```js
export default {
  rules: {
    PATH_VALIDATION: {
      enabled: true,
      exclude: (defaults) => [...defaults, '/build'],
    },
  },
};
```

#### PATH_VALIDATION -> DS_STORE

Looks for committed DS_Store files. These are files generated by Mac OS and generally considered junk in code projects. It is recommended to gitignore these, but they often end up committed.

Example configuration:

```js
export default {
  rules: {
    PATH_VALIDATION: {
      rules: {
        DS_STORE: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        },
      },
    },
  },
};
```

#### PATH_VALIDATION -> UPPERCASE_EXTENSION

Looks for files with uppercase extensions. Generally file extensions are lowercase, uppercase extensions could lead to unexpeted behaviour in some tools.

Example configuration:

```js
export default {
  rules: {
    PATH_VALIDATION: {
      rules: {
        UPPERCASE_EXTENSION: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        },
      },
    },
  },
};
```

#### PATH_VALIDATION -> IGNORED_COMMITTED_FILE

Looks for files which have been committed but are gitignored. This is usually a mistake, either the file should not be committed, or the gitignore file should be updated.

Example configuration:

```js
export default {
  rules: {
    PATH_VALIDATION: {
      rules: {
        IGNORED_COMMITTED_FILE: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        },
      },
    },
  },
};
```

### CONTENT_VALIDATION

A collection of rules which check the content of project files.

Example configuration:

```ts
export default {
  return {
    rules: {
      CONTENT_VALIDATION: {
        enabled: true,
        exclude: (defaults) => [...defaults, '*.txt'],
      },
    },
  };
}
```

#### CONTENT_VALIDATION -> MALFORMED_ENCODING

Looks for files with a malformed character encoding. This means that the file likely has encoding errors. [UTF8 checks](#utf8-checks) are only run on files which have a malformed encoding.

**Note:** This rule is required for any further content checks.

Example configuration:

```ts
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        MALFORMED_ENCODING: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> UNEXPECTED_ENCODING

Looks for files with encodings other than UTF8 or ASCII. Many codebases use these encodings exclusively, and some tools do not support old, less widely used encodings.

**Note:** This rule is required for any further content checks.

Example configuration:

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UNEXPECTED_ENCODING: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> CARRIAGE_RETURN

Looks for carriage returns, often used in windows style line endings. These characters are not generally used in Mac OSX or Linux, and their presence can lead to unexpected/inconsitent behaviour in various tools.

Example configuration:

```ts
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        CARRIAGE_RETURN: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> TAB

Looks for tabs. Many projects indent purely with spaces, and tabs are undesirable.

Example configuration:

```ts
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        TAB: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> TRAILING_WHITESPACE

Looks for whitespace at the end of lines. Trailing whitespace is generally unnecessary and messy.

Example configuration:

```ts
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        TRAILING_WHITESPACE: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> MULTIPLE_FINAL_NEWLINES

Looks for multiple newlines at the end of files. Trailing newlines are generally unnecessary and messy.

Example configuration:

```ts
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        MULTIPLE_FINAL_NEWLINES: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> NO_FINAL_NEWLINE

Looks for files with no final newline. Files without a final newline can lead to unexpected behaviour in various tools.

Example configuration:

```ts
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        NO_FINAL_NEWLINE: {
          enabled: true,
          exclude: (defaults) => [...defaults, '/build'],
        }
      }
    },
  },
}
```

#### CONTENT_VALIDATION -> UNEXPECTED_CHARACTER

Looks for unusual unicode characters: non-ASCII, non-unicode letter and non-emoji characters. Some of these are confusing or ambiguous and could lead to unexpected behaviour.

Specific characters can be allowed using the following config:

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UNEXPECTED_CHARACTER: {
          allowed: ['✓'],
        },
      },
    },
  },
};
```

#### CONTENT_VALIDATION -> UTF8_VALIDATION

If your files are encoded with UTF8, they can be checked for encoding errors. These can occur when files are manipulated by different applications which are not expecting the same encoding, or applications which are not able to safely encode UTF8.

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UTF8_VALIDATION: {
          enabled: true,
          exclude: (defaults) => [...defaults, '*.txt'],
        },
      },
    },
  },
};
```

#### CONTENT_VALIDATION -> UTF8_VALIDATION -> INVALID_BYTE

Looks for bytes which should not appear in UTF8 files. This can occur when text is copied from other files or applications.

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UTF8_VALIDATION: {
          rules: {
            INVALID_BYTE: {
              enabled: true,
              exclude: (defaults) => [...defaults, '*.txt'],
            },
          },
        },
      },
    },
  },
};
```

#### CONTENT_VALIDATION -> UTF8_VALIDATION -> UNEXPECTED_CONTINUATION_BYTE

Looks for invalid multibyte characters which have no start. This can happen when applications do not understand multibyte characters, cutting them in half.

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UTF8_VALIDATION: {
          rules: {
            UNEXPECTED_CONTINUATION_BYTE: {
              enabled: true,
              exclude: (defaults) => [...defaults, '*.txt'],
            },
          },
        },
      },
    },
  },
};
```

#### CONTENT_VALIDATION -> UTF8_VALIDATION -> MISSING_CONTINUATION_BYTE

Looks for invalid multibyte characters which have no end. This can happen when applications do not understand multibyte characters, cutting them in half.

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UTF8_VALIDATION: {
          rules: {
            MISSING_CONTINUATION_BYTE: {
              enabled: true,
              exclude: (defaults) => [...defaults, '*.txt'],
            },
          },
        },
      },
    },
  },
};
```

#### CONTENT_VALIDATION -> UTF8_VALIDATION -> OVERLONG_BYTE_SEQUENCE

Looks for invalid multibyte characters which use a logical but disallowed encoding.

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UTF8_VALIDATION: {
          rules: {
            OVERLONG_BYTE_SEQUENCE: {
              enabled: true,
              exclude: (defaults) => [...defaults, '*.txt'],
            },
          },
        },
      },
    },
  },
};
```

#### CONTENT_VALIDATION -> UTF8_VALIDATION -> INVALID_CODE_POINT

Looks for invalid unicode values. These values are generally meaningless/undesirable, although some can be part of [private use areas](https://en.wikipedia.org/wiki/Private_Use_Areas) which _may_ be used by companies internally.

```js
export default {
  rules: {
    CONTENT_VALIDATION: {
      rules: {
        UTF8_VALIDATION: {
          rules: {
            INVALID_CODE_POINT: {
              enabled: true,
              exclude: (defaults) => [...defaults, '*.txt'],
            },
          },
        },
      },
    },
  },
};
```

## Todo:

- Extend documentation
- Autofixing
- More snippets
- Extend config
- Carriage return allow windows

[npm-badge]: https://badge.fury.io/js/unlinted.svg
[npm-url]: https://www.npmjs.com/package/unlinted

[circle-badge]: https://circleci.com/gh/peterjwest/unlinted.svg?style=shield
[circle-url]: https://circleci.com/gh/peterjwest/unlinted

[coverage-badge]: https://coveralls.io/repos/peterjwest/unlinted/badge.svg?branch=main&service=github
[coverage-url]: https://coveralls.io/github/peterjwest/unlinted?branch=main
