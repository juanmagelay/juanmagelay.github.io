// TDD 2.3.7 / D-41b: the audio engine. Browsers start audio only after a user
// gesture, so the first click or key opens one AudioContext and decodes every
// sound of js/sound-sheet.js once, from the bytes of its data URI (TDD 6.2: no
// fetch). Until then, and if Web Audio is missing or a sound fails to decode,
// the game runs silent: audio never stops it.

// Seconds a music track takes to fade in or out when the track changes
const musicFadeSeconds = 0.8;
// Seconds a volume change takes, so a slider never clicks
const volumeChangeSeconds = 0.03;
// D-41c: the mute key, not defined by the TDD
const muteKey = "m";
// D-41d: the boss uses the enemy sounds played slower, which also makes them deeper
const bossSoundRate = 0.7;
// D-41f: closer than this many cells an enemy sounds at full volume
const soundReferenceDistance = 2;

// D-41d: the mix level of each sound, from 0 to 1, so a step sounds softer
// than a shot. The files are normalized to the same loudness (assets/sounds).
const soundLevels = {
  shot: 1,
  dryFire: 0.7,
  reload: 0.8,
  enemyHit: 0.8,
  enemyDeath: 0.9,
  enemyAlert: 0.7,
  playerHit: 0.8,
  bossAppear: 1,
  footstepLeft: 0.35,
  footstepRight: 0.35,
  uiFocus: 0.45,
  uiClick: 0.7,
  victory: 0.9,
  defeat: 0.9,
  menuMusic: 0.8,
  arenaMusic: 0.7,
};

// The two tracks and the two stings go through the music volume, the rest
// through the effects volume (D-41c)
const musicSoundNames = ["menuMusic", "arenaMusic", "victory", "defeat"];

// --- Pure helpers, covered by tests/audio.test.js ---

const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// The 6 bit value of each letter, indexed by its character code, built once
const base64Values = new Uint8Array(128);
for (let index = 0; index < base64Alphabet.length; index += 1) {
  base64Values[base64Alphabet.charCodeAt(index)] = index;
}

// Base64 writes 3 bytes as 4 letters of 6 bits each; "=" pads the last group.
// Read by hand, so the same code runs in the browser and in the tests. The
// bits not yet written are kept in a small number, at most 14 of them.
function base64ToBytes(base64) {
  let length = base64.length;
  while (length > 0 && base64[length - 1] === "=") {
    length -= 1;
  }
  const bytes = new Uint8Array(Math.floor(length * 6 / 8));
  let bits = 0;
  let bitCount = 0;
  let byteIndex = 0;
  for (let index = 0; index < length; index += 1) {
    bits = ((bits << 6) | base64Values[base64.charCodeAt(index)]) & 0x3fff;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[byteIndex] = (bits >> bitCount) & 0xff;
      byteIndex += 1;
    }
  }
  return bytes;
}

// "data:audio/mp4;base64,AAAA" to the bytes after the comma
function dataUriToBytes(dataUri) {
  return base64ToBytes(dataUri.slice(dataUri.indexOf(",") + 1));
}

// D-41c: a volume from 0 to 100 to a gain from 0 to 1. The ear hears loudness
// roughly on a logarithmic scale, so a squared curve makes the slider feel even:
// 50 sounds about half as loud instead of barely quieter.
function getVolumeGain(volume) {
  const fraction = volume / 100;
  return fraction * fraction;
}

// D-41c: mute sets the master gain to 0 and leaves the three volumes as they
// are, so turning it off brings them back
function getMasterGain(settings) {
  return settings.soundMuted ? 0 : getVolumeGain(settings.masterVolume);
}

function isMusicSound(name) {
  return musicSoundNames.includes(name);
}

