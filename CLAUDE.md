# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Antisemitism Decoded: The Game" is a browser-based Jewish leadership simulator. Players take on the role of an executive director of a Jewish organization, making decisions across 6 rounds that affect community trust, staff morale, and donor confidence. The game includes character creation, organization selection, advisor teams, political positioning, budget management, and scenario-based decision-making with consequences across different community segments.

## Architecture

This is a **zero-dependency, single-file HTML game** with no build toolchain (no npm, no bundler).

### Source Files (root)
- **`data.json`** — All game content: scenarios, organizations, traits, advisors, missions, conversations, configuration, landing page text. This is the single source of truth for game content.
- **`engine.js`** — Game logic: state management (`G` object), screen transitions, HUD rendering, scenario/choice resolution, segment approval calculations, political system, budget/investment system, inbox, coalitions, conversations, and end-game scoring.
- **`template.html`** — HTML structure for all game screens (password gate, intro/landing, character creation, org selection, mission, advisors, budget allocation, briefing, game play, end screen, promotion).
- **`style.css`** — All game styling. Newspaper/broadsheet aesthetic with Merriweather serif + Merriweather Sans.
- **`editor.html`** — Self-contained game content editor (separate app). Password-protected admin tool for editing `data.json` content via a GUI with sidebar navigation.
- **`index.html`** — The pre-built, assembled single-file game (style + template + data + engine concatenated). This is what players load directly.

### Build

```bash
bash build.sh
```

Assembles `game/template.html`, `game/data.json`, `game/engine.js`, and `game/style.css` into `dist/game.html`. Note: the build script reads from a `game/` subdirectory, but the source files currently live at the repo root. The pre-built `index.html` at root is the playable version.

### Key Engine Concepts

- **State object `G`** — Single mutable object holding all game state (character, org, stats, round, political position, budget, segment approvals, inbox, etc.)
- **`GAME_DATA`** — Parsed from `data.json`, injected as a global variable. Contains all content and configuration.
- **Screen system** — `showScreen(id)` toggles `.screen.active` class; screens are `password-screen`, `intro-screen`, `char-screen`, `org-screen`, `mission-screen`, `advisor-screen`, `budget-screen`, `briefing-screen`, `game-screen`, `end-screen`, `promo-screen`, `promo-budget-screen`.
- **Segment system** — Community trust is a weighted composite of approval ratings across demographic segments (Orthodox, Reform, Conservative, unaffiliated, young adults, older adults), each with political centers and comfort ranges.
- **Political system** — Position (0=far-left to 100=far-right) and clout (accumulated political capital). Choices have `politicalLean` that shifts position.
- **Stat thresholds** — Any core stat (trust/morale/donors) dropping to 20 or below triggers game-over. Score above 80 at year-end earns promotion.

### No Test Suite or Linter

There are no automated tests or linting configured. Test changes by opening `index.html` in a browser.
