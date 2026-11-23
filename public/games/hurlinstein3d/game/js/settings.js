// TDD 2.3.5 / D-16c1: the settings the admin panel can edit. Each one has a
// default value; number settings are whole numbers with a range that the panel
// shows next to the field, or one of a short list of options. They are saved
// in localStorage, so they survive a reload. Blocked storage or invalid data
// falls back to the defaults.

const settingsStorageKey = "hurlinstein3d.settings";

const settingDefinitions = {
  // Game: regular enemies created in the whole game (D-16c1e), enemies only
  // updated near the player (D-23), and the player's hit points; a regular
  // enemy takes one per second of contact
  enemiesPerGame: { defaultValue: 20, min: 1, max: 100000 },
  activeAreaOnly: { defaultValue: true },
  playerHitPoints: { defaultValue: 10, min: 1, max: 100 },
  // Weapon: rounds per magazine and the reload allowance
  magazineSize: { defaultValue: 6, min: 2, max: 20 },
  unlimitedReloads: { defaultValue: true },
  reloadLimit: { defaultValue: 5, min: 0, max: 99 },
  // Player: arrow turn speed in degrees per second, mouse sensitivity in
  // degrees per 100 px of mouse movement (D-12c, TDD 2.2), and no damage
  turnSpeed: { defaultValue: 120, min: 30, max: 360 },
  mouseSensitivity: { defaultValue: 20, min: 5, max: 100 },
  godMode: { defaultValue: false },
  // Raycasting (D-16e): pixels per ray (TDD 6.5), walls drawn with the
  // Euclidean distance (TDD 3.4) and the rays drawn on the minimap. The first
  // strip width option is the narrowest, the last the widest (js/config.js).
  stripWidth: { defaultValue: 2, options: [1, 2, 4, 8] },
  fisheye: { defaultValue: false },
  minimapRays: { defaultValue: false },
  // Procedural generation (D-16f): chunk borders on the minimap
  chunkBorders: { defaultValue: false },
};

function getDefaultSettings() {
  const settings = {};
  for (const name in settingDefinitions) {
    settings[name] = settingDefinitions[name].defaultValue;
  }
  return settings;
}

function isFlagSetting(name) {
  return typeof settingDefinitions[name].defaultValue === "boolean";
}

function hasSettingOptions(name) {
  return Array.isArray(settingDefinitions[name].options);
}

// A field gives text and storage gives anything, so only real numbers count.
// An empty field is not zero: it gives the default.
function toSettingNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return NaN;
}

// Numbers are rounded and clamped to their range, options must be one of the
// list, flags only take true or false, and anything else gives the default
function normalizeSetting(name, value) {
  const definition = settingDefinitions[name];
  if (isFlagSetting(name)) {
    return typeof value === "boolean" ? value : definition.defaultValue;
  }
  const number = toSettingNumber(value);
  if (hasSettingOptions(name)) {
    return definition.options.includes(number) ? number : definition.defaultValue;
  }
  if (!Number.isFinite(number)) {
    return definition.defaultValue;
  }
  return Math.min(Math.max(Math.round(number), definition.min), definition.max);
}

// 100000 reads as 100,000
function formatSettingRange(name) {
  const definition = settingDefinitions[name];
  return `${definition.min.toLocaleString("en-US")} to ${definition.max.toLocaleString("en-US")}`;
}

// Stored text to settings: unknown names are dropped, missing ones keep the
// default and every known one is normalized
function parseStoredSettings(text) {
  const settings = getDefaultSettings();
  let stored = null;
  try {
    stored = JSON.parse(text);
  } catch (error) {
    return settings;
  }
  if (!stored || typeof stored !== "object") {
    return settings;
  }
  for (const name in settings) {
    if (name in stored) {
      settings[name] = normalizeSetting(name, stored[name]);
    }
  }
  return settings;
}

// localStorage can be missing or throw when the browser blocks it, so every
// access is guarded and the game keeps running with the defaults
function getBrowserStorage() {
  try {
    return globalThis.localStorage || null;
  } catch (error) {
    return null;
  }
}

function loadSettings(storage) {
  try {
    return parseStoredSettings(storage.getItem(settingsStorageKey));
  } catch (error) {
    return getDefaultSettings();
  }
}

function saveSettings(storage, settings) {
  try {
    storage.setItem(settingsStorageKey, JSON.stringify(settings));
    return true;
  } catch (error) {
    return false;
  }
}

// Loaded once, before player.js builds the player with these values
const gameSettings = loadSettings(getBrowserStorage());

// TDD 6.6: degrees per second to radians per 60 Hz ticker unit, the unit that
// ticker.deltaTime counts (close to 1 per frame at 60 frames per second)
function getRotationPerTick(degreesPerSecond) {
  return degreesPerSecond * Math.PI / 180 / 60;
}

// TDD 2.3.1: unlimited reloads are Infinity. Infinity - 1 is still Infinity and
// Infinity > 0 is true, so the reload code needs no special case, like
// deltaDist when a ray component is zero (TDD 3.3).
function getReloadAllowance(settings) {
  return settings.unlimitedReloads ? Infinity : settings.reloadLimit;
}
