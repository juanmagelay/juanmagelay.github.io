// D-05: enemy state machine. States are idle, patrol and (D-05b) chase.
// Positions are in cells, like the player. Speeds are cells per 60 Hz ticker
// unit, so they are multiplied by ticker.deltaTime.

const ticksPerSecond = 60;
const enemyIdleSeconds = 2;
const enemyIdleTicks = enemyIdleSeconds * ticksPerSecond;
const enemyPatrolSpeed = 1 / ticksPerSecond;
const enemyChaseSpeed = 2 / ticksPerSecond;
const enemySightDistance = maxRayDistance;
const enemyLoseSightTicks = ticksPerSecond;
// TDD 6.6: the enemy keeps half its width away from walls, so its body never
// crosses a wall even when it cuts a corner
const enemyCollisionRadius = enemyWidth / 2;

// D-27c / TDD 2.3.1: contact damage comes in whole hit points. An enemy closer
// than contactDistance hits once as soon as its wait is over, then waits a
// second. D-19c: the amount is per enemy, one for a regular, two for the boss.
const contactDistance = 0.6;
const contactHitWaitTicks = ticksPerSecond;

// D-23 / TDD 3.6: only the chunks this close to the player's chunk are active.
// Two chunks (32 cells) cover maxRayDistance (24 cells) from anywhere in the
// player's chunk, so every enemy the player can see or touch is inside the
// 5 by 5 block. The rest stay frozen in place until the player comes back.
const activeChunkRadius = Math.ceil(maxRayDistance / chunkSize);

// D-23: the enemy lists to update and draw this frame, at most 25 lists read
// from the Map, so the cost does not grow with the explored world. With the
// admin toggle off it is every loaded chunk, as before D-23, to compare FPS.
function getActiveEnemyLists(player) {
  if (!gameSettings.activeAreaOnly) {
    return enemiesByChunk.values();
  }
  const playerChunkX = Math.floor(player.posX / chunkSize);
  const playerChunkY = Math.floor(player.posY / chunkSize);
  const lists = [];
  for (let cy = playerChunkY - activeChunkRadius; cy <= playerChunkY + activeChunkRadius; cy += 1) {
    for (let cx = playerChunkX - activeChunkRadius; cx <= playerChunkX + activeChunkRadius; cx += 1) {
      const enemies = enemiesByChunk.get(getChunkKey(cx, cy));
      if (enemies !== undefined) {
        lists.push(enemies);
      }
    }
  }
  return lists;
}

// D-25: the chunk the player stood in the last time far enemies were gathered
let gatheredChunkX = null;
let gatheredChunkY = null;

// D-25 and D-38 / TDD 2.3.2: when the player enters another chunk, every live
// enemy out of play moves to a room of the four door neighbors of the new
// chunk, to the one with the fewest enemies, with the same rules as the start
// of the game (js/world.js). The ones still alive, the boss included, stay one
// door away in the infinite world. With no free cell left, an enemy waits
// where it is.
function gatherFarEnemies(player) {
  const playerChunkX = Math.floor(player.posX / chunkSize);
  const playerChunkY = Math.floor(player.posY / chunkSize);
  if (playerChunkX === gatheredChunkX && playerChunkY === gatheredChunkY) {
    return;
  }
  gatheredChunkX = playerChunkX;
  gatheredChunkY = playerChunkY;

  const areas = getSpawnAreas(player);
  let freeCells = 0;
  for (const area of areas) {
    freeCells += area.roomCells.length + area.corridorCells.length;
  }
  const outOfPlay = collectOutOfPlayEnemies(player, freeCells);
  for (const enemy of outOfPlay) {
    const cell = takeSpreadSpawnCell(areas);
    moveEnemyToCell(enemy, cell.x, cell.y);
  }
}

