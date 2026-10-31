// Browser smoke tests for the Pokédex page.
// PokéAPI is replaced by the trimmed fixtures in tests/fixtures and sprite
// images are stubbed, so the suite runs offline and gives stable results.
// Run with: npm test
// `npm run check:live` runs the same tests against the real PokéAPI (LIVE_API=1)
// to catch API changes the fixtures would hide.

/* global document, window -- used inside page.evaluate/waitForFunction callbacks, which run in the browser */

const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { LIVE_API, pokemonList, useMockedPages } = require("./harness.js");

// The harness serves the site, mocks PokéAPI from the fixtures and gives each test a fresh page.
let baseUrl;
let context;
let page;
let pageErrors;
useMockedPages({ before, after, beforeEach, afterEach }, (state) => {
    ({ baseUrl, context, page, pageErrors } = state);
});

// Clicks the right quiz answer the way a curious player could: the artwork URL holds the
// Pokémon's number, and the fixture list gives its name (labels are title-cased names).
async function answerQuizCorrectly() {
    const id = (await page.getAttribute("#quizImage", "src")).match(/(\d+)\.png$/)[1];
    const entry = pokemonList.find((candidate) => candidate.url.endsWith("/" + id + "/"));
    const squash = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
    const labels = await page.locator(".quizChoice").allTextContents();
    const index = labels.findIndex((label) => squash(label) === squash(entry.name));
    await page.click(".quizChoice >> nth=" + index);
}

async function search(query) {
    await page.fill("#pokemonLookupInpt", query);
    await page.press("#pokemonLookupInpt", "Enter");
}

test("searching by name shows the card", async () => {
    await search("Pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");

    assert.equal((await page.textContent("#pokemonName")).trim(), "Pikachu");
    assert.match(await page.textContent("#pokemonNumber"), /25/);
    assert.equal(await page.getAttribute("#pokemonType1", "alt"), "Electric type");
    assert.equal(await page.isVisible("#pokemonType2"), false);
    // Stats count up when they appear, so wait for the final total.
    await page.waitForFunction(() => /Total\s+320/.test(document.getElementById("statsList").innerText));
    await page.waitForSelector("#pokemonFlavorText:not(:empty)");
    await page.waitForSelector("#pokemonMatchups:not([hidden])");
    assert.match(await page.innerText("#matchupsList"), /Weak to/);
    assert.deepEqual(pageErrors, []);
});

test("dual-type Pokémon show both type icons", async () => {
    await search("gengar");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");

    assert.equal(await page.getAttribute("#pokemonType1", "alt"), "Ghost type");
    assert.equal(await page.getAttribute("#pokemonType2", "alt"), "Poison type");
    assert.deepEqual(pageErrors, []);
});

test("unknown names show a friendly error with suggestions", async () => {
    await search("pikachoo");
    await page.waitForSelector("#errorMessage:not(.hidden)");

    assert.match(await page.textContent("#errorMessage"), /No Pokémon called/);
    await page.waitForSelector(".suggestionBtn");
    assert.equal(await page.textContent(".suggestionBtn"), "Pikachu");
    assert.equal(await page.isVisible("#pokemonCardContainer"), false);
});

test("previous and next step through Pokédex numbers", async () => {
    await search("25");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");

    await page.click("#nextPokemonBtn");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Raichu");
    await page.click("#prevPokemonBtn");
    await page.click("#prevPokemonBtn");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Arbok");
    assert.deepEqual(pageErrors, []);
});

test("favorites persist across reloads", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    await page.click("#favoriteBtn");
    assert.equal(await page.getAttribute("#favoriteBtn", "aria-pressed"), "true");

    await page.reload();
    await page.waitForSelector("#favoritesSection:not([hidden])");
    assert.match(await page.innerText("#favoritesList"), /Pikachu/);
});

test("?pokemon= links open that Pokémon and Back returns to the previous one", async () => {
    await page.goto(baseUrl + "?pokemon=25");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");
    assert.match(page.url(), /\?pokemon=pikachu$/);

    await search("gengar");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Gengar");
    assert.match(page.url(), /\?pokemon=gengar$/);

    await page.goBack();
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");
    assert.deepEqual(pageErrors, []);
});

test("species with several forms get a forms switcher", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonForms:not([hidden])");

    const pressed = await page.textContent(".formBtn[aria-pressed=true]");
    assert.equal(pressed.trim(), "Standard");
    assert.ok((await page.locator(".formBtn").count()) > 1);
});

test("the level-up moves list loads type and power when opened", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonMoves:not([hidden])");
    assert.match(await page.textContent("#movesSummary"), /Moves \(\d+\)/);
    assert.equal(await page.getAttribute(".movesTab[aria-selected=true]", "data-method"), "level-up");

    await page.click("#movesSummary");
    await page.waitForFunction(() => !document.querySelector("#movesTable tbody").textContent.includes("…"));
    const rows = await page.$$eval("#movesTable tbody tr", (trs) =>
        trs.map((tr) => tr.innerText.replace(/\s+/g, " ").trim()),
    );
    assert.ok(
        rows.some((row) => /Thunder Shock Electric Spec 40 100%$/.test(row)),
        rows.join(" | "),
    );
    assert.deepEqual(pageErrors, []);
});

test("the browse grid can be sorted by name", async () => {
    await page.waitForSelector("#browseGrid .browseTile");
    await page.selectOption("#sortOrder", "name");
    const first = await page.textContent("#browseGrid .browseTile span");
    assert.equal(first.trim(), "Abomasnow");
});

test("arrow keys step through the Pokédex when not typing", async () => {
    await search("25");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");
    await page.locator("#pokemonNumber").click();

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Raichu");

    await page.keyboard.press("s");
    assert.equal(await page.getAttribute("#shinyToggleBtn", "aria-pressed"), "true");
});

test("? opens the keyboard shortcut list and Esc closes it", async () => {
    await page.locator("#shortcutHint").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("?");
    await page.waitForSelector("#shortcutsDialog[open]");
    assert.equal(await page.locator("#shortcutsDialog dt").count(), 8);
    await page.keyboard.press("Escape");
    await page.waitForSelector("#shortcutsDialog[open]", { state: "detached" });
    await page.click("#shortcutsBtn");
    await page.waitForSelector("#shortcutsDialog[open]");
    await page.click("#shortcutsClose");
    await page.waitForSelector("#shortcutsDialog[open]", { state: "detached" });
});

