// TDD 2.3.3 and 6.4: static center crosshair, drawn once outside the ticker and
// again only when the canvas width changes (D-16a). D-37b: cyan, the color of
// the live values in the retro UI.
const crosshairColor = 0x00e5ff;
const crosshairArmLength = 8;
const crosshairGap = 4;
const crosshairThickness = 2;

// D-37b: retro bevel frames in the same Graphics as the crosshair, so they cost
// nothing per frame: a steel plate behind LIFE, AMMO and KILLS and a ring around
// the minimap. This Graphics sits above the minimap and under the bars and the
// labels, so the plate shows behind them and the ring leaves the map uncovered.
const hudFrameShadowColor = 0x050608;
const hudFrameShadowAlpha = 0.7;
const hudFrameLightColor = 0x6b7587;
const hudFrameDarkColor = 0x0b0d11;
const hudPlateColor = 0x14171c;
const hudPlateAlpha = 0.82;
const minimapRingColor = 0x2c323d;
const hudBevelWidth = 2;
const hudShadowOffset = 4;
const hudPlatePadding = 10;
// Wide enough for the bars plus a reload counter of up to x99 (D-16c1)
const hudPlateWidth = 208;
const minimapRingWidth = 4;

function drawHud(graphics) {
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const halfGap = crosshairGap / 2;

  graphics.clear();
  drawHudFrames(graphics);
  graphics.rect(
    centerX - halfGap - crosshairArmLength,
    centerY - crosshairThickness / 2,
    crosshairArmLength,
    crosshairThickness,
  );
  graphics.rect(
    centerX + halfGap,
    centerY - crosshairThickness / 2,
    crosshairArmLength,
    crosshairThickness,
  );
  graphics.rect(
    centerX - crosshairThickness / 2,
    centerY - halfGap - crosshairArmLength,
    crosshairThickness,
    crosshairArmLength,
  );
  graphics.rect(
    centerX - crosshairThickness / 2,
    centerY + halfGap,
    crosshairThickness,
    crosshairArmLength,
  );
  graphics.fill(crosshairColor);
}

// D-37b: the plate around the three HUD rows, from LIFE to KILLS
function getHudPlateRect() {
  const top = getHudRowY(0) - hudPlatePadding;
  const bottom = getHudRowY(2) + barBandHeight + hudPlatePadding;
  return { x: hudMargin - hudPlatePadding, y: top, width: hudPlateWidth, height: bottom - top };
}

// D-37b: the ring around the 21 by 21 minimap window, outside it
function getMinimapRingRect() {
  const windowSize = minimapCellsPerSide * minimapCellSize;
  return {
    x: getMinimapX() - minimapRingWidth,
    y: minimapY - minimapRingWidth,
    width: windowSize + 2 * minimapRingWidth,
    height: windowSize + 2 * minimapRingWidth,
  };
}

// One frame as rectangles grouped by color: light edges top and left, dark
// edges bottom and right, and a hard shadow down and to the right, drawn as an
// L so it never covers what is inside the frame
function getBevelFrameRects(frame) {
  const { x, y, width, height } = frame;
  return {
    shadow: [
      { x: x + width, y: y + hudShadowOffset, width: hudShadowOffset, height },
      { x: x + hudShadowOffset, y: y + height, width: width - hudShadowOffset, height: hudShadowOffset },
    ],
    light: [
      { x, y, width, height: hudBevelWidth },
      { x, y, width: hudBevelWidth, height },
    ],
    dark: [
      { x, y: y + height - hudBevelWidth, width, height: hudBevelWidth },
      { x: x + width - hudBevelWidth, y, width: hudBevelWidth, height },
    ],
  };
}

// The four sides of a ring of the given thickness, inside the frame
function getRingRects(frame, thickness) {
  const { x, y, width, height } = frame;
  return [
    { x, y, width, height: thickness },
    { x, y: y + height - thickness, width, height: thickness },
    { x, y: y + thickness, width: thickness, height: height - 2 * thickness },
    { x: x + width - thickness, y: y + thickness, width: thickness, height: height - 2 * thickness },
  ];
}

