// Browser smoke tests for the Pokédex page.
// PokéAPI is replaced by the trimmed fixtures in tests/fixtures and sprite
// images are stubbed, so the suite runs offline and gives stable results.
// Run with: npm test
// `npm run check:live` runs the same tests against the real PokéAPI (LIVE_API=1)
// to catch API changes the fixtures would hide.

/* global document, window -- used inside page.evaluate/waitForFunction callbacks, which run in the browser */

const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const LIVE_API = Boolean(process.env.LIVE_API);
const SITE_ROOT = path.join(__dirname, "..", "pokemon");
const FIXTURES = path.join(__dirname, "fixtures");
const CONTENT_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};
// 1x1 transparent PNG used for every remote sprite.
const BLANK_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
);

const pokemonList = JSON.parse(fs.readFileSync(path.join(FIXTURES, "pokemon-list.json"), "utf8")).results;

let server;
let baseUrl;
let browser;
let context;
let page;
let pageErrors;

// Maps a PokéAPI URL to a fixture file, e.g. /api/v2/pokemon/pikachu -> pokemon-25.json.
function fixtureFor(url) {
    const { pathname } = new URL(url);
    const [resource, key] = pathname
        .replace(/^\/api\/v2\//, "")
        .split("/")
        .filter(Boolean);
    if (resource === "pokemon" && !key) {
        return "pokemon-list.json";
    }
    if (resource === "pokemon" && !/^\d+$/.test(key)) {
        const entry = pokemonList.find((candidate) => candidate.name === key);
        return entry ? "pokemon-" + entry.url.split("/").filter(Boolean).pop() + ".json" : null;
    }
    return resource + "-" + key + ".json";
}

before(async () => {
    server = http.createServer((request, response) => {
        const filePath = path.join(SITE_ROOT, decodeURIComponent(request.url.split("?")[0]));
        fs.readFile(filePath, (error, data) => {
            if (error) {
                response.writeHead(404);
                response.end();
                return;
            }
            response.writeHead(200, {
                "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
            });
            response.end(data);
        });
    });
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = "http://localhost:" + server.address().port + "/pokemon.html";
    browser = await chromium.launch();
});

after(async () => {
    await browser?.close();
    server?.close();
});

beforeEach(async () => {
    // Service workers would bypass page.route, so the mocked tests block them.
    context = await browser.newContext({ serviceWorkers: LIVE_API ? "allow" : "block" });
    page = await context.newPage();
    pageErrors = [];
    // Fail fast: waits give up after a few seconds (longer against the real API), and any
    // uncaught page error (e.g. a broken module import) is reported in the next wait's failure.
    page.setDefaultTimeout(LIVE_API ? 15000 : 5000);
    page.on("pageerror", (error) => {
        pageErrors.push(error.message);
        console.error("page error:", error.message);
    });

    if (LIVE_API) {
        await page.goto(baseUrl);
        return; // talk to the real PokéAPI and sprite hosts
    }

    await page.route("https://pokeapi.co/**", (route) => {
        const fixture = fixtureFor(route.request().url());
        const file = fixture && path.join(FIXTURES, fixture);
        if (file && fs.existsSync(file)) {
            route.fulfill({ status: 200, contentType: "application/json", body: fs.readFileSync(file) });
        } else {
            route.fulfill({ status: 404, body: "Not Found" });
        }
    });
    await page.route("https://raw.githubusercontent.com/**", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG }),
    );
    await page.goto(baseUrl);
});