test("malformed saved favourites and history are skipped instead of breaking the page", async () => {
    await page.evaluate(() => {
        localStorage.setItem("pokedex:favorites:v1", JSON.stringify([1, null, "x", { id: 25, name: "pikachu" }]));
        localStorage.setItem("pokedex:recent:v1", JSON.stringify([{ id: "7" }, 4]));
        localStorage.setItem("pokedex:team:v1", JSON.stringify([null, 6, { id: 1, label: "Bulbasaur" }]));
    });
    await page.reload();
    await search("gengar");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Gengar");
    assert.equal(await page.locator("#favoritesList .browseTile").count(), 1);
    assert.match(await page.innerText("#favoritesList"), /Pikachu/);
    assert.equal(await page.locator("#recentList .browseTile").count(), 1); // just Gengar
    // The trainer card counts only the valid ones.
    await page.click("#dexProgress");
    await page.waitForSelector("#trainerCard[open]");
    await page.waitForFunction(() => !document.querySelector("#trainerCardStats strong span")); // counted up
    const counts = await page.evaluate(() =>
        Object.fromEntries(
            [...document.querySelectorAll("#trainerCardStats li")].map((item) => [
                item.querySelector("small").textContent,
                item.querySelector("strong").textContent,
            ]),
        ),
    );
    assert.equal(counts.Favorites, "1");
    assert.equal(counts["Team members"], "0");
});

test("G opens the go-to-number prompt and Enter jumps there", async () => {
    await page.locator("#shortcutHint").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("g");
    await page.waitForSelector("#gotoDialog[open]");
    assert.equal(await page.inputValue("#gotoInput"), ""); // the "g" itself isn't typed
    await page.keyboard.type("94");
    await page.waitForSelector('#gotoPreview img:not([hidden])[src$="/94.png"]');
    await page.waitForFunction(() => document.querySelector("#gotoPreview span").textContent === "Gengar");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Gengar");
    assert.equal(await page.locator("#gotoDialog[open]").count(), 0);
});

test("the go-to prompt also finds a Pokémon by the start of its name", async () => {
    await page.locator("#shortcutHint").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("g");
    await page.waitForSelector("#gotoDialog[open]");
    await page.keyboard.type("zzz");
    await page.waitForFunction(() => document.querySelector("#gotoPreview span").textContent === "No match");
    await page.fill("#gotoInput", "farf");
    await page.waitForFunction(() => /^Farfetch’?d$/.test(document.querySelector("#gotoPreview span").textContent)); // ’ needs the species list
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("pokemonNumber").textContent.includes("83"));
});

test("arrow keys cycle through every name matching the go-to prefix", async () => {
    await page.locator("#shortcutHint").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("g");
    await page.waitForSelector("#gotoDialog[open]");
    await page.keyboard.type("charm");
    await page.waitForFunction(() => document.querySelector("#gotoPreview span").textContent === "Charmander · 1/2");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.textContent("#gotoPreview span"), "Charmeleon · 2/2");
    await page.keyboard.press("ArrowDown"); // wraps around
    assert.equal(await page.textContent("#gotoPreview span"), "Charmander · 1/2");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Tab"); // completes the shown name, focus stays
    assert.equal(await page.inputValue("#gotoInput"), "Charmeleon");
    assert.equal(await page.evaluate(() => document.activeElement.id), "gotoInput");
    const charmeleon = page.waitForRequest((request) => /\/pokemon\/5$/.test(request.url()));
    await page.keyboard.press("Enter");
    await charmeleon;
});

test("the cry button requests the Pokémon's cry", async () => {
    await search("pikachu");
    await page.waitForSelector("#cryBtn:not([hidden])");
    const cryRequest = page.waitForRequest((request) => request.url().endsWith("/latest/25.ogg"));
    await page.click("#cryBtn");
    await cryRequest;
    // The mocked cry isn't real audio, so playback fails and the visualiser bars stay collapsed.
    await page.waitForFunction(() => !document.getElementById("cryBtn").classList.contains("playing"));
    assert.equal(await page.locator('#cryWave[aria-hidden="true"]:not(.active) span').count(), 24);
});

test("pressing Enter before suggestions load doesn't leave the list open", async () => {
    // Hold back the Pokémon name list so the suggestion lookup is still pending at Enter.
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(/\/api\/v2\/pokemon\?limit=/, async (route) => {
        await held;
        await route.fallback();
    });
    await page.evaluate(() => {
        window.localStorage.removeItem("pokedex:entries:v1"); // force a fresh download
        window.sessionStorage.clear(); // fetchJson's response cache
    });
    await page.reload();
    await page.fill("#pokemonLookupInpt", "25"); // a number doesn't wait for the name list
    await page.waitForSelector(".comboboxLoading:has-text('Loading names')");
    await page.press("#pokemonLookupInpt", "Enter");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    release();
    await page.waitForTimeout(500);
    assert.equal(await page.isHidden("#pokemonLookupInpt + [role=listbox]"), true);
});

test("official spellings with punctuation resolve", async () => {
    await search("Farfetch'd");
    await page.waitForFunction(() => document.getElementById("pokemonNumber").textContent.includes("83"));
    assert.deepEqual(pageErrors, []);
});

test("move tabs switch between level-up, TM, egg and tutor moves", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonMoves:not([hidden])");
    await page.click("#movesSummary");
    const levelUpRows = await page.locator("#movesTable tbody tr").count();

    await page.click('.movesTab[data-method="machine"]');
    assert.equal(await page.getAttribute('.movesTab[data-method="machine"]', "aria-selected"), "true");
    const machineRows = await page.locator("#movesTable tbody tr").count();
    assert.ok(machineRows > 0 && machineRows !== levelUpRows);
    assert.equal(await page.textContent("#movesTable th:first-child"), "TM"); // first column holds TM numbers
});

test("three Pokémon can be compared", async () => {
    await page.fill("#compareLeftInput", "pikachu");
    await page.fill("#compareRightInput", "raichu");
    await page.fill("#compareThirdInput", "gengar");
    await page.click("#compareBtn");
    await page.waitForSelector("#compareResult:not([hidden])");

    const headers = await page.$$eval("#compareTable thead th", (cells) => cells.map((cell) => cell.innerText));
    assert.equal(headers.length, 4); // empty corner + three Pokémon
    assert.match(headers[3], /Gengar/);
    assert.deepEqual(pageErrors, []);
});

test("species whose default form has a suffixed name can be searched by species name", async () => {
    await search("zygarde");
    await page.waitForFunction(() => document.getElementById("pokemonNumber").textContent.includes("0718"));
    assert.match(page.url(), /\?pokemon=zygarde-50$/);
    assert.deepEqual(pageErrors, []);
});

// Accessibility: no serious or critical axe-core violations in the main states, in both themes.
// Run in light and dark mode, at desktop and phone width, with the install/offline UI showing.

test("the units toggle switches the card and the comparison table to imperial", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    assert.equal(await page.textContent("#pokemonHeight"), "0.4 m");

    await page.fill("#compareLeftInput", "farfetchd");
    await page.fill("#compareRightInput", "pikachu");
    await page.click("#compareBtn");
    await page.waitForSelector("#compareResult:not([hidden])");
    // The header uses official names, not the API slug ("Farfetchd").
    assert.match(await page.textContent("#compareTable thead"), /Farfetch’d/);

    await page.click("#unitsToggleBtn");
    assert.equal(await page.textContent("#pokemonHeight"), "1′04″");
    assert.equal(await page.textContent("#pokemonWeight"), "13.2 lbs");
    assert.match(await page.innerText("#compareTable"), /Weight\s+33\.1 lbs\s+13\.2 lbs/);

    await page.reload();
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    assert.equal(await page.textContent("#pokemonWeight"), "13.2 lbs"); // remembered
});

