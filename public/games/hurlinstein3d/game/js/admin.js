// TDD 2.3.5 / D-16b: admin panel for the team, an HTML layer over the game.
// It has three states, kept in body[data-admin] so the CSS can animate them:
// "hidden" (nothing shows), "peek" (the strip with the open button, while the
// mouse is near the top edge) and "open" (the pinned panel). It never pauses
// the game and never resizes it.

const adminRefreshInterval = 250; // ms: live values refresh about four times per second
const adminPeekHideDelay = 400; // ms: grace time before the strip slides back up
const adminToggleKey = "p";

// --- Pure helpers, covered by tests/admin.test.js ---

function formatAdminPosition(posX, posY) {
  return `${posX.toFixed(2)}, ${posY.toFixed(2)}`;
}

// TDD 5.1: the chunk of a world position, with Math.floor so negatives work
function getChunkOfPosition(posX, posY) {
  return { cx: Math.floor(posX / chunkSize), cy: Math.floor(posY / chunkSize) };
}

function formatAdminChunk(posX, posY) {
  const chunk = getChunkOfPosition(posX, posY);
  return `${chunk.cx}, ${chunk.cy}`;
}

// Health drops by fractions of a point per frame, so it is rounded up: the
// panel shows 1 until the player is really at zero
function formatAdminHealth(health, maxHealth) {
  return `${Math.ceil(health)} / ${maxHealth}`;
}

// The reloads left only show when they are limited (a finite number)
function formatAdminAmmo(ammo, magazine, reloading, reloadsLeft) {
  const parts = [`${ammo} / ${magazine}`];
  if (Number.isFinite(reloadsLeft)) {
    parts.push(`${reloadsLeft} reloads left`);
  }
  if (reloading) {
    parts.push("reloading");
  }
  return parts.join(", ");
}

function countLoadedEnemies() {
  let total = 0;
  for (const enemies of enemiesByChunk.values()) {
    total += enemies.length;
  }
  return total;
}

// D-23: the enemies updated and drawn this frame; all of them with the toggle off
function countActiveEnemies(player) {
  let total = 0;
  for (const enemies of getActiveEnemyLists(player)) {
    total += enemies.length;
  }
  return total;
}

// D-24: enemies alive against the game total, "87 / 100"
function formatAdminEnemiesAlive(alive, total) {
  return `${alive.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`;
}

// Every live value as text, ready for textContent
function getAdminInfo(player, framesPerSecond) {
  return {
    fps: String(Math.round(framesPerSecond)),
    position: formatAdminPosition(player.posX, player.posY),
    chunk: formatAdminChunk(player.posX, player.posY),
    health: formatAdminHealth(player.health, player.maxHealth),
    ammo: formatAdminAmmo(player.ammo, gameSettings.magazineSize, player.reloading, player.reloadsLeft),
    enemies: formatAdminEnemiesAlive(countLoadedEnemies(), gameSettings.enemiesPerGame),
    active: String(countActiveEnemies(player)),
    chunks: String(generatedChunks.size),
  };
}

// D-16c1: what a changed setting does to the game right away. The rest need
// nothing here: the game reads them every frame or when a chunk is generated.
function applySetting(player, name) {
  if (name === "playerHitPoints") {
    applyPlayerHitPoints(player, gameSettings.playerHitPoints);
  } else if (name === "magazineSize") {
    applyMagazineSize(player, gameSettings.magazineSize);
  } else if (name === "unlimitedReloads" || name === "reloadLimit") {
    applyReloadAllowance(player, gameSettings);
  } else if (name === "enemiesPerGame") {
    // D-24: a new total replaces the live enemies with new ones around the player
    placeGameEnemies(player, gameSettings.enemiesPerGame);
  }
}

// D-16c1: a field value (text or checkbox) becomes the setting in use, is
// applied to the game and saved. Returns the value in use, for the field.
function changeSetting(player, storage, name, fieldValue) {
  gameSettings[name] = normalizeSetting(name, fieldValue);
  applySetting(player, name);
  saveSettings(storage, gameSettings);
  return gameSettings[name];
}

// D-16c1: Reset puts every default back, applies it and saves it
function resetSettings(player, storage) {
  Object.assign(gameSettings, getDefaultSettings());
  for (const name in settingDefinitions) {
    applySetting(player, name);
  }
  saveSettings(storage, gameSettings);
}

// --- Browser part, wired once by main.js (TDD 6.4) ---

// A clicked button keeps the focus, and Space would press it again instead
// of firing the shotgun, so every panel button lets the focus go
function onAdminButton(button, action) {
  button.addEventListener("click", () => {
    action();
    button.blur();
  });
}

