// TDD 3.4 and 6.5: ceiling and floor drawn once, wall strips drawn every frame.

// D-04c1: perpendicular wall depth per screen strip, kept after each draw so
// enemies (D-04c2) can be hidden behind walls. Missed strips use the max
// distance, the same depth their background strip is drawn at.
// D-16a / D-16e1: sized once for the widest canvas with the narrowest strips
// (1680 entries); only the first screenWidth / stripWidth are used each frame.
const narrowestStripWidth = settingDefinitions.stripWidth.options[0];
const maxWallStripCount = maxScreenWidth / narrowestStripWidth;
const wallDepthBuffer = new Array(maxWallStripCount).fill(maxRayDistance);

function getWallDepthAtColumn(columnX) {
  return wallDepthBuffer[Math.floor(columnX / gameSettings.stripWidth)];
}

// TDD 6.5 / D-16e1: one ray per strip, so the strip width sets the rays per
// frame: 640 with 2 px strips on a 1280 px canvas, 1280 with 1 px, 160 with 8 px
function getWallStripCount() {
  return screenWidth / gameSettings.stripWidth;
}

// TDD 3.4: a strip is the rect drawn for one ray, x is its left edge in pixels.
// A wall at perpWallDist is screenHeight / perpWallDist pixels tall (similar
// triangles), centered on the horizon and clipped to the screen.
// perpWallDist 0 gives Infinity, and the clip turns it into the full column.
function getWallStrip(x, perpWallDist) {
  const lineHeight = screenHeight / perpWallDist;
  const drawStart = Math.max(0, -lineHeight / 2 + screenHeight / 2);
  const drawEnd = Math.min(screenHeight, lineHeight / 2 + screenHeight / 2);
  return { x, lineHeight, drawStart, drawEnd };
}

// D-16e2 / TDD 3.4: the distance the wall height is drawn with. Normally it is
// perpWallDist (distPerp), which keeps a straight wall straight. The fisheye
// setting uses the Euclidean distance to the hit instead: the ray is
// P(t) = pos + t * rayDir and the hit is at t = perpWallDist, so the distance
// is perpWallDist * |rayDir|. |rayDir| is 1 at the center column and grows
// toward the edges, so the walls bend. The DDA is the same in both modes.
function getProjectionDistance(player, x, perpWallDist) {
  if (!gameSettings.fisheye) {
    return perpWallDist;
  }
  const cameraX = 2 * x / screenWidth - 1;
  const rayDirX = player.dirX + player.planeX * cameraX;
  const rayDirY = player.dirY + player.planeY * cameraX;
  return perpWallDist * Math.sqrt(rayDirX * rayDirX + rayDirY * rayDirY);
}

// TDD 6.5: quantize perpendicular distance into four brightness bands
function getDistanceBand(perpWallDist) {
  const bandWidth = maxRayDistance / distanceBrightnessBands.length;
  const band = Math.floor(perpWallDist / bandWidth);
  return Math.min(Math.max(band, 0), distanceBrightnessBands.length - 1);
}

function getDistanceBrightness(perpWallDist) {
  return distanceBrightnessBands[getDistanceBand(perpWallDist)];
}

function shadeColor(color, brightness) {
  const red = Math.floor(((color >> 16) & 0xff) * brightness);
  const green = Math.floor(((color >> 8) & 0xff) * brightness);
  const blue = Math.floor((color & 0xff) * brightness);
  return (red << 16) | (green << 8) | blue;
}

// TDD 6.8 and D-02: chunk colors follow a stable palette index from Cantor key
function getChunkWallColor(mapX, mapY) {
  const cx = Math.floor(mapX / chunkSize);
  const cy = Math.floor(mapY / chunkSize);
  const paletteIndex = getChunkKey(cx, cy) % wallPalette.length;
  return wallPalette[paletteIndex];
}

function getWallColor(mapX, mapY, side, perpWallDist) {
  const faceBrightness = side === 1 ? side1Brightness : 1;
  const distanceBrightness = getDistanceBrightness(perpWallDist);
  return shadeColor(getChunkWallColor(mapX, mapY), faceBrightness * distanceBrightness);
}

