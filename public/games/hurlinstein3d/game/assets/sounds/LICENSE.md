# Sounds and music

Every file in this folder is a processed copy of a CC0 1.0 Universal (public domain dedication) recording, https://creativecommons.org/publicdomain/zero/1.0/. All were downloaded on 2026-11-26 from the pages below, and each license was read on the asset page. CC0 needs no attribution; the authors are credited anyway in the README and the credits screen. None comes from a commercial game.

## Processing

The same steps for every file, made with macOS `afconvert` and a small Python script (standard library only) outside the repo:

1. Decoded to 16-bit PCM at 44,100 Hz (the firearm recording was 96,000 Hz, 24-bit).
2. Effects mixed down to mono; the stings and the music stay stereo.
3. Effects trimmed: the silence before the sound is cut (4 ms kept before the first sample over 3% of the peak) and the tail after the last sample over 1% of the peak (0.2% for the shot, to keep its echo), with a 3 ms fade in and a 10 ms fade out. A cut that is still too long ends with a longer fade out (the times below).
4. Normalized to the same loudness: RMS 0.2 for the effects and 0.18 for the stings and the music, never past a peak of 0.89 (-1 dBFS). The shot and the dry fire then get a soft saturation, `peak * tanh(drive * x / peak) / tanh(drive)`, which raises the quiet part and keeps the peak, so they hit harder.
5. Encoded as AAC-LC in an M4A container with `afconvert -f m4af -d aac -q 127`, at 96 kbps (the menu music at 80 kbps).

`js/sound-sheet.js` holds each `.m4a` file as a base64 data URI, byte for byte (`tests/audio.test.js` checks it). To change a sound, put the new `.m4a` here with the same name and rebuild the data URI of `js/sound-sheet.js` from it.

## Files

