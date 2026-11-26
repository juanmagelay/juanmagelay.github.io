# Shotgun sprite: FPS Gun Sprites

- Author: Rekkimaru
- Source: https://rekkimaru.itch.io/fps-gun-sprites
- License: free for any use, no attribution required. It is credited anyway in the README and the credits screen.

## Files

- `Sgun.png`: the shotgun sheet from the pack, copied unchanged. 535 by 710 px. sha256 `ac367adbcfe380d6c72da6b69018d2358c88b3f6af4bd9a94d3575d2c47e8094`.

The other sprites of the pack (`MCGUN1.png`, `PICK1.png`, `PIST1.png` and `PIST2.png`) were never used by the game and were removed on 2026-11-26 (D-43).

## Derived files

- `js/weapon-sheet.js`: a strip of 15 frames of 269 by 156 px cut from `Sgun.png`: idle, four firing frames and ten reload frames (D-07b, D-07e, D-08c, D-08d), embedded as a data URI so the game keeps working under `file://` (TDD 6.1).
