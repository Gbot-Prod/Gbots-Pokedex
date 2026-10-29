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

## 2. Code quality

## 3. Core Pokédex features

## 4. Browsing & discovery

## 5. Design & UX
- [ ] Missing sprites show an empty space; use a Poké Ball placeholder (assets/favicon.svg) instead
- [ ] On phones the open suggestion list covers the Compare button; close it after a pick and/or open it upwards near the bottom of the screen

## 6. Performance, accessibility & polish
- [ ] Lighthouse performance is 0.8 (first paint 3.1 s): self-host or `preload` the Inter font with `font-display: swap`, and defer the browse grid until after the card renders
- [ ] Tile type icons wait for 18 /type requests on every new session; store the id → types map in localStorage like the name list
- [ ] Offline: Random and Previous/Next should pick from cached Pokémon instead of failing when offline
- [ ] Offline tile check does one Cache API lookup per tile; read `cache.keys()` once into a Set instead
- [ ] Service worker: cap the runtime cache (sprites and API responses grow without limit)

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
- [x] Cry button does nothing in Safari (no .ogg support): check `new Audio().canPlayType("audio/ogg")` and hide the button (or explain) when unsupported (2026-10-29) — button (and C shortcut) hidden when the browser can't play Ogg Vorbis; checked with canPlayType stubbed to ''
- [x] Extend the smoke tests to forms, moves, sorting, keyboard shortcuts and the cry button (add `moves`/`varieties`/`cries` to the fixtures) (2026-10-29) — fixtures now regenerated from the live API by tests/build-fixtures.mjs (npm run fixtures) and include moves, varieties, cries; 5 new tests (forms, moves, sorting, keyboard, cry) — 20 tests pass
- [x] Opt-in live check: `npm run check:live` runs the smoke flow against the real PokéAPI (pikachu, gengar, farfetchd, 25) to catch API changes the fixtures hide (2026-10-29) — npm run check:live runs the smoke suite with LIVE_API=1 (no mocks) — 12/12 pass against the real API; added a Farfetch'd test + fixture
- [x] Moves: Level-up / TM / Egg / Tutor tabs for the newest game (2026-10-29) — `learnset()` groups by learn method; level column hidden for non-level-up tabs; fixtures keep all SV moves; unit + smoke tests. Split from "tabs and a game selector"
- [x] Moves: game selector (the moves list always uses the newest game that has a level-up learnset) (2026-10-29) — game <select> listing every main-series game with a level-up learnset (named, newest first); choice persists while browsing and falls back to the newest game
- [x] "Did you mean" can list several forms of one species (Gengar, Gengar Mega, Gengar Gmax); prefer distinct species first (2026-10-29) — forms rank below species with the same score and are skipped when their species is already suggested ('gengr' → just Gengar)
- [x] Format the card number as "#0025" to match the browse tiles (currently "Pokemon no#25") (2026-10-29) — card shows '#0025' via a shared formatDexNumber helper (also used by tiles), unit-tested
- [x] Forms show their internal id ("Pokemon no#10034" for Mega Charizard X); show the species' dex number instead and label the form (2026-10-29) — card, title and screen-reader announcement use the species' dex number; forms add a label ('#0006 · Mega X form')
- [x] Show official display names from `species.names` ("Farfetch’d", "Mr. Mime", "Nidoran♀") instead of title-casing the slug ("Farfetchd", "Nidoran F") (2026-10-29) — after the species loads, the card/title/search box use species.names (Farfetch’d, Nidoran♀, Mr. Mime); forms read 'Charizard (Mega X)'
- [x] Sprite alt text and the screen-reader announcement still use the slug name ("Farfetchd sprite") because they're set before species data arrives; update them in `applyDisplayName` (2026-10-29) — applyDisplayName refreshes the sprite alt ('Farfetch’d sprite') and the live-region text with the official name
- [x] Make smoke tests fail fast: `page.setDefaultTimeout(5000)` and fail a test as soon as a `pageerror` fires (a missing export made the suite hang for minutes) (2026-10-29) — 5s default timeout (15s for check:live) and page errors logged as they happen; a broken import now fails all 13 smoke tests in ~1 min instead of hanging
- [x] Catch broken imports between modules in lint (`eslint-plugin-import` `import/named`), since ESLint alone missed a removed export (2026-10-29) — eslint-plugin-import-x with import-x/named, no-unresolved and no-cycle on the site modules; verified it flags a removed export
- [x] Moves table: Physical/Special/Status category badge and accuracy columns (2026-10-29) — from the move request already made; fixtures + smoke test updated. Split from "category, accuracy and TM numbers"
- [x] Moves table: show TM numbers on the TM tab (move → `machines` for the selected game → item name like "tm085") (2026-10-29) — TM tab's first column shows the TM number from the move's machine record for the selected game (e.g. TM08 Body Slam in Red & Blue)
- [x] Compare: "Weak to / Resists / Immune to (types)" rows, fewer weaknesses highlighted as better (2026-10-29) — matchup math moved to a shared, unit-tested `damageMultipliers()` in utils.js. Split from "matchups row and three Pokémon"
- [x] Compare: allow comparing three Pokémon (2026-10-29) — optional third input; table, best-value highlighting (skipped on full ties) and matchup rows work for 2 or 3; inputs stack on phones; smoke test
- [x] Tiles (browse/favorites/recent) still show slug-based names for default forms ("Zygarde 50", "Aegislash Shield", "Farfetchd"); show official display names there too (2026-10-29) — tiles use the species name from one cached /pokemon-species list (Aegislash, Zygarde) plus an exceptions map for punctuation (Farfetch’d, Nidoran♀, Mr. Mime, Type: Null); speciesDisplayName unit-tested
- [x] Evolution methods: include time of day (Espeon day / Umbreon night), held items and trade items (2026-10-29) — describeEvolution uses the newest game's detail and adds time of day, held/trade items, trade partners, known moves/move types and locations (Espeon 'Friendship (day)', Scizor 'Trade holding Metal Coat', Leafeon 'Leaf Stone'); unit-tested
- [x] Metric/imperial toggle for height and weight (2026-10-29) — 'Show lbs / ft' toggle under height/weight (1′04″, 13.2 lbs), remembered in localStorage; formatHeight/formatWeight unit-tested
- [x] Persist move details (type/power) in localStorage: opening a moves list fires 20–90 requests on every visit (2026-10-29) — getMoveSummary/getMachineItemName in api.js keep small summaries in localStorage (batched writes); Pikachu's TM tab in a new tab went from 106 requests to 0 (~39 KB stored)
- [x] CI: a GitHub Actions workflow running `npm run lint` and `npm test` on every push (a red commit slipped through locally this run) (2026-10-29) — .github/workflows/ci.yml runs npm ci, installs Chromium, then npm run lint and npm test on every push and PR
- [x] TM tab: sort rows by TM number once the numbers load (currently alphabetical) (2026-10-29) — once TM numbers load the rows are re-ordered TM01, TM02… (then HM/TR, then moves without a machine)
- [x] Compare table: follow the metric/imperial setting and use display names (Farfetch’d, "Charizard (Mega X)") in its header (2026-10-29) — header uses pokemonDisplayName (Farfetch’d, Charizard (Mega X), Zygarde); height/weight rows follow the units toggle and re-render when it changes; unit-tested
- [x] Searching a species whose default form has a suffixed name fails: "zygarde", "aegislash", "deoxys", "giratina" 404 on /pokemon/{name}; fall back to the species' default variety (2026-10-29) — fetchPokemon() in api.js falls back to the species' default variety on a 404 (zygarde → zygarde-50, aegislash → aegislash-shield) and skips the doomed request when the cached name list says it doesn't exist; used by search and compare; smoke test + fixtures
- [x] Evolution methods: show gender requirements (e.g. Combee → Vespiquen "female only") and other conditions PokéAPI provides (2026-10-29) — conditions in parentheses: gender (Combee 'Lv. 21 (female)'), Tyrogue's Atk/Def comparison, party species/type (Mantyke), rain (Goodra), upside-down console (Malamar), Beauty; unit-tested
- [x] Move summary cache in localStorage never expires: add a timestamp/version and cap its size (2026-10-29) — cache moved to pokedex:moves:v2 with per-entry savedAt; entries older than 30 days dropped and storage capped at 3,000 entries (pruneCacheEntries, unit-tested); old v1 key removed
- [x] Cache by canonical id: "gengar" and "94" currently fetch the same Pokémon twice (2026-10-29) — fetchPokemon remembers each loaded Pokémon under /pokemon/<id>, /pokemon/<name> (with and without trailing slash): gengar → 94 → #094 → next → prev made 2 requests instead of 5
- [x] Offline step 1: web manifest + service worker (2026-10-29) — app shell stale-while-revalidate, PokéAPI/sprites network-first with cached fallback; viewed Pokémon reload offline with sprites; mocked tests block service workers. Split from "Offline support"
- [x] Automated accessibility check: run axe-core against the page in the smoke tests (card, browse grid, compare table, dark mode) (2026-10-29) — axe-core smoke tests (card, moves, compare, browse; light + dark) fail on serious/critical issues. Fixed what they found: page text now dark ink in light mode, blue buttons and 11 type theme shades darkened to ≥4.5:1, compare 'winner' green darkened, Pokédex number no longer a skipped-level heading
- [x] Smoke tests for the units toggle (card + compare table) and for display names in the compare header (2026-10-29) — smoke test covers card + compare table switching to imperial, the choice surviving a reload, and 'Farfetch’d' in the compare header
- [x] "Did you mean" buttons show slug names for default forms ("Zygarde 50", "Farfetchd"); use the species display names like the tiles do (2026-10-29) — suggestions and autocomplete use entryDisplayName (Farfetch’d, Nidoran♀, Zygarde); species list fetch shared via getSpeciesSlugs in api.js; forms of an already-suggested species are skipped by species name ('zygard' → just Zygarde)
- [x] "Install app" button using the `beforeinstallprompt` event, now that there's a manifest and service worker (2026-10-29) — button next to the theme toggle appears on beforeinstallprompt, opens the browser's install prompt and hides once used or installed; smoke test with a simulated event. Also fixed the fixed buttons covering the search box on phones (extra top padding)
- [x] Offline step 2a: "You're offline" banner driven by online/offline events, with a smoke test (2026-10-29) — split from offline step 2
- [x] Offline step 2b: mark which tiles/recent Pokémon are available offline (check the service worker's runtime cache) and add an end-to-end offline reload test with the service worker enabled (2026-10-29) — while offline, tiles whose Pokémon isn't in the service worker's cache are dimmed (aria-disabled); end-to-end offline reload test runs in check:live (skipped in the mocked suite, which blocks service workers)
- [x] Service worker: bump `SHELL_CACHE` automatically (e.g. a build step or a version from package.json) — today an edit to the JS needs a manual version bump or users get the old shell once (2026-10-29) — solved without a build step: the shell is now network-first with cache: no-cache revalidation (fresh files whenever online, cached copy offline), so there's no version to bump and no mix of old/new modules; verified an edited CSS file is picked up on the next load
- [x] Run the axe accessibility check at phone width (375px) too, and with the install/offline UI visible (2026-10-29) — axe now runs at 1280px and 375px in both themes with the install button and offline banner showing; it caught the Random/Clear buttons failing contrast at phone size (smaller text) — darkened to ≥4.6:1
- [x] Shareable comparisons: reflect the compared Pokémon in the URL (`?compare=pikachu,gengar`) and restore them on load (2026-10-29) — compared Pokémon kept in ?compare=a,b[,c] (replaceState, alongside ?pokemon=) and restored on load; smoke test
- [x] Ability descriptions: show each ability's short effect (ability endpoint `effect_entries`) in a tooltip or expandable chip (2026-10-29) — ability chips are buttons (aria-expanded) that show the latest English game text below the chips, fetched on click; abilityDescription helper unit-tested; smoke test
- [x] Combobox step 1: main search uses a custom ARIA combobox (combobox.js) — up to 8 matches with sprites, official names and dex numbers; ↑/↓/Enter/Escape and click; numbers match by id (2026-10-29) — matchEntries unit-tested, keyboard smoke test. Split from "replace the datalist"
- [x] Combobox step 2: compare inputs use the custom combobox (auto-wrapped for positioning); the 1,300-option `<datalist>` and `loadNameSuggestions` are gone (2026-10-29)
- [x] Lighthouse CI in the GitHub workflow with performance/accessibility budgets (2026-10-29) — lighthouserc.json budgets (a11y ≥0.95 and best practices ≥0.9 fail the build; performance/SEO warn) run via npm run lighthouse and in CI; local run: perf 0.8, a11y 1.0, BP 1.0, SEO 0.91
- [x] Some newer forms have no sprite in PokéAPI's repo (e.g. id 10301), so tiles/suggestions log a 404; use `sprites.front_default` from the API (null when missing) or skip ids known to be missing (2026-10-29) — setSprite/spriteUrl in api.js skip the 12 form sprites known to be missing and remember any other failure in localStorage, so a 404 happens at most once per browser; used by combobox, tiles and evolution; verified no 404s typing pikachu/eevee/zyg/ogerpon…; smoke test
- [x] Compare: radar (spider) chart of the six base stats in inline SVG, one colour per Pokémon (2026-10-29) — inline-SVG hexagon chart under the comparison table with one translucent polygon per Pokémon, grid rings, stat labels and a legend; scales to max(150, highest stat); role=img with a summary label; radarPoints unit-tested
- [x] Combobox: show forms with their species number and label ("Charizard (Mega X) · #0006") instead of "#10034" (2026-10-29) — forms are matched to their species (longest slug prefix, entrySpecies) and shown as 'Charizard (Mega X) #0006' in suggestions and favorites/recent tiles; unit-tested
- [x] Combobox: when the search box is focused and empty, offer recently viewed Pokémon (2026-10-29) — focusing/clicking the empty search box lists recently viewed Pokémon (listbox labelled 'Recently viewed'), with the same keyboard support; smoke test
- [x] Unit tests for api.js (fetchPokemon species fallback, id/name aliasing, move-cache pruning, missing-sprite memory) with stubbed fetch/localStorage in Node (2026-10-29) — tests/api.test.mjs stubs fetch/localStorage/sessionStorage and covers the species fallback, no species retry for numbers, id/name reuse, move-summary caching and missing-sprite memory (5 tests)
- [x] Combobox: matched text is underlined in each suggestion (`<mark>`, "Charizard" for "char") (2026-10-29) — split from "highlight + remove recent"
- [x] Combobox: let users remove an entry from the "Recently viewed" suggestions (e.g. Delete/Shift+Delete on the highlighted option, announced via a live region) (2026-10-29) — Delete on a highlighted recent suggestion removes it (removeFromRecent also updates the tiles), keeps a sensible highlight and announces 'X removed from recently viewed' in a status region; listbox label mentions the shortcut; smoke test
- [x] Radar chart: lighter polygon colours in dark mode (the blue is dim on the dark table) and highlight a Pokémon's polygon when its legend entry or column is hovered/focused (2026-10-29) — series colours moved to CSS variables with lighter dark-mode shades; hovering/focusing a legend entry or hovering a table column highlights that Pokémon's polygon and dims the others; smoke test
