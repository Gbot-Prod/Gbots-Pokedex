// Pokémon tile lists: the browse grid (with filters), favorites and recently viewed.
import { API_BASE, fetchJson, getAllPokemonEntries, getSpeciesSlugs, setSprite } from "./api.js";
import { hasSeen, seenMark } from "./progress.js";
import {
    GENERATIONS,
    MAX_DEX_NUMBER,
    TYPE_ICONS,
    entryDisplayName,
    entrySpecies,
    formatDexNumber,
    formatName,
    idFromUrl,
} from "./utils.js";

// Set by initLists: loads a Pokémon onto the main card / returns the one shown there.
let showPokemon = () => {};
let getCurrentPokemon = () => null;

export function initLists(options) {
    showPokemon = options.showPokemon;
    getCurrentPokemon = options.getCurrentPokemon;
    renderFavorites();
    renderRecent();
    initBrowse();
    loadTileTypes();
    loadSpeciesSlugs();
}

// National Dex number -> species slug. Default forms are listed under their form's name
// ("zygarde-50", "aegislash-shield"), so tiles use the species name instead.
let speciesSlugs = null;

async function loadSpeciesSlugs() {
    try {
        speciesSlugs = await getSpeciesSlugs();
        renderBrowsePage();
        renderFavorites();
        renderRecent();
    } catch {
        // tiles keep the title-cased Pokémon names
    }
}

function tileName(entry) {
    return entryDisplayName(entry, speciesSlugs);
}

// id -> type names in slot order, built from the 18 /type responses (cached by fetchJson).
let typesById = null;

async function loadTileTypes() {
    try {
        const types = await Promise.all(Object.keys(TYPE_ICONS).map((type) => fetchJson(API_BASE + "type/" + type)));
        const map = new Map();
        for (const type of types) {
            for (const { pokemon, slot } of type.pokemon) {
                const id = idFromUrl(pokemon.url);
                const list = map.get(id) ?? [];
                list[(slot ?? list.length + 1) - 1] = type.name;
                map.set(id, list);
            }
        }
        typesById = map;
        renderBrowsePage();
        renderFavorites();
        renderRecent();
    } catch {
        // tiles simply stay without type icons
    }
}

// Hides an image until it has loaded so it can fade in instead of popping.
export function fadeInImage(image, src) {
    if (image.getAttribute("src") === src) {
        return;
    }
    image.classList.add("pending");
    image.addEventListener("load", () => image.classList.remove("pending"), { once: true });
    image.addEventListener("error", () => image.classList.remove("pending"), { once: true });
    image.src = src;
}

// --- Browse grid ----------------------------------------------------------

const BROWSE_PAGE_SIZE = 24;
const browseGridElement = document.getElementById("browseGrid");
const browsePageLabel = document.getElementById("browsePageLabel");
const browsePrevButton = document.getElementById("browsePrevBtn");
const browseNextButton = document.getElementById("browseNextBtn");
const browseStatusElement = document.getElementById("browseStatus");
const typeFilterElement = document.getElementById("typeFilter");
const generationFilterElement = document.getElementById("generationFilter");
const sortOrderElement = document.getElementById("sortOrder");

const SORTERS = {
    number: (a, b) => a.id - b.id,
    "number-desc": (a, b) => b.id - a.id,
    name: (a, b) => a.name.localeCompare(b.name),
    "name-desc": (a, b) => b.name.localeCompare(a.name),
};

let nationalDexEntries = [];
let browseEntries = [];
let browsePage = 0;
const typeMembersCache = new Map();

async function initBrowse() {
    for (const type of Object.keys(TYPE_ICONS)) {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = formatName(type);
        typeFilterElement.append(option);
    }

    for (const generation of GENERATIONS) {
        const option = document.createElement("option");
        option.value = generation.number;
        option.textContent = "Gen " + generation.number + " (" + generation.region + ")";
        generationFilterElement.append(option);
    }

    browseStatusElement.textContent = "Loading Pokémon…";
    try {
        const entries = await getAllPokemonEntries();
        // Only the National Dex here; alternate forms are reachable through search.
        nationalDexEntries = entries.filter((entry) => entry.id <= MAX_DEX_NUMBER);
        await applyBrowseFilters();
    } catch {
        browseStatusElement.textContent = "Couldn't load the Pokémon list.";
    }
}

// Ids of every Pokémon with the given type, fetched once per type.
async function getTypeMemberIds(type) {
    if (!typeMembersCache.has(type)) {
        const data = await fetchJson(API_BASE + "type/" + type);
        typeMembersCache.set(type, new Set(data.pokemon.map((entry) => idFromUrl(entry.pokemon.url))));
    }
    return typeMembersCache.get(type);
}