// D-10: the lit color. The light factor (ambient plus every light in range)
// takes the place of the distance bands, and the side face stays darker.
function getLitWallColor(mapX, mapY, side, lightFactor) {
  const faceBrightness = side === 1 ? side1Brightness : 1;
  return shadeColor(getChunkWallColor(mapX, mapY), faceBrightness * lightFactor);
}

// D-10: where the ray met the wall, in world cells, and the face normal. The
// DDA can be read as a ray of parameter perpWallDist, because dir is unit and
// plane is perpendicular, so the hit is pos + perpWallDist * rayDir.
function getWallHitPoint(player, stripX, ray) {
  const cameraX = 2 * stripX / screenWidth - 1;
  const rayDirX = player.dirX + player.planeX * cameraX;
  const rayDirY = player.dirY + player.planeY * cameraX;

  const hitX = player.posX + ray.perpWallDist * rayDirX;
  const hitY = player.posY + ray.perpWallDist * rayDirY;

  // The normal points out of the wall, toward the side the ray came from
  let normalX = 0;
  let normalY = 0;
  if (ray.side === 0) {
    normalX = rayDirX > 0 ? -1 : 1;
  } else {
    normalY = rayDirY > 0 ? -1 : 1;
  }
  return { x: hitX, y: hitY, normalX, normalY };
}

// D-10 (Lode-style point light): start at the ambient floor, then for every
// light in range that faces the wall, add intensity * (1 - distance / radius)
// unless a wall blocks the way. The shadow ray reuses the DDA.
function getWallLight(hitX, hitY, normalX, normalY, lights) {
  let illumination = ambientLight;

  for (const light of lights) {
    const dx = light.x - hitX;
    const dy = light.y - hitY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared <= 0 || distanceSquared >= light.radius * light.radius) {
      continue;
    }
    // The light must sit on the open side of the wall
    if (dx * normalX + dy * normalY <= 0) {
      continue;
    }

    const distance = Math.sqrt(distanceSquared);
    const directionX = dx / distance;
    const directionY = dy / distance;
    const shadow = castRay(
      hitX + directionX * shadowRayEpsilon,
      hitY + directionY * shadowRayEpsilon,
      directionX,
      directionY
    );
    if (shadow.hit && shadow.perpWallDist < distance - shadowRayEpsilon) {
      continue;
    }

    // D-28d: a flickering lamp dims its light on the walls too
    const lampBrightness = getLampBrightness(light, getGameTime());
    illumination += light.intensity * lampBrightness * (1 - distance / light.radius);
  }

  return Math.min(1, illumination);
}

// D-10: color of one wall strip, lit or distance-shaded depending on the flag.
function getWallStripColor(player, stripX, ray) {
  if (!useLighting || gameSettings.flatColors) {
    return getWallColor(ray.mapX, ray.mapY, ray.side, ray.perpWallDist);
  }

  const hit = getWallHitPoint(player, stripX, ray);
  const lights = getLightsAtCell(ray.mapX, ray.mapY);
  const lightFactor = getWallLight(hit.x, hit.y, hit.normalX, hit.normalY, lights);
  return getLitWallColor(ray.mapX, ray.mapY, ray.side, lightFactor);
}

// TDD 6.4 and 6.5: runs once, outside the ticker, and again only when the
// canvas width changes (D-16a). Ceiling above the horizon, floor below it.
function drawCeilingAndFloor(graphics) {
  const horizonY = screenHeight / 2;
  graphics.clear();
  graphics.rect(0, 0, screenWidth, horizonY).fill(ceilingColor);
  graphics.rect(0, horizonY, screenWidth, screenHeight - horizonY).fill(floorColor);
}