// CLAUDE.md 8.4: every rectangle of one color, then a single fill
function fillRects(graphics, rects, fillStyle) {
  for (const rect of rects) {
    graphics.rect(rect.x, rect.y, rect.width, rect.height);
  }
  graphics.fill(fillStyle);
}

function drawHudFrames(graphics) {
  const plate = getHudPlateRect();
  const ring = getMinimapRingRect();
  const frames = [getBevelFrameRects(plate), getBevelFrameRects(ring)];
  const plateInside = {
    x: plate.x + hudBevelWidth,
    y: plate.y + hudBevelWidth,
    width: plate.width - 2 * hudBevelWidth,
    height: plate.height - 2 * hudBevelWidth,
  };

  fillRects(graphics, frames.flatMap((frame) => frame.shadow), {
    color: hudFrameShadowColor,
    alpha: hudFrameShadowAlpha,
  });
  fillRects(graphics, [plateInside], { color: hudPlateColor, alpha: hudPlateAlpha });
  fillRects(graphics, getRingRects(ring, minimapRingWidth), minimapRingColor);
  fillRects(graphics, frames.flatMap((frame) => frame.light), hudFrameLightColor);
  fillRects(graphics, frames.flatMap((frame) => frame.dark), hudFrameDarkColor);
}

// D-06c: the health bar uses the embedded UI sheet, cropped to its middle bar
// band (rows 20 to 35). Data URIs keep file:// working without network access.
const barSheetWidth = 98;
const barBandY = 20;
const barBandHeight = 16;
const emptyBarDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAABHCAYAAAD8xJKLAAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TpSIVkXYQcchQnSyIFXGUKhbBQmkrtOpgcukXNGlIUlwcBdeCgx+LVQcXZ10dXAVB8APE0clJ0UVK/F9SaBHjwXE/3t173L0DhGaVqWbPJKBqlpFOxMVcflUMvCKIEIYAxCRm6snMYhae4+sePr7eRXmW97k/x4BSMBngE4nnmG5YxBvEM5uWznmfOMzKkkJ8Tjxh0AWJH7kuu/zGueSwwDPDRjY9TxwmFktdLHcxKxsq8TRxRFE1yhdyLiuctzir1Tpr35O/MFjQVjJcpzmKBJaQRAoiZNRRQRUWorRqpJhI037cwz/i+FPkkslVASPHAmpQITl+8D/43a1ZjE25ScE40Pti2x9jQGAXaDVs+/vYtlsngP8ZuNI6/loTmP0kvdHRIkfA4DZwcd3R5D3gcgcYftIlQ3IkP02hWATez+ib8kDoFuhfc3tr7+P0AchSV8s3wMEhMF6i7HWPd/d19/bvmXZ/P4arcq/4oiC+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gwTEQMOWuTwzAAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAEuSURBVHja7dnRbYMwFAVQU2UPVmATZvUmXsGT0I+qCZBGBRsFAuf8Ben6IT1BsF8THoZQppGvzzfjBfq+X7VCjHHyW74834QQhvECXdctWiSl9Od1+fX5GOOjEUsXeLWgfHk+xhi+AoegERqBRmgEGvEpjXj1Xbz0W1i+Lv+0oeP97vuInHPxIjln+cr8/YkY7wrbtl21wJz8+nxKaXrot3abPn8vypfnm9F1x9j75gHg3z+KYed7uHT9qpn1FjvKsSvXL55Z16qd+Z6pfowx3N59A/N6tTPfs9R3DH4QGqERaIRGoBGf0oiSmeuW39JXr39bssnZ48auVr96Zl2rduZ7hvqTJ+L3wtKZ61Y3oP6Pqpn11q+CK9d3DH6c+gAAAAAAAAAAAAAAAABs6xuykB1/pUjlpAAAAABJRU5ErkJggg==";
const healthBarDataUri = "data:image/png;base64,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";

// D-08b: the top bar band (rows 0 to 15) of the same sheet holds six segments,
// one per shotgun round.
const ammoBarDataUri = "data:image/png;base64,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";
const ammoBarBandY = 0;