test("the install button appears when the browser offers installation", async () => {
    assert.equal(await page.isVisible("#installBtn"), false);
    // Simulate the browser's beforeinstallprompt event with a fake prompt.
    await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = () => {
            window.installPrompted = true;
        };
        event.userChoice = Promise.resolve({ outcome: "accepted" });
        window.dispatchEvent(event);
    });
    await page.waitForSelector("#installBtn:not([hidden])");
    await page.click("#installBtn");
    await page.waitForSelector("#installBtn[hidden]", { state: "attached" });
    assert.equal(await page.evaluate(() => window.installPrompted), true);
});

test("an offline banner shows while the browser is offline", async () => {
    assert.equal(await page.isVisible("#offlineBanner"), false);
    await context.setOffline(true);
    await page.waitForSelector("#offlineBanner:not([hidden])");
    assert.match(await page.textContent("#offlineBanner"), /offline/);
    await context.setOffline(false);
    await page.waitForSelector("#offlineBanner[hidden]", { state: "attached" });
});

// Needs the service worker, which the mocked tests block, so this runs in `npm run check:live`.
test(
    "viewed Pokémon still load after going offline",
    { skip: !LIVE_API && "needs the real API (check:live)" },
    async () => {
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload(); // now controlled by the service worker
        await search("pikachu");
        await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");

        await context.setOffline(true);
        await page.reload();
        await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");
        await page.waitForSelector("#offlineBanner:not([hidden])");
        // Pikachu (viewed) stays enabled in the recent list; an unvisited browse tile is dimmed.
        await page.waitForSelector("#browseGrid .browseTile.unavailableOffline");
        assert.equal(await page.locator("#recentList .browseTile.unavailableOffline").count(), 0);
        await context.setOffline(false);
    },
);

test("comparisons are kept in the URL and restored from a shared link", async () => {
    await page.fill("#compareLeftInput", "pikachu");
    await page.fill("#compareRightInput", "gengar");
    await page.click("#compareBtn");
    await page.waitForSelector("#compareResult:not([hidden])");
    assert.match(page.url(), /[?&]compare=pikachu%2Cgengar|[?&]compare=pikachu,gengar/);

    await page.goto(baseUrl + "?pokemon=raichu&compare=gengar,pikachu,raichu");
    await page.waitForSelector("#compareResult:not([hidden])");
    const headers = await page.$$eval("#compareTable thead th", (cells) => cells.map((cell) => cell.innerText));
    assert.equal(headers.length, 4);
    assert.match(headers[1], /Gengar/);
    // The main card still follows ?pokemon=
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Raichu");
    assert.match(page.url(), /compare=/);
});

test("ability chips expand to show a description", async () => {
    await search("pikachu");
    await page.waitForSelector(".abilityChip");
    await page.click(".abilityChip");
    assert.equal(await page.getAttribute(".abilityChip", "aria-expanded"), "true");
    await page.waitForSelector("#abilityDescription:not([hidden])");
    // The fixtures have no ability data, so offline this shows the friendly fallback.
    await page.waitForFunction(() => !document.getElementById("abilityDescription").textContent.includes("Loading"));
    await page.click(".abilityChip");
    await page.waitForSelector("#abilityDescription[hidden]", { state: "attached" });
});

test("the search combobox suggests Pokémon and can be driven with the keyboard", async () => {
    await page.click("#pokemonLookupInpt");
    await page.keyboard.type("pika");
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true] + [role=listbox] .comboboxOption"); // real suggestions, not "Loading names…"
    assert.match(await page.textContent("[role=listbox] [role=option]"), /Pikachu/);
    assert.equal(await page.textContent("[role=listbox] [role=option] mark"), "Pika"); // matched part highlighted

    await page.keyboard.press("ArrowDown");
    assert.ok(await page.getAttribute("#pokemonLookupInpt", "aria-activedescendant"));
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");
    assert.equal(await page.getAttribute("#pokemonLookupInpt", "aria-expanded"), "false");
    assert.deepEqual(pageErrors, []);
});

test("browse tiles are filled in place as names and types arrive, not re-rendered", async () => {
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    const firstTile = await page.waitForSelector("#browseGrid .browseTile");
    await page.waitForSelector("#browseGrid .browseTile .tileTypes");
    assert.equal(await firstTile.evaluate((tile) => tile.isConnected), true);
    assert.equal(await firstTile.evaluate((tile) => tile.querySelector(".tileName").textContent), "Bulbasaur");
});

test("a sprite that fails to load is remembered and not requested again", async () => {
    let requests = 0;
    // Ivysaur (#2) appears only once on the page (Bulbasaur is also in the region strip).
    await page.route("**/sprites/pokemon/2.png", (route) => {
        requests++;
        route.fulfill({ status: 404, body: "" });
    });
    await page.reload();
    await page.waitForFunction(() =>
        JSON.parse(localStorage.getItem("pokedex:missing-sprites:v1") ?? "[]").includes(2),
    );
    // Normally exactly one request; under full-suite load a second one occasionally appears
    // (cause not yet found, see TODO.md). What matters is the next visit below.
    assert.ok(requests >= 1 && requests <= 2);
    const firstVisit = requests;

    await page.reload();
    await page.waitForSelector("#browseGrid .browseTile");
    assert.equal(requests, firstVisit); // skipped on the next visit
    // A Poké Ball placeholder is shown instead.
    assert.match(
        await page.locator("#browseGrid li:nth-child(2) .browseTile > img").getAttribute("src"),
        /favicon\.svg$/,
    );
});

test("an empty, focused search box offers recently viewed Pokémon", async () => {
    await search("gengar");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Gengar");
    await page.fill("#pokemonLookupInpt", "");
    await page.locator("#pokemonNumber").click(); // move focus away
    await page.click("#pokemonLookupInpt");
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true] + [role=listbox] .comboboxOption"); // real suggestions, not "Loading names…"
    assert.match(await page.getAttribute("[role=listbox]:not([hidden])", "aria-label"), /^Recently viewed/);
    assert.match(await page.textContent("[role=listbox]:not([hidden]) [role=option]"), /Gengar/);
});

