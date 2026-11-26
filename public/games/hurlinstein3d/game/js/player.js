// TDD 3.2: the camera is six numbers. dir has length 1 and plane is perpendicular
// to dir. The field of view is implicit, 2 * atan(|plane|), and never stored.

// TDD 6.6: the camera keeps a small radius, so it never sits flush against a
// wall face and does not clip a corner. Under 0.5, so a one-cell door still fits.
const playerRadius = 0.2;
// One second between successful shots (D-35)
const shotCooldownDuration = 1;
// Seconds (D-08c). D-08d: the ten reload frames share it, about 0.096 s each.
const reloadDuration = 0.96;

// TDD 5.2: spawn at the center of the generated room in chunk (0, 0).
// y grows downward on the map, so facing east (+x) the right hand side is +y:
// plane points there and the image is not mirrored.
// TDD 2.3.1 / D-16c1: health is in hit points, and the magazine and the reload
// allowance come from the admin settings (js/settings.js).
// D-40 / TDD 6.8: lookAngle is the vertical look in radians, positive up
// (D-40b). stepPhase counts steps, 0 to 2 for one stride, and bobAmount is how
// much of the footstep bob shows, 0 standing and 1 walking (D-40d). The three
// only change the drawing.
const spawnPosition = getSpawnPosition();
const player = {
  posX: spawnPosition.x,
  posY: spawnPosition.y,
  dirX: 1,
  dirY: 0,
  planeX: 0,
  planeY: getCameraPlaneLength(),
  lookAngle: 0,
  stepPhase: 0,
  bobAmount: 0,
  health: gameSettings.playerHitPoints,
  maxHealth: gameSettings.playerHitPoints,
  ammo: gameSettings.magazineSize,
  reloadsLeft: getReloadAllowance(gameSettings),
  reloading: false,
  reloadTime: 0,
  shotCooldown: 0,
};

// H-10c / TDD 3.2: a wall is drawn screenHeight / perpWallDist pixels tall, so
// one cell across must also cover screenHeight / perpWallDist pixels for a wall
// face to look square. A cell spans screenWidth / (2 * |plane|) pixels across, so
// |plane| = screenWidth / screenHeight / 2. On a 4:3 screen that is Lode's 0.66
// (about 67 degrees); a wider screen sees more to the sides (83 degrees at 16:9)
// with the same vertical view. One division, only when the canvas size changes.
function getCameraPlaneLength() {
  return screenWidth / screenHeight / 2;
}

// Keeps plane perpendicular to dir, turned right (x' = -y, y' = x), with a new length
function setCameraPlaneLength(player, length) {
  player.planeX = -player.dirY * length;
  player.planeY = player.dirX * length;
}

// D-17a / TDD 2.3.4: a new game sends the player back to the spawn of a newly
// generated chunk (0, 0), facing east, with full health and a full magazine,
// and no reload in progress. D-40b: the view starts level, and standing still.
function resetPlayer() {
  const spawn = getSpawnPosition();
  player.posX = spawn.x;
  player.posY = spawn.y;
  player.dirX = 1;
  player.dirY = 0;
  player.planeX = 0;
  player.planeY = getCameraPlaneLength();
  player.lookAngle = 0;
  player.stepPhase = 0;
  player.bobAmount = 0;
  player.maxHealth = gameSettings.playerHitPoints;
  player.health = gameSettings.playerHitPoints;
  player.ammo = gameSettings.magazineSize;
  player.reloadsLeft = getReloadAllowance(gameSettings);
  player.reloading = false;
  player.reloadTime = 0;
  player.shotCooldown = 0;
}

// D-06b: health never goes below zero, and zero health means defeat.
// D-16c1: god mode, from the admin panel, ignores every damage.
// D-27c: returns true when the health dropped, so the damage flash starts in
// the same frame. D-41d: the player's grunt plays in that frame too.
function damagePlayer(player, amount) {
  if (gameSettings.godMode || amount <= 0) {
    return false;
  }
  player.health = Math.max(0, player.health - amount);
  playSound("playerHit");
  return true;
}

function isPlayerDefeated(player) {
  return player.health <= 0;
}

