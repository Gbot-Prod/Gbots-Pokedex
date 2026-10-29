# Pokédex Website — Improvement To-Do List

A living backlog for continually improving the Pokédex site in `pokemon/`.
Each improvement run works through the list **top to bottom, completing as
many items as it can in one session**, and keeps the backlog growing with new
ideas it discovers.

Rules for each run:
- Keep going: finish an item, verify, commit, push, then immediately start the next one. Stop only after ~20 minutes of work (runs are hourly, so they must not overlap) or when the list is empty.
- Each item gets its own commit and push, so progress is saved even if the session ends early.
- Don't break existing features; load the site in a headless browser after every item to check.
- After each item, check it off (move it to "Done" with the date) and add any new ideas it revealed.
- Bigger changes (new framework, build tooling, tests) are welcome when they make sense; split them into steps.

## 1. Bug fixes (do these first)
- [ ] Cry button does nothing in Safari (no .ogg support): check `new Audio().canPlayType("audio/ogg")` and hide the button (or explain) when unsupported

## 2. Code quality
- [ ] Extend the smoke tests to forms, moves, sorting, keyboard shortcuts and the cry button (add `moves`/`varieties`/`cries` to the fixtures)
- [ ] Opt-in live check: `npm run check:live` runs the smoke flow against the real PokéAPI (pikachu, gengar, farfetchd, 25) to catch API changes the fixtures hide

## 3. Core Pokédex features
- [ ] Moves: add TM / egg / tutor tabs and a game selector (the level-up list currently always uses the newest game)

## 4. Browsing & discovery
- [ ] "Did you mean" can list several forms of one species (Gengar, Gengar Mega, Gengar Gmax); prefer distinct species first

## 5. Design & UX
- [ ] Format the card number as "#0025" to match the browse tiles (currently "Pokemon no#25")
- [ ] Forms show their internal id ("Pokemon no#10034" for Mega Charizard X); show the species' dex number instead and label the form
- [ ] Show official display names from `species.names` ("Farfetch’d", "Mr. Mime", "Nidoran♀") instead of title-casing the slug ("Farfetchd", "Nidoran F")
- [ ] Evolution methods: include time of day (Espeon day / Umbreon night), held items and trade items
- [ ] Metric/imperial toggle for height and weight

## 6. Performance, accessibility & polish
- [ ] Persist move details (type/power) in localStorage: opening a moves list fires 20–90 requests on every visit
- [ ] Cache by canonical id: "gengar" and "94" currently fetch the same Pokémon twice
- [ ] Offline support: service worker caching the app shell and recently viewed Pokémon (PWA manifest)

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
- [x] Keyboard focus styles and ARIA live region for results (2026-10-28) — removed outline:none overrides; yellow :focus-visible ring; visually-hidden aria-live region announces each loaded Pokémon
- [x] Favicon and page title that updates with the current Pokémon (2026-10-28) — Poké Ball SVG favicon; title becomes 'Gengar #94 · Pokédex' and resets on Clear
- [x] Type effectiveness chart (weaknesses/resistances) (2026-10-28) — 'Type matchups' section: weak to / resists / immune with type icons and 4×–0× multipliers, computed from each type's damage_relations
- [x] Compare two Pokémon side by side (2026-10-28) — Compare section with two autocompleting inputs → table of stats/total/height/weight with the higher value highlighted; ⚖️ on the card pre-fills the current Pokémon
- [x] Names with punctuation fail: "Farfetch'd", "Mr. Mime", "Nidoran♀", "Type: Null" must map to the API slugs (`farfetchd`, `mr-mime`, `nidoran-f`, `type-null`) (2026-10-28) — normalizeQuery maps ♀/♂, strips accents and . ' ’ : so official spellings resolve to API slugs
- [x] After a number/random/prev/next search the input shows the number (e.g. "95"); show the loaded Pokémon's name instead (2026-10-28) — input is replaced with the loaded name unless the user has started typing a different search
- [x] Favorite ☆ is hard to see on yellow (Electric) cards and the compare "winner" green is low-contrast in dark mode (2026-10-28) — dark text-shadow outline on the star; compare winner colour is a --win token with a lighter green in dark mode
- [x] Commit an automated smoke test: Playwright script + mocked PokéAPI fixtures, runnable with `npm test` (search, not-found, prev/next, favorites) (2026-10-28) — tests/smoke.test.js (node:test + Playwright) with trimmed fixtures in tests/fixtures; 5 tests pass via npm test; README documents it
- [x] Add ESLint + Prettier with an `npm run lint` script and fix what it reports (2026-10-28) — eslint.config.js (recommended rules) + .prettierrc (4 spaces, 120 cols); npm run lint / npm run format; fixed unused catch bindings and formatted the code
- [x] Split pokemon.js — step 1: page loads as an ES module; pure helpers moved to utils.js with 6 node:test unit tests (2026-10-28) — README now says to serve over HTTP (npm start)
- [x] Split pokemon.js — step 2: PokéAPI access, response caching and the cached entry list moved to `api.js` (2026-10-28) — pokemon.js imports fetchJson/getAllPokemonEntries
- [x] Split pokemon.js — step 3a: comparison moved to `compare.js` (`initCompare`), `pickSprite`/`STAT_LABELS` moved to utils.js (2026-10-28)
- [x] Split pokemon.js — step 3b: browse grid, favorites and recently viewed moved to `lists.js` (`initLists`); TYPE_ICONS/MAX_DEX_NUMBER moved to utils.js (2026-10-29) — pokemon.js down from ~1,100 to ~630 lines
- [x] Split pokemon.js — step 4: decided against Vite for now (2026-10-29) — 5 small native ES modules with no runtime dependencies load fine via `npm start`; revisit if we add npm runtime packages, TypeScript or a framework
- [x] Shareable URLs: reflect the current Pokémon in `?pokemon=gengar` and support Back/Forward (2026-10-29) — current Pokémon kept in ?pokemon=<name> (pushState); deep links load on open, Back/Forward restore, Clear removes it; new smoke test
- [x] Keyboard shortcuts: ←/→ for previous/next, `/` to focus search, `s` to toggle shiny (2026-10-29) — ←/→ prev/next, / focuses search, S toggles shiny; ignored while typing or with modifiers; hint line shown on devices with hover
- [x] Alternate forms switcher (Mega, Alolan, Galarian…) from `species.varieties` (2026-10-29) — 'Forms:' buttons from species.varieties (Standard / Mega X / Alola / Gmax…), current form pressed; hidden for single-form species; formLabel helper + unit test
- [x] Play the Pokémon's cry (`cries.latest`) with a small speaker button (2026-10-29) — 🔊 button next to the name plays cries.latest (falls back to legacy), C shortcut; hidden when there's no cry
- [x] Moves list (level-up moves with level, type and power) in a collapsible section (2026-10-29) — collapsible 'Level-up moves (N)' table from the newest main-series game (explicit game order, since version-group ids aren't chronological); type/power fetched only when opened; levelUpMoves helper + unit test
- [x] Browse sorting by number ↑/↓ and name A–Z/Z–A, combined with the type/generation filters (2026-10-29) — split from "type icons on tiles and sorting"
- [x] Show type icons on browse tiles (build an id → types map from the 18 cached /type responses, loaded lazily) (2026-10-29) — id → types map built lazily from the 18 cached /type responses (slot order); browse, favorites and recent tiles show small type icons
- [x] "Did you mean" should also match substrings/subsequences (e.g. "charz" → Charizard) (2026-10-29) — suggestionScore ranks prefix > substring > in-order letters (charz → Charizard) > typos; isSubsequence/suggestionScore unit-tested
