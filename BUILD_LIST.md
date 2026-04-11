# Antisemitism Decoded — Build List

Ordered by risk (lowest to highest). Check items off as they are completed. Commit after each item (or each logical sub-task) so progress is durable.

Status legend: `[ ]` = not started, `[~]` = in progress, `[x]` = done.

---

## 1. [x] Standardize editor delete buttons

**Risk:** Very low — purely cosmetic, four localized edits.

Coalition, Breaking News, Investments, and Gazette renderers all use an **undefined `del-btn` class** (and Gazette additionally uses undefined `edit-btn`), so those buttons render with no styling. Standardize them to match the rest of the editor.

**Changes:**
- editor.html:20618 (Coalitions): `<button class="del-btn" ...>×</button>` → `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteCoalition(...)">Delete</button>`
- editor.html:20506 (Breaking News): same change for `deleteBreaking`
- editor.html:20742 (Investments): same change for `deleteInvestment`
- editor.html:20475 (Gazette): same change for `deleteGazette`; replace `edit-btn` on the Edit button with `btn btn-ghost btn-sm` (or similar); **add missing `event.stopPropagation()`** to Gazette delete

**Acceptance:** All four panels show identically styled "Delete" buttons matching Scenarios/Traits/Orgs/Missions. Clicking Delete does not also toggle the row expand.

---

## 2. [x] Editor panels expand downward from the header

**Risk:** Low — scroll/CSS behavior fix in the editor only.

Scenarios, inbox items, conversations, etc. sometimes open upward from their header, forcing a scroll back to the top to start editing.

**Changes:** Investigate `toggleEdit` / card rendering to ensure the edit form is inserted *after* the card header in normal document order, not positioned such that it appears above. Likely involves the `.item-edit-form` positioning/margin or the scroll-into-view logic.

**Acceptance:** Opening any item card scrolls/opens such that the top of the edit form is visible immediately beneath the header. No cards open upward.

---

## 3. [x] Fix portrait picker duplicates

**Risk:** Low — reversible via git (file deletions + code edits).

The portrait picker concatenates the 9 named advisor folders and all 17 `char##` source folders (editor.html:20222). 9 of the `char##` folders are crop/resize twins of the named folders, so the same face appears twice — once live, once greyed.

**Changes:**
1. Delete these 9 duplicate folders from `art/advisors/`:
   `char04, char05, char06, char09, char10, char13, char14, char16, char17`
2. In editor.html:20218-20219, replace the auto-generated loop with a hardcoded survivor list:
   ```js
   var PORTRAIT_CHARS = ['char01','char02','char03','char07','char08','char11','char12','char15'];
   ```

