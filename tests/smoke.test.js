// Browser smoke tests for the Pokédex page.
// PokéAPI is replaced by the trimmed fixtures in tests/fixtures and sprite
// images are stubbed, so the suite runs offline and gives stable results.
// Run with: npm test
// `npm run check:live` runs the same tests against the real PokéAPI (LIVE_API=1)
// to catch API changes the fixtures would hide.

/* global document -- used inside page.waitForFunction callbacks, which run in the browser */

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

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
    page = await browser.newPage();
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
    assert.match(await page.innerText("#statsList"), /Total\s+320/);
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
    assert.equal(await page.isVisible("#movesTable th:first-child"), false); // no level column for TMs
});
