// D-30: small deterministic generator for repeatable worlds.
function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getChunkSeed(worldSeed, cx, cy) {
  const key = getChunkKey(cx, cy);
  let seed = (worldSeed >>> 0) ^ Math.imul(key >>> 0, 0x9e3779b1);
  seed ^= Math.imul(Math.floor(key / 4294967296), 0x85ebca6b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
  seed = Math.imul(seed ^ (seed >>> 15), 0x846ca68b);
  return (seed ^ (seed >>> 16)) >>> 0;
}
