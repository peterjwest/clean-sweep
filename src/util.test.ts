import assert from 'assert';
import { describe, test } from 'vitest';

import { createEnum } from './util';

describe('createEnum', () => {
  test('Converts an array to a object where the values equal the keys', () => {
    assert.deepStrictEqual(createEnum(['APPLE', 'BANANA', 'ORANGE']), {
      APPLE: 'APPLE',
      BANANA: 'BANANA',
      ORANGE: 'ORANGE',
    });
  });
});
