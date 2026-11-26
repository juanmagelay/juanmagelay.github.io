# HUD bars: UI BARS

- Author: guilemus
- Source: https://guilemus.itch.io/ui-bars
- License: free for commercial use, no redistribution of the pack

The pack is not kept in this repo, because its license does not allow redistributing it. Only the three sheets the HUD draws are in the game, embedded unchanged as data URIs so the game keeps working under `file://` (TDD 6.1, 6.2). Each sheet is 98 by 71 px.

## Derived files

- `js/hud.js`, `emptyBarDataUri`: `empty_bar.png`, the empty frame behind the LIFE and AMMO bars (D-06c). sha256 `986939d15bbdc64a63df0da51883933aa5cedc0fd48b39f370b5a52282aaf1c9`.
- `js/hud.js`, `healthBarDataUri`: `health_bar.png`, the LIFE bar, cropped at draw time to its middle band, rows 20 to 35 (D-06c). sha256 `aea3a1bc6a574bf689f1ee70e4c44ee2037a27f00e8440bd62db4a771cf55158`.
- `js/hud.js`, `ammoBarDataUri`: `magic_bar.png`, the AMMO bar, cropped at draw time to its top band, rows 0 to 15, one segment per round (D-08b). sha256 `9cc4d4c780ce76a9dc6769968755021ce7a027ed9612122d788d8a961469264c`.

The PNG files were removed from the repo on 2026-11-26 (D-43). Earlier commits still hold them.
