const START = 0;

export function createRepeatingSequence(end: number) {
  let n = START;

  return () => {
    const value = n;
    n = n < end ? n + 1 : 0;
    return value;
  };
}
