// TDD 3.2 to 3.4: one ray per screen column, walked across the grid with DDA.

// TDD 3.2: x is a screen column in pixels, from 0 to screenWidth - 1.
// cameraX goes from -1 on the left edge to +1 on the right edge.
function castRayForColumn(player, x) {
  const cameraX = 2 * x / screenWidth - 1;
  // Not normalized: the rays are spread evenly over the camera plane
  const rayDirX = player.dirX + player.planeX * cameraX;
  const rayDirY = player.dirY + player.planeY * cameraX;
  return castRay(player.posX, player.posY, rayDirX, rayDirY);
}

// TDD 3.3: walks the ray one grid line at a time until it enters a wall cell
// or the next grid line is past maxRayDistance (TDD 5.2).
// Returns { hit, perpWallDist, side, mapX, mapY }.
// side 0: the ray crossed a vertical grid line (X face). side 1: a horizontal one (Y face).
// When hit is false the column shows the background and perpWallDist is not used.
function castRay(posX, posY, rayDirX, rayDirY) {
  // TDD 5.2: Math.floor, so negative positions land in the right cell
  let mapX = Math.floor(posX);
  let mapY = Math.floor(posY);

  // How far the ray travels between two vertical grid lines, and between two
  // horizontal ones. Numerator 1 instead of |rayDir| turns it into perpendicular
  // distance. 1 / 0 is Infinity, so an axis the ray never crosses never wins.
  const deltaDistX = 1 / Math.abs(rayDirX);
  const deltaDistY = 1 / Math.abs(rayDirY);

  // Step direction, and distance from pos to the first grid line on each axis
  let stepX;
  let sideDistX;
  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (posX - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - posX) * deltaDistX;
  }

  let stepY;
  let sideDistY;
  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (posY - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - posY) * deltaDistY;
  }

  let hit = false;
  let side = 0;
  while (!hit) {
    // TDD 5.2: stop when the next grid line is past the max distance
    if (Math.min(sideDistX, sideDistY) > maxRayDistance) {
      break;
    }
    // Advance on the axis whose next grid line is closer
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    if (getCell(mapX, mapY) === 1) {
      hit = true;
    }
  }

  // TDD 3.4: read once, after the loop, from the axis that moved last
  let perpWallDist;
  if (side === 0) {
    perpWallDist = sideDistX - deltaDistX;
  } else {
    perpWallDist = sideDistY - deltaDistY;
  }

  return { hit, perpWallDist, side, mapX, mapY };
}
