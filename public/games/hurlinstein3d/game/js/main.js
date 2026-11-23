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
  drawDefeatOverlay(scene.defeatOverlay);
  resizeDamageFlash(scene.damageFlash);
  scene.shotgun.sprite.x = getAimedShotgunX();
}

// TDD 6.4: app.init is async, so startup lives in an async function
async function startGame() {
  // D-16a: the canvas starts with the shape of the window, and H-10c: the
  // camera plane with the matching length
  screenWidth = getScreenWidthForWindow(window.innerWidth, window.innerHeight);
  setCameraPlaneLength(player, getCameraPlaneLength());

  // D-24 / TDD 2.3.2: the enemies of the game are placed once, around the spawn
  placeGameEnemies(player, gameSettings.enemiesPerGame);

  const app = new PIXI.Application();
  await app.init({
    width: screenWidth,
    height: screenHeight,
    background: backgroundColor,
  });
  const gameFrame = document.getElementById("game-frame");
  gameFrame.appendChild(app.canvas);
  fitGameFrame(gameFrame);

  // TDD 6.4: Graphics objects are created once, outside the ticker.
  // Ceiling and floor never change, so they are drawn here, once.
  const ceilingAndFloor = new PIXI.Graphics();
  drawCeilingAndFloor(ceilingAndFloor);
  app.stage.addChild(ceilingAndFloor);

  // Added second, so the walls are drawn on top of ceiling and floor
  const walls = new PIXI.Graphics();
  app.stage.addChild(walls);

  // D-09: optional textured walls, one pre-created sprite per strip, above the
  // flat wall graphics and under the enemies
  let wallStrips = null;
  if (useWallTextures) {
    initWallTextures();
    wallStrips = createWallStripSprites();
    app.stage.addChild(wallStrips.container);
  }

  // D-04c2: enemies draw over the walls, occluded per strip by the wall depth
  const enemies = new PIXI.Graphics();
  app.stage.addChild(enemies);

  // D-21b: the enemy sprite, cut into columns once, and its pool of strip
  // sprites, created once, at the same layer as the flat enemies
  let enemyStrips = null;
  if (useEnemySprites) {
    await loadEnemyTextureColumns();
    enemyStrips = createEnemyStripSprites();
    app.stage.addChild(enemyStrips.container);
  }

  // D-13c: projectiles draw over the enemies, with the same wall occlusion
  const projectileGraphics = new PIXI.Graphics();
  app.stage.addChild(projectileGraphics);

  // D-07b / D-07c: the shotgun view model sits at the bottom, aimed at the crosshair,
  // under the HUD and overlay
  const shotgun = await createShotgun();
  app.stage.addChild(shotgun.sprite);

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

  // D-06c: defeat overlay sits on top and stays hidden until health reaches zero
  const defeatOverlay = createDefeatOverlay();
  app.stage.addChild(defeatOverlay);

  // TDD 6.4: keyboard and mouse listeners are registered once, outside the
  // ticker. D-12: the mouse listens on the game frame only, so clicks on the
  // admin panel never fire or reload.
  const pressedControls = createKeyboardInput(window);
  const mouseTurnInput = createMouseTurnInput(document, gameFrame);
  const fireInput = createFireInput(window, gameFrame);
  const reloadInput = createReloadInput(window, gameFrame);

  // D-16b: the admin panel is HTML over the game, wired once
  const adminPanel = createAdminPanel(document, player);

  // D-16a: resizing the window, or entering full screen, refits the game.
  // Registered once; a drag fires many events, so the canvas only changes when
  // the rounded width does. Called once now in case the window changed during init.
  const scene = { ceilingAndFloor, hud, defeatOverlay, damageFlash, shotgun };
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
  }

  // TDD 6.4: inside the ticker goes only what changes every frame
  app.ticker.add((ticker) => {
    // D-16b: counts frames for the FPS and refreshes the panel four times per second
    adminPanel.update(ticker.deltaMS);
    // D-27d: the flash keeps fading, also after the last hit
    updateDamageFlash(damageFlash, ticker.deltaTime);
    // D-12c: the mouse movement since the last frame. It is taken every frame,
    // also while defeated, so a frozen game does not pile up a turn.
    const mouseTurnPixels = mouseTurnInput.consumeTurn();
    // D-06b: at zero health the game freezes on the last frame. D-16c1: new
    // hit points from the admin panel bring the player back, so the overlay
    // follows the health every frame.
    const defeated = isPlayerDefeated(player);
    defeatOverlay.visible = defeated;
    if (defeated) {
      updateHudBars();
      return;
    }
    turnPlayerWithMouse(player, mouseTurnPixels);
    updatePlayer(player, pressedControls, ticker.deltaTime);
    // D-25: enemies left far behind come back near the player's new chunk
    gatherFarEnemies(player);
    updateEnemies(player, ticker.deltaTime);
    if (reloadInput.consumeReload() && startReload(player)) {
      startReloadAnimation(shotgun);
    }
    updateReload(player, ticker.deltaTime);
    // D-13c / TDD 2.3.1: a shot launches a projectile along the center ray;
    // the hit happens later, when the projectile reaches an enemy
    if (fireInput.consumeShot() && tryFire(player)) {
      fireProjectile(player);
      triggerShotgun(shotgun);
    }
    updateProjectiles(ticker.deltaTime);
    updateShotgun(shotgun, ticker.deltaTime);
    // D-27c: whole hits. The flash starts and the bar drops in this same frame.
    if (damagePlayer(player, getContactDamage(player, ticker.deltaTime))) {
      triggerDamageFlash(damageFlash);
    }
    updateHudBars();
    drawWalls(walls, player, wallStrips);
    drawEnemies(enemies, player, enemyStrips);
    drawProjectiles(projectileGraphics, player);
    drawMinimap(minimap, player);
  });
}

startGame();
