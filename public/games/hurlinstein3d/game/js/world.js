// TDD 5.1 and 6.8: chunks are generated on demand and kept for the session.
const generatedChunks = new Map();
// D-10: one light per room center, in world coordinates, kept per chunk
const lightsByChunk = new Map();
// D-38: the rooms of every chunk, in world cells, so enemies can spawn in them
const roomsByChunk = new Map();
// TDD 2.3.2: every enemy is listed in the chunk it stands in and in its cell
const enemiesByChunk = new Map();
const enemiesByCell = new Map();
let spawnRoomCenter = null;
let nextEnemyId = 1;
// D-38 / TDD 2.3.2: enemies appear in the four chunks that share a door with
// the player's chunk: north, south, west and east. The player's chunk stays empty.
const doorNeighborOffsets = [[0, -1], [0, 1], [-1, 0], [1, 0]];
// D-38: an enemy never appears where the player could see it: this close to
// the player's cell (the 21 by 21 minimap shows 10 cells each way) or in line
// of sight. So it never appears on top of the player either.
const spawnHiddenRadius = 10;
// D-24: totals too big for the four door neighbors (admin panel, up to 100,000)
// fill the chunks around the player one ring at a time, starting at ring 1
const enemyPlacementRadius = 1;
function createWorldSeed() {
  return (Math.random() * 4294967296) >>> 0;
}
let worldSeed = createWorldSeed();
let gameRandom = createRandom(worldSeed);

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
    const generatedChunk = generateChunk(createRandom(getChunkSeed(worldSeed, cx, cy)));
    generatedChunks.set(key, generatedChunk.cells);
    roomsByChunk.set(key, getChunkRooms(generatedChunk, cx, cy));
    lightsByChunk.set(key, createChunkLights(generatedChunk, cx, cy));
    if (cx === 0 && cy === 0) {
      spawnRoomCenter = generatedChunk.roomCenter;
    }
  }
  return generatedChunks.get(key);
}

// D-10: a light sits at the center of every room of the chunk, in world cells.
function createChunkLights(chunk, cx, cy) {
  return getChunkRooms(chunk, cx, cy).map((room) => ({
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
    radius: lightRadius,
    intensity: lightIntensity,
  }));
}

// D-11: the main room and, in half of the chunks, the second one, in world cells
function getChunkRooms(chunk, cx, cy) {
  const rooms = chunk.secondRoom ? [chunk.room, chunk.secondRoom] : [chunk.room];
  return rooms.map((room) => ({
    x: cx * chunkSize + room.x,
    y: cy * chunkSize + room.y,
    width: room.width,
    height: room.height,
  }));
}

// D-10: rooms sit at least four cells from a chunk border and the light radius
// is under four, so a light only ever reaches walls of its own chunk.
function getLightsAtCell(cellX, cellY) {
  const cx = Math.floor(cellX / chunkSize);
  const cy = Math.floor(cellY / chunkSize);
  return lightsByChunk.get(getChunkKey(cx, cy)) || [];
}

// D-24 and D-38 / TDD 2.3.2: all the enemies of the game are placed at once, at
// the start and every time the admin panel changes the total. The live ones are
// removed, then the new ones spread evenly over the rooms of the four door
// neighbors (20 give 5 per chunk). What does not fit there goes ring by ring
// around the player's chunk. Chunks generated later, while exploring, have no
// enemies.
function placeGameEnemies(player, count) {
  removeAllEnemies();
  const areas = getSpawnAreas(player);
  let placed = 0;
  while (placed < count) {
    const cell = takeSpreadSpawnCell(areas);
    if (cell === null) {
      break;
    }
    addEnemyAtCell(cell.x, cell.y);
    placed += 1;
  }

  const remaining = count - placed;
  if (remaining === 0) {
    return;
  }
  const cells = getEnemyPlacementCells(player, remaining);
  for (let index = 0; index < remaining; index += 1) {
    const cell = pickRandomCell(cells, index);
    addEnemyAtCell(cell.x, cell.y);
  }
}

