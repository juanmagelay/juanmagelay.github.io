// D-39d / TDD 2.3.2 and 6.8: one blood stain per cell, kept for the session in
// the chunk of its cell. Same structure as the walls: a 16 by 16 Uint8Array
// per chunk, index ly * 16 + lx, in a Map with the Cantor key. 0 is no stain
// and 1 to 4 is the shape of the stain.
const stainsByChunk = new Map();
const stainShapeCount = 4;
// Mixed into the world seed, so the stain of cell (x, y) does not repeat the
// map of chunk (x, y), which uses the same seed mix (js/random.js)
const stainSeedSalt = 0x5eed0b1d;

// D-39d: the stain array of a chunk, or null when the chunk has no stain yet.
// It never creates anything, so the floor casting can ask for any chunk.
function getChunkStains(cx, cy) {
  return stainsByChunk.get(getChunkKey(cx, cy)) ?? null;
}

// D-39d: the stain of any cell, negative ones included. Callers pass cell
// integers, like getCell; Math.floor finds the chunk.
function getStain(x, y) {
  const cx = Math.floor(x / chunkSize);
  const cy = Math.floor(y / chunkSize);
  const stains = getChunkStains(cx, cy);
  if (stains === null) {
    return 0;
  }
  return stains[(y - cy * chunkSize) * chunkSize + (x - cx * chunkSize)];
}

// D-39d / TDD 2.3.2: the shape comes from the world seed and the cell, so the
// same seed gives the same stains in any order of play
function getStainShape(x, y) {
  return getChunkSeed(worldSeed ^ stainSeedSalt, x, y) % stainShapeCount + 1;
}

// D-39d: one stain per cell. A cell that already has one keeps the first. The
// chunk array is created with the chunk's first stain.
function addStain(x, y) {
  if (getStain(x, y) !== 0) {
    return;
  }
  const cx = Math.floor(x / chunkSize);
  const cy = Math.floor(y / chunkSize);
  const key = getChunkKey(cx, cy);
  if (!stainsByChunk.has(key)) {
    stainsByChunk.set(key, new Uint8Array(chunkSize * chunkSize));
  }
  stainsByChunk.get(key)[(y - cy * chunkSize) * chunkSize + (x - cx * chunkSize)] = getStainShape(x, y);
}

// D-39d / TDD 2.3.4: a new game or a new world discards every stain
function clearStains() {
  stainsByChunk.clear();
}
