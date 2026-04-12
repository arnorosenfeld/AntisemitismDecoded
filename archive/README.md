# Archive

Content removed from the main game during the 3-org reduction (commit following `pre-org-reduction` tag). Preserved here so it can be revived as DLC or a future mode without needing to spelunk through git history.

## Safety tag

Immediately before the removal, the repository was tagged with:

```
git tag pre-org-reduction
```

To view the full pre-removal state:

```
git show pre-org-reduction
git checkout pre-org-reduction
```

## Files in this directory

### `orgs-removed.json`

The five organizations that were fully retired in the reduction:

**Local orgs (3):**
- `left` — Tikkun Olam Alliance (progressive advocacy)
- `center` — Jewish Federation of Metroland (centrist community)
- `jcc` — Ashford JCC (apolitical community hub)

**National orgs (2):**
- `nat_right` — Lion of Judah
- `nat_jcc` — Synagogue Council

**NOT in the archive — kept in the game under new IDs:**
- Jews for Justice: was `nat_left`, now the `left` org
- Association of American Jews: was `nat_center`, now the `center` org
- Israel Action Committee: was `right`, unchanged

### `scenarios-archived.json`

Scenarios whose body text is structurally tied to JCC-specific facilities (preschools, swim hours, programming calendars) that the 3 remaining advocacy organizations don't operate. Preserved in full, including all choice text, outcomes, and metadata.

- `jcc_pride_programming` — Pride Month at the JCC
- `jcc_modesty_hours` — Women-Only Swim Hours Under Fire

Four other JCC-flavored scenarios (`jcc_bomb_threat`, `jcc_flag_controversy`, `jcc_bds_rental`, `jcc_preschool_teacher`) were **rewritten** rather than archived — reframed so the player's advocacy org is responding to something happening at a local JCC in the community, rather than running the JCC themselves. The pre-rewrite versions of those scenarios live at `pre-org-reduction` if you need to see them.

### `promotion-system.md`

A note describing the removed local → national promotion system — the `startPromoGame()` flow, the `#promo-screen` + `#promo-budget-screen` HTML, the `G.promotionLevel` state, and everything else that powered the "win your year, get promoted to a national org" loop. With line references from `pre-org-reduction` so you can retrieve the code cleanly.

## When you might want to revive this content

- **JCC DLC / mode:** re-add the `jcc` and `nat_jcc` orgs from `orgs-removed.json`, reintroduce the scenarios from `scenarios-archived.json`, and you'd have a working "community hub" playthrough.
- **Long-form arc:** reintroduce the promotion system from `promotion-system.md` to give players a second-year national-tier loop after a successful local year.
- **More political variety:** re-add the Tikkun Olam Alliance and Jewish Federation of Metroland as alternate progressive/centrist flavors.

Nothing in this archive should be loaded by the live game. These files exist for human reference only.
