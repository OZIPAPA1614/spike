# NOVA — notes for Claude

NOVA is a single-file browser 3D tactical shooter (Turkish UI, English toggle). It is published by
GitHub Pages straight from `main/index.html`: https://ozipapa1614.github.io/nova/ — every push to
`main` goes live for all players within 1–2 minutes.

The owner writes in Turkish: reply to them in Turkish and write commit messages in Turkish.

## Source of truth
- Edit `src/` only: `src/00_*.js … src/08_ui.js` (concatenated in name order) + `src/template.html`.
- Build: `python3 tools/build.py src index.html` (also writes `index.html.js`; delete it, it is not committed).
- Never hand-edit `index.html`. If someone did, port that diff into `src/` first, then rebuild —
  `tests/check.py` reports when `index.html` and the `src/` build differ.

## Checking
- `python3 tests/check.py` — build consistency, menus/store, bot matches on every map (2 full matches),
  PARKUR mode (5 bot rounds, UI flow, multiplayer map/round sync), cinematic intro, single-player flow,
  local multiplayer (room, join, sync, chat, voice), public-server matchmaking, admin panel (gems, powers), SERBEST mode (NPCs, pills, mods, multiplayer sync, content download).
  `--quick` skips the full matches. Needs Playwright + `/usr/bin/google-chrome`; no internet needed
  (local signalling server `tests/sigserver.py` and Firebase mock `tests/fbmock.py`).
- Exit code 0 and `SONUÇ: SORUN YOK` = healthy. Every problem line starts with `FAIL:`.

## Live services (do not change without the owner's OK)
- Firebase project `spike-oyun` (Realtime DB europe-west1). Accounts are nickname+password
  (stored as base32 emails `n…@spike-oyun.app`). These two ids keep the game's old name on purpose:
  a Firebase project id cannot be renamed and changing the email domain would lock every player out.
  Rules allow `users/<uid>` (owner writes),
  `pub/<code>` (public room list), `clk` (server clock) and `gk/<code>` (admin gem gifts: only the admin
  account OZN = `nn55g4@spike-oyun.app` and the account `n<code>@spike-oyun.app` may read/write).
- Admin panel (`src/08b_admin.js`) is visible only when logged in as OZN.
- Store / cosmetics: catalog (swords, 44 weapon skins, 65 character skins, 14 kill effects, rarities) in
  `src/02h_shop.js`; CS-style cases (bought with gems in the store, opened at once, odds shown, duplicates refund 35%)
  in `src/02j_cases.js`; the "Yeniden Başlıyoruz" case (`cs4`) holds character skins c45–c65 named after the owner's
  friend group chat (rarity by how often the name came up); `ultra: 1` = top rarity ★★ Efsanevi (only Dederam, exactly 1% there); kill effects (Arsenal-style, drawn where the victim died, everyone sees them) in
  `src/07i_killfx.js`. Items with `ex: 1` drop only from cases. Profile fields: `ws/cs/kf` owned, `wsk/csk/kfx` equipped.
  Weapon skin patterns (camo, carbon, scales, flames, circuits…; seeded 128 px tiles, `pat/pc/pk/pg/flow` in `WPAT`)
  are generated in `src/02k_patterns.js`; gun models get box-projected UVs (`src/07g_models.js`), the shader has
  `uTE` (pattern glow) and `uTO` (flowing pattern offset).
- SERBEST (free roam, mode `fr`): `src/03d_free.js` (host: NPCs, pills, free weapons), `src/07h_npc.js`
  (drawing), `src/08c_spawn.js` (Q spawn menu), `src/08d_mods.js` (player JavaScript mods, run only on
  the host inside a Web Worker; they may act only through the checked `nova` API), `src/06b_pak.js`
  (content sharing: custom NPC images + 15 s sounds are sent in 16 KB chunks when joining a room).
- Multiplayer signalling: public PeerJS server 0.peerjs.com via the embedded MiniPeer (`src/00_peer.js`).
- Controls (`src/08e_controls.js`): Minecraft-style key rebinding in Settings (`KB`, saved as `spk_keys`; code reads keys
  through `kbIs` / `kbHeld` / `kbLabel`, never hard-coded codes), Brawl Stars-style touch layout editor (drag + resize
  buttons and joystick, saved as `spk_tlay` in screen fractions) and `tbModeHidden` (touch buttons shown only in modes
  where they work).

## Daily health check (scheduled task, 12:00 Europe/Istanbul)
1. Run `python3 tests/check.py`.
2. If it passes: change nothing, push nothing.
3. If it fails: find the root cause, fix it in `src/`, rebuild, rerun until it passes, then commit and push.
   Fix only what is broken — no new features, no balance changes, no visual changes.
4. If it cannot be fixed safely, do not push; report what is broken.