afterEach(async () => {
    await context?.close();
});

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
for (const [colorScheme, width] of [
    ["light", 1280],
    ["dark", 1280],
    ["light", 375],
    ["dark", 375],
]) {
    test("no serious accessibility violations (" + colorScheme + " mode, " + width + "px)", async () => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 900 });
        // Show the install button and offline banner too.
        await page.evaluate(() => {
            const event = new Event("beforeinstallprompt", { cancelable: true });
            event.prompt = () => {};
            event.userChoice = Promise.resolve({ outcome: "dismissed" });
            window.dispatchEvent(event);
            document.getElementById("offlineBanner").hidden = false;
        });
        await search("pikachu");
        await page.waitForSelector("#pokemonMoves:not([hidden])");
        await page.click("#movesSummary");
        await page.fill("#compareLeftInput", "pikachu");
        await page.fill("#compareRightInput", "gengar");
        await page.press("#compareRightInput", "Enter"); // submits; at phone width the suggestion list covers the button
        await page.waitForSelector("#compareResult:not([hidden])");
        await page.waitForSelector("#browseGrid .browseTile");

        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations
            .filter((violation) => ["serious", "critical"].includes(violation.impact))
            .map((violation) => violation.id + ": " + violation.nodes.map((node) => node.target.join(" ")).join(", "));
        assert.deepEqual(serious, []);
    });
}

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
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true]");
    assert.match(await page.textContent("[role=listbox] [role=option]"), /Pikachu/);
    assert.equal(await page.textContent("[role=listbox] [role=option] mark"), "Pika"); // matched part highlighted

    await page.keyboard.press("ArrowDown");
    assert.ok(await page.getAttribute("#pokemonLookupInpt", "aria-activedescendant"));
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("pokemonName").textContent.trim() === "Pikachu");
    assert.equal(await page.getAttribute("#pokemonLookupInpt", "aria-expanded"), "false");
    assert.deepEqual(pageErrors, []);
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
    assert.equal(requests, 1);

    await page.reload();
    await page.waitForSelector("#browseGrid .browseTile");
    assert.equal(requests, 1); // skipped on the next visit
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
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true]");
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
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true]");
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
    await page.waitForSelector("#compareLeftInput[aria-expanded=true]");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "compareRightInput");

    await page.keyboard.type("geng");
    await page.waitForSelector("#compareRightInput[aria-expanded=true]");
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

test("the Who's that Pokémon? quiz reveals the answer and keeps score", async () => {
    await page.click("#quizStartBtn");
    await page.waitForSelector(".quizChoice");
    assert.equal(await page.locator(".quizChoice").count(), 4);
    assert.match(await page.getAttribute("#quizImage", "alt"), /Silhouette/);

    await page.click(".quizChoice >> nth=0");
    await page.waitForSelector("#quizStage.revealed");
    assert.match(await page.textContent("#quizResult"), /Correct!|Not quite/);
    assert.match(await page.textContent("#quizScore"), /Score \d\/1/);
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
    // The trimmed fixtures have no Showdown animations, so the toggle stays hidden.
    assert.equal(await page.isVisible("#animatedToggleBtn"), false);
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
    await page.waitForSelector("#pokemonLookupInpt[aria-expanded=true]");
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
    assert.ok((await page.locator('.browseTile[data-dex="25"] .tileSeen').count()) >= 1);
    assert.equal(await page.locator('#browseGrid .browseTile[data-dex="1"] .tileSeen').count(), 0);
});

test("the completion ring opens a trainer card", async () => {
    await search("pikachu");
    await page.waitForSelector("#pokemonCardContainer:not(.hidden)");
    await page.click("#dexProgress");
    await page.waitForSelector("#trainerCard[open]");
    assert.match(await page.textContent("#trainerCardSeen"), /of 1025 Pokémon seen/);
    assert.equal(await page.locator("#trainerCardRegions li").count(), 9);
    assert.match(await page.textContent("#trainerCardVisits"), /^Member since .+ · 🔥 \d+-day streak \(best \d+\)$/);
    assert.equal(await page.locator("#trainerCardStats li").count(), 6);
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
    assert.equal(await page.textContent("#dexToast"), "🏅 Kanto Pokédex complete!");
    assert.equal(await page.locator('.regionBanner.regionComplete[data-generation="1"]').count(), 1);
});

test("the shiny hunt counts encounters and collects shinies", async () => {
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
});