// D-09 / D-28b: a procedural wall texture on a hidden canvas, in light neutral
// tones, so the chunk color and the shading tint it through the sprite tint.
// Variant 0: white plaster with a green and light blue stripe near the floor.
// Variant 1: a window band covered by black horizontal louvers.
// Variant 2: tall glass panes between frames.
function createWallTextureCanvas(variant = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = wallTextureSize;
  canvas.height = wallTextureSize;
  const context = canvas.getContext("2d");

  context.fillStyle = variant === 2 ? "#263743" : "#9aa9ae";
  context.fillRect(0, 0, wallTextureSize, wallTextureSize);
  if (variant === 0) {
    context.fillStyle = "#b7c5c5";
    context.fillRect(0, 0, wallTextureSize, 48);
    context.fillStyle = "#42695e";
    context.fillRect(0, 48, wallTextureSize, 5);
    context.fillStyle = "#77a1a5";
    context.fillRect(0, 53, wallTextureSize, 3);
  } else if (variant === 1) {
    context.fillStyle = "#435866";
    context.fillRect(0, 0, wallTextureSize, wallTextureSize);
    context.fillStyle = "#090d12";
    for (let y = 4; y < wallTextureSize; y += 8) context.fillRect(0, y, wallTextureSize, 4);
    context.fillStyle = "#637a83";
    for (let y = 5; y < wallTextureSize; y += 8) context.fillRect(0, y, wallTextureSize, 1);
  } else {
    context.fillStyle = "#647b80";
    context.fillRect(4, 0, 3, wallTextureSize);
    context.fillRect(32, 0, 2, wallTextureSize);
    context.fillRect(58, 0, 3, wallTextureSize);
    context.fillStyle = "#9bb5b8";
    context.fillRect(7, 0, 1, wallTextureSize);
  }

  return canvas;
}

// D-28c (Lode's floor casting): the eye is half a wall above the floor, so a
// floor point seen at screen row y is at this distance along dir (similar
// triangles, like the wall height of TDD 3.4). The ceiling is the mirror image.
function getRowDistance(y) {
  return 0.5 * screenHeight / Math.abs(y - screenHeight / 2);
}

// D-28c: the floor point under the ray of this cameraX, at that row distance.
// It is P(t) = pos + t * rayDir with t = rowDistance, the same ray as the walls.
function getFloorWorldPoint(player, cameraX, rowDistance) {
  return {
    x: player.posX + rowDistance * (player.dirX + player.planeX * cameraX),
    y: player.posY + rowDistance * (player.dirY + player.planeY * cameraX),
  };
}

// D-28b / D-28d: a stable pseudo random number for a cell, the same for the
// same cell in every frame and every game, negative cells included.
function getCellHash(cellX, cellY) {
  return (Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663)) >>> 0;
}

// D-28d: about one lamp in five flickers, picked by the hash of its cell, so
// the same lamp always flickers.
function isFlickeringLamp(light) {
  return getCellHash(Math.floor(light.x), Math.floor(light.y)) % lampFlickerShare === 0;
}

// D-28d: 1 for a steady lamp. A flickering lamp blinks dim twice at the start
// of every period; its hash shifts the period, so lamps never blink together.
function getLampBrightness(light, time) {
  // Same test as isFlickeringLamp, keeping the hash for the offset below
  const hash = getCellHash(Math.floor(light.x), Math.floor(light.y));
  if (hash % lampFlickerShare !== 0) {
    return 1;
  }
  const offset = (hash % 1000) / 1000 * lampFlickerPeriod;
  const moment = (time + offset) % lampFlickerPeriod;
  const isBlinking = moment < 0.1 || (moment > 0.2 && moment < 0.35);
  return isBlinking ? lampFlickerDim : 1;
}

// D-28d: the light of the rooms on a floor or ceiling point. Same falloff as
// getWallLight (D-10), without the facing test, since every lamp faces the
// floor, and without the shadow ray, which would cost one ray per sample.
function getFloorLight(worldX, worldY, lights) {
  let illumination = ambientLight;
  for (const light of lights) {
    const dx = light.x - worldX;
    const dy = light.y - worldY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= light.radius * light.radius) {
      continue;
    }
    const lampBrightness = getLampBrightness(light, getGameTime());
    illumination += light.intensity * lampBrightness * (1 - Math.sqrt(distanceSquared) / light.radius);
  }
  return Math.min(1, illumination);
}

