import { describe, test } from 'vitest';
import assert from 'assert';

import argvParser, { splitOnce } from './argvParser';

describe('argvParser', () => {
  test('Returns empty arguments and options when passed no additional arguments', () => {
    const input = ['command', 'file'];
    assert.deepStrictEqual(argvParser(input), { args: [], options: {} });
  });

  test('Returns arguments as an array', () => {
    const input = ['command', 'file', 'foo', 'bar'];
    assert.deepStrictEqual(argvParser(input), { args: ['foo', 'bar'], options: {} });
  });

  test('Returns options as an object', () => {
    const input = ['command', 'file', '--foo', '--bar=zim'];
    assert.deepStrictEqual(argvParser(input), { args: [], options: { foo: true, bar: 'zim' } });
  });

  test('Returns short options as an object', () => {
    const input = ['command', 'file', '-f', '-b=zim'];
    assert.deepStrictEqual(argvParser(input), { args: [], options: { f: true, b: 'zim' } });
  });

  test('Returns options and arguments in any order/combination', () => {
    const input = ['command', 'file', '-x', 'foo', '--bar=zim', 'gir', '--zig'];
    assert.deepStrictEqual(argvParser(input), { args: ['foo', 'gir'], options: { x: true, bar: 'zim', zig: true } });
  });
});

describe('splitOnce', () => {
  test('Returns an array with two parts of a string containing the delimiter', () => {
    assert.deepStrictEqual(splitOnce('foo=bar', '='), ['foo', 'bar']);
  });

  test('Returns an array with two parts of a string containing the delimiter more than once', () => {
    assert.deepStrictEqual(splitOnce('foo=bar=zim=gir', '='), ['foo', 'bar=zim=gir']);
  });

  test('Returns an array with an entire value not containing the delimiter ', () => {
    assert.deepStrictEqual(splitOnce('foo=bar', ' '), ['foo=bar']);
  });
});