// D-08 / D-35: firing spends one round and is blocked while reloading, empty or cooling down
function canFireShot(player) {
  return !player.reloading && player.ammo > 0 && player.shotCooldown <= 0;
}

// D-41d: a shot plays the blast; pulling the trigger on an empty magazine
// plays a dry click instead (not while reloading: the reload is heard)
function tryFire(player) {
  if (!canFireShot(player)) {
    if (player.ammo === 0 && !player.reloading) {
      playSound("dryFire");
    }
    return false;
  }
  player.ammo -= 1;
  player.shotCooldown = shotCooldownDuration;
  playSound("shot");
  return true;
}

function updateShotCooldown(player, deltaTime) {
  const remaining = player.shotCooldown - deltaTime / 60;
  player.shotCooldown = remaining <= 1e-9 ? 0 : remaining;
}

// D-08: reload only tops up an incomplete magazine. D-16c1: it spends one
// reload of the allowance, which is Infinity unless the admin panel limits it.
// D-41d: the reload sound lasts about the 0.96 s of the reload.
function startReload(player) {
  if (player.reloading || player.ammo >= gameSettings.magazineSize || player.reloadsLeft <= 0) {
    return false;
  }
  player.reloadsLeft -= 1;
  player.reloading = true;
  player.reloadTime = 0;
  playSound("reload");
  return true;
}

// Returns true on the frame the reload finishes
function updateReload(player, deltaTime) {
  if (!player.reloading) {
    return false;
  }
  player.reloadTime += deltaTime / 60;
  if (player.reloadTime < reloadDuration) {
    return false;
  }
  player.reloading = false;
  player.reloadTime = 0;
  player.ammo = gameSettings.magazineSize;
  return true;
}

// D-16c1: a new number of hit points restores full health with that maximum
function applyPlayerHitPoints(player, hitPoints) {
  player.maxHealth = hitPoints;
  player.health = hitPoints;
}

// D-16c1: a smaller magazine drops the extra rounds; a bigger one fills on the
// next reload
function applyMagazineSize(player, size) {
  player.ammo = Math.min(player.ammo, size);
}

function applyReloadAllowance(player, settings) {
  player.reloadsLeft = getReloadAllowance(settings);
}

// D-16c1: the admin panel's refill fills the magazine and the reload allowance
function refillAmmo(player, settings) {
  player.ammo = settings.magazineSize;
  applyReloadAllowance(player, settings);
}

// D-16c1: keys typed into an admin panel field never reach the game
function isTypingInField(event) {
  const target = event.target;
  if (!target || !target.tagName) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target.isContentEditable);
}

// D-36a / TDD 2.2: the menu and end screens are HTML inside #game-frame
// (TDD 2.3.4). Their clicks and keys belong to their buttons, so they never
// capture the mouse, fire or reload.
function isOnGameScreen(event) {
  const target = event.target;
  if (!target || typeof target.closest !== "function") {
    return false;
  }
  return target.closest("#game-frame .screen") !== null;
}

// TDD 2.2 / 6.6: each movement key and the control it presses. D-12b: the up
// and down arrows act as W and S, and the left and right arrows turn. D-12e:
// A and D strafe, so the keyboard turns only with the arrows.
const movementKeys = new Map([
  ["w", "forward"],
  ["arrowup", "forward"],
  ["s", "backward"],
  ["arrowdown", "backward"],
  ["a", "strafeLeft"],
  ["d", "strafeRight"],
  ["arrowleft", "turnLeft"],
  ["arrowright", "turnRight"],
]);

// Returns the Set of controls held down, which updatePlayer reads every frame
function createKeyboardInput(target) {
  const pressedControls = new Set();

  target.addEventListener("keydown", (event) => {
    const control = movementKeys.get(event.key.toLowerCase());
    if (control && !isTypingInField(event)) {
      // The arrows would scroll the admin panel
      event.preventDefault();
      pressedControls.add(control);
    }
  });

  target.addEventListener("keyup", (event) => {
    const control = movementKeys.get(event.key.toLowerCase());
    if (control) {
      pressedControls.delete(control);
    }
  });

  return pressedControls;
}

// D-12: MouseEvent.button numbers
const leftMouseButton = 0;
const rightMouseButton = 2;

