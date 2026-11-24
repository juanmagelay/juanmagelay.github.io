// TDD 2.3.4 / D-18a: the game screens are HTML elements over the canvas, inside
// #game-frame, so they scale with the game. main.js wires the buttons; these
// helpers show screens and support keyboard navigation.

function getMenuNavigationDirection(key) {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === "arrowdown" || normalizedKey === "s") {
    return 1;
  }
  if (normalizedKey === "arrowup" || normalizedKey === "w") {
    return -1;
  }
  return 0;
}

function getNextMenuButtonIndex(currentIndex, buttonCount, direction) {
  if (buttonCount === 0) {
    return -1;
  }
  if (currentIndex < 0) {
    return direction > 0 ? 0 : buttonCount - 1;
  }
  return (currentIndex + direction + buttonCount) % buttonCount;
}

function getVisibleMenuButtons(screen) {
  return Array.from(screen.querySelectorAll("button")).filter(
    (button) => !button.disabled && button.closest("[hidden]") === null,
  );
}

function createMenuNavigation(target) {
  target.addEventListener("keydown", (event) => {
    const direction = getMenuNavigationDirection(event.key);
    if (direction === 0) {
      return;
    }

    const eventTarget = event.target;
    if (
      eventTarget.isContentEditable ||
      (typeof eventTarget.closest === "function" &&
        eventTarget.closest("input, textarea, select, [contenteditable='true']") !== null)
    ) {
      return;
    }

    const screen = target.querySelector("#game-frame .screen:not([hidden])");
    if (screen === null) {
      return;
    }
    const buttons = getVisibleMenuButtons(screen);
    if (buttons.length === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = buttons.indexOf(target.activeElement);
    const nextIndex = getNextMenuButtonIndex(currentIndex, buttons.length, direction);
    buttons[nextIndex].focus();
  });
}

function hideScreens() {
  for (const screen of document.querySelectorAll("#game-frame .screen")) {
    screen.hidden = true;
  }
}

function showScreen(screenId) {
  hideScreens();
  const screen = document.getElementById(screenId);
  if (screen !== null) {
    screen.hidden = false;
    const firstButton = getVisibleMenuButtons(screen)[0];
    if (firstButton !== undefined) {
      firstButton.focus();
    }
    if (document.pointerLockElement && typeof document.exitPointerLock === "function") {
      document.exitPointerLock();
    }
  }
}

// D-36b / TDD 2.2: while playing with the mouse free, a hint inside the game
// frame says that a click on the view captures it. The browser shows its own
// notice once the mouse is captured; the page cannot hide or restyle that one.
function shouldShowMouseHint(isPlaying, isMouseCaptured) {
  return isPlaying && !isMouseCaptured;
}

// The ticker calls update() every frame; the element is written only when the
// answer changes
function createMouseHint(page, gameFrame, hintElement) {
  let shown = !hintElement.hidden;
  return {
    update(isPlaying) {
      const show = shouldShowMouseHint(isPlaying, page.pointerLockElement === gameFrame);
      if (show !== shown) {
        shown = show;
        hintElement.hidden = !show;
      }
    },
  };
}
