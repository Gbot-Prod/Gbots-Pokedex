// PokéAPI access with caching. Everything network-related lives here.
import { idFromUrl, pruneCacheEntries } from "./utils.js";

export const API_BASE = "https://pokeapi.co/api/v2/";
export const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";

// Responses are cached in memory for this page, and in sessionStorage (when small
// enough) so going back to a Pokémon after a reload doesn't refetch it.
const responseCache = new Map();
const SESSION_CACHE_PREFIX = "pokedex:api:";
const MAX_SESSION_ENTRY_LENGTH = 150000; // characters; full /pokemon payloads with move lists are skipped

export function fetchJson(url) {
    if (!responseCache.has(url)) {
        const request = fetchJsonUncached(url).catch((error) => {
            responseCache.delete(url); // don't cache failures
            throw error;
        });
        responseCache.set(url, request);
    }
    return responseCache.get(url);
}

async function fetchJsonUncached(url) {
    try {
        const stored = sessionStorage.getItem(SESSION_CACHE_PREFIX + url);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // storage unavailable or corrupt; fetch instead
    }

    const response = await fetch(url);
    if (!response.ok) {
        const err = new Error("Network response was not ok " + response.statusText);
        err.status = response.status;
        throw err;
    }
    const text = await response.text();
    if (text.length <= MAX_SESSION_ENTRY_LENGTH) {
        try {
            sessionStorage.setItem(SESSION_CACHE_PREFIX + url, text);
        } catch {
            // quota exceeded; the in-memory cache still helps
        }
    }
    return JSON.parse(text);
}

const NAME_LIST_CACHE_KEY = "pokedex:entries:v1";
let allEntriesPromise = null;

// Every Pokémon (including alternate forms) as { name, id }, cached in localStorage.
export function getAllPokemonEntries() {
    if (!allEntriesPromise) {
        allEntriesPromise = fetchAllPokemonEntries().catch((error) => {
            allEntriesPromise = null; // allow a retry later
            throw error;
        });
    }
    return allEntriesPromise;
}

async function fetchAllPokemonEntries() {
    try {
        const cached = localStorage.getItem(NAME_LIST_CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch {
        // storage unavailable (private mode) or corrupt; fall through to the network
    }

    const data = await fetchJson(API_BASE + "pokemon?limit=2000");
    const entries = data.results.map((entry) => ({ name: entry.name, id: idFromUrl(entry.url) }));
    try {
        localStorage.setItem(NAME_LIST_CACHE_KEY, JSON.stringify(entries));
    } catch {
        // ignore quota/storage errors; suggestions still work for this visit
    }
    return entries;
}

// Move and TM details are kept in localStorage as small summaries, so a moves list
// opened again (even after closing the tab) doesn't refetch 20–90 large /move responses.
// v2 entries carry a savedAt timestamp so old data expires (moves get rebalanced between games).
const MOVE_CACHE_KEY = "pokedex:moves:v2";
const MOVE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MOVE_CACHE_MAX_ENTRIES = 3000; // ~950 moves plus the TM records looked up so far
let moveCache = null;
let moveCacheSaveTimer = null;

function getMoveCache() {
    if (!moveCache) {
        try {
            localStorage.removeItem("pokedex:moves:v1"); // replaced by v2
            const stored = JSON.parse(localStorage.getItem(MOVE_CACHE_KEY)) ?? {};
            moveCache = pruneCacheEntries(stored, Date.now(), MOVE_CACHE_MAX_AGE_MS, MOVE_CACHE_MAX_ENTRIES);
        } catch {
            moveCache = {};
        }
    }
    return moveCache;
}

// Writes are batched: a moves list fills dozens of entries at once.
function saveMoveCacheSoon() {
    clearTimeout(moveCacheSaveTimer);
    moveCacheSaveTimer = setTimeout(() => {
        try {
            // Prune only what's stored; the in-memory cache keeps everything for this visit.
            const pruned = pruneCacheEntries(moveCache, Date.now(), MOVE_CACHE_MAX_AGE_MS, MOVE_CACHE_MAX_ENTRIES);
            localStorage.setItem(MOVE_CACHE_KEY, JSON.stringify(pruned));
        } catch {
            // quota exceeded or storage unavailable; the in-memory cache still helps
        }
    }, 500);
}

// { type, power, accuracy, category, machines: [[versionGroup, machineUrl], …] }
export async function getMoveSummary(url) {
    const cache = getMoveCache();
    if (!cache[url]) {
        const move = await fetchJson(url);
        cache[url] = {
            savedAt: Date.now(),
            type: move.type.name,
            power: move.power,
            accuracy: move.accuracy,
            category: move.damage_class?.name ?? null,
            machines: (move.machines ?? []).map((entry) => [entry.version_group.name, entry.machine.url]),
        };
        saveMoveCacheSoon();
    }
    return cache[url];
}

// TM/HM/TR item name for a machine record, e.g. "tm085".
export async function getMachineItemName(url) {
    const cache = getMoveCache();
    if (!cache[url]) {
        const machine = await fetchJson(url);
        cache[url] = { savedAt: Date.now(), item: machine.item.name };
        saveMoveCacheSoon();
    }
    return cache[url].item;
}

// A Pokémon by name or number. Some species' default form has a suffixed name
// ("zygarde" is listed as "zygarde-50", "aegislash" as "aegislash-shield"), so a name
// that 404s is retried as a species and resolved to its default variety.
// The same Pokémon is reachable as /pokemon/gengar, /pokemon/94 and /pokemon/94/ (from
// other responses' links), so a loaded one is remembered under all of them.
function rememberPokemon(pokemon) {
    for (const key of [pokemon.id, pokemon.name]) {
        for (const url of [API_BASE + "pokemon/" + key, API_BASE + "pokemon/" + key + "/"]) {
            if (!responseCache.has(url)) {
                responseCache.set(url, Promise.resolve(pokemon));
            }
        }
    }
    return pokemon;
}

export async function fetchPokemon(query) {
    return rememberPokemon(await fetchPokemonUncached(query));
}

async function fetchPokemonUncached(query) {
    try {
        // If the name list is already loaded and doesn't have this name, skip the request
        // that would 404 (and log a console error) and go straight to the species.
        if (allEntriesPromise && !/^\d+$/.test(query)) {
            const entries = await allEntriesPromise.catch(() => null);
            if (entries && !entries.some((entry) => entry.name === query)) {
                throw Object.assign(new Error("Not in the Pokémon list"), { status: 404 });
            }
        }
        return await fetchJson(API_BASE + "pokemon/" + encodeURIComponent(query));
    } catch (error) {
        if (error.status !== 404 || /^\d+$/.test(query)) {
            throw error;
        }
        let species;
        try {
            species = await fetchJson(API_BASE + "pokemon-species/" + encodeURIComponent(query));
        } catch {
            throw error; // report the original "not found"
        }
        const variety = species.varieties.find((entry) => entry.is_default) ?? species.varieties[0];
        if (!variety) {
            throw error;
        }
        return fetchJson(variety.pokemon.url);
    }
}
