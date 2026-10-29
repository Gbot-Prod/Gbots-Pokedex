// PokéAPI access with caching. Everything network-related lives here.
import { idFromUrl } from "./utils.js";

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
const MOVE_CACHE_KEY = "pokedex:moves:v1";
let moveCache = null;
let moveCacheSaveTimer = null;

function getMoveCache() {
    if (!moveCache) {
        try {
            moveCache = JSON.parse(localStorage.getItem(MOVE_CACHE_KEY)) ?? {};
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
            localStorage.setItem(MOVE_CACHE_KEY, JSON.stringify(moveCache));
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
        cache[url] = { item: machine.item.name };
        saveMoveCacheSoon();
    }
    return cache[url].item;
}