// D-28c / D-28d: the color of one floor or ceiling sample as 0xRRGGBB, like
// shadeColor, so drawing a pixel creates no object. Each cell is a light tile
// with a dark joint along two of its edges. With lighting on, the room lights
// shade it, like the walls (D-10); with lighting off, the distance bands do
// (D-01). On the ceiling, the fluorescent lamp of each room light is a bright
// panel; a flickering lamp dims it.
function getFloorTextureColor(worldX, worldY, isCeiling, rowDistance, lights) {
  const u = worldX - Math.floor(worldX);
  const v = worldY - Math.floor(worldY);
  const isJoint = u < 0.035 || v < 0.035;
  let value;
  if (isCeiling) {
    value = isJoint ? 82 : 177;
  } else {
    value = isJoint ? 36 : 166;
  }
  if (useLighting) {
    value = Math.floor(value * getFloorLight(worldX, worldY, lights));
  } else {
    value = Math.floor(value * getDistanceBrightness(rowDistance));
  }

  if (isCeiling) {
    for (const light of lights) {
      if (Math.abs(worldX - light.x) < 0.48 && Math.abs(worldY - light.y) < 0.16) {
        value += Math.floor(65 * getLampBrightness(light, getGameTime()));
        break;
      }
    }
  }

  // A cold blue tint on the ceiling, a faint green one on the floor tiles
  let red;
  let green;
  let blue;
  if (isCeiling) {
    red = value;
    green = value * 1.03;
    blue = value * 1.08;
  } else {
    red = value * 0.94;
    green = value;
    blue = value * 1.02;
  }
  return (toColorByte(red) << 16) | (toColorByte(green) << 8) | toColorByte(blue);
}

function toColorByte(value) {
  return Math.min(255, Math.floor(value));
}

// D-28c / TDD 6.4: created once, for the widest canvas with 1 px strips, so
// neither a resize nor a new strip width creates anything. Each frame only
// uses its top left corner: one pixel per sample.
function createFloorCastingSurface() {
  const canvas = document.createElement("canvas");
  canvas.width = maxWallStripCount;
  canvas.height = screenHeight;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(canvas.width, canvas.height);
  const texture = PIXI.Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  const sprite = new PIXI.Sprite(texture);
  return { canvas, context, imageData, sprite };
}

function writeColorPixel(data, index, color) {
  data[index] = (color >> 16) & 0xff;
  data[index + 1] = (color >> 8) & 0xff;
  data[index + 2] = color & 0xff;
  data[index + 3] = 255;
}

// D-28c (Lode's floor casting), every frame. The screen is sampled in squares
// of stripWidth by stripWidth pixels, one canvas pixel each, and the sprite is
// stretched stripWidth times: sample column i lands under wall strip i, and
// the strip width lowers the floor resolution like it lowers the rays.
// Per row there is one rowDistance. The floor points of the row lie on a
// straight line, from the ray of the left edge (cameraX -1) to the ray of the
// right edge (cameraX +1), so after the first one each sample only adds a step.
// Past maxRayDistance the row is the background color, like a ray without a
// hit (TDD 5.2).
function drawFloorCasting(surface, player) {
  const stripWidth = gameSettings.stripWidth;
  const columns = getWallStripCount();
  const rows = Math.min(surface.canvas.height, screenHeight / stripWidth);
  const canvasWidth = surface.canvas.width;
  const data = surface.imageData.data;
  const noLights = [];
  // Neighbor samples usually fall in the same chunk, so the lights of a chunk
  // are looked up again only when the samples cross into another one
  let lights = noLights;
  let lightsChunkX = NaN;
  let lightsChunkY = NaN;

  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * stripWidth;
    const isCeiling = y < screenHeight / 2;
    const rowDistance = getRowDistance(y);
    let index = row * canvasWidth * 4;

    if (rowDistance > maxRayDistance) {
      for (let column = 0; column < columns; column++) {
        writeColorPixel(data, index, backgroundColor);
        index += 4;
      }
      continue;
    }

    // The center of the first sample, and the step from one sample to the next
    const firstCameraX = 1 / columns - 1;
    const first = getFloorWorldPoint(player, firstCameraX, rowDistance);
    const stepX = rowDistance * 2 * player.planeX / columns;
    const stepY = rowDistance * 2 * player.planeY / columns;
    let floorX = first.x;
    let floorY = first.y;

    // The lights matter for the lamps on the ceiling and, with lighting on,
    // for the light on the floor
    const needsLights = isCeiling || useLighting;
    for (let column = 0; column < columns; column++) {
      let sampleLights = noLights;
      if (needsLights) {
        const chunkX = Math.floor(floorX / chunkSize);
        const chunkY = Math.floor(floorY / chunkSize);
        if (chunkX !== lightsChunkX || chunkY !== lightsChunkY) {
          lights = getLightsAtCell(Math.floor(floorX), Math.floor(floorY));
          lightsChunkX = chunkX;
          lightsChunkY = chunkY;
        }
        sampleLights = lights;
      }
      writeColorPixel(data, index, getFloorTextureColor(floorX, floorY, isCeiling, rowDistance, sampleLights));
      index += 4;
      floorX += stepX;
      floorY += stepY;
    }
  }

  // Only the samples drawn this frame go to the canvas
  surface.context.putImageData(surface.imageData, 0, 0, 0, 0, columns, rows);
  surface.sprite.scale.set(stripWidth, stripWidth);
  surface.sprite.texture.source.update();
}