// D-15b / TDD 2.3.3: top-left HUD block. Each row is a label followed by its bar:
// row 0 LIFE, row 1 AMMO. The label column is wide enough for four monospace letters.
const hudMargin = 16;
const hudLabelWidth = 56;
const hudRowSpacing = 24;
// D-37b: amber labels with the monospace stack of the HTML screens
const hudLabelStyle = {
  fontFamily: ["Consolas", "Menlo", "DejaVu Sans Mono", "Courier New", "monospace"],
  fontSize: 14,
  fontWeight: "bold",
  fill: 0xffd166,
  stroke: { color: 0x050608, width: 3 },
};

function getHudRowY(row) {
  return hudMargin + row * hudRowSpacing;
}

function getHudBarX() {
  return hudMargin + hudLabelWidth;
}

// D-15b: a label is a PixiJS Text with a system font (no font file to load),
// vertically centered on its bar. Created once, outside the ticker (TDD 6.4).
function createHudLabel(text, row) {
  const label = new PIXI.Text({ text, style: hudLabelStyle });
  label.anchor.set(0, 0.5);
  label.position.set(hudMargin, getHudRowY(row) + barBandHeight / 2);
  return label;
}

// D-16c1 / TDD 2.3.3: when the admin panel limits the reloads, the ones left
// show to the right of the ammo bar, as x3. Unlimited reloads (Infinity) hide it.
const reloadCounterGap = 8;

function formatReloadCounter(reloadsLeft) {
  return `x${reloadsLeft}`;
}

function getReloadCounterX() {
  return getHudBarX() + barSheetWidth + reloadCounterGap;
}

// Created once, outside the ticker (TDD 6.4), with the label style
function createReloadCounter() {
  const counter = new PIXI.Text({ text: formatReloadCounter(0), style: hudLabelStyle });
  counter.anchor.set(0, 0.5);
  counter.position.set(getReloadCounterX(), getHudRowY(1) + barBandHeight / 2);
  counter.visible = false;
  return counter;
}

// Called every frame: PixiJS only redraws a Text when its text really changes
function updateReloadCounter(counter, reloadsLeft) {
  counter.visible = Number.isFinite(reloadsLeft);
  if (counter.visible) {
    counter.text = formatReloadCounter(reloadsLeft);
  }
}

// D-19a / TDD 2.3.3: the kill count under AMMO, as "KILLS 3 / 20".
function formatKillsLabel(killCount, total) {
  return `KILLS ${killCount} / ${total}`;
}

// Created once, outside the ticker (TDD 6.4)
function createKillsLabel() {
  const label = new PIXI.Text({
    text: formatKillsLabel(0, gameSettings.enemiesPerGame),
    style: hudLabelStyle,
  });
  label.anchor.set(0, 0.5);
  label.position.set(hudMargin, getHudRowY(2) + barBandHeight / 2);
  return label;
}

// Called every frame; PixiJS only redraws the Text when the text changes
function updateKillsLabel(label, killCount) {
  label.text = formatKillsLabel(killCount, gameSettings.enemiesPerGame);
}

// D-19d / TDD 2.3.4: the game time as "m:ss", for the victory screen.
function formatGameTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

// D-06c: the fill width follows the health fraction, clamped to the bar.
function getHealthBarWidth(healthFraction) {
  const clamped = Math.min(Math.max(healthFraction, 0), 1);
  return barSheetWidth * clamped;
}

// D-08b: the ammo fill follows the fraction of the magazine that is loaded.
function getAmmoBarWidth(ammo, magazine) {
  const fraction = Math.min(Math.max(ammo / magazine, 0), 1);
  return barSheetWidth * fraction;
}

// D-06c and D-08b: the fill is revealed by a rectangular mask, so the segments
// keep their size and are cropped at the right edge instead of being squashed.
// A Pixi mask is not a scene child; it is rendered into the stencil buffer.
function setBarFill(bar, width) {
  const clampedWidth = Math.min(Math.max(width, 0), barSheetWidth);
  bar.mask.clear();
  bar.mask.rect(bar.x, bar.y, clampedWidth, barBandHeight).fill(0xffffff);
}

