import { createRepeatingSequence } from '../src/sequence';

const seq = createRepeatingSequence(0, 2);

describe('Calling sequence', () => {
  test('returns 0', () => {
    expect(seq()).toEqual(0);
  });

  test('returns 1', () => {
    expect(seq()).toEqual(1);
  });

  test('returns 2', () => {
    expect(seq()).toEqual(2);
  });

  test('returns 0', () => {
    expect(seq()).toEqual(0);
  });
});