// D-38: one spawn area per door neighbor of the player's chunk, with its free
// hidden cells (rooms and corridors apart) and the enemies it already holds.
// The areas are shuffled, so a tie in the count goes to a random one.
function getSpawnAreas(player) {
  const playerChunkX = Math.floor(player.posX / chunkSize);
  const playerChunkY = Math.floor(player.posY / chunkSize);
  const areas = doorNeighborOffsets.map(([offsetX, offsetY]) =>
    createSpawnArea(player, playerChunkX + offsetX, playerChunkY + offsetY));
  shuffleInPlace(areas);
  return areas;
}

function createSpawnArea(player, cx, cy) {
  const airCells = [];
  addChunkAirCells(airCells, cx, cy);
  const roomCells = [];
  const corridorCells = [];
  for (const cell of airCells) {
    if (!isFreeHiddenCell(cell, player)) {
      continue;
    }
    if (isRoomCell(cell, cx, cy)) {
      roomCells.push(cell);
    } else {
      corridorCells.push(cell);
    }
  }
  return { cx, cy, roomCells, corridorCells, count: getEnemiesForChunk(cx, cy).length };
}

// D-38: rooms are where the player looks for enemies, and they are lit (D-10)
function isRoomCell(cell, cx, cy) {
  const rooms = roomsByChunk.get(getChunkKey(cx, cy)) || [];
  return rooms.some((room) =>
    cell.x >= room.x && cell.x < room.x + room.width &&
    cell.y >= room.y && cell.y < room.y + room.height);
}

// TDD 2.3.2: one enemy per cell, and (D-38) never where the player can see it
function isFreeHiddenCell(cell, player) {
  return getEnemiesAtCell(cell.x, cell.y).length === 0 &&
    isHiddenFromPlayer(cell.x + 0.5, cell.y + 0.5, player);
}

// D-38: hidden means outside the minimap window around the player's cell and
// with a wall between that point and the player. The line of sight is the
// same DDA the enemies use to spot the player (js/enemies.js).
function isHiddenFromPlayer(posX, posY, player) {
  const cellDistance = Math.max(
    Math.abs(Math.floor(posX) - Math.floor(player.posX)),
    Math.abs(Math.floor(posY) - Math.floor(player.posY)),
  );
  if (cellDistance <= spawnHiddenRadius) {
    return false;
  }
  return !hasLineOfSight({ posX, posY }, player);
}

// D-38: the next spawn cell goes to the area with the fewest enemies, so they
// spread evenly over the four door neighbors. null when the four are full.
function takeSpreadSpawnCell(areas) {
  let emptiest = null;
  for (const area of areas) {
    const hasCells = area.roomCells.length + area.corridorCells.length > 0;
    if (hasCells && (emptiest === null || area.count < emptiest.count)) {
      emptiest = area;
    }
  }
  if (emptiest === null) {
    return null;
  }
  emptiest.count += 1;
  return takeSpawnCell(emptiest);
}

// D-38: a random room cell while the rooms have room, then a random corridor
// cell. The cell leaves its list, so it is never handed out twice.
function takeSpawnCell(area) {
  const cells = area.roomCells.length > 0 ? area.roomCells : area.corridorCells;
  if (cells.length === 0) {
    return null;
  }
  const index = Math.floor(gameRandom() * cells.length);
  const cell = cells[index];
  cells[index] = cells[cells.length - 1];
  cells.pop();
  return cell;
}

// Fisher-Yates shuffle with the world random, so a seed repeats it (D-30c)
function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(gameRandom() * (index + 1));
    const item = items[index];
    items[index] = items[pick];
    items[pick] = item;
  }
}

// Partial Fisher-Yates shuffle, one step: picks a random cell among the ones
// from index on (the ones not picked yet) and swaps it to index. Called with
// index 0, 1, 2... no cell is picked twice and every pick costs the same, even
// with 100,000 enemies.
function pickRandomCell(cells, index) {
  const pick = index + Math.floor(gameRandom() * (cells.length - index));
  const cell = cells[pick];
  cells[pick] = cells[index];
  cells[index] = cell;
  return cell;
}