// D-41e / TDD 2.3.7: the music of each game state. Victory and defeat play
// their sting first and then the menu track.
function getMusicPlan(state) {
  if (state === gameStatePlaying) {
    return { sting: null, music: "arenaMusic" };
  }
  if (state === gameStateVictory) {
    return { sting: "victory", music: "menuMusic" };
  }
  if (state === gameStateDefeat) {
    return { sting: "defeat", music: "menuMusic" };
  }
  return { sting: null, music: "menuMusic" };
}

// D-41f / TDD 2.3.7: the zombie radar of the presentation. The dot product of
// the unit vector from the player to the sound with plane divided by its length
// tells the side: plane points to the player's right (TDD 3.2), so the result
// is +1 straight right, 0 straight ahead or behind and -1 straight left. That
// is the pan of a StereoPannerNode.
function getSoundPan(player, sourceX, sourceY) {
  const offsetX = sourceX - player.posX;
  const offsetY = sourceY - player.posY;
  const distance = Math.hypot(offsetX, offsetY);
  const planeLength = Math.hypot(player.planeX, player.planeY);
  if (distance === 0 || planeLength === 0) {
    return 0;
  }
  const pan = (offsetX * player.planeX + offsetY * player.planeY) / (distance * planeLength);
  return Math.min(Math.max(pan, -1), 1);
}

// D-41f: the sound pressure falls with the inverse of the distance, so twice
// as far is half as loud. Closer than soundReferenceDistance it stays at 1.
function getDistanceGain(distance) {
  return Math.min(1, soundReferenceDistance / distance);
}

// --- The output: silent until the first gesture, replaceable in the tests ---

// null plays nothing. startAudio puts the Web Audio output here; the tests put
// a fake one that records the names.
let audioOutput = null;
// D-41e: the plan of the current state, kept so the music the menu asked for
// before the first gesture starts as soon as the audio opens
let musicPlan = { sting: null, music: "menuMusic" };

function setAudioOutput(output) {
  audioOutput = output;
}

// D-41b: plays one sound once. options.volume (0 to 1) scales its level,
// options.pan (-1 left to 1 right) places it and options.rate changes its speed.
function playSound(name, options = {}) {
  if (audioOutput !== null) {
    audioOutput.playSound(name, options);
  }
}

// D-41f: a sound at a world position, quieter with distance and panned to its side
function playSoundAt(name, sourceX, sourceY, player, options = {}) {
  const distance = Math.hypot(sourceX - player.posX, sourceY - player.posY);
  playSound(name, {
    ...options,
    volume: (options.volume ?? 1) * getDistanceGain(distance),
    pan: getSoundPan(player, sourceX, sourceY),
  });
}

// D-41e: called when the game state changes
function playMusicForState(state) {
  musicPlan = getMusicPlan(state);
  if (audioOutput !== null) {
    audioOutput.playMusic(musicPlan);
  }
}

// D-41c: called when a sound setting changes in the admin panel or with M
function applyAudioVolumes() {
  if (audioOutput !== null) {
    audioOutput.setVolumes(gameSettings);
  }
}

// --- Browser part: Web Audio, opened once on the first gesture ---

let audioWarned = false;

// One warning at most, so a browser without audio does not flood the console
function warnAudio(message, error) {
  if (!audioWarned) {
    audioWarned = true;
    console.warn(`Audio: ${message}`, error ?? "");
  }
}

// D-41b / TDD 6.4: the first click or key opens the audio, once
function initAudio(target, page) {
  function onFirstGesture() {
    target.removeEventListener("pointerdown", onFirstGesture);
    target.removeEventListener("keydown", onFirstGesture);
    startAudio(page);
  }
  target.addEventListener("pointerdown", onFirstGesture);
  target.addEventListener("keydown", onFirstGesture);
}

