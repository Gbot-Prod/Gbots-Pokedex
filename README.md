# Gbot's Pokédex

A Pokédex website built with plain HTML, CSS and JavaScript on top of
[PokéAPI](https://pokeapi.co). Search by name or number to see a Pokémon's
sprite (and shiny), types, description, abilities, base stats, type matchups
and evolution chain. You can also browse the whole National Dex with type and
generation filters, keep favorites, compare two Pokémon, and switch to dark
mode.

## Project layout

```
pokemon/
  pokemon.html   page markup
  pokemon.css    styles
  pokemon.js     main card: search, rendering, navigation, theme (ES module entry)
  lists.js       browse grid with filters, favorites and recently viewed
  compare.js     side-by-side comparison table
  combobox.js    accessible search autocomplete (sprites, keyboard navigation)
  quiz.js        "Who's that Pokémon?" silhouette quiz
  team.js        team builder (6 slots) with a type-coverage chart
  typechart.js   interactive 18×18 type effectiveness chart
  api.js         PokéAPI requests with in-memory/sessionStorage caching
  utils.js       pure helpers (name formatting, query normalisation, …)
  sw.js          service worker: offline app shell + cached PokéAPI data/sprites
  manifest.webmanifest  install-as-app metadata
  assets/        type icons (one PNG per type, e.g. FireIcon.png)
tests/
  smoke.test.js  browser tests (Playwright) against mocked PokéAPI data
  utils.test.mjs unit tests for utils.js
  combobox.test.mjs  unit tests for the autocomplete matching
  api.test.mjs   unit tests for api.js (fetch and storage stubbed)
  features.test.mjs  unit tests for the quiz, team and type-chart helpers
  fixtures/      trimmed PokéAPI responses used by the tests
  build-fixtures.mjs  regenerates the fixtures from the live API
TODO.md          living improvement backlog
```

## Running it

There's no build step, but the page uses ES modules, so it has to be served
over HTTP (opening the file directly with `file://` won't load the scripts).
Run `npm start`, or:

```sh
cd pokemon
python3 -m http.server 8000
# then open http://localhost:8000/pokemon.html
```

An internet connection is needed, since all Pokémon data and sprites come
from PokéAPI.

## Tests

The smoke tests drive the page in headless Chromium with PokéAPI mocked out,
so they run offline:

```sh
npm install                       # installs Playwright, ESLint and Prettier
npx playwright install chromium   # first time only
npm test
```

`npm run check:live` runs the same smoke tests against the real PokéAPI, to
catch API changes the fixtures would hide.

The fixtures are trimmed copies of real PokéAPI responses; `npm run fixtures`
regenerates them from the live API (see `tests/build-fixtures.mjs`).

`npm run lighthouse` runs Lighthouse with the budgets in `lighthouserc.json`
(CI runs it on every push).

Lint and formatting checks (ESLint + Prettier) run with `npm run lint`;
`npm run format` rewrites files in the house style.

## Contributing

Pick the next unchecked item in [`TODO.md`](TODO.md), implement it, check it
off in the "Done" section, and add any new ideas you discover.
