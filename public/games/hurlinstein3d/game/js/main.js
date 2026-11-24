// D-16a: the game frame takes the CSS size that fills the window; the canvas
// inside it stretches to 100% of the frame
function fitGameFrame(gameFrame) {
  const size = getGameFrameSize(window.innerWidth, window.innerHeight, screenWidth);
  gameFrame.style.width = `${size.width}px`;
  gameFrame.style.height = `${size.height}px`;
}

// D-16a / TDD 6.4: a new canvas width creates nothing. The renderer and the
// camera plane take the new width, the drawings made once are drawn again and
// the shotgun moves back under the crosshair.
function applyScreenWidth(app, scene, width) {
  screenWidth = width;
  app.renderer.resize(screenWidth, screenHeight);
  setCameraPlaneLength(player, getCameraPlaneLength());
  drawCeilingAndFloor(scene.ceilingAndFloor);
  drawHud(scene.hud);
  resizeDamageFlash(scene.damageFlash);
  scene.shotgun.sprite.x = getAimedShotgunX();
}

// TDD 6.4: app.init is async, so startup lives in an async function
async function startGame() {
  // D-37d: the menu logo, before the first await so it shows with the menu
  document.getElementById("menu-logo").src = logotypeDataUri;
  useWallTextures = gameSettings.useWallTextures;
  useLighting = gameSettings.useLighting;
  // D-16a: the canvas starts with the shape of the window, and H-10c: the
  // camera plane with the matching length
  screenWidth = getScreenWidthForWindow(window.innerWidth, window.innerHeight);
  setCameraPlaneLength(player, getCameraPlaneLength());

  const app = new PIXI.Application();
  await app.init({
    width: screenWidth,
    height: screenHeight,
    background: backgroundColor,
  });
  // D-29b: one CRT filter, created once, on the layer of the 3D view. The
  // minimap, the HUD and the HTML screens stay outside it, sharp and readable.
  // The ticker only advances its time, so the noise and the lines move.
  const crtFilter = new PIXI.filters.CRTFilter({
    curvature: 1,
    lineWidth: 1,
    lineContrast: 0.15,
    noise: 0.08,
    vignetting: 0.25,
    vignettingAlpha: 0.35,
    vignettingBlur: 0.2,
  });
  let crtWasEnabled = gameSettings.crtFilter;
  const gameLayer = new PIXI.Container();
  if (crtWasEnabled) gameLayer.filters = [crtFilter];
  app.stage.addChild(gameLayer);
  const gameFrame = document.getElementById("game-frame");
  gameFrame.appendChild(app.canvas);
  fitGameFrame(gameFrame);
  createMenuNavigation(document);

  // TDD 6.4: Graphics objects are created once, outside the ticker.
  // The flat ceiling and floor never change, so they are drawn here, once.
  const ceilingAndFloor = new PIXI.Graphics();
  drawCeilingAndFloor(ceilingAndFloor);
  gameLayer.addChild(ceilingAndFloor);
  // D-28c: the textured ceiling and floor cover the flat ones; the canvas, its
  // texture and its sprite are created once and the ticker only writes pixels
  const floorCastingSurface = createFloorCastingSurface();
  gameLayer.addChild(floorCastingSurface.sprite);

  // Added second, so the walls are drawn on top of ceiling and floor
  const walls = new PIXI.Graphics();
  gameLayer.addChild(walls);

  // D-09: optional textured walls, one pre-created sprite per strip, above the
  // flat wall graphics and under the enemies
  let wallStrips = null;
  // D-16d: create texture resources and the sprite pool once, even when hidden.
  initWallTextures();
  wallStrips = createWallStripSprites();
  gameLayer.addChild(wallStrips.container);

  // D-04c2: enemies draw over the walls, occluded per strip by the wall depth
  const enemies = new PIXI.Graphics();
  gameLayer.addChild(enemies);

  // D-21b: the enemy sprite, cut into columns once, and its pool of strip
  // sprites, created once, at the same layer as the flat enemies
  let enemyStrips = null;
  if (useEnemySprites) {
    await loadEnemyTextureColumns();
    enemyStrips = createEnemyStripSprites();
    gameLayer.addChild(enemyStrips.container);
  }

  // D-07b / D-07c: the shotgun view model sits at the bottom, aimed at the crosshair,
  // under the HUD and overlay
  const shotgun = await createShotgun();
  gameLayer.addChild(shotgun.sprite);

  // D-27d: the damage flash covers the view and the shotgun, under the minimap
  // and the HUD, so LIFE stays readable
  const damageFlash = createDamageFlash();
  app.stage.addChild(damageFlash.sprite);

  // TDD 6.4: the minimap Graphics object is created once, above the view
  const minimap = new PIXI.Graphics();
  app.stage.addChild(minimap);

  // TDD 6.4: static HUD Graphics is created and drawn once, above the minimap
  const hud = new PIXI.Graphics();
  drawHud(hud);
  app.stage.addChild(hud);

  // D-06c: health bar sprites from the embedded images, loaded once (no network)
  const healthBar = await createHealthBar();
  app.stage.addChild(healthBar.background);
  app.stage.addChild(healthBar.fill);

  // D-08b: the six-round ammo bar, under the health bar, loaded once (no network)
  const ammoBar = await createAmmoBar();
  app.stage.addChild(ammoBar.background);
  app.stage.addChild(ammoBar.fill);

  // D-15b: LIFE and AMMO labels to the left of their bars, created once
  app.stage.addChild(createHudLabel("LIFE", 0));
  app.stage.addChild(createHudLabel("AMMO", 1));

  // D-16c1: reloads left, right of the ammo bar, only while they are limited
  const reloadCounter = createReloadCounter();
  app.stage.addChild(reloadCounter);

  // D-19a: the kill count, under AMMO
  const killsLabel = createKillsLabel();
  app.stage.addChild(killsLabel);

  // TDD 6.4: keyboard and mouse listeners are registered once, outside the
  // ticker. D-12: the mouse listens on the game frame only, so clicks on the
  // admin panel never fire or reload.
  const pressedControls = createKeyboardInput(window);
  const mouseTurnInput = createMouseTurnInput(document, gameFrame);
  const fireInput = createFireInput(window, gameFrame);
  const reloadInput = createReloadInput(window, gameFrame);
  // D-36b: the hint that a click on the view captures the mouse
  const mouseHint = createMouseHint(document, gameFrame, document.getElementById("mouse-hint"));

  // D-16b: the admin panel is HTML over the game, wired once
  const adminPanel = createAdminPanel(document, player);

  // D-18a / D-20a: the buttons change the state; the ticker syncs the visible
  // screen to it. A new game resets the world, places the enemies and plays.
  function startNewGame() {
    resetGame();
    placeGameEnemies(player, gameSettings.enemiesPerGame);
    setGameState(gameStatePlaying);
  }
  document.getElementById("start-game").addEventListener("click", startNewGame);
  document.getElementById("play-again").addEventListener("click", startNewGame);
  document.getElementById("main-menu").addEventListener("click", () => {
    setGameState(gameStateMenu);
  });
  document.getElementById("victory-play-again").addEventListener("click", startNewGame);
  document.getElementById("victory-main-menu").addEventListener("click", () => {
    setGameState(gameStateMenu);
  });

  // D-18b: Controls and Credits are sub-screens of the menu; Back returns to it.
  document.getElementById("show-controls").addEventListener("click", () => {
    showScreen("controls-screen");
  });
  document.getElementById("show-credits").addEventListener("click", () => {
    showScreen("credits-screen");
  });
  document.getElementById("controls-back").addEventListener("click", () => {
    showScreen("menu-screen");
  });
  document.getElementById("credits-back").addEventListener("click", () => {
    showScreen("menu-screen");
  });

  // D-20a / D-18b: the visible screen follows the state, synced only when the
  // state changes, so the menu's Controls and Credits stay open while in menu.
  let syncedState = null;
  function syncScreenToState() {
    if (gameState === syncedState) {
      return;
    }
    syncedState = gameState;
    if (gameState === gameStateMenu) {
      showScreen("menu-screen");
    } else if (gameState === gameStateDefeat) {
      updateEndStats("defeat");
      resetScoreSubmit("defeat");
      showScreen("defeat-screen");
    } else if (gameState === gameStateVictory) {
      updateEndStats("victory");
      resetScoreSubmit("victory");
      showScreen("victory-screen");
    } else {
      hideScreens();
    }
  }

  // D-19d / D-32: the end screens show the kills and the game time
  function updateEndStats(prefix) {
    const killCount = getKillCount();
    const isVictory = prefix === "victory";
    document.getElementById(`${prefix}-kills`).textContent = killCount;
    document.getElementById(`${prefix}-time`).textContent = formatGameTime(getGameTime());
    document.getElementById(`${prefix}-score`).textContent = getScore(killCount, isVictory);
  }

  // D-32: the score submit and the top 5, shared by victory and defeat
  function wireScoreSubmit(prefix, isVictory) {
    const input = document.getElementById(`${prefix}-initials`);
    const button = document.getElementById(`${prefix}-submit-button`);
    const submitBlock = document.getElementById(`${prefix}-submit`);
    const ranking = document.getElementById(`${prefix}-ranking`);
    const list = document.getElementById(`${prefix}-ranking-list`);
    const errorElement = document.getElementById(`${prefix}-error`);

    button.addEventListener("click", async () => {
      const nombre = normalizeInitials(input.value);
      if (nombre === "") {
        errorElement.textContent = "Enter your initials";
        errorElement.hidden = false;
        return;
      }
      button.disabled = true;
      try {
        await submitScore(nombre, getScore(getKillCount(), isVictory));
        const top = await fetchTopScores();
        renderRanking(list, top);
        submitBlock.hidden = true;
        errorElement.hidden = true;
        ranking.hidden = false;
      } catch (error) {
        errorElement.textContent = error.message;
        errorElement.hidden = false;
        button.disabled = false;
      }
    });
  }

  function resetScoreSubmit(prefix) {
    document.getElementById(`${prefix}-submit`).hidden = false;
    document.getElementById(`${prefix}-ranking`).hidden = true;
    document.getElementById(`${prefix}-error`).hidden = true;
    document.getElementById(`${prefix}-initials`).value = "";
    document.getElementById(`${prefix}-submit-button`).disabled = false;
  }

  // D-37a: one span per column (initials, score, date), so the CSS lines the
  // top 5 up like a high score table
  function renderRanking(list, entries) {
    list.textContent = "";
    for (const entry of entries) {
      const item = document.createElement("li");
      for (const text of [entry.nombre, entry.puntuacion, formatScoreDate(entry.createdAt)]) {
        const cell = document.createElement("span");
        cell.textContent = text;
        item.appendChild(cell);
      }
      list.appendChild(item);
    }
  }

  wireScoreSubmit("victory", true);
  wireScoreSubmit("defeat", false);

  // D-16a: resizing the window, or entering full screen, refits the game.
  // Registered once; a drag fires many events, so the canvas only changes when
  // the rounded width does. Called once now in case the window changed during init.
  const scene = { ceilingAndFloor, hud, damageFlash, shotgun };
  function onWindowResize() {
    const width = getScreenWidthForWindow(window.innerWidth, window.innerHeight);
    if (width !== screenWidth) {
      applyScreenWidth(app, scene, width);
    }
    fitGameFrame(gameFrame);
  }
  window.addEventListener("resize", onWindowResize);
  onWindowResize();

  // The bars follow the player's health and ammo
  function updateHudBars() {
    setBarFill(healthBar, getHealthBarWidth(player.health / player.maxHealth));
    setBarFill(ammoBar, getAmmoBarWidth(player.ammo, gameSettings.magazineSize));
    updateReloadCounter(reloadCounter, player.reloadsLeft);
    updateKillsLabel(killsLabel, getKillCount());
  }

  // TDD 6.4: inside the ticker goes only what changes every frame
  app.ticker.add((ticker) => {
    // D-16b: counts frames for the FPS and refreshes the panel four times per second
    adminPanel.update(ticker.deltaMS);
    crtFilter.time += ticker.deltaTime / 60;
    if (crtWasEnabled !== gameSettings.crtFilter) {
      crtWasEnabled = gameSettings.crtFilter;
      gameLayer.filters = crtWasEnabled ? [crtFilter] : [];
    }
    // D-27d: the flash keeps fading, also after the last hit
    updateDamageFlash(damageFlash, ticker.deltaTime);
    // D-12c: the mouse movement since the last frame. It is taken every frame,
    // also while defeated, so a frozen game does not pile up a turn.
    const mouseTurnPixels = mouseTurnInput.consumeTurn();
    // D-17b: zero health switches to defeat. D-16c1: new hit points from the
    // admin panel bring the player back, so defeat returns to playing when the
    // health is restored.
    if (gameState === gameStatePlaying && isPlayerDefeated(player)) {
      setGameState(gameStateDefeat);
    } else if (gameState === gameStateDefeat && !isPlayerDefeated(player)) {
      setGameState(gameStatePlaying);
    }
    // D-20a: the visible screen follows the state
    syncScreenToState();
    mouseHint.update(gameState === gameStatePlaying);
    // D-17b: only playing updates the simulation; the scene stays on its last frame
    if (gameState !== gameStatePlaying) {
      updateHudBars();
      return;
    }
    // D-19d: the game time advances only while playing
    addGameTime(ticker.deltaTime);
    turnPlayerWithMouse(player, mouseTurnPixels);
    updatePlayer(player, pressedControls, ticker.deltaTime);
    // D-25: enemies left far behind come back near the player's new chunk
    gatherFarEnemies(player);
    updateEnemies(player, ticker.deltaTime);
    if (reloadInput.consumeReload() && startReload(player)) {
      startReloadAnimation(shotgun);
    }
    updateReload(player, ticker.deltaTime);
    updateShotCooldown(player, ticker.deltaTime);
    // D-07a / TDD 2.3.1: a shot is the center ray DDA; the nearest enemy on it
    // dies instantly. The muzzle flash plays regardless of a hit.
    if (fireInput.consumeShot() && tryFire(player)) {
      shootCenterRay(player);
      triggerShotgun(shotgun);
    }
    updateShotgun(shotgun, ticker.deltaTime);
    // D-27c: whole hits. The flash starts and the bar drops in this same frame.
    if (damagePlayer(player, getContactDamage(player, ticker.deltaTime))) {
      triggerDamageFlash(damageFlash);
    }
    updateHudBars();
    // D-28c: the textured floor and ceiling follow the Textures toggle (D-16d)
    updateFloorCasting(floorCastingSurface, player, useWallTextures && !gameSettings.flatColors);
    drawWalls(walls, player, wallStrips);
    drawEnemies(enemies, player, enemyStrips);
    drawMinimap(minimap, player);
  });
}

startGame();
