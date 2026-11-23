// TDD 6.7: a fixed-size top-down window over the player's current cell
const minimapCellsPerSide = 21;
const minimapCellSize = 10;
// D-15a / TDD 2.3.3: the window sits in the top-right corner
const minimapMargin = 10;
const minimapY = minimapMargin;

// D-16a: the left edge follows the canvas width, so the window stays in the
// top-right corner after a resize. Read once per draw.
function getMinimapX() {
  return screenWidth - minimapMargin - minimapCellsPerSide * minimapCellSize;
}
const minimapBackgroundColor = 0x0d1117;
const minimapWallColor = 0x2c4a7c;
const minimapPlayerColor = 0x4de1bd;
const minimapProjectileRadius = 2;
// D-16e3: every eighth ray of the wall pass, faint, so the fan reads clearly
const minimapRayStep = 8;
const minimapRayAlpha = 0.35;
// D-16f: chunk borders in a color no other minimap element uses
const minimapChunkBorderColor = 0xff4fd8;

function getEnemyMinimapMarker(enemy, firstMapX, firstMapY) {
  const minimapX = getMinimapX();
  const markerSize = minimapCellSize * enemy.width;
  const centerX = minimapX + (enemy.posX - firstMapX) * minimapCellSize;
  const centerY = minimapY + (enemy.posY - firstMapY) * minimapCellSize;
  return {
    x: centerX - markerSize / 2,
    y: centerY - markerSize / 2,
    width: markerSize,
    height: markerSize,
  };
}

// D-13d: true when a world position falls inside the 21 by 21 cell window
function isInsideMinimapWindow(posX, posY, firstMapX, firstMapY) {
  const insideX = posX >= firstMapX && posX < firstMapX + minimapCellsPerSide;
  const insideY = posY >= firstMapY && posY < firstMapY + minimapCellsPerSide;
  return insideX && insideY;
}

// D-16f: the chunk borders inside the window along one axis, in world cells.
// Math.floor finds the chunk of the first cell, so negatives work (-10 is in
// chunk -1, whose right border is 0). A border on the window edge is skipped.
function getChunkBordersInWindow(firstCell) {
  const borders = [];
  let border = (Math.floor(firstCell / chunkSize) + 1) * chunkSize;
  while (border < firstCell + minimapCellsPerSide) {
    borders.push(border);
    border += chunkSize;
  }
  return borders;
}

// D-16e3: ray parameter t where one coordinate of P(t) = pos + t * rayDir
// reaches the window edge it moves toward. A zero component never gets there.
function getWindowExitParameter(pos, rayDir, firstCell) {
  if (rayDir > 0) {
    return (firstCell + minimapCellsPerSide - pos) / rayDir;
  }
  if (rayDir < 0) {
    return (firstCell - pos) / rayDir;
  }
  return Infinity;
}

// D-16e3: where the ray of a screen column ends on the minimap, in world
// cells. The wall pass of this frame left t = perpWallDist in the depth buffer
// (maxRayDistance for a miss), so nothing is cast again. The ray starts at the
// player, inside the window, and is cut where it first leaves the window.
function getMinimapRayEnd(player, columnX, rayLength, firstMapX, firstMapY) {
  const cameraX = 2 * columnX / screenWidth - 1;
  const rayDirX = player.dirX + player.planeX * cameraX;
  const rayDirY = player.dirY + player.planeY * cameraX;
  const t = Math.min(
    rayLength,
    getWindowExitParameter(player.posX, rayDirX, firstMapX),
    getWindowExitParameter(player.posY, rayDirY, firstMapY),
  );
  return { x: player.posX + t * rayDirX, y: player.posY + t * rayDirY };
}

// D-16f: one line per chunk border across the window, all in one stroke
function drawChunkBorders(graphics, minimapX, firstMapX, firstMapY) {
  const windowSize = minimapCellsPerSide * minimapCellSize;
  const bordersX = getChunkBordersInWindow(firstMapX);
  const bordersY = getChunkBordersInWindow(firstMapY);
  for (const border of bordersX) {
    const x = minimapX + (border - firstMapX) * minimapCellSize;
    graphics.moveTo(x, minimapY).lineTo(x, minimapY + windowSize);
  }
  for (const border of bordersY) {
    const y = minimapY + (border - firstMapY) * minimapCellSize;
    graphics.moveTo(minimapX, y).lineTo(minimapX + windowSize, y);
  }
  if (bordersX.length + bordersY.length > 0) {
    graphics.stroke({ color: minimapChunkBorderColor, width: 1 });
  }
}

