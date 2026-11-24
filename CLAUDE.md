# NOVA (formerly SPIKE) — notes for Claude

NOVA (formerly SPIKE) is a single-file browser 3D tactical shooter (Turkish UI, English toggle). It is published by
GitHub Pages straight from `main/index.html`: https://ozipapa1614.github.io/spike/ — every push to
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
  local multiplayer (room, join, sync, chat, voice), public-server matchmaking.
  `--quick` skips the full matches. Needs Playwright + `/usr/bin/google-chrome`; no internet needed
  (local signalling server `tests/sigserver.py` and Firebase mock `tests/fbmock.py`).
- Exit code 0 and `SONUÇ: SORUN YOK` = healthy. Every problem line starts with `FAIL:`.

## Live services (do not change without the owner's OK)
- Firebase project `spike-oyun` (Realtime DB europe-west1). Accounts are nickname+password
  (stored as base32 emails `n…@spike-oyun.app`). Rules allow `users/<uid>` (owner writes),
  `pub/<code>` (public room list) and `clk` (server clock).
- Multiplayer signalling: public PeerJS server 0.peerjs.com via the embedded MiniPeer (`src/00_peer.js`).

## Daily health check (scheduled task, 12:00 Europe/Istanbul)
1. Run `python3 tests/check.py`.
2. If it passes: change nothing, push nothing.
3. If it fails: find the root cause, fix it in `src/`, rebuild, rerun until it passes, then commit and push.
   Fix only what is broken — no new features, no balance changes, no visual changes.
4. If it cannot be fixed safely, do not push; report what is broken.
