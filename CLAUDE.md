# CLAUDE.md

## What this is

A small real-time multiplayer party-game companion: everyone joins from their own phone/computer with a name + emoji avatar, sees a shared leaderboard of everyone's Token count. Built 2026-09-14 for kaiser.m0900's friend group; redesigned 2026-09-15 from "adjust your own tokens" to a **give/take pairing mechanic** (see below) once the group explained the actual game they wanted to play. Separate project — no shared code with `worksheet`, `fitness-app`, `lesson-plan-generator`, or `online-exam`.

## Game mechanic (v2, 2026-09-15)

Any player can move Tokens between any two players (including themselves) — not just their own count. To do it: tap the 🔥 button on the card of whoever should **gain** 5, then tap the ❄️ button on the card of whoever should **lose** 5 (either order). The moment both are picked, the transfer executes automatically: gainer +5, loser −5, selection resets. Tapping an already-picked button again deselects it. Picking the same player for both is rejected (silently resets) rather than transferring to/from yourself with no net effect.

This is zero-sum across the whole game — the total of everyone's tokens never changes, only who's holding what. A "📋 สรุปผล" (summary) screen aggregates every transfer into net pairwise totals ("แคโรล เสีย 5 ให้ บ๊อบ") rather than a blow-by-blow log — exactly what the group asked for so a group of players isn't confused by a long event history, just "who ended up owing whom."

Plain static site, no build step. Real-time-ish sync (polls every 2s) via a Google Apps Script Web App that holds the player list in `PropertiesService` (no Google Sheet needed this time — see `apps-script/README.md`). Requires that setup to do anything at all; unlike the other projects there's no "works standalone, sync is optional" fallback, since the entire point is seeing everyone's tokens across devices.

## Structure

- `index.html` — three screens (`login`, `board`, `notconfigured`), toggled via `.active`.
- `js/config.js` — `CONFIG.API_URL` (blank until deployed) and `CONFIG.POLL_MS` (2000).
- `js/app.js` — the whole client: avatar picker, join/leave/reset, the poll loop, and `onAdjust()` which optimistically updates the acting player's own card immediately (so their button feels instant) while the next poll (≤2s) reconciles everyone's view including their own.
- `apps-script/Code.gs` — `doGet` returns `{players, netPairs, roster}`; `doPost` handles `join` (upsert by id, also records into `roster`), `transfer` (moves `amount` from `loserId` to `gainerId`, and folds it into the pairwise `netPairs` aggregate — see below), `remove` (drops from the active `players` list, but *not* from `roster`), `reset` (clears all three). All wrapped in `LockService.getScriptLock()` to avoid lost updates when two people press buttons at the same instant.
  - `netPairs` stores one aggregated signed integer per unordered player pair (`"idA|idB": net`, positive meaning idA net-gained from idB) instead of a full transfer log — deliberately, since Apps Script's `PropertiesService` caps each stored value at 9KB and an unbounded event log for an active party game would blow past that; a per-pair aggregate scales with player count² instead, which stays small for any realistic friend-group size. The tradeoff: no timestamped history, only net totals — which is exactly what the "สรุปผล" screen needs anyway.
  - `roster` is a separate `{id: {name, avatar}}` map that's only ever added to (never pruned by `remove` or by someone leaving) so the summary screen can still show a departed player's name/avatar next to their net total. Only `reset` clears it.
- `apps-script/README.md` — setup steps for the teacher's own Google account. Simpler than the online-exam one: no spreadsheet step, just a bare Apps Script project (state lives in Script Properties, not a Sheet).

## Design notes

- Player identity is a random id (`crypto.randomUUID()`) stored in `localStorage`, not a real login — anyone who knows/guesses another player's flow can't impersonate them without their device, but there's no real auth. Fine for a friend-group party game, not appropriate to reuse for anything that needs real accounts.
- Every card (including your own) shows both 🔥 and ❄️ — deliberately unrestricted, so any player can move tokens between any two people, including moving tokens to/from themselves as one side of a pair. There's no server-side check preventing someone from repeatedly targeting the same victim; this is a party game refereed by the players themselves, not a competitive system needing abuse-resistance.
- No profile photo upload — the ask was interpreted as an emoji avatar picker (16 options) instead, to stay "ง่ายง่าย" (simple) as requested: no file handling, no image storage/size concerns in Apps Script Properties.

## Testing performed

No real browser available in the dev environment. Verified the *actual* real-time behavior — not just single-client logic — by running three independent jsdom clients against a local mock stateful API server standing in for the Apps Script endpoint (matching its real shape: GET returns `{players, netPairs, roster}`, POST handles `join`/`transfer`/`remove`/`reset`): join propagation across all three clients, a transfer executed on one client showing up correctly on the other two after their next poll (~2s), a second transfer layering correctly on top (final totals: gainer of both +5/+5, double-loser −10), and the summary screen on a third client rendering both aggregated pairwise results correctly against the actual final token totals. Not yet verified against the real deployed Apps Script endpoint or in an actual browser — do that (and a phone-to-phone check) before relying on it for game night. **Note for whoever updates this next:** the teacher's Apps Script deployment needs its `Code.gs` replaced with the new version and redeployed as a new version of the *same* deployment (Deploy → Manage deployments → edit → New version) to keep the same `/exec` URL — a brand new deployment would break the URL already wired into `js/config.js`.