// D-38: at most limit enemies out of play, one per free cell. Collected first
// and moved after, so no list changes while it is being walked. Stopping at
// the limit keeps a chunk change cheap with 100,000 enemies and full rooms.
function collectOutOfPlayEnemies(player, limit) {
  const outOfPlay = [];
  if (limit === 0) {
    return outOfPlay;
  }
  for (const enemies of enemiesByChunk.values()) {
    for (const enemy of enemies) {
      if (isEnemyOutOfPlay(enemy, player)) {
        outOfPlay.push(enemy);
        if (outOfPlay.length === limit) {
          return outOfPlay;
        }
      }
    }
  }
  return outOfPlay;
}

// D-38: an enemy is in play in the player's chunk or a door neighbor (chunk
// distance 0 or 1 counting only straight steps), while it chases, or while
// the player could see it. Only the hidden ones move, so nobody sees one vanish.
function isEnemyOutOfPlay(enemy, player) {
  if (enemy.state === "chase") {
    return false;
  }
  const playerChunkX = Math.floor(player.posX / chunkSize);
  const playerChunkY = Math.floor(player.posY / chunkSize);
  const chunkSteps = Math.abs(enemy.chunkX - playerChunkX) + Math.abs(enemy.chunkY - playerChunkY);
  if (chunkSteps <= 1) {
    return false;
  }
  return isHiddenFromPlayer(enemy.posX, enemy.posY, player);
}

// D-25: the enemy reappears idle at the center of the new cell, listed in its
// new chunk and cell
function moveEnemyToCell(enemy, cellX, cellY) {
  removeEnemyFromCell(enemy);
  removeEnemyFromChunk(enemy);
  enemy.posX = cellX + 0.5;
  enemy.posY = cellY + 0.5;
  enemy.cellX = cellX;
  enemy.cellY = cellY;
  enemy.chunkX = Math.floor(cellX / chunkSize);
  enemy.chunkY = Math.floor(cellY / chunkSize);
  enemy.state = "idle";
  enemy.stateTime = 0;
  addEnemyToChunk(enemy);
  registerEnemyAtCell(enemy);
}

// D-27c: the hit points the active enemies take from the player this frame
function getContactDamage(player, deltaTime) {
  if (isBossFalling()) {
    return 0;
  }
  let damage = 0;
  for (const enemies of getActiveEnemyLists(player)) {
    for (const enemy of enemies) {
      damage += updateContactHit(enemy, player, deltaTime);
    }
  }
  return damage;
}

// D-27c: each enemy keeps its own wait, which runs down in and out of contact,
// so stepping in and out never gives more than one hit per second
function updateContactHit(enemy, player, deltaTime) {
  enemy.hitWait = Math.max(0, enemy.hitWait - deltaTime);
  const touching = Math.hypot(enemy.posX - player.posX, enemy.posY - player.posY) < contactDistance;
  if (!touching || enemy.hitWait > 0) {
    return 0;
  }
  enemy.hitWait = contactHitWaitTicks;
  return enemy.contactDamage;
}

// D-23: only the active enemies move. An enemy that crossed into another chunk
// changes lists after the loop, so no list changes while it is being walked.
function updateEnemies(player, deltaTime) {
  const changedChunk = [];
  for (const enemies of getActiveEnemyLists(player)) {
    for (const enemy of enemies) {
      updateEnemyState(enemy, player, deltaTime);
      if (hasLeftItsChunk(enemy)) {
        changedChunk.push(enemy);
      }
    }
  }
  for (const enemy of changedChunk) {
    moveEnemyToItsChunk(enemy);
  }
}

// D-05a and D-05b: idle waits, patrol walks a route and scans for the player,
// chase follows the player until it loses sight for a full second.
function updateEnemyState(enemy, player, deltaTime) {
  if (enemy.state === "idle") {
    enemy.stateTime += deltaTime;
    if (enemy.stateTime >= enemyIdleTicks) {
      startPatrol(enemy);
    }
  } else if (enemy.state === "patrol") {
    updatePatrol(enemy, player, deltaTime);
  } else if (enemy.state === "chase") {
    updateChase(enemy, player, deltaTime);
  }
}

