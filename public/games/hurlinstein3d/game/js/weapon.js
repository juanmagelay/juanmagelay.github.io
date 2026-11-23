// D-07b / D-08c: shotgun view model. The embedded strip (js/weapon-sheet.js)
// holds the idle frame, then the four firing frames, then the reload frames,
// all the same size.
// D-07e: frames are wide enough for the whole muzzle flash.
// D-08d: frames are 269 by 156 px, so every reload drawing fits whole (the
// tallest is the raised hand). The margins grew by the same amount on both
// sides, so the gun keeps its place on screen. Every drawing sits on the frame
// bottom, where the stock and the arm leave the screen.

const shotgunFrameCount = 15;
const shotgunFrameWidth = 269;
const shotgunFrameHeight = 156;
const shotgunFrameDuration = 0.08; // seconds per firing frame
// On-screen height of the frame: 286 / 156 is the D-07b scale (260 / 142)
// within 0.2%, so the gun keeps its size
const shotgunDisplayHeight = 286;

// Frame ranges inside the strip (D-07b and D-08d)
const shotgunIdleFrame = 0;
const shotgunFireFrames = [1, 2, 3, 4];
const shotgunReloadFrames = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// D-07c: barrel axis of the idle frame, in frame pixels, measured on the strip.
// The breech is the gold bead between the two barrels; the sight is the front bead.
// D-08d: moved 45 px right and 17 px down with the bigger frame.
const shotgunBreechX = 131;
const shotgunBreechY = 91;
const shotgunSightX = 107;
const shotgunSightY = 52;

// D-07c / TDD 2.3.1 and 3.2: the barrel points along dir, and the center ray
// (cameraX 0, rayDir equal to dir) meets the horizon at the screen center, where
// the crosshair is. Returns the sprite x that makes the barrel axis, extended,
// cross that point. The sprite is only moved, never rotated.
function getAimedShotgunX() {
  const scale = shotgunDisplayHeight / shotgunFrameHeight;
  // The horizon in frame pixels: half a screen above the frame bottom
  const horizonY = shotgunFrameHeight - screenHeight / 2 / scale;
  // Follow the axis from the breech up to the horizon (similar triangles)
  const slope = (shotgunSightX - shotgunBreechX) / (shotgunSightY - shotgunBreechY);
  const horizonX = shotgunBreechX + slope * (horizonY - shotgunBreechY);
  // Shift the sprite (anchored at its bottom center) so that point lands on the crosshair
  return screenWidth / 2 - (horizonX - shotgunFrameWidth / 2) * scale;
}

// Slices the strip into one canvas per frame. The strip is a data URI, so the
// canvas is never tainted and can be read back (TDD 6.1).
function loadShotgunFrames(dataUri) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const frames = [];
      for (let index = 0; index < shotgunFrameCount; index += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = shotgunFrameWidth;
        canvas.height = shotgunFrameHeight;
        const context = canvas.getContext("2d");
        context.drawImage(
          image,
          index * shotgunFrameWidth, 0, shotgunFrameWidth, shotgunFrameHeight,
          0, 0, shotgunFrameWidth, shotgunFrameHeight
        );
        frames.push(canvas);
      }
      resolve(frames);
    };
    image.src = dataUri;
  });
}

async function createShotgun() {
  const frames = await loadShotgunFrames(shotgunSheetDataUri);
  const textures = frames.map((canvas) => PIXI.Texture.from(canvas));
  const sprite = new PIXI.Sprite(textures[shotgunIdleFrame]);
  sprite.anchor.set(0.5, 1);
  sprite.position.set(getAimedShotgunX(), screenHeight);
  const scale = shotgunDisplayHeight / shotgunFrameHeight;
  sprite.scale.set(scale);
  return {
    sprite: sprite,
    idleTexture: textures[shotgunIdleFrame],
    fireTextures: shotgunFireFrames.map((index) => textures[index]),
    reloadTextures: shotgunReloadFrames.map((index) => textures[index]),
    playing: false,
    sequence: null,
    frameDuration: shotgunFrameDuration,
    frameIndex: 0,
    frameTime: 0,
  };
}

// Plays a list of textures once, from the start, each for frameDuration seconds
function playShotgunSequence(shotgun, textures, frameDuration) {
  shotgun.playing = true;
  shotgun.sequence = textures;
  shotgun.frameDuration = frameDuration;
  shotgun.frameIndex = 0;
  shotgun.frameTime = 0;
  shotgun.sprite.texture = textures[0];
}

// D-07b: each shot restarts the firing animation
function triggerShotgun(shotgun) {
  playShotgunSequence(shotgun, shotgun.fireTextures, shotgunFrameDuration);
}

// D-08c: a reload plays the reload frames.
// D-08d: they share reloadDuration (js/player.js), so the animation and the
// reload logic end together whatever the number of frames.
function startReloadAnimation(shotgun) {
  const frameDuration = reloadDuration / shotgun.reloadTextures.length;
  playShotgunSequence(shotgun, shotgun.reloadTextures, frameDuration);
}

// Steps the running animation in seconds and falls back to the idle frame
function updateShotgun(shotgun, deltaTime) {
  if (!shotgun.playing) {
    return;
  }
  shotgun.frameTime += deltaTime / 60;
  if (shotgun.frameTime < shotgun.frameDuration) {
    return;
  }
  shotgun.frameTime -= shotgun.frameDuration;
  shotgun.frameIndex += 1;
  if (shotgun.frameIndex >= shotgun.sequence.length) {
    shotgun.playing = false;
    shotgun.sprite.texture = shotgun.idleTexture;
  } else {
    shotgun.sprite.texture = shotgun.sequence[shotgun.frameIndex];
  }
}
