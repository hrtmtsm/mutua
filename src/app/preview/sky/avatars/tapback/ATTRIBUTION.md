# Tapback Memoji avatars

Source: https://tapback.co/memoji
Repository: https://github.com/Wimell/Tapback-Memojis
Author: Wes Wimell
Retrieved: 2026-11-03
Repository license: MIT; original notice preserved in LICENSE.

Local WebP files person-0.webp through person-5.webp were downloaded from
https://tapback.co/api/avatar/user{n}.webp?color={n} for n = 0 through 5.
These are illustrative landing-page avatars, not actual member photos.
The upstream describes these as Apple Memoji-style avatars. Its repository
license is recorded here without asserting separate rights to Apple's trademarks.

## Resolution update

The API downsizes every response to 128×128 (see AvatarController.php).
The active assets are now lossless 256×256 to 421×421 PNG originals from the same MIT
repository, src/public/images/avatars/v1/{id}.png, with IDs 57,17,56,46,44,11.
They map to the same user0..user5 seeds. Original PNGs are served without
additional lossy compression, at up to 112 CSS pixels (224 device pixels at 2×).
The previous API WebPs are retained but no longer rendered.