// D-16d / D-28c: flat mode hides the casting sprite; texture mode redraws it
// before showing it, so returning to textures never exposes stale pixels.
function updateFloorCasting(surface, player, enabled) {
  surface.sprite.visible = enabled;
  if (enabled) drawFloorCasting(surface, player);
}

// D-28b: the texture variant of a wall cell, stable for any cell
function getWallVariant(mapX, mapY) {
  return getCellHash(mapX, mapY) % 3;
}

// D-09: one texture per texture column, sliced out of the hidden canvas so a
// strip sprite can show the right column without redrawing the wall.
let wallTextureColumns = null;

function initWallTextures() {
  if (wallTextureColumns) {
    return;
  }
  wallTextureColumns = [0, 1, 2].map((variant) =>
    sliceTextureColumns(createWallTextureCanvas(variant), wallTextureSize, wallTextureSize));
}

// D-09 / D-21b: cuts an image or canvas into 1 px wide textures, one per
// column, so a strip sprite shows one column. Nearest keeps the pixels sharp.
function sliceTextureColumns(source, width, height) {
  const columns = [];
  for (let x = 0; x < width; x++) {
    const column = document.createElement("canvas");
    column.width = 1;
    column.height = height;
    column.getContext("2d").drawImage(source, x, 0, 1, height, 0, 0, 1, height);
    const texture = PIXI.Texture.from(column);
    texture.source.scaleMode = "nearest";
    columns.push(texture);
  }
  return columns;
}

// D-21b: the enemy sprite cut into column textures, like the wall. The image is
// a data URI (js/enemy-sheet.js), so it loads under file:// and the canvas can
// be read. Runs once, outside the ticker (TDD 6.4).
let enemyTextureColumns = null;

function loadEnemyTextureColumns() {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      enemyTextureColumns = sliceTextureColumns(image, enemyTextureWidth, enemyTextureHeight);
      resolve(enemyTextureColumns);
    };
    image.src = enemySpriteDataUri;
  });
}

// D-09 / D-21b: a pool of strip sprites created once and reused every frame
// (TDD 6.4); the ticker only moves them, retextures them and hides them.
function createStripSpritePool(count) {
  const container = new PIXI.Container();
  const sprites = [];
  for (let index = 0; index < count; index++) {
    const sprite = new PIXI.Sprite();
    sprite.visible = false;
    container.addChild(sprite);
    sprites.push(sprite);
  }
  return { container, sprites };
}

// D-09 (Lode part 2): one pre-created sprite per strip, reused every frame
// (TDD 6.4). D-16a: created for the widest canvas, so a resize never creates one.
function createWallStripSprites() {
  return createStripSpritePool(maxWallStripCount);
}

// D-21b: room for four screens of 1 px strips (6720 sprites), so many enemies
// up close still fit. If they ever run out, the farthest enemies are left out.
const enemyStripPoolSize = maxWallStripCount * 4;

function createEnemyStripSprites() {
  return createStripSpritePool(enemyStripPoolSize);
}

