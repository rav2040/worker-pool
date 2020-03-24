const START = 0;
const END = 10_000;

export function createRepeatingSequence() {
  let n = START;

  return () => {
    const value = n;
    n = n < END ? n + 1 : 0;
    return value;
  };
}
