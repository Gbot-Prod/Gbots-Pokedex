// Browser smoke tests for the Pokédex page.
// PokéAPI is replaced by the trimmed fixtures in tests/fixtures and sprite
// images are stubbed, so the suite runs offline and gives stable results.
// Run with: npm test

/* global document -- used inside page.waitForFunction callbacks, which run in the browser */

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

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
    page.on("pageerror", (error) => pageErrors.push(error.message));

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
