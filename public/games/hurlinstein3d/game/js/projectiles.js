// D-13b / TDD 2.3.1: shotgun projectiles. A projectile flies along the center
// ray (cameraX 0, rayDir equal to dir). Positions are in cells, like the player.

// 20 cells per second, in cells per 60 Hz ticker unit (times ticker.deltaTime)
const projectileSpeed = 20 / ticksPerSecond;

// Projectiles in flight. They are few and short lived, so a plain array is
// enough (they are not registered by cell like the enemies).
const projectiles = [];

// D-17a / TDD 2.3.4: a new game discards every projectile still in flight.
function clearProjectiles() {
  projectiles.length = 0;
}

// TDD 2.3.1: the center ray DDA gives the wall distance once, when firing.
// Walls never change during the session (TDD 4.4), so that distance is the
// projectile range. dir has length 1, so perpWallDist is also the distance
// travelled along the ray. No wall within maxRayDistance: the range is the max.
// D-40c: aimSlope is the look slope (getLookSlope, js/player.js), the cells of
// height the shot gains per cell along dir; 0 is a level shot. It starts at
// eye height, so it follows the line through the crosshair, and its range is
// also cut where that line meets the floor or the ceiling.
function fireProjectile(player, aimSlope = 0) {
  const ray = castRay(player.posX, player.posY, player.dirX, player.dirY);
  const wallRange = ray.hit ? ray.perpWallDist : maxRayDistance;
  const projectile = {
    posX: player.posX,
    posY: player.posY,
    z: eyeHeight,
    dirX: player.dirX,
    dirY: player.dirY,
    slope: aimSlope,
    travelled: 0,
    range: Math.min(wallRange, getFloorOrCeilingRange(aimSlope)),
  };
  projectiles.push(projectile);
  return projectile;
}

// D-40c: the distance along dir at which a shot from eye height, half a cell
// over the floor and half a cell under the ceiling, meets one of them. A level
// shot never does: 0.5 / 0 is Infinity, like deltaDist for a ray along one
// axis (TDD 3.3), so the wall always wins the Math.min.
function getFloorOrCeilingRange(slope) {
  return eyeHeight / Math.abs(slope);
}

// Moves every projectile and drops the ones that are done. The loop walks the
// list backwards, so removing one does not skip the next.
function updateProjectiles(deltaTime, player) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const done = advanceProjectile(projectiles[index], projectileSpeed * deltaTime, player);
    if (done) {
      projectiles.splice(index, 1);
    }
  }
}

// One tick of flight. The projectile never moves past its range, so it stops
// on the wall face. Returns true when it hit an enemy or reached its range.
function advanceProjectile(projectile, distance, player) {
  const remaining = projectile.range - projectile.travelled;
  const step = Math.min(distance, remaining);

  const enemy = findEnemyOnSegment(projectile, step);
  if (enemy !== null) {
    damageEnemy(enemy, player);
    return true;
  }

  projectile.posX += projectile.dirX * step;
  projectile.posY += projectile.dirY * step;
  projectile.z += projectile.slope * step;
  projectile.travelled += step;
  return distance >= remaining;
}

// TDD 2.3.1: only the enemies registered in the cells the segment touches are
// tested (spatial hashing). The box around the segment grows by half an enemy
// width, so an enemy whose center sits in the next cell, but whose body reaches
// the segment, is still found. Returns the nearest enemy hit, or null.
function findEnemyOnSegment(projectile, length) {
  const endX = projectile.posX + projectile.dirX * length;
  const endY = projectile.posY + projectile.dirY * length;
  const margin = enemyWidth / 2;
  // TDD 5.2: Math.floor, so negative positions land in the right cell
  const minCellX = Math.floor(Math.min(projectile.posX, endX) - margin);
  const maxCellX = Math.floor(Math.max(projectile.posX, endX) + margin);
  const minCellY = Math.floor(Math.min(projectile.posY, endY) - margin);
  const maxCellY = Math.floor(Math.max(projectile.posY, endY) + margin);

  let target = null;
  let targetDistance = Infinity;
  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (const enemy of getEnemiesAtCell(cellX, cellY)) {
        const distance = getHitDistance(projectile, enemy, length);
        if (distance !== null && distance < targetDistance) {
          target = enemy;
          targetDistance = distance;
        }
      }
    }
  }
  return target;
}

// along is the dot product of the offset with dir: how far down the segment
// the enemy center sits. lateral is the distance from the enemy center to the
// line. A hit needs along inside the segment and lateral within half the enemy
// width. D-40c: it also needs the shot's height where it crosses the enemy
// center inside the body, from the floor to enemy.height (0.6 cells, 0.9 for
// the boss). Returns along, or null on a miss.
function getHitDistance(projectile, enemy, length) {
  const offsetX = enemy.posX - projectile.posX;
  const offsetY = enemy.posY - projectile.posY;
  const along = offsetX * projectile.dirX + offsetY * projectile.dirY;
  if (along < 0 || along > length) {
    return null;
  }
  const lateral = Math.hypot(
    offsetX - along * projectile.dirX,
    offsetY - along * projectile.dirY,
  );
  if (lateral > enemy.width / 2) {
    return null;
  }
  const height = projectile.z + projectile.slope * along;
  if (height < 0 || height > enemy.height) {
    return null;
  }
  return along;
}