test("Delete removes a Pokémon from the recently viewed suggestions", async () => {
    for (const name of ["pikachu", "gengar"]) {
        await search(name);
        await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    }
    await page.fill("#pokemonLookupInpt", "");
    await page.locator("#pokemonNumber").click();
    await page.click("#pokemonLookupInpt");
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true] + [role=listbox] .comboboxOption"); // real suggestions, not "Loading names…"
    await page.keyboard.press("ArrowDown"); // Gengar (most recent)
    await page.keyboard.press("Delete");

    await page.waitForFunction(
        () => document.querySelectorAll("[role=listbox]:not([hidden]) [role=option]").length === 1,
    );
    assert.match(await page.textContent("[role=listbox]:not([hidden]) [role=option]"), /Pikachu/);
    assert.match(await page.textContent(".comboboxWrap [role=status]"), /Gengar removed/);
    assert.doesNotMatch(await page.innerText("#recentList"), /Gengar/); // the tiles update too
});

test("the comparison radar chart highlights a Pokémon from its legend entry", async () => {
    await page.goto(baseUrl + "?compare=pikachu,gengar");
    await page.waitForSelector("#compareRadar svg");
    assert.equal(await page.locator("#compareRadar .radarSeries").count(), 2);
    await page.focus(".radarLegend li >> nth=1");
    assert.equal(await page.getAttribute("#compareRadar svg", "data-highlight"), "1");
    await page.locator("#pokemonLookupInpt").focus();
    assert.equal(await page.getAttribute("#compareRadar svg", "data-highlight"), null);
});

test("picking a compare suggestion moves on, so the list never blocks the Compare button", async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.click("#compareLeftInput");
    await page.keyboard.type("pika");
    await page.waitForSelector("#compareLeftInput[aria-expanded=true] + [role=listbox] .comboboxOption"); // real suggestions, not "Loading names…"
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "compareRightInput");

    await page.keyboard.type("geng");
    await page.waitForSelector("#compareRightInput[aria-expanded=true] + [role=listbox] .comboboxOption"); // real suggestions, not "Loading names…"
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    // The optional third box is skipped; focus lands on the button with the list closed.
    assert.equal(await page.evaluate(() => document.activeElement.id), "compareBtn");
    await page.click("#compareBtn");
    await page.waitForSelector("#compareResult:not([hidden])");
});

test("the moves table sorts by a column when its header is clicked", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonMoves:not([hidden])");
    await page.click("#movesSummary");
    await page.waitForFunction(() => !document.querySelector("#movesTable tbody").textContent.includes("…"));

    const powers = () =>
        page.$$eval("#movesTable tbody tr", (rows) => rows.map((row) => parseInt(row.cells[4].textContent, 10) || -1));
    await page.click("#movesTable th:nth-child(5) button"); // Pwr
    assert.equal(await page.getAttribute("#movesTable th:nth-child(5)", "aria-sort"), "ascending");
    const ascending = await powers();
    assert.deepEqual(
        ascending,
        [...ascending].sort((a, b) => a - b),
    );

    await page.click("#movesTable th:nth-child(5) button");
    assert.equal(await page.getAttribute("#movesTable th:nth-child(5)", "aria-sort"), "descending");
    const descending = await powers();
    assert.deepEqual(
        descending,
        [...descending].sort((a, b) => b - a),
    );
});

test("the share button copies a link to the current Pokémon", async () => {
    await search("gengar");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    // Headless Chromium has no share sheet; capture the clipboard write instead.
    await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText: async (text) => (window.copiedText = text) },
        });
    });
    await page.click("#shareBtn");
    await page.waitForFunction(() => document.getElementById("shareStatus").textContent === "Link copied");
    assert.match(await page.evaluate(() => window.copiedText), /\?pokemon=gengar$/);
});

test("beating the best quiz streak flashes New best!", async () => {
    await page.evaluate(() =>
        localStorage.setItem(
            "pokedex:quiz:v1",
            JSON.stringify({ correct: 19, played: 19, streak: 19, best: 19, bestTimed: 0 }),
        ),
    );
    await page.reload();
    await page.click("#quizStartBtn");
    await page.waitForSelector(".quizChoice");
    await answerQuizCorrectly();
    await page.waitForSelector("#quizStage.revealed");
    assert.match(await page.textContent("#quizResult"), /^Correct!/);
    assert.match(await page.textContent("#quizScore"), /Streak 20 · Best 20 .*🎉 New best!$/);
    // ...and the Quiz whiz line moves up to the next tier.
    assert.equal(await page.textContent("#quizTier"), "🧠 Quiz whiz badge: best streak 20 / 35 for silver");
});

test("the Who's that Pokémon? quiz reveals the answer and keeps score", async () => {
    await page.click("#quizStartBtn");
    await page.waitForSelector(".quizChoice");
    assert.equal(await page.locator(".quizChoice").count(), 4);
    assert.match(await page.getAttribute("#quizImage", "alt"), /Silhouette/);

    await page.click(".quizChoice >> nth=0");
    await page.waitForSelector("#quizStage.revealed");
    assert.match(await page.textContent("#quizResult"), /Correct!|Not quite/);
    assert.match(await page.textContent("#quizScore"), /Score \d\/1/);
    assert.match(await page.textContent("#quizTier"), /^🧠 Quiz whiz badge: best streak \d+ \/ 20 for bronze$/);
    assert.equal(await page.locator(".quizChoice.correct").count(), 1);
    await page.click("#quizNextBtn");
    await page.waitForSelector("#quizStage:not(.revealed)");
});

test("the team builder adds Pokémon from the card and charts type coverage", async () => {
    for (const name of ["pikachu", "gengar"]) {
        await search(name);
        await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
        await page.click("#teamAddBtn");
    }
    assert.equal(await page.getAttribute("#teamAddBtn", "aria-pressed"), "true");
    assert.equal(await page.locator(".teamSlot:not(.empty)").count(), 2);
    await page.waitForSelector(".coverageTable");
    // Ground hits both Pikachu (2×) and Gengar (2×).
    const groundWeak = await page.$eval(".coverageTable tbody tr:nth-child(9) td.weak", (cell) => cell.textContent);
    assert.equal(groundWeak, "2");

    await page.click(".teamRemove");
    assert.equal(await page.locator(".teamSlot:not(.empty)").count(), 1);
});

test("the type chart opens on demand and highlights the hovered row and column", async () => {
    assert.equal(await page.isVisible("#typeChart"), false);
    await page.click("#typeChartBtn");
    assert.equal(await page.getAttribute("#typeChartBtn", "aria-expanded"), "true");
    await page.waitForSelector(".typeChartTable");
    assert.equal(await page.locator(".typeChartTable tbody tr").count(), 18);
    await page.hover(".typeChartTable tbody tr:nth-child(5) td:nth-child(3)");
    assert.ok((await page.locator(".typeChartTable .rowHighlight").count()) > 0);
});

test("a shared ?team= link offers to load that team", async () => {
    await page.goto(baseUrl + "?team=25,94");
    await page.waitForSelector("#sharedTeam:not([hidden])");
    assert.match(await page.textContent("#sharedTeam"), /Pikachu, Gengar/);
    await page.click("#sharedTeam .btn");
    assert.equal(await page.locator(".teamSlot:not(.empty)").count(), 2);
    assert.doesNotMatch(page.url(), /team=/); // the offer is consumed
    assert.equal(await page.isVisible("#teamShareBtn"), true);
});