// D-12c / TDD 2.2: the browser only grants pointer lock in answer to a click.
// Chrome returns a promise that rejects when it refuses, for example right after
// Esc; the click still counts and the next click asks again.
function requestMouseCapture(target) {
  const request = target.requestPointerLock();
  if (request && typeof request.catch === "function") {
    request.catch(() => {});
  }
}

// D-12c / TDD 2.2: a click on the game captures the mouse. While it is
// captured, the horizontal movement of every mouse event adds up, and the
// ticker spends the sum once per frame with consumeTurn(). The listeners go on
// the game frame, so clicks on the admin panel never reach them. D-36a: clicks
// on the menu screens do not capture, so the browser shows no capture notice.
// D-40b: the vertical movement adds up the same way, spent with consumeLook().
function createMouseTurnInput(page, gameTarget) {
  let turnPixels = 0;
  let lookPixels = 0;

  gameTarget.addEventListener("mousedown", (event) => {
    if (isOnGameScreen(event)) {
      return;
    }
    if (page.pointerLockElement !== gameTarget) {
      requestMouseCapture(gameTarget);
    }
  });

  gameTarget.addEventListener("mousemove", (event) => {
    if (page.pointerLockElement === gameTarget) {
      turnPixels += event.movementX;
      lookPixels += event.movementY;
    }
  });

  return {
    consumeTurn() {
      const pixels = turnPixels;
      turnPixels = 0;
      return pixels;
    },
    consumeLook() {
      const pixels = lookPixels;
      lookPixels = 0;
      return pixels;
    },
  };
}

// D-07: firing is one shot per key press. The browser repeats keydown while a
// key is held, so event.repeat is ignored and consumeShot() drains one shot.
// D-12d: a left click on the game is a shot too. mousedown has no repeat, so a
// held button fires once. Space and a click in the same frame are one shot.
function createFireInput(keyTarget, gameTarget) {
  let pendingShot = false;
  keyTarget.addEventListener("keydown", (event) => {
    if (event.key === " " && !event.repeat && !isTypingInField(event)) {
      if (isOnGameScreen(event)) {
        return;
      }
      event.preventDefault();
      pendingShot = true;
    }
  });
  gameTarget.addEventListener("mousedown", (event) => {
    if (event.button === leftMouseButton && !isOnGameScreen(event)) {
      pendingShot = true;
    }
  });
  return {
    consumeShot() {
      if (!pendingShot) {
        return false;
      }
      pendingShot = false;
      return true;
    },
  };
}

// D-08: R reloads, one press at a time, ignoring the browser key repeat.
// D-12d: so does a right click on the game, and the browser menu it would open
// stays closed.
function createReloadInput(keyTarget, gameTarget) {
  let pendingReload = false;
  keyTarget.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r" && !event.repeat && !isTypingInField(event)) {
      pendingReload = true;
    }
  });
  gameTarget.addEventListener("mousedown", (event) => {
    if (event.button === rightMouseButton && !isOnGameScreen(event)) {
      pendingReload = true;
    }
  });
  gameTarget.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  return {
    consumeReload() {
      if (!pendingReload) {
        return false;
      }
      pendingReload = false;
      return true;
    },
  };
}

// TDD 3.2: turning applies the same rotation matrix to dir and plane, so plane
// stays perpendicular to dir and both keep their length. A positive angle turns
// right (y grows downward on the map). The keys and the mouse both turn here.
function rotateCamera(player, angle) {
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const oldDirX = player.dirX;
  const oldDirY = player.dirY;
  const oldPlaneX = player.planeX;
  const oldPlaneY = player.planeY;

  player.dirX = oldDirX * cosAngle - oldDirY * sinAngle;
  player.dirY = oldDirX * sinAngle + oldDirY * cosAngle;
  player.planeX = oldPlaneX * cosAngle - oldPlaneY * sinAngle;
  player.planeY = oldPlaneX * sinAngle + oldPlaneY * cosAngle;
}

