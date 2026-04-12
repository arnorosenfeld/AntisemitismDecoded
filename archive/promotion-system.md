# Archived: Local → National promotion system

The game originally had a two-tier structure: the player started at a "local" Jewish org, played a year, and if they scored high enough they were offered a promotion to a "national" org to play a second year at higher stakes. The 3-org reduction removed this entirely. One org, one year, end of game.

This note documents what was removed so it can be revived cleanly as a DLC / second-year mode. All line numbers below refer to the `pre-org-reduction` git tag — run `git show pre-org-reduction:index.html | sed -n 'NNN,MMMp'` or `git checkout pre-org-reduction` to retrieve any of it.

## State

```js
G.promotionLevel = 0   // 0 = local, 1 = promoted once
G.activeUnlocks = []   // character trait unlocks carried across promotions
```

## Orgs

The 4 national orgs lived in `GAME_DATA.nationalOrganizations` (starting around line 2315 in the tagged state). Each had:
- `orgLevel: "national"`
- `promotionEligible: []` (national is the top of the ladder)
- Higher `startingBudget` / `allocationPoints` than their local counterparts
- National-tier `scenarioCategories` (same as local — "progressive", "centrist", etc.)

Local orgs had:
- `orgLevel: "local"`
- `promotionEligible: ["left","center","right"]` or similar — determined which national orgs they could be promoted into

## Scenario gating

Scenarios had an `orgLevel` field: `"local"`, `"national"`, or `"both"` (default). `scenarioApplies()` at roughly line 15286 checked the current org's level against the scenario's level and filtered.

```js
function scenarioApplies(scenario) {
  const allOrgs = [...GAME_DATA.organizations, ...GAME_DATA.nationalOrganizations];
  const org = allOrgs.find(o => o.id === G.orgId);
  if (!org) return false;
  const level = scenario.orgLevel || 'both';
  const orgLvl = org.orgLevel || (GAME_DATA.nationalOrganizations.find(o=>o.id===G.orgId) ? 'national' : 'local');
  if (level !== 'both' && level !== orgLvl) return false;
  // ...category check follows
}
```

After the reduction, all orgs are effectively one tier, so the level check is gone.

## Promotion flow functions

- `startPromoGame()` — equivalent of `startGame()` but for a second year with `promotionLevel = 1`. Re-initialises stats with a +10 bonus from the promotion, applies a `+15` clout bonus, rebuilds segment approvals, etc.
- `selectPromoOrg(id)` — called from `#promo-screen` when the player picks a national org to promote into.
- `confirmPromoOrg()` — transitions from `#promo-screen` to `#mission-screen` and sets `_isPromotionFlow = true` so the subsequent screens know this is a promotion.

## HTML screens

- `<div id="promo-screen">` (around line 1565) — the org-select screen for promotion. Lists eligible national orgs based on `promotionEligible` of the just-completed local org.
- `<div id="promo-budget-screen">` — the budget allocation screen for the promoted run (most of the budget UI was reused, but some flow was separate).

## End-screen branching

`endYear()` (around line 17768) branched on score:

```js
if (score < fail)     { renderEndScreen(score, false, null, false, false, false); ... }
if (score >= promo) {
  if (G.promotionLevel >= 1) renderEndScreen(score, false, null, true,  false, false); // already promoted — game won
  else                        renderEndScreen(score, false, null, false, true,  false); // offer promotion
}
```

The `renderEndScreen(...)` signature had flags for "game won", "offer promotion", etc. When promotion was offered, a button on the end screen called into `showScreen('promo-screen')`.

## Restart flow

`restartSameCharacter()` (around line 18011) preserved `G.promotionLevel` and `G.activeUnlocks` across replays so the player kept their promoted state if they restarted the same character.

## To revive

1. Restore `GAME_DATA.nationalOrganizations` from `orgs-removed.json` (or from the git tag if you want different orgs).
2. Re-add `orgLevel` to the local orgs.
3. Re-add `promotionLevel` to G initial state.
4. Bring back the `startPromoGame`, `selectPromoOrg`, `confirmPromoOrg` functions from `git show pre-org-reduction:index.html`.
5. Bring back the `#promo-screen` + `#promo-budget-screen` HTML blocks.
6. Restore the orgLevel check in `scenarioApplies()`.
7. Restore the promotion branching in `endYear()` and `renderEndScreen()`.
8. Restore the restartSameCharacter promotion-preservation logic.

All of that code is intact at the `pre-org-reduction` tag.