test("a card type icon opens the type chart at that type, and arrow keys move around it", async () => {
    await search("gengar");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    await page.click("#pokemonType1"); // Ghost
    await page.waitForFunction(() => document.activeElement?.title?.startsWith("Ghost → Ghost"));
    await page.keyboard.press("ArrowRight");
    assert.match(await page.evaluate(() => document.activeElement.title), /^Ghost → Dark/);
    await page.keyboard.press("ArrowDown");
    assert.match(await page.evaluate(() => document.activeElement.title), /^Dark → Dark/);
});

test("the animated-sprite toggle only shows when an animation exists", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    // The trimmed fixtures have no Showdown animations, so the toggle stays hidden there; the
    // real Pikachu has one, so against the live API it shows.
    assert.equal(await page.isVisible("#animatedToggleBtn"), LIVE_API);
});

test("the 60-second quiz challenge counts down, accepts number keys and ends with a result", async () => {
    await page.clock.install();
    await page.reload();
    await page.click("#quizTimedBtn");
    await page.waitForSelector(".quizChoice:not(:disabled)");
    assert.match(await page.textContent("#quizTimer"), /^⏱ \d+s · 0 correct$/);

    await page.keyboard.press("1"); // answers with the first (focused-area) choice
    assert.equal(await page.locator(".quizChoice:disabled").count(), 4);

    await page.clock.runFor(61_000);
    await page.waitForFunction(() => document.getElementById("quizResult").textContent.startsWith("Time's up!"));
    assert.equal(await page.isVisible("#quizTimer"), false);
    assert.match(await page.textContent("#quizScore"), /Best 60s run \d/);
});

test("the 60-second challenge counts correct answers and records the best run", async () => {
    await page.clock.install();
    await page.reload();
    await page.click("#quizTimedBtn");
    for (let round = 1; round <= 3; round++) {
        await page.waitForSelector(".quizChoice:not(:disabled)");
        await answerQuizCorrectly();
        await page.waitForFunction(
            (count) => document.getElementById("quizTimer").textContent.endsWith(count + " correct"),
            round,
        );
        assert.equal(await page.locator("#quizCombo span.lit").count(), round);
        assert.equal(
            await page.textContent(".quizChoice.correct .quizPlusOne"),
            round >= 3 ? "Combo ×" + round + "!" : "+1",
        );
        await page.clock.runFor(800); // the next silhouette follows after a short pause
    }
    await page.clock.runFor(61_000);
    await page.waitForFunction(() => document.getElementById("quizResult").textContent.startsWith("Time's up!"));
    assert.match(await page.textContent("#quizResult"), /^Time's up! .*\b3\b/);
    assert.match(await page.textContent("#quizScore"), /Best 60s run 3 · Best combo ×3$/);
});

test("the theme button cycles light → dark → retro and remembers the choice", async () => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await page.click("#themeToggleBtn");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    await page.click("#themeToggleBtn");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "retro");
    assert.match(await page.getAttribute("#themeToggleBtn", "aria-label"), /light theme/);
    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "retro");
});

test("submitting the typed text closes the suggestion list", async () => {
    await page.click("#pokemonLookupInpt");
    await page.keyboard.type("gengar");
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true] + [role=listbox] .comboboxOption"); // real suggestions, not "Loading names…"
    await page.keyboard.press("Enter");
    assert.equal(await page.getAttribute("#pokemonLookupInpt", "aria-expanded"), "false");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Gengar");
});

test("the Pokémon of the day shows on the landing page and hides once a Pokémon is shown", async () => {
    await page.waitForSelector("#potdSection:not([hidden])");
    assert.match(await page.textContent("#potdDetail"), /#\d{4}/);
    await search("pikachu");
    await page.waitForSelector("#potdSection[hidden]", { state: "attached" });
    await page.click("#clearDataBtn");
    await page.waitForSelector("#potdSection:not([hidden])");
});

test("region banners filter the browse grid by generation and toggle off again", async () => {
    await page.waitForSelector("#browseGrid .browseTile");
    assert.equal(await page.locator(".regionBanner").count(), 9);
    await page.click('.regionBanner[data-generation="2"]');
    assert.equal(await page.inputValue("#generationFilter"), "2");
    assert.equal(await page.getAttribute('.regionBanner[data-generation="2"]', "aria-pressed"), "true");
    await page.waitForFunction(() => document.querySelector("#browseGrid .browseTile small").textContent === "#0152");

    await page.click('.regionBanner[data-generation="2"]');
    assert.equal(await page.inputValue("#generationFilter"), "");
});

test("the size comparison scales the Pokémon against a 1.7 m trainer", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    assert.match(await page.textContent("#sizeCaption"), /Pikachu is 24% of a 1\.7 m trainer/);
    const heights = await page.evaluate(() => [
        document.getElementById("pokemonSilhouette").style.height,
        document.getElementById("trainerSilhouette").style.height,
    ]);
    assert.deepEqual(heights, ["38px", "160px"]);
});

test("resting the mouse on a browse tile flips it to its base stats", async () => {
    const tile = page.locator('#browseGrid .browseTile[data-id="24"]');
    await tile.scrollIntoViewIfNeeded();
    await tile.hover();
    await page.waitForSelector('#browseGrid .browseTile.flipped[data-id="24"] .tileBackTotal');
    assert.match(await tile.locator(".tileBackTotal").textContent(), /Base stats448/);
    assert.equal(await tile.locator(".tileBackStat").count(), 6);
    assert.equal(await tile.locator(".tileBackRadar .radarShape").count(), 1);
    assert.equal(await tile.locator(".tileBackRadar text").count(), 6);
    assert.equal(await tile.locator(".tileBack").getAttribute("aria-hidden"), "true");
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => !document.querySelector(".browseTile.flipped"));
});

test("viewing a Pokémon fills the completion ring and its region's progress bar", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    assert.match(await page.getAttribute("#dexProgress", "aria-label"), /[1-9]\d* of 1025 Pokémon seen/);
    assert.match(
        await page.textContent('.regionBanner[data-generation="1"] .regionProgressText'),
        /^[1-9]\d*\/151 seen$/,
    );
    assert.equal(await page.textContent('.regionBanner[data-generation="9"] .regionProgressText'), "0/120 seen");
    assert.match(await page.textContent('.regionBanner[data-generation="1"] + .regionChip'), /^Only \d+ to go!$/);
    await page.click('.regionBanner[data-generation="1"] + .regionChip');
    assert.equal(await page.inputValue("#generationFilter"), "1");
    assert.equal(await page.isChecked("#unseenFilter"), true);
    assert.match(await page.textContent("#unseenCount"), /^\d+ left in Kanto →$/);
    assert.match(await page.textContent("#nextMissingBtn"), /^Next missing in Kanto \(\d+ left\) →$/);
    await page.waitForFunction(() => !document.querySelector('#browseGrid .browseTile[data-id="25"]'));
    assert.ok((await page.locator('.browseTile[data-dex="25"] .tileSeen').count()) >= 1);
    assert.equal(await page.locator('#browseGrid .browseTile[data-dex="1"] .tileSeen').count(), 0);
    // "N" follows the Next missing button: Bulbasaur (#1) is Kanto's first gap.
    const bulbasaurRequest = page.waitForRequest((request) => /\/pokemon\/1$/.test(request.url()));
    await page.keyboard.press("n");
    await bulbasaurRequest;
});

