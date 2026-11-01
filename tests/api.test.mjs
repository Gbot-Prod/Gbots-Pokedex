// Unit tests for pokemon/api.js with fetch and Web Storage stubbed out.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
    #items = new Map();
    getItem(key) {
        return this.#items.has(key) ? this.#items.get(key) : null;
    }
    setItem(key, value) {
        this.#items.set(key, String(value));
    }
    removeItem(key) {
        this.#items.delete(key);
    }
}
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

// Fake PokéAPI: path (after /api/v2/) -> JSON body; anything else is a 404.
const API = "https://pokeapi.co/api/v2/";
let routes = {};
let requests = [];
globalThis.fetch = async (url) => {
    requests.push(url.replace(API, ""));
    const body = routes[url.replace(API, "")];
    return body
        ? { ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(body) }
        : { ok: false, status: 404, statusText: "Not Found", text: async () => "Not Found" };
};

const api = await import("../pokemon/api.js");

beforeEach(() => {
    requests = [];
});

test("fetchPokemon falls back to the species' default variety", async () => {
    routes = {
        "pokemon-species/aegislash": {
            varieties: [
                { is_default: false, pokemon: { url: API + "pokemon/10026/" } },
                { is_default: true, pokemon: { url: API + "pokemon/681/" } },
            ],
        },
        "pokemon/681/": { id: 681, name: "aegislash-shield" },
    };
    const pokemon = await api.fetchPokemon("aegislash");
    assert.equal(pokemon.name, "aegislash-shield");
    assert.deepEqual(requests, ["pokemon/aegislash", "pokemon-species/aegislash", "pokemon/681/"]);
});

test("fetchPokemon reports numbers that don't exist as not found", async () => {
    routes = {};
    await assert.rejects(api.fetchPokemon("99999"), (error) => error.status === 404);
    assert.deepEqual(requests, ["pokemon/99999"]); // no species retry for numbers
});

test("a loaded Pokémon is reused for its id and name", async () => {
    routes = { "pokemon/gengar": { id: 94, name: "gengar" } };
    await api.fetchPokemon("gengar");
    requests = [];
    assert.equal((await api.fetchPokemon("94")).name, "gengar");
    assert.equal((await api.fetchJson(API + "pokemon/94/")).name, "gengar");
    assert.deepEqual(requests, []);
});

test("move summaries are fetched once and kept in the move cache", async () => {
    routes = {
        "move/85/": {
            type: { name: "electric" },
            power: 90,
            accuracy: 100,
            damage_class: { name: "special" },
            machines: [{ version_group: { name: "red-blue" }, machine: { url: API + "machine/24/" } }],
        },
    };
    const summary = await api.getMoveSummary(API + "move/85/");
    assert.deepEqual(
        { type: summary.type, power: summary.power, category: summary.category, machines: summary.machines },
        { type: "electric", power: 90, category: "special", machines: [["red-blue", API + "machine/24/"]] },
    );
    requests = [];
    await api.getMoveSummary(API + "move/85/");
    assert.deepEqual(requests, []);
});

test("missing sprites are skipped, including ones learned at runtime", () => {
    assert.equal(api.spriteUrl(10301), null); // known gap
    assert.match(api.spriteUrl(25), /\/25\.png$/);
    api.noteMissingSprite(25);
    assert.equal(api.spriteUrl(25), null);
    assert.ok(JSON.parse(localStorage.getItem("pokedex:missing-sprites:v1")).includes(25));
});
