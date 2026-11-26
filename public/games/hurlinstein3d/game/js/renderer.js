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

// D-40 / TDD 3.4 (Lode's floor casting, with pitch and posZ): the screen row
// of a point z cells above the floor, depth cells away along dir. The horizon
// sits at screenHeight / 2 + pitch. The point is eyeHeight - z cells under the
// eye, plus posZ pixels when the eye is higher, and one cell at this depth is
// screenHeight / depth pixels (similar triangles). Walls (z 1 and 0), enemies
// (z 0), blood drops and projectiles are all placed with it.
function getScreenYAtHeight(z, depth, camera) {
  return screenHeight / 2 + camera.pitch + (camera.posZ + screenHeight * (eyeHeight - z)) / depth;
}

// TDD 3.4: a strip is the rect drawn for one ray, x is its left edge in pixels.
// A wall at perpWallDist is screenHeight / perpWallDist pixels tall (similar
// triangles), from its top (z 1) to its foot (z 0), clipped to the screen.
// It is Lode's drawStart = -lineHeight / 2 + screenHeight / 2 + pitch +
// posZ / perpWallDist, and the same for drawEnd with + lineHeight / 2.
// perpWallDist 0 gives -Infinity and Infinity, and the clip turns them into
// the full column.
function getWallStrip(x, perpWallDist, camera) {
  const lineHeight = screenHeight / perpWallDist;
  const drawStart = Math.max(0, getScreenYAtHeight(1, perpWallDist, camera));
  const drawEnd = Math.min(screenHeight, getScreenYAtHeight(0, perpWallDist, camera));
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
// D-40b: both reach maxPitchShare of the screen height past the screen edges,
// so the ticker only moves the Graphics pitch pixels down to move the horizon,
// and the edge never shows.
function drawCeilingAndFloor(graphics) {
  const horizonY = screenHeight / 2;
  const margin = maxPitchShare * screenHeight;
  graphics.clear();
  graphics.rect(0, -margin, screenWidth, horizonY + margin).fill(ceilingColor);
  graphics.rect(0, horizonY, screenWidth, screenHeight - horizonY + margin).fill(floorColor);
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
// D-40b / D-40d: rows are measured from the moved horizon, and posZ (pixels)
// brings the eye closer to the floor when it dips and farther from the
// ceiling, so the floor and the ceiling are no longer symmetrical.
function getRowDistance(y, camera) {
  const horizonY = screenHeight / 2 + camera.pitch;
  const eyeToFloor = eyeHeight * screenHeight + camera.posZ;
  const eyeToCeiling = (1 - eyeHeight) * screenHeight - camera.posZ;
  const eyeToPlane = y < horizonY ? eyeToCeiling : eyeToFloor;
  return eyeToPlane / Math.abs(y - horizonY);
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

// D-39e / TDD 6.2: the four stain shapes, drawn by code side by side on a
// hidden canvas, 32 by 32 px each, read back once and turned into one factor
// per texel and color channel (TDD 6.4). The floor casting reads them with no
// object.
const stainTextureSize = 32;
const stainTextureWidth = stainTextureSize * stainShapeCount;
// A stain lets a little of the tile show through
const stainOpacity = 0.85;
const stainColor = "#5e0b0b";
const stainCoreColor = "#3c0505";
// Shape 1 a round pool, 2 a smear, 3 two lobes, 4 a splash with many drops.
// Every size stays within 14 px of the center, so no stain is cut by the cell edge.
const stainShapeStyles = [
  { radiusX: 9, radiusY: 8, lobes: 1, droplets: 3 },
  { radiusX: 11, radiusY: 5, lobes: 1, droplets: 5 },
  { radiusX: 7, radiusY: 5.5, lobes: 2, droplets: 4 },
  { radiusX: 5.5, radiusY: 5.5, lobes: 1, droplets: 10 },
];
// The unshaded floor tile of getFloorTextureColor, 166 with its green tint
const floorTileRgb = [166 * 0.94, 166, 166 * 1.02];
let stainFactors = null;

// D-39e: each shape is a dark red ellipse, a second lobe for shape 3, small
// drops around it and a darker core. Its own fixed seed places them, so the
// four shapes look the same in every game.
function drawStainShape(context, shapeIndex) {
  const style = stainShapeStyles[shapeIndex];
  const random = createRandom(shapeIndex + 1);
  const centerX = shapeIndex * stainTextureSize + stainTextureSize / 2;
  const centerY = stainTextureSize / 2;
  const rotation = random() * Math.PI;

  context.save();
  context.beginPath();
  context.rect(shapeIndex * stainTextureSize, 0, stainTextureSize, stainTextureSize);
  context.clip();

  context.fillStyle = stainColor;
  context.beginPath();
  context.ellipse(centerX, centerY, style.radiusX, style.radiusY, rotation, 0, 2 * Math.PI);
  if (style.lobes === 2) {
    const lobeX = centerX + Math.cos(rotation) * 6;
    const lobeY = centerY + Math.sin(rotation) * 6;
    context.ellipse(lobeX, lobeY, style.radiusY, style.radiusY, 0, 0, 2 * Math.PI);
  }
  context.fill();

  for (let index = 0; index < style.droplets; index++) {
    const angle = random() * 2 * Math.PI;
    const distance = Math.min(style.radiusX + 1 + random() * 4, 11.5);
    const radius = 0.8 + random() * 1.4;
    context.beginPath();
    context.arc(centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance, radius, 0, 2 * Math.PI);
    context.fill();
  }

  context.fillStyle = stainCoreColor;
  context.beginPath();
  context.ellipse(centerX, centerY, style.radiusX * 0.5, style.radiusY * 0.5, rotation, 0, 2 * Math.PI);
  context.fill();
  context.restore();
}

// D-39e / TDD 6.4: runs once, outside the ticker
function initStainTexture() {
  if (stainFactors !== null) {
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = stainTextureWidth;
  canvas.height = stainTextureSize;
  const context = canvas.getContext("2d");
  for (let shapeIndex = 0; shapeIndex < stainShapeCount; shapeIndex++) {
    drawStainShape(context, shapeIndex);
  }
  stainFactors = createStainFactors(context.getImageData(0, 0, stainTextureWidth, stainTextureSize).data);
}

// D-39e: what each stain texel lets through of the tile under it, per color
// channel, and its coverage. Blending the stain over the tile by its alpha is
// a product: where the texel is opaque the factor turns the tile into the
// stain color, where it is transparent (coverage 0) the tile stays. Four
// numbers per texel, like the RGBA it comes from. The tile under a stain is
// always plain tile, never a joint, since every shape stays 2 px away from the
// cell edge.
function createStainFactors(texels) {
  const texelCount = stainTextureWidth * stainTextureSize;
  const factors = new Float64Array(texelCount * 4);
  for (let texel = 0; texel < texelCount; texel++) {
    const coverage = texels[texel * 4 + 3] / 255 * stainOpacity;
    for (let channel = 0; channel < 3; channel++) {
      const ratio = texels[texel * 4 + channel] / floorTileRgb[channel];
      factors[texel * 4 + channel] = 1 + (ratio - 1) * coverage;
    }
    factors[texel * 4 + 3] = coverage;
  }
  return factors;
}

// D-39e / TDD 6.5: the stain texel under a floor point. u and v are the
// fractional parts of the point, its place inside the cell, used as texture
// coordinates, and the shape picks one of the four 32 px squares of the strip.
// Returns the texel number, row times the strip width plus column.
function getStainTexelIndex(shape, u, v) {
  const texX = (shape - 1) * stainTextureSize + Math.floor(u * stainTextureSize);
  const texY = Math.floor(v * stainTextureSize);
  return texY * stainTextureWidth + texX;
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

// D-39e / TDD 6.5: lays the stain of a cell over a floor sample. The tile
// color comes already shaded, by the lights or the distance bands, and is
// multiplied by the factors of its stain texel, so the stain keeps the light
// of the floor around it. u and v are the place of the sample inside its cell.
// Only the samples of a stained cell come here, and a transparent texel, most
// of the square around a blob, returns the tile as it is.
function applyStain(tileColor, stainShape, u, v) {
  const texel = getStainTexelIndex(stainShape, u, v) * 4;
  if (stainFactors[texel + 3] === 0) {
    return tileColor;
  }
  const red = ((tileColor >> 16) & 0xff) * stainFactors[texel];
  const green = ((tileColor >> 8) & 0xff) * stainFactors[texel + 1];
  const blue = (tileColor & 0xff) * stainFactors[texel + 2];
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
function drawFloorCasting(surface, camera) {
  const stripWidth = gameSettings.stripWidth;
  const columns = getWallStripCount();
  const rows = Math.min(surface.canvas.height, screenHeight / stripWidth);
  const canvasWidth = surface.canvas.width;
  const data = surface.imageData.data;
  const noLights = [];
  // Neighbor samples usually fall in the same chunk, so the lights and the
  // stains (D-39e) of a chunk are looked up again only when the samples cross
  // into another one. The chunk is kept by its first cell, as whole numbers.
  let lights = noLights;
  let stains = null;
  let hasChunk = false;
  let chunkFirstX = 0;
  let chunkFirstY = 0;
  // D-40b: rows above the moved horizon show the ceiling
  const horizonY = screenHeight / 2 + camera.pitch;

  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * stripWidth;
    const isCeiling = y < horizonY;
    const rowDistance = getRowDistance(y, camera);
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
    const first = getFloorWorldPoint(camera, firstCameraX, rowDistance);
    const stepX = rowDistance * 2 * camera.planeX / columns;
    const stepY = rowDistance * 2 * camera.planeY / columns;
    let floorX = first.x;
    let floorY = first.y;

    // The lights matter for the lamps on the ceiling and, with lighting on,
    // for the light on the floor. D-39e: stains lie on the floor only, and
    // only once some enemy has died.
    const needsLights = isCeiling || useLighting;
    const needsStains = !isCeiling && stainsByChunk.size > 0 && stainFactors !== null;
    for (let column = 0; column < columns; column++) {
      let sampleLights = noLights;
      let stainShape = 0;
      let cellX = 0;
      let cellY = 0;
      if (needsLights || needsStains) {
        // The cell of the sample; while it stays inside the same 16 by 16
        // chunk, nothing is looked up again
        cellX = Math.floor(floorX);
        cellY = Math.floor(floorY);
        const outsideX = cellX < chunkFirstX || cellX >= chunkFirstX + chunkSize;
        const outsideY = cellY < chunkFirstY || cellY >= chunkFirstY + chunkSize;
        if (!hasChunk || outsideX || outsideY) {
          hasChunk = true;
          const chunkX = Math.floor(cellX / chunkSize);
          const chunkY = Math.floor(cellY / chunkSize);
          lights = getLightsAtCell(cellX, cellY);
          stains = getChunkStains(chunkX, chunkY);
          chunkFirstX = chunkX * chunkSize;
          chunkFirstY = chunkY * chunkSize;
        }
        if (needsLights) {
          sampleLights = lights;
        }
        // TDD 6.8: the stain of the cell is one index in the chunk array
        if (needsStains && stains !== null) {
          stainShape = stains[(cellY - chunkFirstY) * chunkSize + (cellX - chunkFirstX)];
        }
      }
      let color = getFloorTextureColor(floorX, floorY, isCeiling, rowDistance, sampleLights);
      if (stainShape > 0) {
        // The place of the sample inside its cell is the texture coordinate
        color = applyStain(color, stainShape, floorX - cellX, floorY - cellY);
      }
      writeColorPixel(data, index, color);
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
function updateFloorCasting(surface, camera, enabled) {
  surface.sprite.visible = enabled;
  if (enabled) drawFloorCasting(surface, camera);
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
// D-39c: the death strip cut the same way, one list of columns per frame
let enemyDeathTextureColumns = null;

function loadImage(dataUri) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = dataUri;
  });
}

async function loadEnemyTextureColumns() {
  const image = await loadImage(enemySpriteDataUri);
  enemyTextureColumns = sliceTextureColumns(image, enemyTextureWidth, enemyTextureHeight);

  const deathImage = await loadImage(enemyDeathSheetDataUri);
  const deathColumns = sliceTextureColumns(
    deathImage, enemyDeathFrameCount * enemyDeathFrameWidth, enemyDeathFrameHeight);
  enemyDeathTextureColumns = [];
  for (let frame = 0; frame < enemyDeathFrameCount; frame++) {
    const firstColumn = frame * enemyDeathFrameWidth;
    enemyDeathTextureColumns.push(deathColumns.slice(firstColumn, firstColumn + enemyDeathFrameWidth));
  }
  return enemyTextureColumns;
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
// D-40: camera is the drawing camera of js/player.js, with pitch and posZ.
function drawWalls(graphics, camera, wallStrips) {
  graphics.clear();

  if (wallStrips?.container) {
    wallStrips.container.visible = useWallTextures && !gameSettings.flatColors;
  }
  if (useWallTextures && !gameSettings.flatColors && wallStrips) {
    drawTexturedWalls(graphics, camera, wallStrips);
    return;
  }

  const stripWidth = gameSettings.stripWidth;
  const stripCount = getWallStripCount();
  const stripsByColor = new Map();
  const missedStrips = [];

  for (let index = 0; index < stripCount; index++) {
    const x = index * stripWidth;
    const ray = castRayForColumn(camera, x);
    if (!ray.hit) {
      // TDD 5.2: nothing within maxRayDistance. The background color takes the
      // place a wall at maxRayDistance would have, so it reads as darkness.
      wallDepthBuffer[index] = maxRayDistance;
      missedStrips.push(getWallStrip(x, getProjectionDistance(camera, x, maxRayDistance), camera));
    } else {
      wallDepthBuffer[index] = ray.perpWallDist;
      const color = getWallStripColor(camera, x, ray);
      const distance = getProjectionDistance(camera, x, ray.perpWallDist);
      addStripToColorGroup(stripsByColor, color, getWallStrip(x, distance, camera));
    }
  }

  fillStripColorGroups(graphics, stripsByColor);
  fillStrips(graphics, missedStrips, backgroundColor);
}

// D-09 (Lode part 2): the textured version of drawWalls. Each strip sprite is
// stretched to the wall height and tinted with the same color the flat mode
// uses, so chunk color and shading still apply. The sprite keeps its unclipped
// height and lets the canvas edge do the clipping, which keeps the texture
// aligned when a wall is bigger than the screen. D-40: its middle, half a wall
// up, is where pitch and posZ place it (TDD 3.4).
function drawTexturedWalls(graphics, camera, wallStrips) {
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
    const ray = castRayForColumn(camera, x);
    if (!ray.hit) {
      wallDepthBuffer[index] = maxRayDistance;
      sprite.visible = false;
      missedStrips.push(getWallStrip(x, getProjectionDistance(camera, x, maxRayDistance), camera));
      continue;
    }

    wallDepthBuffer[index] = ray.perpWallDist;
    const distance = getProjectionDistance(camera, x, ray.perpWallDist);
    const lineHeight = Math.min(screenHeight / distance, wallSpriteMaxHeight);
    const wallMiddleY = getScreenYAtHeight(0.5, distance, camera);
    sprite.texture = wallTextureColumns[getWallVariant(ray.mapX, ray.mapY)][getWallTextureX(camera, x, ray)];
    sprite.position.set(x, wallMiddleY - lineHeight / 2);
    sprite.width = stripWidth;
    sprite.height = lineHeight;
    sprite.tint = getWallStripColor(camera, x, ray);
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
// D-40: the floor line is height 0 for the drawing camera, with pitch and posZ.
function getStandingSpriteBox(transformX, depth, worldWidth, worldHeight, camera) {
  const screenX = (screenWidth / 2) * (1 + transformX / depth);
  const width = screenHeight * worldWidth / depth;
  const height = screenHeight * worldHeight / depth;
  const bottom = getScreenYAtHeight(0, depth, camera);
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
// sprite pixels, then kept inside the sprite. D-39c: textureWidth is 51 for a
// death frame.
function getEnemyTextureX(stripX, spriteLeft, spriteWidth, textureWidth = enemyTextureWidth) {
  const stripCenter = stripX + gameSettings.stripWidth / 2;
  const texX = Math.floor((stripCenter - spriteLeft) * textureWidth / spriteWidth);
  return Math.min(Math.max(texX, 0), textureWidth - 1);
}

// D-21b: the sprite keeps the proportions of its image: as tall as the enemy,
// and as wide as that height gives (0.6 * 33 / 57, about 0.35 cells)
function getEnemySpriteWorldWidth(enemy) {
  return enemy.height * enemyTextureWidth / enemyTextureHeight;
}

// D-21b / D-39c: what an enemy shows in 3D. Alive, the front frame; falling,
// the death frame for its time, fading out at the end. Both keep the scale of
// the front frame, 57 texture pixels for enemy.height, so the boss falls larger.
function getEnemySpriteLook(enemy, dying) {
  if (dying === null) {
    return {
      columns: enemyTextureColumns,
      textureWidth: enemyTextureWidth,
      worldWidth: getEnemySpriteWorldWidth(enemy),
      worldHeight: enemy.height,
      alpha: 1,
    };
  }
  const cellsPerPixel = enemy.height / enemyTextureHeight;
  return {
    columns: enemyDeathTextureColumns[getDeathFrame(dying.time)],
    textureWidth: enemyDeathFrameWidth,
    worldWidth: enemyDeathFrameWidth * cellsPerPixel,
    worldHeight: enemyDeathFrameHeight * cellsPerPixel,
    alpha: getCorpseAlpha(dying.time),
  };
}

// D-04c2: adds the enemy with its camera space position when it is in view
// range and in front of the camera. dying is its D-39c entry, or null.
function addVisibleEnemy(visible, enemy, player, dying) {
  if (!isEnemyInViewRange(enemy, player)) {
    return;
  }
  const { transformX, depth } = getEnemyProjection(enemy, player);
  if (depth <= 0 || depth > maxRayDistance) {
    return;
  }
  visible.push({ enemy, transformX, depth, dying });
}

// D-04c2 / D-23: the active enemies in view, and with includeDying the falling
// ones too (D-39c), sorted near to far (D-21b)
function getVisibleEnemies(player, includeDying = false) {
  const visible = [];
  for (const enemies of getActiveEnemyLists(player)) {
    for (const enemy of enemies) {
      addVisibleEnemy(visible, enemy, player, null);
    }
  }
  if (includeDying) {
    for (const dying of dyingEnemies) {
      addVisibleEnemy(visible, dying.enemy, player, dying);
    }
  }
  visible.sort((a, b) => a.depth - b.depth);
  return visible;
}

// D-04c2: draws every enemy in view, standing on the floor (D-21b) and hidden
// strip by strip behind nearer walls. With useEnemySprites and the sprite pool
// it draws the Husk Mutant sprite; otherwise an amber rectangle, the flat color
// mode, with one fill() for all of them. D-39c: the flat mode shows the bare
// algorithm, so a killed enemy vanishes there in the frame it dies.
// D-40: camera is the drawing camera of js/player.js, with pitch and posZ.
function drawEnemies(graphics, camera, enemyStrips) {
  graphics.clear();

  if (enemyStrips?.container) {
    enemyStrips.container.visible = useEnemySprites && !gameSettings.flatColors;
  }
  if (useEnemySprites && !gameSettings.flatColors && enemyStrips) {
    drawTexturedEnemies(camera, enemyStrips);
    return;
  }

  const rectsByColor = new Map();
  for (const { enemy, transformX, depth } of getVisibleEnemies(camera)) {
    const box = getStandingSpriteBox(transformX, depth, enemy.width, enemy.height, camera);
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
// D-39c: the falling enemies join the same list, so they are hidden by walls
// and by nearer enemies the same way, and shaded by the same distance bands.
function drawTexturedEnemies(camera, enemyStrips) {
  const stripWidth = gameSettings.stripWidth;
  const sprites = enemyStrips.sprites;
  let nextSprite = sprites.length - 1;

  for (const { enemy, transformX, depth, dying } of getVisibleEnemies(camera, true)) {
    const look = getEnemySpriteLook(enemy, dying);
    const box = getStandingSpriteBox(transformX, depth, look.worldWidth, look.worldHeight, camera);
    const baseTint = enemy.isBoss ? bossColor : 0xffffff;
    const tint = shadeColor(baseTint, getDistanceBrightness(depth));
    for (const x of getVisibleStripXs(box, depth)) {
      if (nextSprite < 0) {
        break;
      }
      const sprite = sprites[nextSprite];
      nextSprite -= 1;
      sprite.texture = look.columns[getEnemyTextureX(x, box.left, box.width, look.textureWidth)];
      sprite.position.set(x, box.top);
      sprite.width = stripWidth;
      sprite.height = box.height;
      sprite.tint = tint;
      sprite.alpha = look.alpha;
      sprite.visible = true;
    }
  }

  // Sprites not used this frame stay hidden
  for (let index = 0; index <= nextSprite; index++) {
    sprites[index].visible = false;
  }
}



// D-13c: look of a projectile, a small red-orange square, like the muzzle flash
// and easy to tell apart from the amber enemies. It is not drawn closer than
// projectileMinDepth, where it would be a big square over the crosshair.
const projectileSize = 0.05;
const projectileColor = 0xff5a1f;
const projectileMinDepth = 0.75;

// D-13c: each projectile is a small square, projected like the enemies (Lode
// part 3) and hidden strip by strip behind nearer walls (D-04c1).
// getEnemyProjection only reads posX and posY, so it projects a projectile too.
// D-40c: the square is centered on its height z, so it climbs or drops on
// screen with the aim; a shot along the look stays on the crosshair.
function drawProjectiles(graphics, camera) {
  graphics.clear();

  const stripWidth = gameSettings.stripWidth;
  const projectileStrips = [];
  for (const projectile of projectiles) {
    const { transformX, depth } = getEnemyProjection(projectile, camera);
    if (depth < projectileMinDepth || depth > maxRayDistance) {
      continue;
    }

    // One cell at this depth is screenHeight / depth pixels tall
    const size = screenHeight * projectileSize / depth;
    const screenX = (screenWidth / 2) * (1 + transformX / depth);
    const centerY = getScreenYAtHeight(projectile.z, depth, camera);
    const top = Math.max(0, centerY - size / 2);
    const bottom = Math.min(screenHeight, centerY + size / 2);
    if (bottom <= top) {
      continue;
    }

    const firstColumn = Math.max(0, screenX - size / 2);
    const lastColumn = Math.min(screenWidth - 1, screenX + size / 2);
    for (
      let x = Math.floor(firstColumn / stripWidth) * stripWidth;
      x <= lastColumn;
      x += stripWidth
    ) {
      if (depth < wallDepthBuffer[x / stripWidth]) {
        projectileStrips.push({ x, drawStart: top, drawEnd: bottom });
      }
    }
  }

  fillStrips(graphics, projectileStrips, projectileColor);
}

// D-39g: look of a blood drop, a small dark red square 0.03 cells wide, never
// under 2 px so far drops still show. Closer than bloodDropMinDepth it would
// be a big square over the view, so it is skipped.
const bloodDropSize = 0.03;
const bloodDropMinPixels = 2;
const bloodDropColor = 0x8c0a0a;
const bloodDropMinDepth = 0.2;
const bloodDropTextureSize = 4;

// D-39g: a 4 by 4 px rounded square, white so the tint gives its color, drawn
// by code on a hidden canvas (TDD 6.2)
function createBloodDropTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = bloodDropTextureSize;
  canvas.height = bloodDropTextureSize;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(1, 0, 2, 4);
  context.fillRect(0, 1, 4, 2);
  const texture = PIXI.Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}

// D-39g / TDD 6.4: one Particle per drop of the pool, created once. A Particle
// has no visible flag, so a hidden drop gets alpha 0. Position, size (vertex)
// and color change every frame, so the three are dynamic. A ParticleContainer
// reports empty bounds, so boundsArea gives the CRT filter the screen size.
function createBloodDropParticles() {
  const texture = createBloodDropTexture();
  const container = new PIXI.ParticleContainer({
    dynamicProperties: { position: true, vertex: true, color: true },
    boundsArea: new PIXI.Rectangle(0, 0, maxScreenWidth, screenHeight),
  });
  const particles = [];
  for (let index = 0; index < bloodDropPoolSize; index++) {
    const particle = new PIXI.Particle({ texture, anchorX: 0.5, anchorY: 0.5, alpha: 0 });
    container.addParticle(particle);
    particles.push(particle);
  }
  return { container, particles };
}

// D-39g (Lode part 3): a drop is projected like an enemy, and its height
// moves it up from the floor line. The eye is half a cell above the floor, so
// a point z cells high is (0.5 - z) cells under eye level, screenHeight / depth
// pixels per cell (getScreenYAtHeight, which adds pitch and posZ for D-40).
// It is drawn only when it is nearer than the wall depth of its column
// (D-04c1). Returns null when it is not drawn.
function getBloodDropView(drop, camera) {
  const { transformX, depth } = getEnemyProjection(drop, camera);
  if (depth < bloodDropMinDepth || depth > maxRayDistance) {
    return null;
  }
  const x = (screenWidth / 2) * (1 + transformX / depth);
  if (x < 0 || x >= screenWidth) {
    return null;
  }
  if (depth >= wallDepthBuffer[Math.floor(x / gameSettings.stripWidth)]) {
    return null;
  }
  return {
    x,
    y: getScreenYAtHeight(drop.z, depth, camera),
    size: Math.max(bloodDropMinPixels, screenHeight * bloodDropSize / depth),
    tint: shadeColor(bloodDropColor, getDistanceBrightness(depth)),
  };
}

// D-39g: every frame, each particle follows its drop of the pool. Like the
// falling enemies and the stains, the flat color mode shows no drops.
function drawBloodDrops(dropParticles, camera) {
  const show = !gameSettings.flatColors;
  for (let index = 0; index < bloodDrops.length; index++) {
    const drop = bloodDrops[index];
    const particle = dropParticles.particles[index];
    const view = show && drop.active ? getBloodDropView(drop, camera) : null;
    if (view === null) {
      particle.alpha = 0;
      continue;
    }
    particle.x = view.x;
    particle.y = view.y;
    particle.scaleX = view.size / bloodDropTextureSize;
    particle.scaleY = view.size / bloodDropTextureSize;
    particle.tint = view.tint;
    particle.alpha = 1;
  }
}
