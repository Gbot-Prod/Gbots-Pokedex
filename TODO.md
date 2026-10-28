# Pokédex Website — Improvement To-Do List

A living backlog for continually improving the Pokédex site in `pokemon/`.
Each improvement run should take the **first unchecked item** (top to bottom),
implement it, check it off with a short note, and add any new ideas it
discovers to the right section.

Rules for each run:
- One item per run. Keep the change small and working.
- Don't break existing features; open `pokemon/pokemon.html` in a headless browser to check.
- Commit with a clear message describing the item.

## 1. Bug fixes (do these first)
- [ ] Fix `type2iconElement` typo (lowercase `i`) in `pokemon.js` — it throws a ReferenceError for Rock, Ghost and Dark types
- [ ] Rock/Ghost/Dark in the *first* type switch set the second icon instead of the first
- [ ] Psychic icon path is `PsychicIcon.png` (missing `assets/`), and the file is actually named `PsychIconIcon.png` — rename asset to `PsychicIcon.png` and fix path
- [ ] Electric icon file is named `ElectrIconIcon.png` but code loads `ElectricIcon.png` — rename asset
- [ ] Second type switch: `"normal"` case is missing `break` (falls through to Fire)
- [ ] Card is revealed even when the fetch fails — show an error message instead
- [ ] Second type icon from a previous search stays visible when the next Pokémon has one type
- [ ] CSS selector `#pokemonlookupInpt` doesn't match the id `pokemonLookupInpt`, so the input is unstyled
- [ ] Trim whitespace from the search input; ignore empty searches
- [ ] Add `<!DOCTYPE html>`, `<meta charset>` and a viewport meta tag

## 2. Code quality
- [ ] Replace both 18-case `switch` blocks with a single type → icon lookup map
- [ ] Remove `console.log(data)` and stray debug output
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