// D-16e3: the rays of the wall pass, from the player to each hit, in one stroke
function drawMinimapRays(graphics, player, minimapX, firstMapX, firstMapY) {
  const playerX = minimapX + (player.posX - firstMapX) * minimapCellSize;
  const playerY = minimapY + (player.posY - firstMapY) * minimapCellSize;
  const stripWidth = gameSettings.stripWidth;
  for (let index = 0; index < getWallStripCount(); index += minimapRayStep) {
    const end = getMinimapRayEnd(player, index * stripWidth, wallDepthBuffer[index], firstMapX, firstMapY);
    graphics
      .moveTo(playerX, playerY)
      .lineTo(
        minimapX + (end.x - firstMapX) * minimapCellSize,
        minimapY + (end.y - firstMapY) * minimapCellSize,
      );
  }
  graphics.stroke({ color: minimapPlayerColor, width: 1, alpha: minimapRayAlpha });
}

function drawMinimap(graphics, player) {
  const minimapX = getMinimapX();
  graphics.clear();
  graphics.rect(
    minimapX,
    minimapY,
    minimapCellsPerSide * minimapCellSize,
    minimapCellsPerSide * minimapCellSize,
  ).fill(minimapBackgroundColor);

  const firstMapX = Math.floor(player.posX) - Math.floor(minimapCellsPerSide / 2);
  const firstMapY = Math.floor(player.posY) - Math.floor(minimapCellsPerSide / 2);

  const enemyMarkers = [];
  for (let y = 0; y < minimapCellsPerSide; y += 1) {
    for (let x = 0; x < minimapCellsPerSide; x += 1) {
      const mapX = firstMapX + x;
      const mapY = firstMapY + y;
      if (getCell(mapX, mapY) === 1) {
        graphics.rect(
          minimapX + x * minimapCellSize,
          minimapY + y * minimapCellSize,
          minimapCellSize,
          minimapCellSize,
        );
      }
      for (const enemy of getEnemiesAtCell(mapX, mapY)) {
        enemyMarkers.push(getEnemyMinimapMarker(enemy, firstMapX, firstMapY));
      }
    }
  }
  graphics.fill(minimapWallColor);

  // D-16e and D-16f: optional layers for the defense, over the walls and under
  // the enemies and the player
  if (gameSettings.chunkBorders) {
    drawChunkBorders(graphics, minimapX, firstMapX, firstMapY);
  }
  if (gameSettings.minimapRays) {
    drawMinimapRays(graphics, player, minimapX, firstMapX, firstMapY);
  }

  for (const marker of enemyMarkers) {
    graphics.rect(marker.x, marker.y, marker.width, marker.height);
  }
  if (enemyMarkers.length > 0) {
    graphics.fill(enemyColor);
  }

  // D-13d: each projectile in flight is a small dot, only inside the window
  let projectileDots = 0;
  for (const projectile of projectiles) {
    if (!isInsideMinimapWindow(projectile.posX, projectile.posY, firstMapX, firstMapY)) {
      continue;
    }
    graphics.circle(
      minimapX + (projectile.posX - firstMapX) * minimapCellSize,
      minimapY + (projectile.posY - firstMapY) * minimapCellSize,
      minimapProjectileRadius,
    );
    projectileDots += 1;
  }
  if (projectileDots > 0) {
    graphics.fill(projectileColor);
  }

  const playerX = minimapX + (player.posX - firstMapX) * minimapCellSize;
  const playerY = minimapY + (player.posY - firstMapY) * minimapCellSize;
  const directionLength = minimapCellSize * 2;

  graphics
    .moveTo(playerX, playerY)
    .lineTo(
      playerX + player.dirX * directionLength,
      playerY + player.dirY * directionLength,
    )
    .stroke({ color: minimapPlayerColor, width: 2 });
  graphics.circle(playerX, playerY, 3).fill(minimapPlayerColor);
}
