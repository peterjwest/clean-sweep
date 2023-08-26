import { describe, test } from 'vitest';
import assert from 'assert';

import GitignoreMatcher from './GitignoreMatcher';

describe('GitignoreMatcher', () => {
  describe('filter', () => {
    test('Filters files by gitignore rules', () => {
      const files = ['foo.ts', 'bar.tsx', 'src/zim.ts', 'src/gir.js', 'irk.txt', 'docs/zig.md', 'docs/zip.md'];
      const matcher = new GitignoreMatcher(['*.ts', '/docs/*', '!/docs/zip.md']);

      assert.deepStrictEqual(matcher.filter(files), ['bar.tsx', 'src/gir.js', 'irk.txt', 'docs/zip.md']);
    });

    test('Filters empty list of files', () => {
      const matcher = new GitignoreMatcher(['/*.ts', '/docs']);

      assert.deepStrictEqual(matcher.filter([]), []);
    });
  });

  describe('matches', () => {
    test('Returns a boolean indicating if a file is matched (not ignored)', () => {
      const matcher = new GitignoreMatcher(['*.ts', '/docs/*', '!/docs/zip.md', '/build', '/banana.txt']);

      assert.strictEqual(matcher.matches('foo.ts'), false);
      assert.strictEqual(matcher.matches('foo.js'), true);

      assert.strictEqual(matcher.matches('docs/zig.md'), false);
      assert.strictEqual(matcher.matches('docs/zip.md'), true);

      assert.strictEqual(matcher.matches('build/apple.zip'), false);

      assert.strictEqual(matcher.matches('banana.txt'), false);
      assert.strictEqual(matcher.matches('src/banana.txt'), true);
    });
  });

  describe('extend', () => {
    test('Creates a new matcher with extended gitignore rules', () => {
      const matcher = new GitignoreMatcher(['*.ts']);
      const extended = matcher.extend(['/src']);

      assert.strictEqual(matcher.matches('src/banana.js'), true);
      assert.strictEqual(matcher.matches('src/banana.ts'), false);

      assert.strictEqual(extended.matches('src/banana.js'), false);
      assert.strictEqual(extended.matches('src/banana.ts'), false);
    });
  });
});