// D-12c / TDD 2.2: the sensitivity is in degrees per 100 px of mouse movement.
// The angle is not multiplied by deltaTime: the pixels the mouse moved in one
// frame are already a distance, and a longer frame has more of them.
function getMouseTurnAngle(movementX, sensitivity) {
  return movementX / 100 * sensitivity * Math.PI / 180;
}

// Moving the mouse right (positive movementX) turns right, like D
function turnPlayerWithMouse(player, movementX) {
  if (movementX !== 0) {
    rotateCamera(player, getMouseTurnAngle(movementX, gameSettings.mouseSensitivity));
  }
}

// D-40b / TDD 2.2 and 3.4: the vertical mouse movement tilts the look with the
// same sensitivity as the turn, so one mouse pixel moves the view the same
// angle up as sideways. Moving the mouse up (negative movementY) looks up. The
// angle stops at maxLookAngle either way; with the setting off it stays level.
function lookPlayerWithMouse(player, movementY) {
  if (movementY === 0 || !gameSettings.verticalLook) {
    return;
  }
  const angle = player.lookAngle - getMouseTurnAngle(movementY, gameSettings.mouseSensitivity);
  player.lookAngle = Math.min(Math.max(angle, -maxLookAngle), maxLookAngle);
}

// D-40b / D-40c: how many cells the aimed line climbs per cell along dir, the
// tangent of the look angle. pitch is this times screenHeight (TDD 3.4).
function getLookSlope(player) {
  return Math.tan(player.lookAngle);
}

// TDD 6.6: rotate the camera, move along dir and to its side, and slide along
// walls by axis. D-16c1: the turn speed is the admin setting, in degrees per second.
// D-40d: returns the distance actually walked, after the collisions, which
// moves the footstep bob.
function updatePlayer(player, pressedControls, deltaTime) {
  const turn = Number(pressedControls.has("turnRight")) - Number(pressedControls.has("turnLeft"));
  const rotation = turn * getRotationPerTick(gameSettings.turnSpeed) * deltaTime;

  if (rotation !== 0) {
    rotateCamera(player, rotation);
  }

  const forward = Number(pressedControls.has("forward")) - Number(pressedControls.has("backward"));
  const sideways = Number(pressedControls.has("strafeRight")) - Number(pressedControls.has("strafeLeft"));

  // D-12e / TDD 6.6: forward and sideways together are normalized (divided by
  // their magnitude), so W and D at once are not faster than W alone
  const inputLength = Math.sqrt(forward * forward + sideways * sideways);
  if (inputLength === 0) {
    return 0;
  }
  const step = moveSpeed * deltaTime / inputLength;

  // The side direction is dir turned 90 degrees to the right, (-dirY, dirX):
  // where plane points (TDD 3.2), with length 1
  const moveX = (player.dirX * forward - player.dirY * sideways) * step;
  const moveY = (player.dirY * forward + player.dirX * sideways) * step;

  // Each axis moves on its own, so a blocked axis still lets the other slide.
  // D-27b: enemies block the player like walls.
  const startX = player.posX;
  const startY = player.posY;
  const newX = player.posX + moveX;
  if (moveX !== 0 && canStandAt(newX, player.posY) && keepsDistanceFromEnemies(player.posX, player.posY, newX, player.posY)) {
    player.posX = newX;
  }
  const newY = player.posY + moveY;
  if (moveY !== 0 && canStandAt(player.posX, newY) && keepsDistanceFromEnemies(player.posX, player.posY, player.posX, newY)) {
    player.posY = newY;
  }
  return Math.hypot(player.posX - startX, player.posY - startY);
}

// D-40d / TDD 6.6: the footstep bob. The step phase advances with the distance
// actually walked, one step per footstepLength cells, so sliding along a wall
// bobs less and pushing against it does not bob. It wraps at 2: one stride,
// left step and right step. bobAmount grows to 1 while walking and drops to 0
// standing still, both in footstepEaseTime seconds, so the bob never jumps.
// With the setting off bobAmount stays at 0 and the view is the one without
// bob. D-41d: a foot strikes the floor at each whole phase, and plays its
// step; the phase keeps counting with the bob off, so the steps are still heard.
function updateFootstepBob(player, walked, deltaTime) {
  const phase = player.stepPhase + walked / footstepLength;
  if (Math.floor(phase) > Math.floor(player.stepPhase)) {
    // Phase 1 ends the first step of the stride, so the left foot lands
    playSound(Math.floor(phase) === 1 ? "footstepLeft" : "footstepRight");
  }
  player.stepPhase = phase % 2;
  if (!gameSettings.footstepBob) {
    player.bobAmount = 0;
    return;
  }
  const target = walked > 0 ? 1 : 0;
  const change = deltaTime / 60 / footstepEaseTime;
  if (player.bobAmount < target) {
    player.bobAmount = Math.min(target, player.bobAmount + change);
  } else {
    player.bobAmount = Math.max(target, player.bobAmount - change);
  }
}