// D-16c1: every element with data-setting is the field of the setting with
// that name; data-setting-range shows its range. Fields show the value in use.
function createAdminSettings(page, player, onApplied) {
  const storage = getBrowserStorage();
  const fields = {};
  for (const field of page.querySelectorAll("[data-setting]")) {
    fields[field.dataset.setting] = field;
  }
  for (const element of page.querySelectorAll("[data-setting-range]")) {
    element.textContent = formatSettingRange(element.dataset.settingRange);
  }

  function writeFields() {
    for (const name in fields) {
      if (isFlagSetting(name)) {
        fields[name].checked = gameSettings[name];
      } else {
        fields[name].value = String(gameSettings[name]);
      }
    }
    // The limit only matters while reloads are limited
    fields.reloadLimit.disabled = gameSettings.unlimitedReloads;
  }

  for (const name in fields) {
    const field = fields[name];
    if (field.type === "number") {
      field.min = String(settingDefinitions[name].min);
      field.max = String(settingDefinitions[name].max);
      field.step = "1";
    }
    // A number field changes when it loses the focus or on Enter, so a value
    // half typed (1 on the way to 15) is never applied
    field.addEventListener("change", () => {
      const fieldValue = isFlagSetting(name) ? field.checked : field.value;
      changeSetting(player, storage, name, fieldValue);
      writeFields();
      onApplied();
      // A focused checkbox or list would take Space; give the keys back to the game
      if (field.type !== "number") {
        field.blur();
      }
    });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        field.blur();
      }
    });
  }

  onAdminButton(page.querySelector("[data-admin-action='refill-ammo']"), () => {
    refillAmmo(player, gameSettings);
    onApplied();
  });
  onAdminButton(page.querySelector("[data-admin-action='reset-settings']"), () => {
    resetSettings(player, storage);
    writeFields();
    onApplied();
  });

  writeFields();
}

function createAdminPanel(page, player) {
  const body = page.body;
  const hoverZone = page.getElementById("admin-hover-zone");
  const peek = page.getElementById("admin-peek");
  const openButton = page.getElementById("admin-open");
  const closeButtons = page.querySelectorAll("[data-admin-close]");
  const valueElements = {};
  for (const element of page.querySelectorAll("[data-admin-value]")) {
    valueElements[element.dataset.adminValue] = element;
  }

  let state = "hidden";
  let hideTimer = null;
  let frames = 0;
  let elapsedMS = 0;
  let framesPerSecond = 0;

  function setState(nextState) {
    state = nextState;
    body.dataset.admin = nextState;
    openButton.setAttribute("aria-expanded", String(nextState === "open"));
  }

  function writeInfo() {
    const info = getAdminInfo(player, framesPerSecond);
    for (const name in valueElements) {
      valueElements[name].textContent = info[name];
    }
  }

  function cancelHide() {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  function showPeek() {
    cancelHide();
    if (state === "hidden") {
      setState("peek");
    }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(() => {
      if (state === "peek") {
        setState("hidden");
      }
    }, adminPeekHideDelay);
  }

  function open() {
    cancelHide();
    setState("open");
    // D-12c / TDD 2.2: the panel needs the cursor, so opening it releases the mouse
    if (page.pointerLockElement) {
      page.exitPointerLock();
    }
    writeInfo();
  }

  function close() {
    setState("hidden");
  }

  function toggle() {
    if (state === "open") {
      close();
    } else {
      open();
    }
  }

  hoverZone.addEventListener("mouseenter", showPeek);
  hoverZone.addEventListener("mouseleave", scheduleHide);
  peek.addEventListener("mouseenter", showPeek);
  peek.addEventListener("mouseleave", scheduleHide);
  onAdminButton(openButton, open);
  for (const button of closeButtons) {
    onAdminButton(button, close);
  }
  createAdminSettings(page, player, writeInfo);

  page.defaultView.addEventListener("keydown", (event) => {
    if (event.repeat || isTypingInField(event)) {
      return;
    }
    if (event.key.toLowerCase() === adminToggleKey) {
      toggle();
    }
  });

  setState("hidden");

  return {
    // Called from the ticker with ticker.deltaMS. It only counts frames; the
    // DOM is written four times per second, and only while the panel is open.
    update(deltaMS) {
      frames += 1;
      elapsedMS += deltaMS;
      if (elapsedMS < adminRefreshInterval) {
        return;
      }
      framesPerSecond = frames * 1000 / elapsedMS;
      frames = 0;
      elapsedMS = 0;
      if (state === "open") {
        writeInfo();
      }
    },
  };
}