async function applyBrowseFilters() {
    updateRegionStrip();
    const type = typeFilterElement.value;
    const generation = GENERATIONS.find((gen) => String(gen.number) === generationFilterElement.value);
    let entries = nationalDexEntries;

    if (generation) {
        entries = entries.filter((entry) => entry.id >= generation.first && entry.id <= generation.last);
    }

    try {
        if (type) {
            browseStatusElement.textContent = "Loading " + formatName(type) + " Pokémon…";
            const members = await getTypeMemberIds(type);
            if (
                type !== typeFilterElement.value ||
                generationFilterElement.value !== (generation ? String(generation.number) : "")
            ) {
                return; // the filter changed while we were waiting
            }
            entries = entries.filter((entry) => members.has(entry.id));
        }
    } catch {
        browseStatusElement.textContent = "Couldn't load that filter. Please try again.";
        return;
    }

    browseEntries = [...entries].sort(SORTERS[sortOrderElement.value] ?? SORTERS.number);
    browsePage = 0;
    browseStatusElement.textContent = entries.length ? "" : "No Pokémon match these filters.";
    renderBrowsePage();
}

function renderBrowsePage() {
    const pageCount = Math.max(1, Math.ceil(browseEntries.length / BROWSE_PAGE_SIZE));
    browsePage = Math.min(Math.max(browsePage, 0), pageCount - 1);
    const pageEntries = browseEntries.slice(browsePage * BROWSE_PAGE_SIZE, (browsePage + 1) * BROWSE_PAGE_SIZE);

    browseGridElement.replaceChildren(...pageEntries.map(createBrowseTile));
    markOfflineAvailability();
    browsePageLabel.textContent = "Page " + (browsePage + 1) + " of " + pageCount;
    browsePrevButton.disabled = browsePage === 0;
    browseNextButton.disabled = browsePage >= pageCount - 1;
}