| File | Source page | Author | Source file | Cut |
|---|---|---|---|---|
| `shot.m4a` | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | freefirearmsfx.com team | `Prepared SFX Library/Model 12/K_22P.wav` (Winchester Model 12 pump shotgun, near), from `Prepared SFX Library.7z` | First shot, from 0.7 s, 1.18 s long, drive 2.5 |
| `dryFire.m4a` | [Toy Double Barrel Shotgun Sounds](https://opengameart.org/content/toy-double-barrel-shotgun-sounds) | JumboSizedFish | `toy-double-barrel-shotgun-right-trigger.wav` | Whole click, 0.25 s, drive 1.5 |
| `reload.m4a` | [Shotgun Reload Sound effects](https://opengameart.org/content/shotgun-reload-sound-effects) | zer0_sol | `ShotgunSounds/Shell in Chamber.mp3`, from `shotgunsounds.zip` | Shell in and pump, from 0.4 s, 0.89 s long (the reload takes 0.96 s) |
| `enemyHit.m4a` | [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack) | artisticdude | `zombies/zombie-5.wav`, from `zombies.zip` | Whole grunt, 0.46 s |
| `enemyDeath.m4a` | [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack) | artisticdude | `zombies/zombie-16.wav`, from `zombies.zip` | Whole groan, 1.39 s |
| `enemyAlert.m4a` | [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack) | artisticdude | `zombies/zombie-21.wav`, from `zombies.zip` | Whole growl, 1.06 s |
| `playerHit.m4a` | [15 vocal male strain/hurt/pain/jump sounds](https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds) | qubodup | `slightscream-03.flac`, from `slightscreams.7z` | Whole grunt, 0.49 s |
| `bossAppear.m4a` | [CC0 Deep Monster Roar](https://opengameart.org/content/cc0-deep-monster-roar) | trazzz123 | `monster_roar.wav` | First 3.2 s, the last 1.2 s fading out |
| `footstepLeft.m4a` | [Fantozzi's Footsteps (Grass/Sand & Stone)](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | Fantozzi, packed by qubodup | `Fantozzi-footsteps/flac/Fantozzi-StoneL1.flac`, from `Fantozzi-footsteps.7z` | Whole step, 0.37 s |
| `footstepRight.m4a` | [Fantozzi's Footsteps (Grass/Sand & Stone)](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | Fantozzi, packed by qubodup | `Fantozzi-footsteps/flac/Fantozzi-StoneR1.flac`, from `Fantozzi-footsteps.7z` | Whole step, 0.36 s |
| `uiFocus.m4a` | [UI Audio](https://kenney.nl/assets/ui-audio) | Kenney | `Audio/rollover2.ogg`, from the pack zip | Whole tick, 0.05 s |
| `uiClick.m4a` | [UI Audio](https://kenney.nl/assets/ui-audio) | Kenney | `Audio/click1.ogg`, from the pack zip | Whole click, 0.07 s |
| `victory.m4a` | [Victory Fanfare Short](https://opengameart.org/content/victory-fanfare-short) | cynicmusic | `Heavy_ConceptB.wav` | First 7 s, the last 2 s fading out |
| `defeat.m4a` | [Game Over Dark Short Music Clips](https://opengameart.org/content/game-over-dark-short-music-clips) | Robin Lamb | `gameoverdark.wav` | First 6.5 s, the last 2.5 s fading out |
| `menuMusic.m4a` | [Menacing Otherworld](https://opengameart.org/content/menacing-otherworld) | Ruskerdax | `ruskerdax_-_menacing_otherworld.mp3` | Loop of 51.05 s from 30 s (below) |
| `arenaMusic.m4a` | [Boss Battle #7 (Metal)](https://opengameart.org/content/boss-battle-7-metal) | nene | `boss_battle_07.wav` | Whole track, 46.6 s; the author made it to loop |

### Menu loop

The source track lasts 243 s at a steady level, so a 51 s stretch is enough. The loop length was searched between 46 and 54 s: for each candidate length, the onset envelope (the rise of the loudness every 10 ms) of the 4 s after the start was compared with the 4 s after the start plus that length, and the length where they matched best (0.875 of correlation, the same beat pattern) won, refined to the sample. The first 0.6 s of the loop are an equal power crossfade with the music that followed the end in the source, so the last sample of the loop leads straight into its first one.

## Checksums (sha256)

Source downloads:

- `Prepared SFX Library.7z`: `cc1ab5a99a0a365105c7c5dd783f4b0b1fe90938114d3ceec53856bfe005f7d6`; `K_22P.wav`: `ea19e9a0be4686054847a58b0a43f6be82fbe65345489f41aa02dbcf166d34d0`
- `toy-double-barrel-shotgun-right-trigger.wav`: `592554f5a7f7e27e3a2bd1a94fbf029741fcb7fcc4fe552b05b097b3a17cdbcd`
- `shotgunsounds.zip`: `31128a93eee729cadcd1cdeabca6b6b1f655578101109b59c0fb5dd4b96e6079`
- `zombies.zip`: `8096ceeb4dac35d9eef9bfe0cc6649778d1eebf141b208d394ac338b9e5be314`; `zombie-5.wav`: `6920b559f953d19737f65a9da5b31f7bb3e1421c48552f52d7a57399d507574b`; `zombie-16.wav`: `637f8d26b186005246a279fb19def56c81eebcf144c2346460ac1e4fc0075fc7`; `zombie-21.wav`: `d58c26ae8df808238becc3434cf46778fca4582e9fcda138bdc01f720ecbbefc`
- `slightscreams.7z`: `3220b234efed17305bef05fe82c5d2e2b38302ae02b0d188021af9b045499a1e`; `slightscream-03.flac`: `4d150f341ac621a7d8b6d0891d946c6c934964b0b5ef06a00ffe24ddacfea235`
- `monster_roar.wav`: `040d2841619c732098c30a638731317d13d7647e5ce1a75a3246219ce4b162ff`
- `Fantozzi-footsteps.7z`: `415d360e0911c1c1c5355ee94023b772e6f4044f59b9b580610e7dbffd1840fd`; `Fantozzi-StoneL1.flac`: `7cfa4a2f500ae2bd19a961022296611d837c34ca2e556fe68deb692388f49971`; `Fantozzi-StoneR1.flac`: `7073bddd2e3ba432e15a83844180c0ebc52835c2c6bab0fa902ee5952499c729`
- Kenney UI Audio zip: `946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6`; `rollover2.ogg`: `d0bc0fcba496d73df1da8c145e5330df75f87ab5a4f33a9b71461b006b5c338e`; `click1.ogg`: `59175ac17cd49a68dd736285738441287636112a84a6f7ce0d89921bda5a5360`
- `Heavy_ConceptB.wav`: `cf7aca1193530c804f41a22cfd9a2813c25d3c244fa96ad88c88c6206daa033d`
- `gameoverdark.wav`: `21a5ec665a0500ef87babfa46cbdacffec467cf0c42ae175a1cfece8ca9457dd`
- `ruskerdax_-_menacing_otherworld.mp3`: `106cc25da6e28378a08cea346483a704e7dc7f8e9e5d77093ead6e515de3a2ef`
- `boss_battle_07.wav`: `16d09747b7c7777314da75a84f4b44c1f81bcf385886566134078a6018850027`

Files in this folder:

- `shot.m4a`: `8654fe9282e8ec04fdcc9a6be2c78c480ff3e7f1887e4cbe9407f90cf9b90181`
- `dryFire.m4a`: `41c61fe3f3c6a5a95c3a08cfcc32792ea03d4f0275e8bb0efc6197115a201602`
- `reload.m4a`: `1d89e7ac2a902976964ce9431a7f828252ba265bddc19a453764008edfb29f6e`
- `enemyHit.m4a`: `0f9104aa56aa469a7a75896888d846f11f34e7a3ed5fb2fe848fed5c6a4c6002`
- `enemyDeath.m4a`: `8c6ddc7fc0dce7c93d017c1fd529faec75d4c8aea17fd1bfc3c7c5c0f02d6344`
- `enemyAlert.m4a`: `7d79acf1f0caf18154df14840c38907749424731729c288c7f7588aed18141ae`
- `playerHit.m4a`: `65400ee12719ccdb251e33de24285ccfd9d68fd64585679c08b5203a191582d5`
- `bossAppear.m4a`: `222ee68d3528d0626ddce71fbcda2b1abf1121632df9d3fbaf2f3d0e48c3dacd`
- `footstepLeft.m4a`: `a89482903706c672ac89976d7f2f24f2b009699e1b5c26930fe93e740edcfad5`
- `footstepRight.m4a`: `21dc40918d4183d22480c491b9aef063dde1d45d4ab84a828a4385e4dc2c6ce5`
- `uiFocus.m4a`: `5b83023ea6e5c0f6dc90d8f5f3809403a48cca055b0e08a2bd8ec9887e8036e4`
- `uiClick.m4a`: `501658a050aec218eb5027e1c67ddaf8248e20d895b7fd7eb55c967183b828cc`
- `victory.m4a`: `9c93aabdc1f51fddc736b00d95ff4567f53955dfe57408ed6809bd8625f7924e`
- `defeat.m4a`: `b2273c891260fb82707b6d2241885261b463c00353e4ebb2ea3f2d9982f773da`
- `menuMusic.m4a`: `545a2a7552ede16fe8ace79ff50ab8a94dd055ea4a5fe19eb90675dda2238f7c`
- `arenaMusic.m4a`: `6049b272e3885f6972f7291bc5c85c54a240b6fa78af34d7c71660a52f582642`