// D-05b: 360 degree line of sight. The ray direction points straight at the
// player, so the player sits at parameter 1 of the ray. A wall closer than that
// (perpWallDist < 1) blocks the view. Same DDA used for rendering and shooting.
function hasLineOfSight(enemy, player) {
  const rayDirX = player.posX - enemy.posX;
  const rayDirY = player.posY - enemy.posY;
  if (Math.hypot(rayDirX, rayDirY) > enemySightDistance) {
    return false;
  }
  const ray = castRay(enemy.posX, enemy.posY, rayDirX, rayDirY);
  return !ray.hit || ray.perpWallDist >= 1;
}

function updateChase(enemy, player, deltaTime) {
  if (hasLineOfSight(enemy, player)) {
    enemy.stateTime = 0;
    moveEnemyToward(enemy, { x: player.posX, y: player.posY }, getChaseStep(enemy, player, deltaTime));
    updateEnemyCell(enemy);
    return;
  }
  enemy.stateTime += deltaTime;
  if (enemy.stateTime >= enemyLoseSightTicks) {
    startPatrol(enemy);
  }
}

// D-27b / TDD 2.3.2: the step is cut to what is left until enemyStopDistance,
// so the enemy stops in front of the player and never walks into its body.
// The move is along the line to the player, so it never ends closer than that.
function getChaseStep(enemy, player, deltaTime) {
  const distance = Math.hypot(player.posX - enemy.posX, player.posY - enemy.posY);
  const room = Math.max(0, distance - enemyStopDistance);
  return Math.min(enemyChaseSpeed * deltaTime, room);
}

// A patrol route is two air cell centers: the enemy's own cell and one random
// neighbour. With no open neighbour it stays idle instead of pacing a wall.
function startPatrol(enemy) {
  const neighbour = choosePatrolNeighbour(enemy);
  if (neighbour === null) {
    enemy.state = "idle";
    enemy.stateTime = 0;
    return;
  }
  enemy.patrolA = { x: enemy.cellX + 0.5, y: enemy.cellY + 0.5 };
  enemy.patrolB = neighbour;
  enemy.patrolTargetIsB = true;
  enemy.state = "patrol";
  enemy.stateTime = 0;
}

function choosePatrolNeighbour(enemy) {
  const options = [];
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [offsetX, offsetY] of neighbours) {
    if (getCell(enemy.cellX + offsetX, enemy.cellY + offsetY) === 0) {
      options.push({ x: enemy.cellX + offsetX + 0.5, y: enemy.cellY + offsetY + 0.5 });
    }
  }
  if (options.length === 0) {
    return null;
  }
  return options[Math.floor(gameRandom() * options.length)];
}

// D-41d: an enemy that spots the player growls once, as it starts the chase
function updatePatrol(enemy, player, deltaTime) {
  if (hasLineOfSight(enemy, player)) {
    enemy.state = "chase";
    enemy.stateTime = 0;
    playEnemySound("enemyAlert", enemy, player);
    return;
  }
  const target = enemy.patrolTargetIsB ? enemy.patrolB : enemy.patrolA;
  moveEnemyToward(enemy, target, enemyPatrolSpeed * deltaTime);
  updateEnemyCell(enemy);
  if (Math.abs(enemy.posX - target.x) < 0.001 && Math.abs(enemy.posY - target.y) < 0.001) {
    enemy.posX = target.x;
    enemy.posY = target.y;
    enemy.patrolTargetIsB = !enemy.patrolTargetIsB;
  }
}

