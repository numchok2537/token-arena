# CLAUDE.md

## What this is

A small real-time multiplayer party-game companion: everyone joins from their own phone/computer with a name + emoji avatar, sees a shared leaderboard of everyone's Token count, and adjusts only their own count by ±5 via animated fire (+) / ice (−) buttons. Built 2026-09-14 for kaiser.m0900's friend group. Separate project — no shared code with `worksheet`, `fitness-app`, `lesson-plan-generator`, or `online-exam`.

Plain static site, no build step. Real-time-ish sync (polls every 2s) via a Google Apps Script Web App that holds the player list in `PropertiesService` (no Google Sheet needed this time — see `apps-script/README.md`). Requires that setup to do anything at all; unlike the other projects there's no "works standalone, sync is optional" fallback, since the entire point is seeing everyone's tokens across devices.

## Structure

- `index.html` — three screens (`login`, `board`, `notconfigured`), toggled via `.active`.
- `js/config.js` — `CONFIG.API_URL` (blank until deployed) and `CONFIG.POLL_MS` (2000).
- `js/app.js` — the whole client: avatar picker, join/leave/reset, the poll loop, and `onAdjust()` which optimistically updates the acting player's own card immediately (so their button feels instant) while the next poll (≤2s) reconciles everyone's view including their own.
- `apps-script/Code.gs` — `doGet` returns the current player list; `doPost` handles `join` (upsert by id), `adjust` (±delta on tokens, can go negative), `remove`, `reset` (clears everyone) — all wrapped in `LockService.getScriptLock()` to avoid lost updates when two people press buttons at the same instant.
- `apps-script/README.md` — setup steps for the teacher's own Google account. Simpler than the online-exam one: no spreadsheet step, just a bare Apps Script project (state lives in Script Properties, not a Sheet).

## Design notes

- Player identity is a random id (`crypto.randomUUID()`) stored in `localStorage`, not a real login — anyone who knows/guesses another player's flow can't impersonate them without their device, but there's no real auth. Fine for a friend-group party game, not appropriate to reuse for anything that needs real accounts.
- Fire/ice buttons only appear on the current player's own card — everyone else's card is read-only, so token totals can only be changed by their owner (rate-limited only by how fast someone can click).
- No profile photo upload — the ask was interpreted as an emoji avatar picker (16 options) instead, to stay "ง่ายง่าย" (simple) as requested: no file handling, no image storage/size concerns in Apps Script Properties.

## Testing performed

No real browser available in the dev environment. Verified the *actual* real-time behavior — not just single-client logic — by running two independent jsdom clients against a local mock stateful API server standing in for the Apps Script endpoint (same shape: GET returns `{players}`, POST handles the four actions): one client's optimistic self-update, the other client picking up that change via its own poll (~2s later), then a leave/removal also propagating correctly to the first client's next poll. Not yet verified against the real deployed Apps Script endpoint or in an actual browser — do that (and a phone-to-phone check) before relying on it for game night.