**Acceptance:** Picker shows exactly 17 unique faces (9 named + 8 char##). Assigning a portrait to one advisor correctly greys out that exact face for all other advisors. No visual duplicates.

---

## 4. [x] Coalition constraints structured editor

**Risk:** Low-medium — editor-only; stored data shape unchanged.

The coalition edit form uses a raw-JSON textarea for constraints (editor.html:20654-20656). Authors have to hand-write `[{"type":"maintainStat","stat":"trust","above":50,"description":"..."}]` with no validation.

**Changes:** Replace the textarea with a structured constraint list. Each row:
- **Type dropdown**: `maintainStat` / `avoidMission`
- **If maintainStat**: stat dropdown (from `GD.stats`), threshold number input. (Optionally extend engine to support `below` / `between` — decide at build time.)
- **If avoidMission**: mission checkbox grid (from `GD.missions`), letting author pick one or more mission IDs
- **Description** text input
- **Delete (×)** button per row
- `+ Add Constraint` button appends a new row

`saveCoalition` rebuilds the constraints JSON array from the structured rows. Stored data shape is unchanged, so no engine edits required.

**Acceptance:** Authors can add/edit/remove constraints via dropdowns and number fields without touching JSON. Existing coalition constraints continue to work; saving doesn't alter the stored shape.

---

## 5. [x] Budget config fix + editor helpers

**Risk:** Medium — touches data values + adds editor display logic.

Op cost is currently 5/5 in the deployed game (index.html), which removes all fiscal pressure. Also, authors have no way to see the fiscal curve when they change values.

**Changes:**
1. Set `operatingCostPerRound: 12` and `baseIncomePerRound: 5` in **both** index.html:1659-1660 **and** data.json:327-328 (so they match).
2. In editor Global Config panel, add an explanatory block near the Op Cost / Base Income / Fundraising Multiplier fields showing:
   - The formula: `net_per_round = round(baseIncome + donors × fundraisingMultiplier) + endowment − operatingCost`
   - A live-computed **Breakeven Donor Level** field: `ceil((operatingCost − baseIncome) / fundraisingMultiplier)`. Recalculates on every input change.
   - Edge cases: if `baseIncome ≥ operatingCost` show "Always profitable — no breakeven"; if `fundraisingMultiplier === 0` show "No fundraising bonus — fixed net".
   - Worked examples at donors = 0 / 50 / 100 using current input values.
3. In each local/national org editor, repeat the breakeven display near `budgetOverrides.operatingCost` / `budgetOverrides.baseIncome`. Uses override values when set, falls back to global defaults when blank.

**Acceptance:** Deployed game has op cost = 12, base income = 5. Global Config shows live breakeven (59 at defaults) that updates as author types. Each org editor shows its own breakeven reflecting overrides.

---

## 6. [x] Page Text panel — wire up + parity (static screen labels only; briefing/gameScreen/endScreen dynamic strings deferred)

**Risk:** Medium-high — touches engine AND editor; affects multiple screens.

Only `pageText.introScreen` is actually read by the game (engine.js:502, 548). Every other screen's strings are hardcoded in index.html or engine.js. Editing Character/Org/Mission/Briefing/Game/End panel fields does nothing.

### Part A — Engine wiring

For every hardcoded user-facing string in index.html / engine.js that should be author-editable, replace with a read from `GAME_DATA.config.pageText.<screen>.<field>`, falling back to the current hardcoded value as the default. Seed `pageText` in index.html (and data.json) with the actual current strings so editing the editor fields reflects what's in the game.

**Screens that need wiring:**
- charScreen (step label, heading, description)
- orgScreen (same fields)
- missionScreen (same fields)
- briefingScreen (step label, heading, description, advisor name, advisor role, opening quote, closing quote, help button label, items)
- gameScreen (action heading, end round button, no-AP message)
- endScreen (failure title, another-year title, promotion title, retirement title)
- promoScreen (heading, description)
- advisorScreen (step label, heading, description)

### Part B — Editor parity

- Add editor sections for `promoScreen` and `advisorScreen` (missing entirely today).
- Audit every pageText field against the editor panel; add any missing ones.
- Update `populateText()` and `saveText()` to read/write every field.
- Re-seed broken briefingScreen defaults — current data has `advisorName: "Choose Your Next Action"` and `advisorRole: "End Round →"` which look like corrupted leftovers.

**Acceptance:** Author can edit any visible string from the Page Text panel, save, and see the change in the game. All screens represented. No hardcoded user-facing strings for labels/headings/descriptions remain.

---

## 7. [ ] Headline refactor

**Risk:** Medium-high — engine + editor + data migration.

Today the Jewish Gazette is authored in a separate panel with convoluted trigger types (`choiceMade`, `statAbove`, `coalitionFormed`, etc.). Move headlines to live directly on scenario outcomes.

**Changes:**
1. Add optional **Headline** and **Subline** fields to the outcome editor (`renderOutcomeEditor`, editor.html:19458). Wire into `saveScenario` / `saveInboxScenario` so they persist as `outcome.headline` / `outcome.subline`.
2. Engine: outcome-headline capture already exists at engine.js:2017 and `pickGazetteHeadlines` at engine.js:3917-3925. Extend to also capture and pass through `subline`. Update the `gazette-subline` render path (engine.js:3905) so it renders empty string when missing (already does).
3. Add `[org]` token substitution in headline/subline text → replaced with the player's full organization name. Extend the existing `{orgName}` replacer at engine.js:3922 to also match `[org]`. Apply to subline too. (Keep `{orgName}` working for backwards compat.)
4. Retain the Jewish Gazette editor panel **only for generic fallback headlines**. Strip non-generic trigger types (`choiceMade`, `statAbove/Below`, `coalitionFormed/Broken`, `inboxExpired`, `missionStarsHigh/Low`) from the editor UI. These fallback headlines remain customizable/addable (user can add, edit, delete generic ones in the panel). They fire when fewer than 3 outcome-headlines were generated in a round.
5. Migration: any existing non-generic `gazetteTemplates` worth keeping should be moved to the originating scenario's outcome as `outcome.headline`/`outcome.subline`. Non-generic templates that have no owner should be deleted.

**Acceptance:** Authors add headlines by editing an outcome (no separate panel). `[org]` token substitutes correctly. Gazette panel contains only generic fallbacks, all author-editable. Existing content migrated so nothing is lost.

---

## 8. [ ] data.json ↔ index.html drift — pick one canonical file

**Risk:** Architectural — affects build process and source of truth.

CLAUDE.md says data.json is the source of truth, but the build script (`build.sh`) points to a non-existent `game/` subdirectory, so data.json edits never reach index.html. The editor pulls GAME_DATA from index.html via `extractGameData`. The game loads index.html directly. data.json is effectively orphaned.

**Options:**
- **(a) Make data.json canonical:** fix `build.sh` to read from repo root source files and rebuild index.html. Add a note to CLAUDE.md that index.html must be rebuilt after editing data.json. Requires verifying the full build still assembles correctly (template + data + engine + style → index.html).
- **(b) Make index.html canonical:** delete data.json. Update CLAUDE.md to reflect that index.html is the canonical file and the editor is the primary authoring tool (push-to-GitHub writes index.html directly). Simpler, matches current reality.

**Decision needed at build time.** Default recommendation: **option (b)** — it matches how the editor already works and removes a stale file. Option (a) is only worth it if you want to be able to edit data.json directly as a text file.

**Acceptance:** Exactly one canonical file exists. CLAUDE.md accurately describes the build. Editor and game both read/write the same file.

---

## 9. [ ] **Deferred** — Player-facing fiscal formula explanation

**Not in this build cycle.** Design a simplified explanation of the budget formula for the in-game budget screen (or a tooltip) so players understand why gelt is going up or down. Skip the math; focus on cause→effect. Design TBD.

---

## Notes for the build run

- Commit after each completed item (e.g., "Build #1: standardize delete buttons"). One commit per item keeps rollback surgical.
- The user's preference: reorder by risk, proceed through the list in order, check items off as done.
- If a task stalls or reveals an ambiguity, stop and ask rather than guessing.
- Item #2 (empty-space/dead-button bug on Politics/Coalitions panels) was **resolved in a prior edit** before this build list was written and is not included.