async function startAudio(page) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) {
    warnAudio("this browser has no Web Audio API, the game runs silent");
    return;
  }
  try {
    const context = new AudioContextClass();
    const buffers = await decodeSounds(context);
    const output = createWebAudioOutput(context, buffers);
    output.setVolumes(gameSettings);
    output.playMusic({ sting: null, music: musicPlan.music });
    setAudioOutput(output);
    // With the tab hidden the ticker stops, so the music stops with it
    page.addEventListener("visibilitychange", () => {
      if (page.hidden) {
        context.suspend();
      } else {
        context.resume();
      }
    });
  } catch (error) {
    warnAudio("it could not start, the game runs silent", error);
  }
}

// D-41b: every sound decoded once to an AudioBuffer. A sound that fails is
// left out and the rest still play.
async function decodeSounds(context) {
  const buffers = new Map();
  const names = Object.keys(soundDataUris);
  const results = await Promise.allSettled(
    names.map((name) => context.decodeAudioData(dataUriToBytes(soundDataUris[name]).buffer)),
  );
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      buffers.set(names[index], result.value);
    } else {
      warnAudio(`${names[index]} could not be decoded and stays silent`, result.reason);
    }
  });
  return buffers;
}

// D-41b: the gain nodes are created once: master, and under it music and
// effects. Each play creates an AudioBufferSourceNode, which the Web Audio API
// makes single use by design; it is no Pixi object, so TDD 6.4 still holds.
function createWebAudioOutput(context, buffers) {
  const master = context.createGain();
  const music = context.createGain();
  const effects = context.createGain();
  music.connect(master);
  effects.connect(master);
  master.connect(context.destination);

  let track = null;
  let sting = null;

  // A source with its own gain, connected to the music or the effects volume
  function startSource(name, options, loop) {
    const buffer = buffers.get(name);
    if (buffer === undefined) {
      return null;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = options.rate ?? 1;
    const gain = context.createGain();
    gain.gain.value = (soundLevels[name] ?? 1) * (options.volume ?? 1);
    source.connect(gain);
    let last = gain;
    if (options.pan && typeof context.createStereoPanner === "function") {
      const panner = context.createStereoPanner();
      panner.pan.value = options.pan;
      gain.connect(panner);
      last = panner;
    }
    last.connect(isMusicSound(name) ? music : effects);
    source.start();
    return { name, source, gain };
  }

  function fadeOutTrack() {
    if (track === null) {
      return;
    }
    const now = context.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(0, now + musicFadeSeconds);
    track.source.stop(now + musicFadeSeconds);
    track = null;
  }

  function startTrack(name) {
    track = startSource(name, { volume: 0 }, true);
    if (track === null) {
      return;
    }
    const now = context.currentTime;
    track.gain.gain.setValueAtTime(0, now);
    track.gain.gain.linearRampToValueAtTime(soundLevels[name] ?? 1, now + musicFadeSeconds);
  }

  // Cleared before stop(), so its onended knows it was cut and starts nothing
  function stopSting() {
    if (sting !== null) {
      const cut = sting;
      sting = null;
      cut.source.stop();
    }
  }

  return {
    playSound(name, options) {
      startSource(name, options, false);
    },
    // D-41e: the new track fades in while the old one fades out. A sting
    // fades the track out, plays once and then starts the plan's track.
    playMusic(plan) {
      stopSting();
      if (plan.sting !== null) {
        fadeOutTrack();
        const played = startSource(plan.sting, {}, false);
        if (played === null) {
          startTrack(plan.music);
          return;
        }
        sting = played;
        played.source.onended = () => {
          if (sting === played) {
            sting = null;
            startTrack(plan.music);
          }
        };
        return;
      }
      if (track !== null && track.name === plan.music) {
        return;
      }
      fadeOutTrack();
      startTrack(plan.music);
    },
    setVolumes(settings) {
      const now = context.currentTime;
      master.gain.setTargetAtTime(getMasterGain(settings), now, volumeChangeSeconds);
      music.gain.setTargetAtTime(getVolumeGain(settings.musicVolume), now, volumeChangeSeconds);
      effects.gain.setTargetAtTime(getVolumeGain(settings.effectsVolume), now, volumeChangeSeconds);
    },
  };
}
