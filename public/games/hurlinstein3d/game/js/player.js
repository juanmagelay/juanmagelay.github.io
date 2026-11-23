// TDD 3.2: the camera is six numbers. dir has length 1 and plane is perpendicular
// to dir. The field of view is implicit, 2 * atan(|plane|), and never stored.

// TDD 6.6: the camera keeps a small radius, so it never sits flush against a
// wall face and does not clip a corner. Under 0.5, so a one-cell door still fits.
const playerRadius = 0.2;
// Seconds (D-08c). D-08d: the ten reload frames share it, about 0.096 s each.
const reloadDuration = 0.96;

// TDD 5.2: spawn at the center of the generated room in chunk (0, 0).
// y grows downward on the map, so facing east (+x) the right hand side is +y:
// plane points there and the image is not mirrored.
// TDD 2.3.1 / D-16c1: health is in hit points, and the magazine and the reload
// allowance come from the admin settings (js/settings.js).
const spawnPosition = getSpawnPosition();
const player = {
  posX: spawnPosition.x,
  posY: spawnPosition.y,
  dirX: 1,
  dirY: 0,
  planeX: 0,
  planeY: getCameraPlaneLength(),
  health: gameSettings.playerHitPoints,
  maxHealth: gameSettings.playerHitPoints,
  ammo: gameSettings.magazineSize,
  reloadsLeft: getReloadAllowance(gameSettings),
  reloading: false,
  reloadTime: 0,
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

// D-06b: health never goes below zero, and zero health means defeat.
// D-16c1: god mode, from the admin panel, ignores every damage.
// D-27c: returns true when the health dropped, so the damage flash starts in
// the same frame.
function damagePlayer(player, amount) {
  if (gameSettings.godMode || amount <= 0) {
    return false;
  }
  player.health = Math.max(0, player.health - amount);
  return true;
}

function isPlayerDefeated(player) {
  return player.health <= 0;
}

// D-08: firing spends one round and is blocked while reloading or empty
function canFireShot(player) {
  return !player.reloading && player.ammo > 0;
}

function tryFire(player) {
  if (!canFireShot(player)) {
    return false;
  }
  player.ammo -= 1;
  return true;
}

// D-08: reload only tops up an incomplete magazine. D-16c1: it spends one
// reload of the allowance, which is Infinity unless the admin panel limits it.
function startReload(player) {
  if (player.reloading || player.ammo >= gameSettings.magazineSize || player.reloadsLeft <= 0) {
    return false;
  }
  player.reloadsLeft -= 1;
  player.reloading = true;
  player.reloadTime = 0;
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
// the game frame, so clicks on the admin panel never reach them.
function createMouseTurnInput(page, gameTarget) {
  let turnPixels = 0;

  gameTarget.addEventListener("mousedown", () => {
    if (page.pointerLockElement !== gameTarget) {
      requestMouseCapture(gameTarget);
    }
  });

  gameTarget.addEventListener("mousemove", (event) => {
    if (page.pointerLockElement === gameTarget) {
      turnPixels += event.movementX;
    }
  });

  return {
    consumeTurn() {
      const pixels = turnPixels;
      turnPixels = 0;
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
      event.preventDefault();
      pendingShot = true;
    }
  });
  gameTarget.addEventListener("mousedown", (event) => {
    if (event.button === leftMouseButton) {
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
    if (event.button === rightMouseButton) {
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

// TDD 6.6: rotate the camera, move along dir and to its side, and slide along
// walls by axis. D-16c1: the turn speed is the admin setting, in degrees per second.
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
    return;
  }
  const step = moveSpeed * deltaTime / inputLength;

  // The side direction is dir turned 90 degrees to the right, (-dirY, dirX):
  // where plane points (TDD 3.2), with length 1
  const moveX = (player.dirX * forward - player.dirY * sideways) * step;
  const moveY = (player.dirY * forward + player.dirX * sideways) * step;

  // Each axis moves on its own, so a blocked axis still lets the other slide.
  // D-27b: enemies block the player like walls.
  const newX = player.posX + moveX;
  if (moveX !== 0 && canStandAt(newX, player.posY) && keepsDistanceFromEnemies(player.posX, player.posY, newX, player.posY)) {
    player.posX = newX;
  }
  const newY = player.posY + moveY;
  if (moveY !== 0 && canStandAt(player.posX, newY) && keepsDistanceFromEnemies(player.posX, player.posY, player.posX, newY)) {
    player.posY = newY;
  }
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
