// TDD 5.1 and 6.8: chunks are generated on demand and kept for the session.
const generatedChunks = new Map();
// D-10: one light per room center, in world coordinates, kept per chunk
const lightsByChunk = new Map();
// TDD 2.3.2: every enemy is listed in the chunk it stands in and in its cell
const enemiesByChunk = new Map();
const enemiesByCell = new Map();
let spawnRoomCenter = null;
let nextEnemyId = 1;
// D-24 / TDD 2.3.2: the enemies of the game are placed in the chunks this
// close to the player's chunk, the 8 neighbors. The player's chunk stays empty.
const enemyPlacementRadius = 1;

// TDD 6.8: map signed chunk coordinates to non-negative integers, then pair them.
function getChunkKey(cx, cy) {
  const a = cx >= 0 ? 2 * cx : -2 * cx - 1;
  const b = cy >= 0 ? 2 * cy : -2 * cy - 1;
  const sum = a + b;
  return (sum * (sum + 1)) / 2 + b;
}

function getChunkCells(cx, cy) {
  const key = getChunkKey(cx, cy);
  if (!generatedChunks.has(key)) {
    const generatedChunk = generateChunk();
    generatedChunks.set(key, generatedChunk.cells);
    lightsByChunk.set(key, createChunkLights(generatedChunk, cx, cy));
    if (cx === 0 && cy === 0) {
      spawnRoomCenter = generatedChunk.roomCenter;
    }
  }
  return generatedChunks.get(key);
}

// D-10: a light sits at the center of every room of the chunk, in world cells.
function createChunkLights(chunk, cx, cy) {
  const rooms = chunk.secondRoom ? [chunk.room, chunk.secondRoom] : [chunk.room];
  return rooms.map((room) => ({
    x: cx * chunkSize + room.x + room.width / 2,
    y: cy * chunkSize + room.y + room.height / 2,
    radius: lightRadius,
    intensity: lightIntensity,
  }));
}

// D-10: rooms sit at least four cells from a chunk border and the light radius
// is under four, so a light only ever reaches walls of its own chunk.
function getLightsAtCell(cellX, cellY) {
  const cx = Math.floor(cellX / chunkSize);
  const cy = Math.floor(cellY / chunkSize);
  return lightsByChunk.get(getChunkKey(cx, cy)) || [];
}

// D-24 / TDD 2.3.2: all the enemies of the game are placed at once, at the
// start and every time the admin panel changes the total. The live ones are
// removed, then count new ones go to random air cells of the chunks around the
// player's chunk. Chunks generated later, while exploring, have no enemies.
function placeGameEnemies(player, count) {
  removeAllEnemies();
  const cells = getEnemyPlacementCells(player, count);
  for (let index = 0; index < count; index += 1) {
    const cell = pickRandomCell(cells, index);
    addEnemyAtCell(cell.x, cell.y);
  }
}

// Partial Fisher-Yates shuffle, one step: picks a random cell among the ones
// from index on (the ones not picked yet) and swaps it to index. Called with
// index 0, 1, 2... no cell is picked twice and every pick costs the same, even
// with 100,000 enemies.
function pickRandomCell(cells, index) {
  const pick = index + Math.floor(Math.random() * (cells.length - index));
  const cell = cells[pick];
  cells[pick] = cells[index];
  cells[index] = cell;
  return cell;
}

function removeAllEnemies() {
  enemiesByChunk.clear();
  enemiesByCell.clear();
}

// The air cells of the 8 chunks around the player's chunk. TDD 2.3.2 allows
// one enemy per cell, so when they are not enough the area grows one ring of
// chunks at a time until every enemy fits (100,000 reach about 18 rings).
function getEnemyPlacementCells(player, count) {
  const playerChunkX = Math.floor(player.posX / chunkSize);
  const playerChunkY = Math.floor(player.posY / chunkSize);
  const cells = [];
  let radius = enemyPlacementRadius;
  addRingAirCells(cells, playerChunkX, playerChunkY, radius);
  while (cells.length < count) {
    radius += 1;
    addRingAirCells(cells, playerChunkX, playerChunkY, radius);
  }
  return cells;
}

// Adds the air cells of every chunk at this ring distance from the center
// chunk, in world cells. Ring 1 is the 8 neighbors, ring 2 the 16 around them.
function addRingAirCells(cells, centerChunkX, centerChunkY, radius) {
  for (let cy = centerChunkY - radius; cy <= centerChunkY + radius; cy += 1) {
    for (let cx = centerChunkX - radius; cx <= centerChunkX + radius; cx += 1) {
      const onRing = Math.max(Math.abs(cx - centerChunkX), Math.abs(cy - centerChunkY)) === radius;
      if (onRing) {
        addChunkAirCells(cells, cx, cy);
      }
    }
  }
}

function addChunkAirCells(cells, cx, cy) {
  const chunkCells = getChunkCells(cx, cy);
  for (let index = 0; index < chunkCells.length; index += 1) {
    if (chunkCells[index] === 0) {
      const localX = index % chunkSize;
      const localY = Math.floor(index / chunkSize);
      cells.push({ x: cx * chunkSize + localX, y: cy * chunkSize + localY });
    }
  }
}

// A new idle enemy at the center of the cell, listed in its chunk and its cell
function addEnemyAtCell(cellX, cellY) {
  const enemy = {
    id: nextEnemyId,
    posX: cellX + 0.5,
    posY: cellY + 0.5,
    cellX,
    cellY,
    chunkX: Math.floor(cellX / chunkSize),
    chunkY: Math.floor(cellY / chunkSize),
    width: enemyWidth,
    height: enemyHeight,
    color: enemyColor,
    state: "idle",
    stateTime: 0,
    // D-27c: ticker units until the next contact hit; 0 hits on first contact
    hitWait: 0,
  };
  nextEnemyId += 1;
  addEnemyToChunk(enemy);
  registerEnemyAtCell(enemy);
  return enemy;
}

function addEnemyToChunk(enemy) {
  const chunkKey = getChunkKey(enemy.chunkX, enemy.chunkY);
  if (!enemiesByChunk.has(chunkKey)) {
    enemiesByChunk.set(chunkKey, []);
  }
  enemiesByChunk.get(chunkKey).push(enemy);
}

function registerEnemyAtCell(enemy) {
  const cellKey = getChunkKey(enemy.cellX, enemy.cellY);
  if (!enemiesByCell.has(cellKey)) {
    enemiesByCell.set(cellKey, []);
  }
  enemiesByCell.get(cellKey).push(enemy);
}

function getEnemiesForChunk(cx, cy) {
  return enemiesByChunk.get(getChunkKey(cx, cy)) || [];
}

function getEnemiesAtCell(cellX, cellY) {
  return enemiesByCell.get(getChunkKey(cellX, cellY)) || [];
}

function getSpawnPosition() {
  getChunkCells(0, 0);
  return { x: spawnRoomCenter.x, y: spawnRoomCenter.y };
}

// TDD 5.2: callers pass cell integers; negative chunk coordinates use Math.floor.
function getCell(x, y) {
  const cx = Math.floor(x / chunkSize);
  const cy = Math.floor(y / chunkSize);
  const localX = x - cx * chunkSize;
  const localY = y - cy * chunkSize;
  const cells = getChunkCells(cx, cy);
  return cells[localY * chunkSize + localX];
}
