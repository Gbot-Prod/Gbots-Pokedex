// Shared setup for the browser test files: a static server for the site, one Chromium per
// file, and a fresh context + page per test with PokéAPI mocked from tests/fixtures (unless
// LIVE_API is set). Each file registers the hooks with its own node:test functions.

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

function useMockedPages(hooks, onPage) {
    let server;
    let baseUrl;
    let browser;
    let context;
    let page;
    let pageErrors;

    hooks.before(async () => {
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

    hooks.after(async () => {
        await browser?.close();
        server?.close();
    });

    hooks.beforeEach(async () => {
        // Service workers would bypass page.route, so the mocked tests block them.
        context = await browser.newContext({ serviceWorkers: LIVE_API ? "allow" : "block" });
        page = await context.newPage();
        pageErrors = [];
        onPage({ baseUrl, context, page, pageErrors });
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

    hooks.afterEach(async () => {
        await context?.close();
    });
}

module.exports = { BLANK_PNG, FIXTURES, LIVE_API, fixtureFor, pokemonList, useMockedPages };
