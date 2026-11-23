// TDD 6.3: global constants, read by every other script

// TDD 6.5: the canvas height is fixed and its width follows the window shape,
// so the game fills any window without distortion. 1280 (16:9) is the starting
// value and the one the tests use; main.js sets the real width at load and on
// every resize (D-16a).
let screenWidth = 1280;
const screenHeight = 720;

const backgroundColor = 0x111e30;

// TDD 5.2: a ray gives up past this many cells and its column shows the background.
// Measured like perpWallDist, along dir.
const maxRayDistance = 24;

// TDD 6.6: demo speed converted to cells per 60 Hz ticker unit. The turn speed
// is an admin setting (js/settings.js).
const moveSpeed = 200 / 64 / 60;

// TDD 6.5: the strip width is an admin setting of 1, 2, 4 or 8 px
// (js/settings.js). The canvas width is rounded to a multiple of the widest
// one, so every strip width fits a whole number of times and all strips match.
const screenWidthStep = 8;

// D-16a / TDD 6.5: the canvas width follows the window between 4:3 and 21:9.
// Outside that range the game keeps the nearest limit and the page color shows
// around it, so a narrow or very wide window never squeezes the HUD.
const minScreenAspect = 4 / 3;
const maxScreenAspect = 21 / 9;
const maxScreenWidth = getScreenWidthForAspect(maxScreenAspect);

function getScreenWidthForAspect(aspect) {
  return Math.round(screenHeight * aspect / screenWidthStep) * screenWidthStep;
}

function getScreenWidthForWindow(windowWidth, windowHeight) {
  const aspect = windowWidth / windowHeight;
  const clampedAspect = Math.min(Math.max(aspect, minScreenAspect), maxScreenAspect);
  return getScreenWidthForAspect(clampedAspect);
}

// D-16a: CSS size of the game frame, the largest box with the canvas shape that
// fits the window. Rounding the width to whole 8 px steps leaves a gap of a few
// canvas pixels; a gap under one step is stretched to the window edge instead
// of leaving a line (under half a percent wider or taller).
function getGameFrameSize(windowWidth, windowHeight, canvasWidth) {
  const scale = Math.min(windowWidth / canvasWidth, windowHeight / screenHeight);
  let width = canvasWidth * scale;
  let height = screenHeight * scale;
  const stretchLimit = screenWidthStep * scale;
  if (windowWidth - width < stretchLimit) {
    width = windowWidth;
  }
  if (windowHeight - height < stretchLimit) {
    height = windowHeight;
  }
  return { width, height };
}

// TDD 1.3: flat colors, from the demo palette
const ceilingColor = 0x1a1a2e;
const floorColor = 0x2d2d44;
// D-02: muted wall colors are assigned deterministically by chunk coordinate
const wallPalette = [0x4a6fa5, 0x4d8b84, 0xa77845, 0x7b5b98];
const side1Brightness = 0.65;
const distanceBrightnessBands = [1, 0.8, 0.6, 0.4];

// D-09: procedural wall texture, drawn on a hidden canvas (no external files).
// Set to false to fall back to the flat color mode of TDD 1.3.
const useWallTextures = true;
const wallTextureSize = 64;
// A very close wall would need an enormous sprite; clamp it to keep it sane
const wallSpriteMaxHeight = screenHeight * 8;

// D-10: one light per room center, with a radial falloff and a shadow ray.
// When on, the light factor replaces the distance brightness bands.
const useLighting = true;
const lightRadius = 3.75;
const lightIntensity = 0.85;
const ambientLight = 0.22;
const shadowRayEpsilon = 0.05;

// D-04: the enemy is a thin standing rectangle (cells), not a wide square.
// enemyWidth is also its footprint for collisions and projectile hits.
const enemyWidth = 0.3;
const enemyHeight = 0.6;
const enemyColor = 0xffc857;

// D-27b / TDD 2.3.2 and 6.6: an enemy and the player never get closer than this,
// center to center. Their bodies measure 0.35 together (0.15 + 0.2), so some
// space always stays between them.
const enemyStopDistance = 0.5;

// D-21b: in 3D the enemy is the Husk Mutant sprite (js/enemy-sheet.js), 33 by
// 57 px. It is drawn enemyHeight tall and as wide as its proportions give (about
// 0.35 cells), so the art is not squeezed. Set to false to draw the amber
// rectangles again (flat color mode, TDD 1.3).
const useEnemySprites = true;
const enemyTextureWidth = 33;
const enemyTextureHeight = 57;