// D-09 (Lode part 2): where along the wall face the ray landed, in [0, 1).
// side 0 (a vertical line) uses the Y offset, side 1 the X offset. The flip
// keeps the texture readable while walking around the wall.
function getWallTextureX(player, stripX, ray) {
  const cameraX = 2 * stripX / screenWidth - 1;
  const rayDirX = player.dirX + player.planeX * cameraX;
  const rayDirY = player.dirY + player.planeY * cameraX;

  let wallX;
  if (ray.side === 0) {
    wallX = player.posY + ray.perpWallDist * rayDirY;
  } else {
    wallX = player.posX + ray.perpWallDist * rayDirX;
  }
  wallX -= Math.floor(wallX);

  if (ray.side === 0 && rayDirX > 0) {
    wallX = 1 - wallX;
  }
  if (ray.side === 1 && rayDirY < 0) {
    wallX = 1 - wallX;
  }

  let texX = Math.floor(wallX * wallTextureSize);
  if (texX < 0) {
    texX = 0;
  }
  if (texX >= wallTextureSize) {
    texX = wallTextureSize - 1;
  }
  return texX;
}

// TDD 6.5: runs every frame. Casts one ray per strip, from the strip's left
// column (so column screenWidth / 2 is still cameraX 0), and sorts the strips
// into side 0 walls, side 1 walls and rays that hit nothing. Each group is
// painted with a single fill(). With useWallTextures the sprites replace this
// path, but missed strips still use the background fill. The depth buffer
// keeps perpWallDist even in fisheye mode, for the enemies (D-16e2).
function drawWalls(graphics, player, wallStrips) {
  graphics.clear();

  if (wallStrips?.container) {
    wallStrips.container.visible = useWallTextures && !gameSettings.flatColors;
  }
  if (useWallTextures && !gameSettings.flatColors && wallStrips) {
    drawTexturedWalls(graphics, player, wallStrips);
    return;
  }

  const stripWidth = gameSettings.stripWidth;
  const stripCount = getWallStripCount();
  const stripsByColor = new Map();
  const missedStrips = [];

  for (let index = 0; index < stripCount; index++) {
    const x = index * stripWidth;
    const ray = castRayForColumn(player, x);
    if (!ray.hit) {
      // TDD 5.2: nothing within maxRayDistance. The background color takes the
      // place a wall at maxRayDistance would have, so it reads as darkness.
      wallDepthBuffer[index] = maxRayDistance;
      missedStrips.push(getWallStrip(x, getProjectionDistance(player, x, maxRayDistance)));
    } else {
      wallDepthBuffer[index] = ray.perpWallDist;
      const color = getWallStripColor(player, x, ray);
      const distance = getProjectionDistance(player, x, ray.perpWallDist);
      addStripToColorGroup(stripsByColor, color, getWallStrip(x, distance));
    }
  }

  fillStripColorGroups(graphics, stripsByColor);
  fillStrips(graphics, missedStrips, backgroundColor);
}

// D-09 (Lode part 2): the textured version of drawWalls. Each strip sprite is
// stretched to the wall height and tinted with the same color the flat mode
// uses, so chunk color and shading still apply. The sprite keeps its unclipped
// height and lets the canvas edge do the clipping, which keeps the texture
// aligned when a wall is bigger than the screen.
function drawTexturedWalls(graphics, player, wallStrips) {
  const stripWidth = gameSettings.stripWidth;
  const stripCount = getWallStripCount();
  const missedStrips = [];

  for (let index = 0; index < maxWallStripCount; index++) {
    const x = index * stripWidth;
    const sprite = wallStrips.sprites[index];
    // D-16a / D-16e1: sprites past the strips in use stay hidden
    if (index >= stripCount) {
      sprite.visible = false;
      continue;
    }
    const ray = castRayForColumn(player, x);
    if (!ray.hit) {
      wallDepthBuffer[index] = maxRayDistance;
      sprite.visible = false;
      missedStrips.push(getWallStrip(x, getProjectionDistance(player, x, maxRayDistance)));
      continue;
    }

    wallDepthBuffer[index] = ray.perpWallDist;
    const distance = getProjectionDistance(player, x, ray.perpWallDist);
    const lineHeight = Math.min(screenHeight / distance, wallSpriteMaxHeight);
    sprite.texture = wallTextureColumns[getWallVariant(ray.mapX, ray.mapY)][getWallTextureX(player, x, ray)];
    sprite.position.set(x, screenHeight / 2 - lineHeight / 2);
    sprite.width = stripWidth;
    sprite.height = lineHeight;
    sprite.tint = getWallStripColor(player, x, ray);
    sprite.visible = true;
  }

  fillStrips(graphics, missedStrips, backgroundColor);
}

