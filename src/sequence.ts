export function createRepeatingSequence(start = 0, end = Number.MAX_SAFE_INTEGER) {
  let n = start;

  return () => {
    const value = n;
    n = n < end ? n + 1 : 0;
    return value;
  };
}