function removeAllEnemies() {
  enemiesByChunk.clear();
  enemiesByCell.clear();
}

// D-17a / TDD 2.3.4: a new game discards the whole world (chunks, lights,
// enemies and their per-cell registry), then puts the player back at a fresh
// spawn. A new game is a new session, so the next chunk (0, 0) is generated
// again with a brand new map.
function resetGame(seed) {
  if (seed !== undefined && seed !== null && seed !== "") {
    worldSeed = Number(seed) >>> 0;
  } else {
    worldSeed = createWorldSeed();
  }
  gameRandom = createRandom(worldSeed);
  generatedChunks.clear();
  lightsByChunk.clear();
  roomsByChunk.clear();
  removeAllEnemies();
  spawnRoomCenter = null;
  nextEnemyId = 1;
  resetKillCount();
  resetGameTime();
  resetPlayer();
}

// D-24: the free hidden air cells of the 8 chunks around the player's chunk.
// TDD 2.3.2 allows one enemy per cell, so when they are not enough the area
// grows one ring of chunks at a time until every enemy fits (100,000 reach
// about 18 rings).
function getEnemyPlacementCells(player, count) {
  const playerChunkX = Math.floor(player.posX / chunkSize);
  const playerChunkY = Math.floor(player.posY / chunkSize);
  const cells = [];
  let radius = enemyPlacementRadius;
  while (cells.length < count) {
    const ringCells = [];
    addRingAirCells(ringCells, playerChunkX, playerChunkY, radius);
    for (const cell of ringCells) {
      if (isFreeHiddenCell(cell, player)) {
        cells.push(cell);
      }
    }
    radius += 1;
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
    health: gameSettings.enemyHealth,
    contactDamage: enemyContactDamage,
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

// D-19c and D-38 / TDD 2.3.2: one boss at a time. It appears like a regular
// enemy, in a room of a door neighbor, hidden from the player. With a boss
// already alive (the admin button) that same boss is brought there instead.
function spawnBoss(player) {
  const cell = takeBossSpawnCell(player);
  const liveBoss = findBoss();
  if (liveBoss !== null) {
    moveEnemyToCell(liveBoss, cell.x, cell.y);
    return liveBoss;
  }
  return addBossAtCell(cell.x, cell.y);
}

// D-38: the live boss, or null. Asking the registry instead of keeping a flag
// means a boss wiped by a new total (D-24) can be spawned again.
function findBoss() {
  for (const enemies of enemiesByChunk.values()) {
    for (const enemy of enemies) {
      if (enemy.isBoss) {
        return enemy;
      }
    }
  }
  return null;
}

// D-38: a spawn cell of the door neighbors, or of the rings around them when
// the four are full, so the boss always gets a cell
function takeBossSpawnCell(player) {
  const cell = takeSpreadSpawnCell(getSpawnAreas(player));
  if (cell !== null) {
    return cell;
  }
  return pickRandomCell(getEnemyPlacementCells(player, 1), 0);
}

// D-19c / TDD 2.3.2: 1.5 times a regular enemy, crimson, with its own hit
// points and double contact damage
function addBossAtCell(cellX, cellY) {
  const boss = {
    id: nextEnemyId,
    posX: cellX + 0.5,
    posY: cellY + 0.5,
    cellX,
    cellY,
    chunkX: Math.floor(cellX / chunkSize),
    chunkY: Math.floor(cellY / chunkSize),
    width: bossWidth,
    height: bossHeight,
    color: bossColor,
    health: gameSettings.bossHealth,
    contactDamage: bossContactDamage,
    isBoss: true,
    state: "idle",
    stateTime: 0,
    hitWait: 0,
  };
  nextEnemyId += 1;
  addEnemyToChunk(boss);
  registerEnemyAtCell(boss);
  return boss;
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
