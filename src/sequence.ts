const START = 0;
const INCREMENT = 1;

/**
 * Returns an anonymous function that, when called, returns the next iteration of a number (starting from 0 and
 * increasing by 1). The number resets to zero once it reaches the value of the 'end' parameter.
 */

export function createRepeatingSequence(end: number) {
  let n: number = end;

  return () => {
    n = (n < end) ? n + INCREMENT : START;
    return n;
  };
}