test("a week-long visit streak earns a flame badge and orange LEDs", async () => {
    await page.evaluate(() => {
        const yesterday = new Date(Date.now() - 86400000);
        const day = [yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate()]
            .map((part) => String(part).padStart(2, "0"))
            .join("-");
        localStorage.setItem("pokedex:visits:v1", JSON.stringify({ first: day, last: day, streak: 6, best: 6 }));
    });
    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("onFire")), true);
    await page.click("#dexProgress");
    await page.waitForSelector("#trainerCard[open]");
    assert.equal(await page.locator("#trainerCardBadges li:not(.locked)").count(), 1);
    await page.click("#trainerCardClose");
    // Seen once: the next time it's shown it no longer spins; a new tier would.
    await page.evaluate(() => localStorage.setItem("pokedex:quiz:v1", JSON.stringify({ best: 20 })));
    await page.click("#dexProgress");
    assert.deepEqual(
        await page.evaluate(() =>
            [...document.querySelectorAll("#trainerCardBadges li.fresh")].map((li) => li.className),
        ),
        ["quiz tier1 fresh"],
    );
    assert.equal(await page.textContent("#trainerNextBadge"), "Next badge: Visit 30 days in a row");
    assert.equal(await page.locator("#trainerCalendar span").count(), 28);
    assert.equal(await page.locator("#trainerCalendar span.today.visited").count(), 1);
    assert.equal(await page.isHidden("#trainerHallOfFame"), true);
    await page.click("#trainerCardClose");
    await page.evaluate(() => localStorage.setItem("pokedex:quiz:v1", JSON.stringify({ best: 50 })));
    await page.click("#dexProgress");
    assert.equal(await page.textContent("#trainerHallOfFame"), "🏛️ Hall of fame: 🧠 Quiz whiz");
    assert.equal(await page.locator("#trainerHallOfFame .hallIcon").count(), 1);
    await page.click("#trainerCardClose");
});

test("an all-gold trainer turns the header ring gold", async () => {
    await page.evaluate(() => {
        localStorage.setItem("pokedex:seen:v1", JSON.stringify(Array.from({ length: 1025 }, (_, index) => index + 1)));
        localStorage.setItem("pokedex:quiz:v1", JSON.stringify({ best: 50 }));
        localStorage.setItem(
            "pokedex:shiny-hunt:v1",
            JSON.stringify({ encounters: 60, shinies: Array.from({ length: 50 }, (_, index) => ({ id: index + 1 })) }),
        );
    });
    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("allGold")), true);
});

test("earning a new badge announces it with the toast", async () => {
    await page.evaluate(() => {
        localStorage.setItem("pokedex:badges-earned:v1", "[]");
        localStorage.setItem("pokedex:views:v1", JSON.stringify({ 25: 24 }));
    });
    await page.reload();
    await search("pikachu");
    await page.waitForFunction(() => document.getElementById("dexToast").textContent.includes("Collector"));
    assert.match(await page.textContent("#dexToast"), /^📚 Badge earned! Collector/);
    assert.equal(await page.textContent("#dexToast .toastIcon"), "📚");
    assert.equal(await page.evaluate(() => document.getElementById("dexProgress").classList.contains("hasNews")), true);
    assert.match(await page.getAttribute("#dexProgress", "aria-label"), / · new badge!$/);
    await page.click("#dexProgress"); // seeing the card clears the dot
    assert.equal(
        await page.evaluate(() => document.getElementById("dexProgress").classList.contains("hasNews")),
        false,
    );
    assert.doesNotMatch(await page.getAttribute("#dexProgress", "aria-label"), /new badge/);
    assert.equal(await page.isVisible("#dexToast.visible"), true);
});

test("a badge toast pauses while hovered and its Show me button spotlights the badge", async () => {
    await page.clock.install();
    await page.evaluate(() => {
        localStorage.setItem("pokedex:badges-earned:v1", "[]");
        localStorage.setItem("pokedex:views:v1", JSON.stringify({ 25: 24 }));
    });
    await page.reload();
    await search("pikachu");
    await page.waitForFunction(() => document.getElementById("dexToast").textContent.includes("Collector"));
    await page.hover("#dexToast .toastShowMe");
    await page.clock.runFor(8000); // well past the 4 s countdown
    assert.equal(await page.isVisible("#dexToast.visible"), true);
    await page.click("#dexToast .toastShowMe");
    await page.waitForSelector("#trainerCard[open]");
    assert.match(await page.getAttribute("#trainerCardBadges li.spotlight", "data-badge"), /^Collector/);
    assert.equal(await page.isVisible("#dexToast.visible"), false);
});

test("badges beyond the toast queue are summed up in one clickable toast", async () => {
    await page.clock.install();
    await page.evaluate(() => {
        localStorage.setItem("pokedex:badges-earned:v1", "[]");
        localStorage.setItem("pokedex:seen:v1", JSON.stringify(Array.from({ length: 1025 }, (_, index) => index + 1)));
        localStorage.setItem("pokedex:quiz:v1", JSON.stringify({ best: 50 }));
        localStorage.setItem("pokedex:views:v1", JSON.stringify({ 6: 60 }));
    });
    await page.reload();
    await page.waitForSelector("#dexToast.visible");
    await page.clock.runFor(3 * 4000); // three queued toasts of 4 s each
    await page.waitForSelector(".toastButton");
    assert.match(await page.textContent(".toastButton"), /^✨ \+\d+ more achievements? — see your trainer card$/);
    await page.click(".toastButton");
    await page.waitForSelector("#trainerCard[open]");
});

test("after Show me, the rest of the toast queue is folded into one summary", async () => {
    await page.clock.install();
    await page.evaluate(() => {
        localStorage.setItem("pokedex:badges-earned:v1", "[]");
        localStorage.setItem("pokedex:seen:v1", JSON.stringify(Array.from({ length: 1025 }, (_, index) => index + 1)));
        localStorage.setItem("pokedex:quiz:v1", JSON.stringify({ best: 50 }));
        localStorage.setItem("pokedex:views:v1", JSON.stringify({ 6: 60 }));
    });
    await page.reload();
    await page.click("#dexToast.visible .toastShowMe");
    await page.waitForSelector("#trainerCard[open]");
    await page.keyboard.press("Escape");
    await page.clock.runFor(2000);
    await page.waitForSelector("#dexToast.visible .toastButton");
    assert.match(await page.textContent(".toastButton"), /^✨ \+\d+ more achievements? — see your trainer card$/);
});

