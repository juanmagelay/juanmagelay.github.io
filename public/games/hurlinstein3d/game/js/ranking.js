// D-32 / TDD 2.3.4: the remote scores API. The game only reads the top scores
// and submits one at the end of a game; the API is the single source of truth.
// CLAUDE.md 8.1: this is the one place that uses fetch.

const rankingApiBase = "https://backend-pixi.vercel.app/api";

// TDD 2.3.4: 100 points per regular enemy plus 1000 for the boss.
function getScore(killCount, isVictory) {
  return 100 * killCount + (isVictory ? 1000 : 0);
}

// D-22: the API takes up to 5 uppercase letters with no spaces and returns 400
// on spaces, so the initials are normalized here: uppercase, letters only, 3 max.
function normalizeInitials(value) {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

// "2026-11-23T12:34:56.000Z" -> "2026-11-23"
function formatScoreDate(isoString) {
  return isoString.slice(0, 10);
}

// One request with the shared error handling. A rejecting fetch means no network;
// a non-ok response carries { error }.
async function requestRanking(path, options) {
  let response;
  try {
    response = await fetch(rankingApiBase + path, options);
  } catch (error) {
    throw new Error("Could not reach the ranking server");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((body && body.error) || `HTTP ${response.status}`);
  }
  return body;
}

function fetchTopScores() {
  return requestRanking("/top-puntuaciones");
}

// D-32: one retry at ~500 ms covers a Vercel cold start on the first submit.
async function submitScore(nombre, puntuacion) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, puntuacion }),
  };
  try {
    return await requestRanking("/all-puntuaciones", options);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return requestRanking("/all-puntuaciones", options);
  }
}