function addStripToColorGroup(stripsByColor, color, strip) {
  if (!stripsByColor.has(color)) {
    stripsByColor.set(color, []);
  }
  stripsByColor.get(color).push(strip);
}

function fillStripColorGroups(graphics, stripsByColor) {
  for (const [color, strips] of stripsByColor) {
    fillStrips(graphics, strips, color);
  }
}

// Pixi v8 keeps adding rect() calls to one shape until fill() paints them all
// at once, so a whole group costs one fill()
function fillStrips(graphics, strips, color) {
  if (strips.length === 0) {
    return;
  }
  for (const strip of strips) {
    graphics.rect(strip.x, strip.drawStart, gameSettings.stripWidth, strip.drawEnd - strip.drawStart);
  }
  graphics.fill(color);
}

// D-04c2: the inverse of the camera matrix turns a world offset into camera
// space. depth is the distance along dir, transformX the sideways position on
// the camera plane (both in cells). Same model as Lode's sprite projection.
function getEnemyProjection(enemy, player) {
  const offsetX = enemy.posX - player.posX;
  const offsetY = enemy.posY - player.posY;
  const inverseDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);
  const transformX = inverseDet * (player.dirY * offsetX - player.dirX * offsetY);
  const depth = inverseDet * (-player.planeY * offsetX + player.planeX * offsetY);
  return { transformX, depth };
}

// D-23: a cheap test before the projection. The squared distance is compared
// with maxRayDistance squared, so there is no square root. The dot product of
// the offset with dir tells front from back by its sign alone, like the zombie
// radar of the presentation: 0 or less is beside or behind the camera.
function isEnemyInViewRange(enemy, player) {
  const offsetX = enemy.posX - player.posX;
  const offsetY = enemy.posY - player.posY;
  if (offsetX * offsetX + offsetY * offsetY > maxRayDistance * maxRayDistance) {
    return false;
  }
  return offsetX * player.dirX + offsetY * player.dirY > 0;
}

// D-21b: screen box of something standing on the floor, worldWidth by
// worldHeight cells, at this camera space position. One cell at this depth is
// screenHeight / depth pixels. The eye is half a wall above the floor, so the
// floor line is screenHeight / (2 * depth) below the horizon, where a wall strip
// ends (Lode part 3 moves sprites down the same way, with vMove). Unclipped.
function getStandingSpriteBox(transformX, depth, worldWidth, worldHeight) {
  const screenX = (screenWidth / 2) * (1 + transformX / depth);
  const width = screenHeight * worldWidth / depth;
  const height = screenHeight * worldHeight / depth;
  const bottom = screenHeight / 2 + screenHeight / (2 * depth);
  return { left: screenX - width / 2, width, top: bottom - height, height };
}

// D-04c2: the strips a box covers, from the strip that holds its left edge to
// the one that holds its right edge, inside the screen. Only strips where the
// enemy is nearer than the wall depth (D-04c1) are kept, so walls hide it.
function getVisibleStripXs(box, depth) {
  const stripWidth = gameSettings.stripWidth;
  const firstColumn = Math.max(0, box.left);
  const lastColumn = Math.min(screenWidth - 1, box.left + box.width);
  const stripXs = [];
  for (
    let x = Math.floor(firstColumn / stripWidth) * stripWidth;
    x <= lastColumn;
    x += stripWidth
  ) {
    if (depth < wallDepthBuffer[x / stripWidth]) {
      stripXs.push(x);
    }
  }
  return stripXs;
}

// D-21b (Lode part 3, texX): the sprite column a strip shows. The strip center
// is measured from the sprite's left edge and scaled from screen pixels to
// sprite pixels, then kept inside the sprite.
function getEnemyTextureX(stripX, spriteLeft, spriteWidth) {
  const stripCenter = stripX + gameSettings.stripWidth / 2;
  const texX = Math.floor((stripCenter - spriteLeft) * enemyTextureWidth / spriteWidth);
  return Math.min(Math.max(texX, 0), enemyTextureWidth - 1);
}

