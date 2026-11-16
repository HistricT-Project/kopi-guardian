// A small seeded random number generator (mulberry32): the same seed gives
// the same game, which is what makes the screenshot scenes repeatable and
// the autopilot runs deterministic.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one element of an array at random. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