function moveEnemyToward(enemy, target, distance) {
  const offsetX = target.x - enemy.posX;
  const offsetY = target.y - enemy.posY;
  const length = Math.hypot(offsetX, offsetY);
  if (length === 0) {
    return;
  }
  const step = Math.min(distance, length);
  const moveX = offsetX / length * step;
  const moveY = offsetY / length * step;

  // Slide by axis against the walls, like the player, so the enemy never walks
  // into a wall it is chasing past
  if (canEnemyStandAt(enemy.posX + moveX, enemy.posY) &&
      canEnemyKeepDistance(enemy, enemy.posX + moveX, enemy.posY)) {
    enemy.posX += moveX;
  }
  if (canEnemyStandAt(enemy.posX, enemy.posY + moveY) &&
      canEnemyKeepDistance(enemy, enemy.posX, enemy.posY + moveY)) {
    enemy.posY += moveY;
  }
}

// D-27e: check nearby registered enemies before accepting either axis.
function canEnemyKeepDistance(enemy, posX, posY) {
  const radius = enemy.width / 2;
  // Include every cell that could contain a colliding regular enemy or boss.
  const searchRadius = radius + bossWidth / 2;
  const minX = Math.floor(posX - searchRadius);
  const maxX = Math.floor(posX + searchRadius);
  const minY = Math.floor(posY - searchRadius);
  const maxY = Math.floor(posY + searchRadius);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (const other of getEnemiesAtCell(x, y)) {
        if (other === enemy) continue;
        const minDistance = radius + other.width / 2;
        const dx = posX - other.posX;
        const dy = posY - other.posY;
        if (dx * dx + dy * dy < minDistance * minDistance) return false;
      }
    }
  }
  return true;
}

// TDD 6.6: a square footprint, side 2 * enemyCollisionRadius, must not touch a
// wall cell
function canEnemyStandAt(posX, posY) {
  const minX = Math.floor(posX - enemyCollisionRadius);
  const maxX = Math.floor(posX + enemyCollisionRadius);
  const minY = Math.floor(posY - enemyCollisionRadius);
  const maxY = Math.floor(posY + enemyCollisionRadius);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (getCell(x, y) !== 0) {
        return false;
      }
    }
  }
  return true;
}

// D-05a: the per-cell registry (minimap, D-04b) follows the enemy as it crosses
// cell boundaries. Math.floor keeps negative cells correct.
function updateEnemyCell(enemy) {
  const cellX = Math.floor(enemy.posX);
  const cellY = Math.floor(enemy.posY);
  if (cellX === enemy.cellX && cellY === enemy.cellY) {
    return;
  }
  removeEnemyFromCell(enemy);
  enemy.cellX = cellX;
  enemy.cellY = cellY;
  registerEnemyAtCell(enemy);
}

function removeEnemyFromCell(enemy) {
  const cellKey = getChunkKey(enemy.cellX, enemy.cellY);
  const list = enemiesByCell.get(cellKey);
  if (list === undefined) {
    return;
  }
  const index = list.indexOf(enemy);
  if (index !== -1) {
    list.splice(index, 1);
  }
}

// D-23: an enemy is listed in the chunk it stands in, so the active area finds
// an enemy that chased the player far from the chunk where it was created.
// Math.floor keeps negative chunks correct.
function hasLeftItsChunk(enemy) {
  const chunkX = Math.floor(enemy.cellX / chunkSize);
  const chunkY = Math.floor(enemy.cellY / chunkSize);
  return chunkX !== enemy.chunkX || chunkY !== enemy.chunkY;
}

function moveEnemyToItsChunk(enemy) {
  removeEnemyFromChunk(enemy);
  enemy.chunkX = Math.floor(enemy.cellX / chunkSize);
  enemy.chunkY = Math.floor(enemy.cellY / chunkSize);
  addEnemyToChunk(enemy);
}

function removeEnemyFromChunk(enemy) {
  const chunkKey = getChunkKey(enemy.chunkX, enemy.chunkY);
  const list = enemiesByChunk.get(chunkKey);
  if (list === undefined) {
    return;
  }
  const index = list.indexOf(enemy);
  if (index !== -1) {
    list.splice(index, 1);
  }
}