// D-21b: the sprite keeps the proportions of its image: as tall as the enemy,
// and as wide as that height gives (0.6 * 33 / 57, about 0.35 cells)
function getEnemySpriteWorldWidth(enemy) {
  return enemy.height * enemyTextureWidth / enemyTextureHeight;
}

// D-04c2 / D-23: the active enemies in view range and in front of the camera,
// with their camera space position. D-21b: sorted near to far.
function getVisibleEnemies(player) {
  const visible = [];
  for (const enemies of getActiveEnemyLists(player)) {
    for (const enemy of enemies) {
      if (!isEnemyInViewRange(enemy, player)) {
        continue;
      }
      const { transformX, depth } = getEnemyProjection(enemy, player);
      if (depth <= 0 || depth > maxRayDistance) {
        continue;
      }
      visible.push({ enemy, transformX, depth });
    }
  }
  visible.sort((a, b) => a.depth - b.depth);
  return visible;
}

// D-04c2: draws every enemy in view, standing on the floor (D-21b) and hidden
// strip by strip behind nearer walls. With useEnemySprites and the sprite pool
// it draws the Husk Mutant sprite; otherwise an amber rectangle, the flat color
// mode, with one fill() for all of them.
function drawEnemies(graphics, player, enemyStrips) {
  graphics.clear();

  if (enemyStrips?.container) {
    enemyStrips.container.visible = useEnemySprites && !gameSettings.flatColors;
  }
  if (useEnemySprites && !gameSettings.flatColors && enemyStrips) {
    drawTexturedEnemies(player, enemyStrips);
    return;
  }

  const rectsByColor = new Map();
  for (const { enemy, transformX, depth } of getVisibleEnemies(player)) {
    const box = getStandingSpriteBox(transformX, depth, enemy.width, enemy.height);
    const drawStart = Math.max(0, box.top);
    const drawEnd = Math.min(screenHeight, box.top + box.height);
    if (drawEnd <= drawStart) {
      continue;
    }
    const color = enemy.color ?? enemyColor;
    let rects = rectsByColor.get(color);
    if (rects === undefined) {
      rects = [];
      rectsByColor.set(color, rects);
    }
    for (const x of getVisibleStripXs(box, depth)) {
      rects.push({ x, drawStart, drawEnd });
    }
  }

  for (const [color, rects] of rectsByColor) {
    fillStrips(graphics, rects, color);
  }
}

// D-21b (Lode part 3): each visible strip of an enemy is one pool sprite showing
// its texture column, stretched to the enemy height and left for the canvas to
// clip, like the textured walls. The tint darkens it by the distance bands (D-01).
// Painter's algorithm: a nearer enemy must cover a farther one. Enemies come near
// to far and take pool sprites from the last one down, and the last children of
// a container are drawn on top. If the pool runs out, the farthest are left out.
function drawTexturedEnemies(player, enemyStrips) {
  const stripWidth = gameSettings.stripWidth;
  const sprites = enemyStrips.sprites;
  let nextSprite = sprites.length - 1;

  for (const { enemy, transformX, depth } of getVisibleEnemies(player)) {
    const box = getStandingSpriteBox(transformX, depth, getEnemySpriteWorldWidth(enemy), enemy.height);
    const baseTint = enemy.isBoss ? bossColor : 0xffffff;
    const tint = shadeColor(baseTint, getDistanceBrightness(depth));
    for (const x of getVisibleStripXs(box, depth)) {
      if (nextSprite < 0) {
        break;
      }
      const sprite = sprites[nextSprite];
      nextSprite -= 1;
      sprite.texture = enemyTextureColumns[getEnemyTextureX(x, box.left, box.width)];
      sprite.position.set(x, box.top);
      sprite.width = stripWidth;
      sprite.height = box.height;
      sprite.tint = tint;
      sprite.visible = true;
    }
  }

  // Sprites not used this frame stay hidden
  for (let index = 0; index <= nextSprite; index++) {
    sprites[index].visible = false;
  }
}