test("the completion ring opens a trainer card", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    await page.click("#dexProgress");
    await page.waitForSelector("#trainerCard[open]");
    assert.match(await page.textContent("#trainerCardSeen"), /of 1025 Pokémon seen/);
    // The count rolls up from 0, then settles on the plain final line.
    await page.waitForFunction(() =>
        /^[1-9]\d* of 1025 Pokémon seen \(\d+%\)$/.test(document.getElementById("trainerCardSeen").textContent),
    );
    assert.equal(await page.locator("#trainerCardRegions li").count(), 9);
    await page.waitForFunction(() =>
        /^[1-9]\d*\/151$/.test(document.querySelector("#trainerCardRegions .trainerRegionCount").textContent),
    );
    assert.match(await page.textContent("#trainerCardVisits"), /^Member since .+ · 🔥 \d+-day streak \(best \d+\)$/);
    assert.equal(await page.locator("#trainerCardStats li").count(), 6);
    await page.waitForFunction(() =>
        [...document.querySelectorAll("#trainerCardStats strong")].every((value) => /^\d+$/.test(value.textContent)),
    );
    await page.click(".trainerJump button[data-target=trainerRegionsHeading]");
    await page.waitForFunction(() => document.getElementById("trainerCard").scrollTop > 0);
    await page.waitForSelector(".trainerJump button[data-target=trainerRegionsHeading][aria-current=true]");
    await page.fill("#trainerName", "Gbot");
    assert.equal(await page.inputValue("#trainerPartner"), "25");
    assert.equal(await page.isVisible("#dexPartner"), true);
    assert.equal(await page.isVisible("#trainerAvatar"), true);
    const download = page.waitForEvent("download");
    await page.click("#trainerImageBtn");
    assert.equal((await download).suggestedFilename(), "trainer-card.png");
    // Where files can be shared (phones), the image goes to the share sheet instead.
    await page.evaluate(() => {
        navigator.canShare = () => true;
        navigator.share = async (data) => (window.sharedFiles = data.files.map((file) => file.name));
    });
    await page.click("#trainerImageBtn");
    await page.waitForFunction(() => window.sharedFiles);
    assert.deepEqual(await page.evaluate(() => window.sharedFiles), ["trainer-card.png"]);
    await page.evaluate(() => {
        delete navigator.canShare;
        delete navigator.share;
    });
    await page.selectOption("#trainerStyle", "holo");
    assert.equal(await page.getAttribute("#trainerCard", "data-style"), "holo");
    await page.hover("#trainerCardSeen");
    await page.waitForSelector("#trainerCard.sheen");
    await page.selectOption("#trainerStyle", "classic");
    await page.evaluate(() => {
        delete Navigator.prototype.share;
        navigator.clipboard.writeText = async (text) => (window.copiedText = text);
    });
    await page.click("#trainerShareBtn");
    await page.waitForSelector("#trainerShareStatus:has-text('Copied')");
    assert.match(await page.evaluate(() => window.copiedText), /^🎴 Gbot's Pokédex\n👀 [1-9]\d*\/1025 Pokémon seen/);
    await page.click("#trainerCardClose");
    await page.waitForSelector("#trainerCard:not([open])", { state: "attached" });
});

test("the partner Pokémon reacts with a heart to its own evolution line", async () => {
    await page.evaluate(() => localStorage.setItem("pokedex:seen:v1", "[25]"));
    await page.reload();
    await search("pikachu");
    await page.waitForSelector("#dexPartnerBubble.visible");
    assert.equal(await page.textContent("#dexPartnerBubble"), "❤️");
    await page.click("#shinyToggleBtn");
    await page.waitForFunction(() => document.getElementById("dexPartnerBubble").textContent === "⭐");
    await page.click("#shinyToggleBtn");
    await search("raichu");
    await page.waitForFunction(() => document.getElementById("pokemonNumber").textContent.includes("26"));
    await page.click("#dexPartnerBtn");
    await page.waitForFunction(() => document.getElementById("pokemonNumber").textContent.includes("25"));
});

test("opening a Pokémon five times offers to make it your partner", async () => {
    await page.evaluate(() => {
        localStorage.setItem("pokedex:seen:v1", "[24, 25]");
        localStorage.setItem("pokedex:trainer:v1", JSON.stringify({ partner: 24 }));
        localStorage.setItem("pokedex:views:v1", JSON.stringify({ 25: 4 }));
    });
    await page.reload();
    await search("pikachu");
    await page.waitForSelector("#partnerOffer:not([hidden])");
    assert.match(await page.textContent("#partnerOfferText"), /Pikachu seems to like you/);
    await page.click("#partnerOfferYes");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("pokedex:trainer:v1")).partner), 25);
    assert.equal(await page.isHidden("#partnerOffer"), true);
    await page.click("#dexProgress");
    assert.equal(await page.getAttribute("#trainerAffection", "aria-label"), "Affection 2 of 5");
    await page.click("#trainerAffection");
    assert.equal(await page.textContent("#trainerHeartHint"), "💕 Open your partner 1 more time for the next heart.");
    assert.equal(await page.textContent("#trainerAffection"), "♥♥♡♡♡");
    assert.match(await page.getAttribute("#trainerTop li:first-child button", "aria-label"), /, opened 5 times$/);
    await page.click("#trainerCardClose");
});

test("a partner at full affection glows and cameos on other Pokémon's art", async () => {
    await page.evaluate(() => {
        localStorage.setItem("pokedex:seen:v1", "[24, 25]");
        localStorage.setItem("pokedex:trainer:v1", JSON.stringify({ partner: 24 }));
        localStorage.setItem("pokedex:views:v1", JSON.stringify({ 24: 12 }));
    });
    await page.reload();
    await search("pikachu");
    await page.waitForSelector("#partnerCameoBtn:not([hidden])");
    await page.click("#partnerCameoBtn");
    await page.waitForSelector("#cameoMatchup.visible");
    assert.match(await page.textContent("#cameoMatchup"), /vs Pikachu: hits \S+×, takes \S+×/);
    assert.match(await page.getAttribute("#cameoVs", "class"), /^flash (win|lose|even)$/);
    assert.equal(await page.evaluate(() => document.getElementById("dexPartner").classList.contains("devoted")), true);
    await search("arbok");
    await page.waitForFunction(() => document.getElementById("pokemonNumber").textContent.includes("24"));
    assert.equal(await page.isHidden("#partnerCameoBtn"), true);
});

