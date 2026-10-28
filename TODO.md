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

## 3. Core Pokédex features

## 4. Browsing & discovery

## 5. Design & UX

## 6. Performance, accessibility & polish
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
- [x] Replace inline `onclick` handlers with `addEventListener` (2026-10-28) — buttons wired up with addEventListener in pokemon.js
- [x] Move repeated button/font CSS into a shared `.btn` class (2026-10-28) — shared .btn rule; buttons only set their colour; removed duplicate .hidden rule
- [x] Add a README describing the project and how to run it (2026-10-28) — README.md with layout, how to run and how to contribute
- [x] Search on Enter key (2026-10-28) — search controls wrapped in a <form role=search>; Enter and the button both submit
- [x] Loading state/spinner while fetching (2026-10-28) — CSS spinner with role=status; search button disabled while fetching
- [x] Show abilities (the `#pokemonAbility` element exists but is never filled) (2026-10-28) — ability chips (hidden ability dashed); added formatName helper for hyphenated names
- [x] Show height and weight (2026-10-28) — metric height/weight tiles (API dm/hg converted to m/kg)
- [x] Show base stats (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed) as bars (2026-10-28) — six stat bars scaled to 255 (role=meter, red→green) plus base stat total
- [x] Search by Pokédex number as well as name (document it in the placeholder) (2026-10-28) — accepts 25 / #025 / 'mr mime'; placeholder updated; refactored into loadPokemon/renderPokemon with stale-response guard and sprite fallbacks
- [x] Previous / Next buttons to step through Pokédex numbers (2026-10-28) — ‹ › buttons in the card header, disabled at #1/#1025; forms navigate by species number
- [x] Random Pokémon button (2026-10-28) — green Random button picks a dex number 1–1025
- [x] Shiny sprite toggle (2026-10-28) — ✨ Shiny toggle (aria-pressed) over the sprite; choice persists while browsing; sprite fallback chain moved to pickSprite
- [x] Pokédex flavor text / description (species endpoint) (2026-10-28) — genus (e.g. 'Shadow Pokémon') and latest English Pokédex entry from the species endpoint, loaded after the main card
- [x] Evolution chain display (2026-10-28) — clickable stages with sprites and method (Lv. 16 / Water Stone / Friendship); branching families wrap into a grid; hidden for single-stage Pokémon
- [x] Autocomplete suggestions while typing (cache the full name list) (2026-10-28) — native <datalist> filled on first focus from /pokemon?limit=2000, cached in localStorage
- [x] Browse grid of Pokémon with pagination or infinite scroll (2026-10-28) — paginated grid (24/page, 43 pages) of National Dex tiles built from the cached entry list; tiles load the Pokémon. Also: hidden card is now display:none with a reveal animation (it left a big empty gap)
- [x] Filter by type (2026-10-28) — type <select> on the browse grid; /type/{name} members cached per type
- [x] Filter by generation (2026-10-28) — generation <select> (Gen 1 Kanto … Gen 9 Paldea) using static dex ranges; combines with the type filter
- [x] Favorites list saved in `localStorage` (2026-10-28) — ☆/★ toggle next to the name; favorites grid above Browse persists in localStorage (shared .tileGrid styles)
- [x] Recently viewed list (2026-10-28) — last 10 Pokémon (deduped, newest first) in a compact grid, stored in localStorage, with Clear history
- [x] Responsive layout for phones (2026-10-28) — <main class=page> max 44rem; search form wraps under 600px; smaller sprite, vertical evolution flow, denser tile grid; no horizontal scroll at 375px
- [x] Card colors themed by the Pokémon's primary type (2026-10-28) — CSS custom properties (--type-strong/light/deep) set from a TYPE_COLORS map for the primary type
- [x] Dark mode (2026-10-28) — colour tokens on :root; follows prefers-color-scheme, with a 🌙/☀️ toggle saved in localStorage (applied before first paint); card body becomes a dark tint of the type colour
- [x] Smooth card animations and image fade-in (2026-10-28) — card fades/slides in, tiles stagger in, sprites fade in once loaded (fadeInImage); all motion disabled under prefers-reduced-motion
- [x] Friendly "Pokémon not found" state (2026-10-28) — names the failed query, explains valid number range, and offers up to 3 'Did you mean' buttons (prefix match + edit distance); network errors get their own message
- [x] Cache API responses in memory/`sessionStorage` to avoid repeat fetches (2026-10-28) — fetchJson keeps an in-memory promise cache (dedupes in-flight requests) plus sessionStorage for payloads ≤150k chars; failures aren't cached
- [x] Meaningful `alt` text (e.g. "Pikachu sprite", "Electric type") (2026-10-28) — sprite alt 'Gengar sprite' / 'Shiny Gengar sprite', type icons 'Ghost type' (+ title tooltip); decorative tile sprites keep alt="" since the name is next to them
