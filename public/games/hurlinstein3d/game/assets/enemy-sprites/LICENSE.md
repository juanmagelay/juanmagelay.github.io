# Enemy sprite: Husk Mutant

- Author: HorrorMovieRei
- Source: https://opengameart.org/content/husk-mutant (posted 2025-01-01, downloaded 2026-11-20)
- License: CC0 1.0 Universal (public domain dedication), https://creativecommons.org/publicdomain/zero/1.0/
- Archive: `husk_mutant.zip`, sha256 `ebb2b2a427ec7bae1630f06393de4ce0ca3444425ae7998d414a6f893f4b2e00`

The author describes it as original art made with Blender and Photoshop, "a set of sprites for a Doom-like monster". CC0 needs no attribution; it is credited anyway in the README and the credits screen.

## Files

- `ZOMBA1.png`: the front frame (walk frame A, rotation 1) from the archive, copied unchanged. 33 by 57 px, 8-bit palette with a transparent background. sha256 `ebbd1ee03c12c06caaf62cd583cb67d1f8eeec28fc658b0ab9bfca5a396f3521`.
- `ZOMBI0.png` to `ZOMBM0.png`: the five death frames (frames I to M, rotation 0, the same from every angle) from the archive, downloaded again on 2026-11-26 (the archive sha256 matched) and copied unchanged. 150 by 81 px each, 8-bit palette with a transparent background, with a `grAb` anchor chunk.
  - `ZOMBI0.png` sha256 `989b1f3cfb3d79df731a6fffbb16e67d4424ad72b3829b9f5e91c3ffeedc361c`
  - `ZOMBJ0.png` sha256 `e63509eb88df1fa444cd06c80ac46d6fdf3e8ce7b7613929b394188bba4293b8`
  - `ZOMBK0.png` sha256 `c2842d8393b3de3b8a93246e987dbd11501a08942bd9b074602818aca5845f9c`
  - `ZOMBL0.png` sha256 `ea59bf03e4eaaa4cb9d79167e73f762df178cfdef55d8c11a406d3f571ddad94`
  - `ZOMBM0.png` sha256 `9d3f650bf01664ee5d7c3f39c159595db9cac69e9f80d4e793907f41310c33f7`

## Derived files

- `js/enemy-sheet.js`: `ZOMBA1.png` as a base64 data URI (D-21a).
- `js/enemy-sheet.js`, `enemyDeathSheetDataUri`: the five death frames packed into one RGBA strip of 255 by 60 px, five frames of 51 by 60, sha256 `4091bad2e12d48284e2a5f9ddc79d7f012741dd8230cf6794730c9def709ff5c` (D-39b). Every opaque pixel is copied unchanged (3,809 in all). In each frame the lowest opaque row of the source sits on the bottom row of the strip, and the source pixel at the `grAb` x anchor goes to column 27, 1.5 px right of the frame center, like the anchor of `ZOMBA1.png` (column 18 of 33). Made with a small Node script (zlib PNG decode and encode) outside the repo.
- `assets/logo/logomark.png` and `assets/logo/favicon-32.png`: a 16 by 16 crop of the head (x 8 to 23, y -2 to 13 of `ZOMBA1.png`) on the game background color `#111e30`, scaled 32 and 2 times with nearest neighbor (D-26). The favicon is embedded in `index.html` as a data URI.