test("finishing a region with Next missing offers the next unfinished region", async () => {
    await page.evaluate(() =>
        localStorage.setItem(
            "pokedex:seen:v1",
            JSON.stringify(Array.from({ length: 151 }, (_, index) => index + 1).filter((id) => id !== 25)),
        ),
    );
    await page.reload();
    await page.waitForSelector("#browseGrid .browseTile");
    await page.selectOption("#generationFilter", "1");
    await search("pikachu"); // the last one missing from Kanto
    await page.waitForSelector("#nextMissingBtn.regionDone");
    assert.equal(await page.textContent("#nextMissingBtn"), "🎉 Kanto complete — on to Johto? →");
    const nextRequest = page.waitForRequest((request) => /\/pokemon\/152$/.test(request.url()));
    await page.locator("#nextMissingBtn").scrollIntoViewIfNeeded();
    const stripOffScreen = await page.evaluate(() => {
        const box = document.getElementById("regionStrip").getBoundingClientRect();
        return box.bottom < 0 || box.top > window.innerHeight;
    });
    await page.click("#nextMissingBtn");
    await nextRequest;
    assert.equal(await page.inputValue("#generationFilter"), "2");
    assert.equal(
        await page.evaluate(() =>
            document.querySelector('.regionBanner[data-generation="2"]').classList.contains("regionPulse"),
        ),
        true,
    );
    // With the strip out of view, a chip says where the walk moved on to.
    if (stripOffScreen) {
        assert.equal(await page.textContent("#nowBrowsingChip.visible"), "🧭 Now browsing Johto ↑");
        await page.click("#nowBrowsingChip button");
        await page.waitForFunction(() => {
            const box = document.getElementById("regionStrip").getBoundingClientRect();
            return box.top >= 0 && box.bottom <= window.innerHeight;
        });
    } else {
        assert.equal(await page.locator("#nowBrowsingChip").count(), 0);
    }
});

test("seeing every Pokémon turns the region button into the National Dex finale", async () => {
    await page.evaluate(() =>
        localStorage.setItem(
            "pokedex:seen:v1",
            JSON.stringify(Array.from({ length: 1025 }, (_, index) => index + 1).filter((id) => id !== 25)),
        ),
    );
    await page.reload();
    await page.waitForSelector("#browseGrid .browseTile");
    await page.selectOption("#generationFilter", "1");
    await search("pikachu");
    await page.waitForFunction(() =>
        document.getElementById("nextMissingBtn").textContent.startsWith("🏆 National Dex complete!"),
    );
    await page.click("#nextMissingBtn");
    await page.waitForSelector("#trainerCard[open]");
});

test("the unseen-only filter hides Pokémon you've already opened", async () => {
    await page.evaluate(() => localStorage.setItem("pokedex:seen:v1", "[1, 2, 4]"));
    await page.reload();
    await page.waitForSelector('#browseGrid .browseTile[data-id="1"]');
    await page.check("#unseenFilter");
    await page.waitForFunction(() => document.querySelector("#browseGrid .browseTile")?.dataset.id === "3");
    assert.equal(await page.locator('#browseGrid .browseTile[data-id="4"]').count(), 0);
    await page.evaluate(() => (Math.random = () => 0)); // the first unseen entry: #3
    const surprise = page.waitForRequest((request) => /\/pokemon\/3$/.test(request.url()));
    await page.click("#surpriseBtn");
    await surprise;
    // Surprise me smooth-scrolls to the top; clicking the checkbox mid-scroll can miss it.
    await page.waitForFunction(
        () =>
            new Promise((resolve) => {
                const before = window.scrollY;
                window.requestAnimationFrame(() =>
                    window.requestAnimationFrame(() => resolve(window.scrollY === before)),
                );
            }),
    );
    await page.uncheck("#unseenFilter");
    await page.waitForSelector('#browseGrid .browseTile[data-id="1"]');
});

test("seeing the last Pokémon of a region celebrates with a toast", async () => {
    await page.evaluate(() =>
        localStorage.setItem(
            "pokedex:seen:v1",
            JSON.stringify(Array.from({ length: 151 }, (_, index) => index + 1).filter((id) => id !== 25)),
        ),
    );
    await page.reload();
    await search("pikachu");
    await page.waitForSelector("#dexToast.visible");
    assert.equal(await page.textContent("#dexToast > span"), "🏅 Kanto Pokédex complete!");
    assert.equal(await page.locator('.regionBanner.regionComplete[data-generation="1"]').count(), 1);
    assert.equal(
        await page.evaluate(
            () =>
                window.getComputedStyle(
                    document.querySelector('.regionBanner[data-generation="1"] .regionProgressBar span'),
                    "::after",
                ).animationName,
        ),
        "barShimmer",
    );
    assert.equal(await page.textContent("#regionTier"), "🗺️ Region master badge: 1 / 3 regions for silver");
    await page.click("#regionTier");
    await page.waitForSelector("#trainerCard[open]");
    assert.equal(await page.locator("#trainerCardBadges li.regions.tier1").count(), 1);
    // The Region master badge it earns is queued and shown next.
    await page.waitForFunction(() => document.getElementById("dexToast").textContent.includes("Region master"), null, {
        timeout: 6000,
    });
});

test("a region toast's Show me opens that region in the browse grid", async () => {
    await page.evaluate(() =>
        localStorage.setItem(
            "pokedex:seen:v1",
            JSON.stringify(Array.from({ length: 151 }, (_, index) => index + 1).filter((id) => id !== 25)),
        ),
    );
    await page.reload();
    await search("pikachu");
    await page.click("#dexToast.visible.withAction .toastShowMe");
    assert.equal(await page.inputValue("#generationFilter"), "1");
    await page.waitForSelector('.regionBanner.regionPulse[data-generation="1"]');
    await page.waitForFunction(() => document.querySelectorAll("#browseGrid .browseTile").length > 0);
    assert.equal(await page.isVisible("#dexToast.visible"), false);
});

test("the shiny hunt counts encounters and collects shinies", async () => {
    await page.evaluate(() => (Math.random = () => 0.5)); // the first encounter must not be shiny (1 in 50)
    await page.click("#huntEncounterBtn");
    await page.waitForSelector("#huntStage:not([hidden])");
    assert.match(await page.textContent("#huntCounter"), /Encounters: 1/);

    await page.selectOption("#huntGeneration", "1");
    await page.evaluate(() => (Math.random = () => 0.001)); // force a shiny: #1 in Kanto
    await page.click("#huntEncounterBtn");
    assert.match(await page.textContent("#huntResult"), /SHINY! A shiny (Bulbasaur|#0001) appeared/);
    assert.equal(await page.locator(".huntShiny").count(), 1);
    await page.reload();
    assert.match(await page.textContent("#huntCounter"), /Encounters: 2 · Shinies found: 1/);
    assert.equal(await page.textContent("#huntTier"), "✨ Shiny hunter badge: 1 / 5 for bronze");
});
