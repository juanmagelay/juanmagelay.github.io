# Enemy sprite: Husk Mutant

- Author: HorrorMovieRei
- Source: https://opengameart.org/content/husk-mutant (posted 2025-01-01, downloaded 2026-11-20)
- License: CC0 1.0 Universal (public domain dedication), https://creativecommons.org/publicdomain/zero/1.0/
- Archive: `husk_mutant.zip`, sha256 `ebb2b2a427ec7bae1630f06393de4ce0ca3444425ae7998d414a6f893f4b2e00`

The author describes it as original art made with Blender and Photoshop, "a set of sprites for a Doom-like monster". CC0 needs no attribution; it is credited anyway in the README and the credits screen.

## Files

- `ZOMBA1.png`: the front frame (walk frame A, rotation 1) from the archive, copied unchanged. 33 by 57 px, 8-bit palette with a transparent background. sha256 `ebbd1ee03c12c06caaf62cd583cb67d1f8eeec28fc658b0ab9bfca5a396f3521`.

## Derived files

- `js/enemy-sheet.js`: `ZOMBA1.png` as a base64 data URI (D-21a).
- `assets/logo/logomark.png` and `assets/logo/favicon-32.png`: a 16 by 16 crop of the head (x 8 to 23, y -2 to 13 of `ZOMBA1.png`) on the game background color `#111e30`, scaled 32 and 2 times with nearest neighbor (D-26). The favicon is embedded in `index.html` as a data URI.