function loadBarCanvas(dataUri, bandY) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = barSheetWidth;
      canvas.height = barBandHeight;
      const context = canvas.getContext("2d");
      context.drawImage(
        image,
        0,
        bandY,
        barSheetWidth,
        barBandHeight,
        0,
        0,
        barSheetWidth,
        barBandHeight,
      );
      resolve(canvas);
    };
    image.src = dataUri;
  });
}

// D-06c: empty bar as background, health bar on top with a width that follows
// the health fraction. Created once, outside the ticker.
async function createHealthBar() {
  const emptyCanvas = await loadBarCanvas(emptyBarDataUri, barBandY);
  const healthCanvas = await loadBarCanvas(healthBarDataUri, barBandY);
  const barX = getHudBarX();
  const barY = getHudRowY(0);
  const background = new PIXI.Sprite(PIXI.Texture.from(emptyCanvas));
  const fill = new PIXI.Sprite(PIXI.Texture.from(healthCanvas));
  const mask = new PIXI.Graphics();
  fill.mask = mask;
  background.position.set(barX, barY);
  fill.position.set(barX, barY);
  return { background, fill, mask, x: barX, y: barY };
}

// D-08b / D-15b: the six-round ammo bar, under the health bar.
async function createAmmoBar() {
  const emptyCanvas = await loadBarCanvas(emptyBarDataUri, ammoBarBandY);
  const ammoCanvas = await loadBarCanvas(ammoBarDataUri, ammoBarBandY);
  const barX = getHudBarX();
  const barY = getHudRowY(1);
  const background = new PIXI.Sprite(PIXI.Texture.from(emptyCanvas));
  const fill = new PIXI.Sprite(PIXI.Texture.from(ammoCanvas));
  const mask = new PIXI.Graphics();
  fill.mask = mask;
  background.position.set(barX, barY);
  fill.position.set(barX, barY);
  return { background, fill, mask, x: barX, y: barY };
}

// D-27d / TDD 2.3.3: non diegetic damage flash. Red at the screen edges and
// transparent toward the center, one pulse per hit that fades in 0.4 s.
const damageFlashDuration = 0.4; // seconds
const damageFlashCanvasSize = 256;

// A radial gradient on a hidden square canvas, drawn once. Stretched to the
// screen it becomes an ellipse with the shape of the canvas.
function createDamageFlashCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = damageFlashCanvasSize;
  canvas.height = damageFlashCanvasSize;
  const context = canvas.getContext("2d");
  const center = damageFlashCanvasSize / 2;
  // Clear inside a quarter of the canvas, strongest at the corners (0.71 * size)
  const gradient = context.createRadialGradient(
    center, center, damageFlashCanvasSize * 0.25,
    center, center, damageFlashCanvasSize * 0.71,
  );
  gradient.addColorStop(0, "rgba(200, 0, 0, 0)");
  gradient.addColorStop(0.55, "rgba(200, 0, 0, 0.45)");
  gradient.addColorStop(1, "rgba(200, 0, 0, 0.9)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, damageFlashCanvasSize, damageFlashCanvasSize);
  return canvas;
}

// Created once, outside the ticker (TDD 6.4); hidden until the first hit
function createDamageFlash() {
  const sprite = new PIXI.Sprite(PIXI.Texture.from(createDamageFlashCanvas()));
  sprite.alpha = 0;
  const flash = { sprite, time: damageFlashDuration };
  resizeDamageFlash(flash);
  return flash;
}

// D-16a: a new canvas width stretches the same sprite, creating nothing
function resizeDamageFlash(flash) {
  flash.sprite.width = screenWidth;
  flash.sprite.height = screenHeight;
}

// Full right after the hit, linear down to zero at damageFlashDuration
function getDamageFlashAlpha(secondsSinceHit) {
  return Math.max(0, 1 - secondsSinceHit / damageFlashDuration);
}

// D-27c: called on the frame the health drops, so both show together
function triggerDamageFlash(flash) {
  flash.time = 0;
  flash.sprite.alpha = 1;
}

function updateDamageFlash(flash, deltaTime) {
  if (flash.time >= damageFlashDuration) {
    return;
  }
  flash.time += deltaTime / 60;
  flash.sprite.alpha = getDamageFlashAlpha(flash.time);
}