// D-13b / D-42: one projectile hit (TDD 2.3.1). The enemy loses one point of
// health and, at zero, it leaves play, starts to fall and is counted (or wins
// the game). D-39f: a hit sprays a few drops and a death sprays more.
// D-41d / D-41f: each plays its sound from where the enemy is.
function damageEnemy(target, player) {
  target.health -= 1;
  if (target.health > 0) {
    sprayBlood(target, player, bloodDropsPerHit);
    playEnemySound("enemyHit", target, player);
    return;
  }
  removeEnemy(target);
  startEnemyDeath(target);
  sprayBlood(target, player, bloodDropsPerDeath);
  playEnemySound("enemyDeath", target, player);
  if (target.isBoss) {
    // D-19d / D-39c: killing the boss wins the game. updateDyingEnemies shows
    // the victory screen once the boss lies on the floor.
    return;
  }
  addKill();
  // D-19c: the last regular enemy spawns the boss. D-38: a live boss stays
  // where it is; killing it ends the game, so it spawns once.
  if (getKillCount() >= gameSettings.enemiesPerGame && findBoss() === null) {
    spawnBoss(player);
  }
}

// D-41d / D-41f: an enemy sound placed at the enemy, quieter with distance and
// panned to its side. The boss plays the same sounds slower, so deeper.
function playEnemySound(name, enemy, player) {
  playSoundAt(name, enemy.posX, enemy.posY, player, { rate: enemy.isBoss ? bossSoundRate : 1 });
}

// A hit removes the enemy from its cell and its chunk.
function removeEnemy(enemy) {
  removeEnemyFromCell(enemy);
  removeEnemyFromChunk(enemy);
}

// D-39c / TDD 2.3.1: a killed enemy leaves its cell and its chunk in the frame
// it dies, so it blocks nothing, hits nothing and takes no shots. It moves to
// this list, which is only drawn: it falls where it died, one death frame
// every 0.2 s (1 s in all), lies 2 s on the last frame, fading out in the last
// half second, and leaves the list. Times are 60 Hz ticker units, like deltaTime.
const enemyDeathFrameTicks = 0.2 * ticksPerSecond;
const enemyDeathTicks = enemyDeathFrameCount * enemyDeathFrameTicks;
const enemyCorpseTicks = 2 * ticksPerSecond;
const enemyCorpseFadeTicks = 0.5 * ticksPerSecond;
const dyingEnemies = [];

// D-39d: the enemy leaves a stain in the cell where it dies, kept for the session
function startEnemyDeath(enemy) {
  dyingEnemies.push({ enemy, time: 0 });
  addStain(Math.floor(enemy.posX), Math.floor(enemy.posY));
}

// D-39c: the death frame for the time since the kill, held on the last one
function getDeathFrame(time) {
  return Math.min(Math.floor(time / enemyDeathFrameTicks), enemyDeathFrameCount - 1);
}

// D-39c: 1 until the last half second of the corpse, then down to 0
function getCorpseAlpha(time) {
  const endTime = enemyDeathTicks + enemyCorpseTicks;
  return Math.min(Math.max((endTime - time) / enemyCorpseFadeTicks, 0), 1);
}

// D-39c: advances every fall and drops the ones that faded out. The boss wins
// the game when it lies on the floor, so the victory screen waits for its fall.
// Walked backwards, so removing an entry never skips the next one.
function updateDyingEnemies(deltaTime) {
  for (let index = dyingEnemies.length - 1; index >= 0; index -= 1) {
    const dying = dyingEnemies[index];
    dying.time += deltaTime;
    if (dying.enemy.isBoss && dying.time >= enemyDeathTicks) {
      setGameState(gameStateVictory);
    }
    if (dying.time >= enemyDeathTicks + enemyCorpseTicks) {
      dyingEnemies.splice(index, 1);
    }
  }
}

// D-39c: the kill already won the game, so while the boss falls no enemy
// hits the player
function isBossFalling() {
  return dyingEnemies.some((dying) => dying.enemy.isBoss);
}

// D-39c / TDD 2.3.4: a new game discards the falls of the last one
function clearDyingEnemies() {
  dyingEnemies.length = 0;
}