function createBrowseTile(entry) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "browseTile";
    button.dataset.id = entry.id;
    button.dataset.name = entry.name;

    const sprite = document.createElement("img");
    setSprite(sprite, entry.id, fadeInImage);
    sprite.alt = "";
    sprite.width = 96;
    sprite.height = 96;
    sprite.loading = "lazy";

    const dexNumber = entrySpecies(entry, speciesSlugs)?.id ?? entry.id;
    button.dataset.dex = dexNumber;
    const number = document.createElement("small");
    number.textContent = formatDexNumber(dexNumber);

    const name = document.createElement("span");
    name.textContent = tileName(entry);

    button.append(sprite, number, name);
    if (hasSeen(dexNumber)) {
        button.append(seenMark());
    }

    const types = typesById?.get(entry.id)?.filter(Boolean) ?? [];
    if (types.length) {
        const typeIcons = document.createElement("span");
        typeIcons.className = "tileTypes";
        for (const type of types) {
            const icon = document.createElement("img");
            icon.src = "assets/" + TYPE_ICONS[type];
            icon.alt = formatName(type) + " type";
            icon.title = formatName(type);
            icon.width = 20;
            icon.height = 20;
            typeIcons.append(icon);
        }
        button.append(typeIcons);
    }

    button.addEventListener("click", () => {
        showPokemon(entry.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    item.append(button);
    return item;
}

typeFilterElement.addEventListener("change", applyBrowseFilters);
generationFilterElement.addEventListener("change", applyBrowseFilters);

// --- Region showcase ---------------------------------------------------------------------
// One banner per region with its starter trio; clicking filters the grid to that generation.

const REGION_STARTERS = {
    1: [1, 4, 7],
    2: [152, 155, 158],
    3: [252, 255, 258],
    4: [387, 390, 393],
    5: [495, 498, 501],
    6: [650, 653, 656],
    7: [722, 725, 728],
    8: [810, 813, 816],
    9: [906, 909, 912],
};

function renderRegionStrip() {
    const strip = document.getElementById("regionStrip");
    strip.replaceChildren(
        ...GENERATIONS.map((generation) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "regionBanner region" + generation.number;
            button.setAttribute("aria-pressed", "false");
            button.dataset.generation = generation.number;

            const name = document.createElement("span");
            name.className = "regionName";
            name.textContent = generation.region;
            const gen = document.createElement("small");
            gen.textContent = "Gen " + generation.number;
            const starters = document.createElement("span");
            starters.className = "regionStarters";
            for (const id of REGION_STARTERS[generation.number]) {
                const sprite = document.createElement("img");
                sprite.alt = "";
                sprite.width = 48;
                sprite.height = 48;
                sprite.loading = "lazy";
                setSprite(sprite, id);
                starters.append(sprite);
            }
            button.append(starters, name, gen);
            button.addEventListener("click", () => {
                const selected = generationFilterElement.value === String(generation.number);
                generationFilterElement.value = selected ? "" : String(generation.number);
                applyBrowseFilters();
                if (!selected) {
                    browseGridElement.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
            item.append(button);
            return item;
        }),
    );
}

// Keeps the banners' pressed state in step with the generation filter.
function updateRegionStrip() {
    for (const banner of document.querySelectorAll(".regionBanner")) {
        banner.setAttribute("aria-pressed", String(banner.dataset.generation === generationFilterElement.value));
    }
}

renderRegionStrip();
generationFilterElement.addEventListener("change", updateRegionStrip);
sortOrderElement.addEventListener("change", applyBrowseFilters);
browsePrevButton.addEventListener("click", () => {
    browsePage--;
    renderBrowsePage();
});
browseNextButton.addEventListener("click", () => {
    browsePage++;
    renderBrowsePage();
});

// --- Favorites ------------------------------------------------------------

const FAVORITES_KEY = "pokedex:favorites:v1";
const favoriteButton = document.getElementById("favoriteBtn");
const favoritesSection = document.getElementById("favoritesSection");
const favoritesListElement = document.getElementById("favoritesList");

function loadStoredList(key) {
    try {
        const list = JSON.parse(localStorage.getItem(key));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function saveStoredList(key, list) {
    try {
        localStorage.setItem(key, JSON.stringify(list));
    } catch {
        // storage full or unavailable; the list still works until the page closes
    }
}

let favorites = loadStoredList(FAVORITES_KEY);

function isFavorite(id) {
    return favorites.some((entry) => entry.id === id);
}

function toggleFavorite() {
    const currentPokemon = getCurrentPokemon();
    if (!currentPokemon) {
        return;
    }
    if (isFavorite(currentPokemon.id)) {
        favorites = favorites.filter((entry) => entry.id !== currentPokemon.id);
    } else {
        favorites = [...favorites, currentPokemon].sort((a, b) => a.id - b.id);
    }
    saveStoredList(FAVORITES_KEY, favorites);
    updateFavoriteButton();
    renderFavorites();
}

export function updateFavoriteButton() {
    const currentPokemon = getCurrentPokemon();
    const active = currentPokemon !== null && isFavorite(currentPokemon.id);
    favoriteButton.textContent = active ? "★" : "☆";
    favoriteButton.setAttribute("aria-pressed", String(active));
    favoriteButton.title = active ? "Remove from favorites" : "Add to favorites";
}

function renderFavorites() {
    favoritesSection.hidden = favorites.length === 0;
    favoritesListElement.replaceChildren(...favorites.map(createBrowseTile));
    markOfflineAvailability();
}

favoriteButton.addEventListener("click", toggleFavorite);

// --- Recently viewed --------------------------------------------------------

const RECENT_KEY = "pokedex:recent:v1";
const MAX_RECENT = 10;
const recentSection = document.getElementById("recentSection");
const recentListElement = document.getElementById("recentList");

let recentPokemon = loadStoredList(RECENT_KEY);

export function getRecentPokemon() {
    return recentPokemon;
}

export function removeFromRecent(id) {
    recentPokemon = recentPokemon.filter((entry) => entry.id !== id);
    saveStoredList(RECENT_KEY, recentPokemon);
    renderRecent();
}

export function addToRecent(pokemon) {
    recentPokemon = [pokemon, ...recentPokemon.filter((entry) => entry.id !== pokemon.id)].slice(0, MAX_RECENT);
    saveStoredList(RECENT_KEY, recentPokemon);
    renderRecent();
}

function renderRecent() {
    recentSection.hidden = recentPokemon.length === 0;
    recentListElement.replaceChildren(...recentPokemon.map(createBrowseTile));
    markOfflineAvailability();
}

document.getElementById("clearRecentBtn").addEventListener("click", () => {
    recentPokemon = [];
    saveStoredList(RECENT_KEY, recentPokemon);
    renderRecent();
});

// --- Offline availability ---------------------------------------------------------
// While offline, tiles for Pokémon the service worker hasn't cached are dimmed, since
// opening them would fail. (The runtime cache name matches sw.js.)

const RUNTIME_CACHE = "pokedex-runtime-v1";

async function isCachedOffline(id, name) {
    const cache = await caches.open(RUNTIME_CACHE);
    for (const key of [id, name]) {
        for (const url of [API_BASE + "pokemon/" + key, API_BASE + "pokemon/" + key + "/"]) {
            if (await cache.match(url)) {
                return true;
            }
        }
    }
    return false;
}

async function markOfflineAvailability() {
    const tiles = document.querySelectorAll(".browseTile");
    if (navigator.onLine || !("caches" in window)) {
        for (const tile of tiles) {
            tile.classList.remove("unavailableOffline");
            tile.removeAttribute("aria-disabled");
        }
        return;
    }
    for (const tile of tiles) {
        const available = await isCachedOffline(tile.dataset.id, tile.dataset.name);
        tile.classList.toggle("unavailableOffline", !available);
        if (available) {
            tile.removeAttribute("aria-disabled");
        } else {
            tile.setAttribute("aria-disabled", "true");
        }
    }
}

window.addEventListener("online", markOfflineAvailability);
window.addEventListener("offline", markOfflineAvailability);