// D-40d: how far down the step is, from 0 to 1. cos² of the phase is 1 at each
// foot strike (whole phases) and 0 halfway between two strikes.
function getStepDip(player) {
  const strike = Math.cos(Math.PI * player.stepPhase);
  return player.bobAmount * strike * strike;
}

// D-40d: how far to the side the step is, from -1 to 1. sin of the phase is
// positive during the first step of the stride (right foot in support) and
// negative during the second (left foot): one side to side cycle per stride.
function getStepSway(player) {
  return player.bobAmount * Math.sin(Math.PI * player.stepPhase);
}

// D-40 / TDD 3.4 and 6.8: the camera the 3D view is drawn with. It holds the
// player's six numbers plus Lode's pitch (pixels the horizon moves down to look
// up) and posZ (how far the eye is above its rest height, in pixels: cells
// times screenHeight). Created once (TDD 6.4) and updated every frame.
function createDrawingCamera() {
  return { posX: 0, posY: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0, pitch: 0, posZ: 0 };
}

// D-40b / D-40d / TDD 6.6: copies the player, turns the look angle into pitch
// and the step into posZ, and moves the ray origin sideways along the unit
// side direction (-dirY, dirX), where plane points. Only the drawing uses this
// camera: pos, the collisions, the minimap and the shot keep the player's.
// footstepSway is far under playerRadius, so the camera never enters a wall.
function updateDrawingCamera(camera, player) {
  const sway = footstepSway * getStepSway(player);
  camera.posX = player.posX - player.dirY * sway;
  camera.posY = player.posY + player.dirX * sway;
  camera.dirX = player.dirX;
  camera.dirY = player.dirY;
  camera.planeX = player.planeX;
  camera.planeY = player.planeY;
  camera.pitch = screenHeight * getLookSlope(player);
  camera.posZ = -footstepDip * getStepDip(player) * screenHeight;
}

// D-27b / TDD 6.6: a move is refused when it ends closer than enemyStopDistance
// to an enemy and closer than before, so walking away is always allowed.
// Distances are compared squared, with no square root. Only the enemies
// registered in the cells that can hold one that close are checked.
function keepsDistanceFromEnemies(fromX, fromY, toX, toY) {
  const minX = Math.floor(toX - enemyStopDistance);
  const maxX = Math.floor(toX + enemyStopDistance);
  const minY = Math.floor(toY - enemyStopDistance);
  const maxY = Math.floor(toY + enemyStopDistance);
  const limit = enemyStopDistance * enemyStopDistance;

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (const enemy of getEnemiesAtCell(x, y)) {
        const newDistance = getSquaredDistance(toX, toY, enemy.posX, enemy.posY);
        const oldDistance = getSquaredDistance(fromX, fromY, enemy.posX, enemy.posY);
        if (newDistance < limit && newDistance < oldDistance) {
          return false;
        }
      }
    }
  }
  return true;
}

function getSquaredDistance(ax, ay, bx, by) {
  return (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
}

// TDD 6.6: a position is free when the player's square footprint, side
// 2 * playerRadius, does not touch any wall cell. This is what keeps the camera
// a radius away from a wall and stops it from cutting a corner.
function canStandAt(posX, posY) {
  const minX = Math.floor(posX - playerRadius);
  const maxX = Math.floor(posX + playerRadius);
  const minY = Math.floor(posY - playerRadius);
  const maxY = Math.floor(posY + playerRadius);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (getCell(x, y) !== 0) {
        return false;
      }
    }
  }
  return true;
}
