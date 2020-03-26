const START = 0;

/**
 * Returns an anonymous function that returns the next iteration of a number, starting with zero, each time it's
 * called. It does this up until it reaches the provided 'end' argument, at which point it resets to zero.
 */

export function createRepeatingSequence(end: number) {
  let n = START;

  return () => {
    const value = n;
    n = n < end ? n + 1 : 0;
    return value;
  };
}
