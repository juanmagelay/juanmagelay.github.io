// D-13b / TDD 2.3.1: shotgun projectiles. A projectile flies along the center
// ray (cameraX 0, rayDir equal to dir). Positions are in cells, like the player.

// 20 cells per second, in cells per 60 Hz ticker unit (times ticker.deltaTime)
const projectileSpeed = 20 / ticksPerSecond;

// Projectiles in flight. They are few and short lived, so a plain array is
// enough (they are not registered by cell like the enemies).
const projectiles = [];

// TDD 2.3.1: the center ray DDA gives the wall distance once, when firing.
// Walls never change during the session (TDD 4.4), so that distance is the
// projectile range. dir has length 1, so perpWallDist is also the distance
// travelled along the ray. No wall within maxRayDistance: the range is the max.
function fireProjectile(player) {
  const ray = castRay(player.posX, player.posY, player.dirX, player.dirY);
  const projectile = {
    posX: player.posX,
    posY: player.posY,
    dirX: player.dirX,
    dirY: player.dirY,
    travelled: 0,
    range: ray.hit ? ray.perpWallDist : maxRayDistance,
  };
  projectiles.push(projectile);
  return projectile;
}

// Moves every projectile and drops the ones that are done. The loop walks the
// list backwards, so removing one does not skip the next.
function updateProjectiles(deltaTime) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const done = advanceProjectile(projectiles[index], projectileSpeed * deltaTime);
    if (done) {
      projectiles.splice(index, 1);
    }
  }
}

// One tick of flight. The projectile never moves past its range, so it stops
// on the wall face. Returns true when it hit an enemy or reached its range.
function advanceProjectile(projectile, distance) {
  const remaining = projectile.range - projectile.travelled;
  const step = Math.min(distance, remaining);

  const enemy = findEnemyOnSegment(projectile, step);
  if (enemy !== null) {
    removeEnemy(enemy);
    return true;
  }

  projectile.posX += projectile.dirX * step;
  projectile.posY += projectile.dirY * step;
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

// Same math as the D-07a shot. along is the dot product of the offset with dir:
// how far down the segment the enemy center sits. lateral is the distance from
// the enemy center to the line. A hit needs along inside the segment and
// lateral within half the enemy width. Returns along, or null on a miss.
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
  return along;
}
