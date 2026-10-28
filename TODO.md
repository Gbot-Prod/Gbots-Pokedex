# Pokédex Website — Improvement To-Do List

A living backlog for continually improving the Pokédex site in `pokemon/`.
Each improvement run works through the list **top to bottom, completing as
many items as it can in one session**, and keeps the backlog growing with new
ideas it discovers.

Rules for each run:
- Keep going: finish an item, verify, commit, push, then immediately start the next one. Stop only after ~45 minutes of work (so runs don't overlap) or when the list is empty.
- Each item gets its own commit and push, so progress is saved even if the session ends early.
- Don't break existing features; load the site in a headless browser after every item to check.
- After each item, check it off (move it to "Done" with the date) and add any new ideas it revealed.
- Bigger changes (new framework, build tooling, tests) are welcome when they make sense; split them into steps.

## 1. Bug fixes (do these first)

## 2. Code quality
- [ ] Replace inline `onclick` handlers with `addEventListener`
- [ ] Move repeated button/font CSS into a shared `.btn` class
- [ ] Add a README describing the project and how to run it

## 3. Core Pokédex features
- [ ] Search on Enter key
- [ ] Loading state/spinner while fetching
- [ ] Show abilities (the `#pokemonAbility` element exists but is never filled)
- [ ] Show height and weight
- [ ] Show base stats (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed) as bars
- [ ] Search by Pokédex number as well as name (document it in the placeholder)
- [ ] Previous / Next buttons to step through Pokédex numbers
- [ ] Random Pokémon button
- [ ] Shiny sprite toggle
- [ ] Pokédex flavor text / description (species endpoint)
- [ ] Evolution chain display

## 4. Browsing & discovery
- [ ] Autocomplete suggestions while typing (cache the full name list)
- [ ] Browse grid of Pokémon with pagination or infinite scroll
- [ ] Filter by type
- [ ] Filter by generation
- [ ] Favorites list saved in `localStorage`
- [ ] Recently viewed list

## 5. Design & UX
- [ ] Responsive layout for phones
- [ ] Card colors themed by the Pokémon's primary type
- [ ] Dark mode
- [ ] Smooth card animations and image fade-in
- [ ] Friendly "Pokémon not found" state

## 6. Performance, accessibility & polish
- [ ] Cache API responses in memory/`sessionStorage` to avoid repeat fetches
- [ ] Meaningful `alt` text (e.g. "Pikachu sprite", "Electric type")
- [ ] Keyboard focus styles and ARIA live region for results
- [ ] Favicon and page title that updates with the current Pokémon
- [ ] Type effectiveness chart (weaknesses/resistances)
- [ ] Compare two Pokémon side by side

## Done
<!-- Move completed items here with the date and commit, e.g.
- [x] Fix typo … (2026-10-28, abc1234) -->
- [x] Fix `type2iconElement` typo (lowercase `i`) in `pokemon.js` — it throws a ReferenceError for Rock, Ghost and Dark types (2026-10-28) — renamed to type2IconElement; Rock/Ghost/Dark no longer throw
- [x] Rock/Ghost/Dark in the *first* type switch set the second icon instead of the first (2026-10-28) — first switch now sets type1IconElement for these types
- [x] Psychic icon path is `PsychicIcon.png` (missing `assets/`), and the file is actually named `PsychIconIcon.png` — rename asset to `PsychicIcon.png` and fix path (2026-10-28) — renamed asset to PsychicIcon.png and added assets/ prefix
- [x] Electric icon file is named `ElectrIconIcon.png` but code loads `ElectricIcon.png` — rename asset (2026-10-28) — renamed asset to ElectricIcon.png
- [x] Second type switch: `"normal"` case is missing `break` (falls through to Fire) (2026-10-28) — added the missing break
- [x] Card is revealed even when the fetch fails — show an error message instead (2026-10-28) — card only shown on success; 404 vs network errors get a role=alert message; body no longer vertically centred (header was pushed off-screen)
- [x] Second type icon from a previous search stays visible when the next Pokémon has one type (2026-10-28) — both type icons are hidden before the new types are applied
- [x] CSS selector `#pokemonlookupInpt` doesn't match the id `pokemonLookupInpt`, so the input is unstyled (2026-10-28) — fixed the id case so the input gets its styling (also font-style: bold → font-weight: 700)
- [x] Trim whitespace from the search input; ignore empty searches (2026-10-28) — input is trimmed; empty searches do nothing
- [x] Add `<!DOCTYPE html>`, `<meta charset>` and a viewport meta tag (2026-10-28) — added doctype, lang, UTF-8 charset (fixes 'PokÃ©mon' mojibake) and viewport meta
- [x] Replace both 18-case `switch` blocks with a single type → icon lookup map (2026-10-28) — single TYPE_ICONS map + setTypeIcon helper (~150 lines removed)
- [x] Remove `console.log(data)` and stray debug output (2026-10-28) — removed debug logging
