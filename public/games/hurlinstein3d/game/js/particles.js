// D-39f / TDD 2.3.2 and 3.5: the blood spray is a particle system. Each drop
// keeps its world position (posX and posY in cells, and a height z above the
// floor, where the floor is 0 and the eye 0.5), its velocity and the life it
// has left. Times are 60 Hz ticker units, like deltaTime.
const bloodDropPoolSize = 256;
const bloodDropsPerHit = 6;
const bloodDropsPerDeath = 24;
// Gravity only pulls the height down: 9 cells per second squared
const bloodGravity = 9 / (ticksPerSecond * ticksPerSecond);
// The spray leaves from the chest, at this share of the enemy height
const bloodChestShare = 0.7;
// Away from the shooter, within a fan this wide (radians, about 100 degrees)
const bloodSpraySpread = 1.75;
// Speeds in cells per second, picked at random between the two limits
const bloodMinSpeed = 0.8;
const bloodMaxSpeed = 2.4;
const bloodMinRise = 0.3;
const bloodMaxRise = 1.5;
// A drop that stays in the air longer than this is dropped anyway
const bloodMinLifeTicks = 0.6 * ticksPerSecond;
const bloodMaxLifeTicks = 1 * ticksPerSecond;
// The spray only looks random; it uses its own generator seeded from the world
// seed, so Math.random still only picks the world seed (TDD 4.4) and the drops
// never change the enemy choices made with gameRandom
const bloodSeedSalt = 0x0b100d5;
let bloodRandom = createRandom(worldSeed ^ bloodSeedSalt);

// TDD 6.4: the fixed pool, created once at load. The ticker only changes the
// values of a drop and turns it on or off.
const bloodDrops = [];
for (let index = 0; index < bloodDropPoolSize; index++) {
  bloodDrops.push({ active: false, posX: 0, posY: 0, z: 0, velX: 0, velY: 0, velZ: 0, life: 0 });
}

function getBloodBetween(min, max) {
  return min + bloodRandom() * (max - min);
}

// D-39f: an inactive drop of the pool, or null when all 256 are in the air
function findFreeBloodDrop() {
  for (const drop of bloodDrops) {
    if (!drop.active) {
      return drop;
    }
  }
  return null;
}

// D-39f: count drops leave the enemy's chest, away from the player, so the
// spray goes out the far side of the hit. A full pool skips the rest.
function sprayBlood(enemy, player, count) {
  const awayAngle = Math.atan2(enemy.posY - player.posY, enemy.posX - player.posX);
  for (let index = 0; index < count; index++) {
    const drop = findFreeBloodDrop();
    if (drop === null) {
      return;
    }
    const angle = awayAngle + (bloodRandom() - 0.5) * bloodSpraySpread;
    const speed = getBloodBetween(bloodMinSpeed, bloodMaxSpeed) / ticksPerSecond;
    drop.active = true;
    drop.posX = enemy.posX;
    drop.posY = enemy.posY;
    drop.z = enemy.height * bloodChestShare;
    drop.velX = Math.cos(angle) * speed;
    drop.velY = Math.sin(angle) * speed;
    drop.velZ = getBloodBetween(bloodMinRise, bloodMaxRise) / ticksPerSecond;
    drop.life = getBloodBetween(bloodMinLifeTicks, bloodMaxLifeTicks);
  }
}

// D-39f / TDD 3.5: one Euler step with Δt = deltaTime. First v = v + g · Δt
// (gravity only on the height), then p = p + v · Δt. A drop dies when it
// reaches the floor or runs out of life, and leaves no stain (TDD 2.3.2).
function stepBloodDrop(drop, deltaTime) {
  drop.velZ -= bloodGravity * deltaTime;
  drop.posX += drop.velX * deltaTime;
  drop.posY += drop.velY * deltaTime;
  drop.z += drop.velZ * deltaTime;
  drop.life -= deltaTime;
  if (drop.z <= 0 || drop.life <= 0) {
    drop.active = false;
  }
}

function updateBloodDrops(deltaTime) {
  for (const drop of bloodDrops) {
    if (drop.active) {
      stepBloodDrop(drop, deltaTime);
    }
  }
}

function getActiveBloodDropCount() {
  let count = 0;
  for (const drop of bloodDrops) {
    if (drop.active) {
      count += 1;
    }
  }
  return count;
}

// D-39f / TDD 2.3.4: a new game empties the pool. Called after the new world
// seed is set, so the spray of the new game follows the new seed.
function clearBloodDrops() {
  for (const drop of bloodDrops) {
    drop.active = false;
  }
  bloodRandom = createRandom(worldSeed ^ bloodSeedSalt);
}
