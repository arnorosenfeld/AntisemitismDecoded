# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Antisemitism Decoded: The Game" is a browser-based Jewish leadership simulator. Players take on the role of an executive director of a Jewish organization, making decisions across 6 rounds that affect community trust, staff morale, and donor confidence. The game includes character creation, organization selection, advisor teams, political positioning, budget management, and scenario-based decision-making with consequences across different community segments.

## Architecture

This is a **zero-dependency, single-file HTML game** with no build toolchain (no npm, no bundler).

### Canonical file

- **`index.html`** — The **canonical, single source of truth**. One self-contained file holding style, template, `GAME_DATA`, and engine code. This is what players load directly, and it is also what the editor reads and writes. Any change to game content, logic, styling, or markup must be made to `index.html`.

### Authoring: the editor is the primary tool

- **`editor.html`** — Self-contained, password-protected content editor. Pulls `GAME_DATA` from `index.html` on GitHub via `extractGameData`, lets authors edit scenarios, organizations, traits, advisors, missions, conversations, coalitions, and configuration through a GUI, then pushes the modified `index.html` back to GitHub. This is the **primary authoring path** for content changes — editing `index.html` by hand is only necessary for engine logic, markup, or style changes that the editor UI doesn't expose.

### Historical source files (not runtime)

- **`engine.js`**, **`template.html`**, **`style.css`** — Pre-assembly source files kept in the repo as a readable reference for the engine logic, HTML structure, and styling that live inlined in `index.html`. **They are not built into `index.html` automatically** — `index.html` is edited directly. If you change one of these files, you must apply the same change to `index.html` or the change will not reach the game. In practice, prefer editing `index.html` directly; the source files may lag the canonical version.

### Key Engine Concepts

- **State object `G`** — Single mutable object holding all game state (character, org, stats, round, political position, budget, segment approvals, inbox, etc.)
- **`GAME_DATA`** — A global variable declared inside `index.html`. Contains all content and configuration. The editor locates it via a `/* GAME_DATA_START */` ... `/* GAME_DATA_END */` marker pair (with a legacy `var GAME_DATA = { ... }` fallback).
- **Screen system** — `showScreen(id)` toggles `.screen.active` class; screens are `password-screen`, `intro-screen`, `char-screen`, `org-screen`, `mission-screen`, `advisor-screen`, `budget-screen`, `briefing-screen`, `game-screen`, `end-screen`, `promo-screen`, `promo-budget-screen`.
- **Segment system** — Community trust is a weighted composite of approval ratings across demographic segments (Orthodox, Reform, Conservative, unaffiliated, young adults, older adults), each with political centers and comfort ranges.
- **Political system** — Position (0=far-left to 100=far-right) and clout (accumulated political capital). Choices have `politicalLean` that shifts position.
- **Stat thresholds** — Any core stat (trust/morale/donors) dropping to 20 or below triggers game-over. Score above 80 at year-end earns promotion.

### No Test Suite or Linter

There are no automated tests or linting configured. Test changes by opening `index.html` in a browser.
