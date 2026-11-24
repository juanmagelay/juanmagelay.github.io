// TDD 2.3.4 / D-17b: the game has four states. Only `playing` runs the
// simulation; in the other states the scene stays still behind the screen that
// D-18a and D-20a will draw later.

const gameStateMenu = "menu";
const gameStatePlaying = "playing";
const gameStateVictory = "victory";
const gameStateDefeat = "defeat";

// The edges the screens use. Until D-18a and D-20a land, only the defeat edge
// runs in the browser; the tests cover every allowed edge.
const gameStateTransitions = {
  [gameStateMenu]: [gameStatePlaying],
  [gameStatePlaying]: [gameStateVictory, gameStateDefeat],
  [gameStateVictory]: [gameStatePlaying, gameStateMenu],
  [gameStateDefeat]: [gameStatePlaying, gameStateMenu],
};

// D-18a: the game opens on the main menu, so it starts there.
let gameState = gameStateMenu;

function getGameState() {
  return gameState;
}

// A transition only follows an allowed edge. A rejected change returns false
// and leaves the state as it was.
function setGameState(nextState) {
  if (!gameStateTransitions[gameState].includes(nextState)) {
    return false;
  }
  gameState = nextState;
  return true;
}

// D-19a / TDD 2.3.1: enemies killed this game, shown as KILLS x / total.
let killCount = 0;

function getKillCount() {
  return killCount;
}

function addKill() {
  killCount += 1;
}

function resetKillCount() {
  killCount = 0;
}

// D-19d / TDD 2.3.4: seconds elapsed in the current game, shown on the victory
// screen and used by the ranking (D-20b) to break ties.
let gameTime = 0;

function getGameTime() {
  return gameTime;
}

// ticker.deltaTime counts 60 Hz ticks, so dividing by 60 gives seconds
function addGameTime(deltaTime) {
  gameTime += deltaTime / 60;
}

function resetGameTime() {
  gameTime = 0;
}
