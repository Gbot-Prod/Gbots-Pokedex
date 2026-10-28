const imgElement = document.getElementById("pokemonSprite");
const nameElement = document.getElementById("pokemonName");
const numberElement = document.getElementById("pokemonNumber");
const type1IconElement = document.getElementById("pokemonType1");
const type2IconElement = document.getElementById("pokemonType2");
const heightElement = document.getElementById("pokemonHeight");
const weightElement = document.getElementById("pokemonWeight");
const abilityElement = document.getElementById("pokemonAbility");
const statsListElement = document.getElementById("statsList");
const pokemonCard = document.getElementById("pokemonCardContainer");
const errorElement = document.getElementById("errorMessage");
const loadingElement = document.getElementById("loadingIndicator");
const searchButton = document.getElementById("getPokemonBtn");

const searchInput = document.getElementById("pokemonLookupInpt");
const genusElement = document.getElementById("pokemonGenus");
const flavorTextElement = document.getElementById("pokemonFlavorText");

const evolutionSection = document.getElementById("pokemonEvolution");
const evolutionListElement = document.getElementById("evolutionList");

const API_BASE = "https://pokeapi.co/api/v2/";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";

const prevButton = document.getElementById("prevPokemonBtn");
const nextButton = document.getElementById("nextPokemonBtn");

// Highest National Pokédex number in PokéAPI (Pecharunt). Higher ids are alternate forms.
const MAX_DEX_NUMBER = 1025;

const shinyButton = document.getElementById("shinyToggleBtn");

let currentDexNumber = null;
let currentPokemon = null; // { id, name } of the Pokémon on the card
let currentSprites = null;
let showShiny = false;
let latestRequest = 0;

// Accepts names ("Pikachu", "mr mime") and Pokédex numbers ("25", "#025").
function normalizeQuery(rawQuery) {
    const query = rawQuery.trim().toLowerCase().replace(/^#/, "");
    if (/^\d+$/.test(query)) {
        return String(parseInt(query, 10));
    }
    return query.replace(/\s+/g, "-");
}

function fetchData() {
    const query = normalizeQuery(searchInput.value);
    if (!query || query === "0") {
        return;
    }
    loadPokemon(query);
}

async function loadPokemon(query) {
    const requestId = ++latestRequest;
    try {
        clearFields();
        setLoading(true);

        const data = await fetchJson(API_BASE + "pokemon/" + encodeURIComponent(query));
        if (requestId !== latestRequest) {
            return; // a newer search has started; drop this stale result
        }
        renderPokemon(data);
        loadSpecies(data.species.url, requestId);
    }
    catch (error) {
        if (requestId === latestRequest) {
            showError(isNotFound(error) ? "Pokémon not found. Check the spelling or number and try again." : "Couldn't reach the Pokédex. Please try again.");
        }
    }
    finally {
        if (requestId === latestRequest) {
            setLoading(false);
        }
    }
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const err = new Error('Network response was not ok ' + response.statusText);
        err.status = response.status;
        throw err;
    }
    return response.json();
}

// Species data (description, genus) is secondary, so a failure here only hides that section.
async function loadSpecies(url, requestId) {
    try {
        const species = await fetchJson(url);
        if (requestId !== latestRequest) {
            return;
        }
        renderSpecies(species);

        const chain = await fetchJson(species.evolution_chain.url);
        if (requestId === latestRequest) {
            renderEvolutionChain(chain.chain);
        }
    }
    catch (error) {
        if (requestId === latestRequest) {
            genusElement.textContent = "";
            flavorTextElement.textContent = "";
            evolutionSection.hidden = true;
        }
    }
}

function idFromUrl(url) {
    return Number(url.split("/").filter(Boolean).pop());
}

// Summarises how a Pokémon evolves, e.g. "Lv. 16", "Thunder Stone", "Trade".
function describeEvolution(details) {
    const detail = details[0];
    if (!detail) {
        return "";
    }
    if (detail.min_level) {
        return "Lv. " + detail.min_level;
    }
    if (detail.item) {
        return formatName(detail.item.name);
    }
    if (detail.min_happiness) {
        return "Friendship";
    }
    return formatName(detail.trigger.name);
}

// Flattens the evolution tree into stages so branching families (Eevee) show side by side.
function renderEvolutionChain(root) {
    const stages = [];
    let level = [root];
    while (level.length) {
        stages.push(level);
        level = level.flatMap((node) => node.evolves_to);
    }

    evolutionListElement.replaceChildren();
    evolutionSection.hidden = stages.length < 2;

    stages.forEach((stage, index) => {
        if (index > 0) {
            const arrow = document.createElement("li");
            arrow.className = "evolutionArrow";
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = "→";
            evolutionListElement.append(arrow);
        }

        const stageItem = document.createElement("li");
        stageItem.className = "evolutionStage";
        // Large branches (Eevee) wrap into a grid instead of one tall column.
        stageItem.classList.toggle("branching", stage.length > 3);
        for (const node of stage) {
            stageItem.append(createEvolutionButton(node));
        }
        evolutionListElement.append(stageItem);
    });
}

function createEvolutionButton(node) {
    const dexNumber = idFromUrl(node.species.url);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evolutionMember";
    if (dexNumber === currentDexNumber) {
        button.classList.add("current");
        button.setAttribute("aria-current", "true");
    }

    const sprite = document.createElement("img");
    sprite.src = SPRITE_BASE + dexNumber + ".png";
    sprite.alt = "";
    sprite.width = 72;
    sprite.height = 72;
    sprite.loading = "lazy";

    const name = document.createElement("span");
    name.textContent = formatName(node.species.name);

    button.append(sprite, name);

    const method = describeEvolution(node.evolution_details);
    if (method) {
        const methodLabel = document.createElement("small");
        methodLabel.textContent = method;
        button.append(methodLabel);
    }

    button.addEventListener("click", () => goToDexNumber(dexNumber));
    return button;
}

function renderSpecies(species) {
    const genus = species.genera.find((entry) => entry.language.name === "en");
    genusElement.textContent = genus ? genus.genus : "";

    // Entries are oldest-first; show the most recent English one.
    const entries = species.flavor_text_entries.filter((entry) => entry.language.name === "en");
    const latest = entries[entries.length - 1];
    // Game text uses form feeds and hard line breaks; collapse them into normal spaces.
    flavorTextElement.textContent = latest ? latest.flavor_text.replace(/[\f\n\r\u00ad]+/g, " ").replace(/\s+/g, " ").trim() : "";
}

function renderPokemon(data) {
    // Alternate forms (e.g. id 10034) navigate relative to their species' dex number.
    currentDexNumber = idFromUrl(data.species.url) || data.id;
    currentPokemon = { id: data.id, name: data.name };
    updateFavoriteButton();
    addToRecent(currentPokemon);
    prevButton.disabled = currentDexNumber <= 1;
    nextButton.disabled = currentDexNumber >= MAX_DEX_NUMBER;

    //fetch pokemon name
    nameElement.textContent = formatName(data.name);

    //fetch pokemon number
    numberElement.textContent = "Pokemon no#" + data.id;

    //species info arrives separately; clear the previous Pokémon's text meanwhile
    genusElement.textContent = "";
    flavorTextElement.textContent = "";
    evolutionSection.hidden = true;

    //fetch pokemon type
    const pkmnType = data.types[0].type.name;
    const pkmnType2 = data.types[1]?.type.name || "none";
    fetchPKMNType(pkmnType, pkmnType2);
    applyTypeTheme(pkmnType);

    //fetch pokemon height (decimetres) and weight (hectograms)
    heightElement.textContent = (data.height / 10).toFixed(1) + " m";
    weightElement.textContent = (data.weight / 10).toFixed(1) + " kg";

    //fetch pokemon abilities
    renderAbilities(data.abilities);

    //fetch pokemon base stats
    renderStats(data.stats);

    //fetch pokemon sprite
    currentSprites = data.sprites;
    renderSprite();

    pokemonCard.classList.remove("hidden");
}

// Not every form has a HOME render, so fall back to official artwork, then the game sprite.
function pickSprite(sprites, shiny) {
    const key = shiny ? "front_shiny" : "front_default";
    return sprites.other.home[key] || sprites.other["official-artwork"][key] || sprites[key] || "";
}

function renderSprite() {
    if (!currentSprites) {
        return;
    }
    const shinySrc = pickSprite(currentSprites, true);
    shinyButton.hidden = !shinySrc;
    const src = showShiny && shinySrc ? shinySrc : pickSprite(currentSprites, false);
    if (src) {
        imgElement.src = src;
        imgElement.style.display = "block";
    } else {
        imgElement.removeAttribute("src");
        imgElement.style.display = "none";
    }
    shinyButton.setAttribute("aria-pressed", String(showShiny));
    shinyButton.classList.toggle("active", showShiny);
}

// "lightning-rod" -> "Lightning Rod"
function formatName(name) {
    return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function renderAbilities(abilities) {
    abilityElement.replaceChildren();

    const label = document.createElement("span");
    label.className = "abilityLabel";
    label.textContent = abilities.length === 1 ? "Ability:" : "Abilities:";
    abilityElement.append(label);

    for (const { ability, is_hidden } of abilities) {
        const chip = document.createElement("span");
        chip.className = "abilityChip" + (is_hidden ? " hiddenAbility" : "");
        chip.textContent = formatName(ability.name) + (is_hidden ? " (hidden)" : "");
        abilityElement.append(chip);
    }
}

const STAT_LABELS = {
    "hp": "HP",
    "attack": "Attack",
    "defense": "Defense",
    "special-attack": "Sp. Atk",
    "special-defense": "Sp. Def",
    "speed": "Speed",
};
// Highest single base stat in the games (Blissey's HP), used to scale the bars.
const MAX_BASE_STAT = 255;

function renderStats(stats) {
    statsListElement.replaceChildren();
    let total = 0;

    for (const { stat, base_stat } of stats) {
        total += base_stat;
        statsListElement.append(createStatRow(STAT_LABELS[stat.name] || formatName(stat.name), base_stat, MAX_BASE_STAT));
    }

    const totalRow = createStatRow("Total", total);
    totalRow.classList.add("statTotal");
    statsListElement.append(totalRow);
}

function createStatRow(label, value, max) {
    const row = document.createElement("li");
    row.className = "statRow";

    const name = document.createElement("span");
    name.className = "statName";
    name.textContent = label;

    const number = document.createElement("span");
    number.className = "statValue";
    number.textContent = value;

    row.append(name, number);

    if (max) {
        const bar = document.createElement("span");
        bar.className = "statBar";
        bar.setAttribute("role", "meter");
        bar.setAttribute("aria-label", label);
        bar.setAttribute("aria-valuenow", value);
        bar.setAttribute("aria-valuemin", 0);
        bar.setAttribute("aria-valuemax", max);

        const fill = document.createElement("span");
        fill.className = "statFill";
        fill.style.width = Math.min(100, (value / max) * 100) + "%";
        // red (low) -> green (high)
        fill.style.backgroundColor = "hsl(" + Math.round(Math.min(value, 150) / 150 * 120) + ", 70%, 45%)";

        bar.append(fill);
        row.append(bar);
    }

    return row;
}

const TYPE_ICONS = {
    normal: "NormalIcon.png",
    fire: "FireIcon.png",
    water: "WaterIcon.png",
    grass: "GrassIcon.png",
    electric: "ElectricIcon.png",
    ice: "IceIcon.png",
    fighting: "FightingIcon.png",
    poison: "PoisonIcon.png",
    ground: "GroundIcon.png",
    flying: "FlyingIcon.png",
    psychic: "PsychicIcon.png",
    bug: "BugIcon.png",
    rock: "RockIcon.png",
    ghost: "GhostIcon.png",
    dark: "DarkIcon.png",
    dragon: "DragonIcon.png",
    steel: "SteelIcon.png",
    fairy: "FairyIcon.png",
};

// Card theme per type: strong (header), light (body) and deep (gradient) shades.
// Strong shades are dark enough for white header text.
const TYPE_COLORS = {
    normal: ["#8a8a65", "#d4d4bd", "#8a8a65"],
    fire: ["#d0611c", "#f5c19c", "#d0611c"],
    water: ["#4a6fd8", "#b3c6f2", "#3559c4"],
    grass: ["#4f9a33", "#bfe3ac", "#3f8a25"],
    electric: ["#b8920c", "#f8e49a", "#c9a20f"],
    ice: ["#3f9e9b", "#c4ecea", "#3f9e9b"],
    fighting: ["#a82a22", "#e7aaa5", "#a82a22"],
    poison: ["#8a3b8a", "#d9b0d9", "#7f357f"],
    ground: ["#a8873a", "#ecd9a8", "#a8873a"],
    flying: ["#7a68c8", "#d2c8f5", "#6a58b8"],
    psychic: ["#d63a6c", "#f8bcd0", "#d63a6c"],
    bug: ["#7b8c14", "#d9e39a", "#7b8c14"],
    rock: ["#94812e", "#e0d4a0", "#94812e"],
    ghost: ["#5a4785", "#c3b6dd", "#4d3c78"],
    dragon: ["#5a2fe0", "#c2aef8", "#4b22cc"],
    dark: ["#5c4838", "#c9bbae", "#4a3a2c"],
    steel: ["#7a7a96", "#d8d8e6", "#6a6a86"],
    fairy: ["#c05c8a", "#f3c8dc", "#c05c8a"],
};

function applyTypeTheme(type) {
    const colors = TYPE_COLORS[type];
    const names = ["--type-strong", "--type-light", "--type-deep"];
    names.forEach((name, index) => {
        if (colors) {
            pokemonCard.style.setProperty(name, colors[index]);
        } else {
            pokemonCard.style.removeProperty(name);
        }
    });
}

function setTypeIcon(iconElement, type) {
    const icon = TYPE_ICONS[type];
    if (icon) {
        iconElement.src = "assets/" + icon;
        iconElement.style.display = "block";
    } else {
        iconElement.removeAttribute("src");
        iconElement.style.display = "none";
    }
}

function fetchPKMNType(pkmnType, pkmnType2) {
    setTypeIcon(type1IconElement, pkmnType);
    setTypeIcon(type2IconElement, pkmnType2);
}

function setLoading(isLoading) {
    loadingElement.classList.toggle("hidden", !isLoading);
    searchButton.disabled = isLoading;
}

function isNotFound(error) {
    return error.status === 404;
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
}

function clearFields() {
    pokemonCard.classList.add("hidden");
    errorElement.classList.add("hidden");
    errorElement.textContent = "";
}

// --- Autocomplete -------------------------------------------------------

const NAME_LIST_CACHE_KEY = "pokedex:entries:v1";
const nameListElement = document.getElementById("pokemonNameList");
let nameListLoaded = false;
let allEntriesPromise = null;

// Every Pokémon (including alternate forms) as { name, id }, cached in localStorage.
function getAllPokemonEntries() {
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
    }
    catch (error) {
        // storage unavailable (private mode) or corrupt; fall through to the network
    }

    const data = await fetchJson(API_BASE + "pokemon?limit=2000");
    const entries = data.results.map((entry) => ({ name: entry.name, id: idFromUrl(entry.url) }));
    try {
        localStorage.setItem(NAME_LIST_CACHE_KEY, JSON.stringify(entries));
    }
    catch (error) {
        // ignore quota/storage errors; suggestions still work for this visit
    }
    return entries;
}

// The full list is only fetched once the user starts interacting with the search box.
async function loadNameSuggestions() {
    if (nameListLoaded) {
        return;
    }
    nameListLoaded = true;
    try {
        const entries = await getAllPokemonEntries();
        const options = entries.map((entry) => {
            const option = document.createElement("option");
            option.value = formatName(entry.name);
            return option;
        });
        nameListElement.replaceChildren(...options);
    }
    catch (error) {
        nameListLoaded = false; // allow a retry on the next focus
    }
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

// National Dex number ranges introduced by each generation.
const GENERATIONS = [
    { number: 1, region: "Kanto", first: 1, last: 151 },
    { number: 2, region: "Johto", first: 152, last: 251 },
    { number: 3, region: "Hoenn", first: 252, last: 386 },
    { number: 4, region: "Sinnoh", first: 387, last: 493 },
    { number: 5, region: "Unova", first: 494, last: 649 },
    { number: 6, region: "Kalos", first: 650, last: 721 },
    { number: 7, region: "Alola", first: 722, last: 809 },
    { number: 8, region: "Galar", first: 810, last: 905 },
    { number: 9, region: "Paldea", first: 906, last: 1025 },
];
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
    }
    catch (error) {
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
            if (type !== typeFilterElement.value || generationFilterElement.value !== (generation ? String(generation.number) : "")) {
                return; // the filter changed while we were waiting
            }
            entries = entries.filter((entry) => members.has(entry.id));
        }
    }
    catch (error) {
        browseStatusElement.textContent = "Couldn't load that filter. Please try again.";
        return;
    }

    browseEntries = entries;
    browsePage = 0;
    browseStatusElement.textContent = entries.length ? "" : "No Pokémon match these filters.";
    renderBrowsePage();
}

function renderBrowsePage() {
    const pageCount = Math.max(1, Math.ceil(browseEntries.length / BROWSE_PAGE_SIZE));
    browsePage = Math.min(Math.max(browsePage, 0), pageCount - 1);
    const pageEntries = browseEntries.slice(browsePage * BROWSE_PAGE_SIZE, (browsePage + 1) * BROWSE_PAGE_SIZE);

    browseGridElement.replaceChildren(...pageEntries.map(createBrowseTile));
    browsePageLabel.textContent = "Page " + (browsePage + 1) + " of " + pageCount;
    browsePrevButton.disabled = browsePage === 0;
    browseNextButton.disabled = browsePage >= pageCount - 1;
}

function createBrowseTile(entry) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "browseTile";

    const sprite = document.createElement("img");
    sprite.src = SPRITE_BASE + entry.id + ".png";
    sprite.alt = "";
    sprite.width = 96;
    sprite.height = 96;
    sprite.loading = "lazy";

    const number = document.createElement("small");
    number.textContent = "#" + String(entry.id).padStart(4, "0");

    const name = document.createElement("span");
    name.textContent = formatName(entry.name);

    button.append(sprite, number, name);
    button.addEventListener("click", () => {
        showPokemon(entry.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    item.append(button);
    return item;
}

typeFilterElement.addEventListener("change", applyBrowseFilters);
generationFilterElement.addEventListener("change", applyBrowseFilters);
browsePrevButton.addEventListener("click", () => {
    browsePage--;
    renderBrowsePage();
});
browseNextButton.addEventListener("click", () => {
    browsePage++;
    renderBrowsePage();
});

initBrowse();

searchInput.addEventListener("focus", loadNameSuggestions);

document.getElementById("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    fetchData();
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
    }
    catch (error) {
        return [];
    }
}

function saveStoredList(key, list) {
    try {
        localStorage.setItem(key, JSON.stringify(list));
    }
    catch (error) {
        // storage full or unavailable; the list still works until the page closes
    }
}

let favorites = loadStoredList(FAVORITES_KEY);

function isFavorite(id) {
    return favorites.some((entry) => entry.id === id);
}

function toggleFavorite() {
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

function updateFavoriteButton() {
    const active = currentPokemon !== null && isFavorite(currentPokemon.id);
    favoriteButton.textContent = active ? "★" : "☆";
    favoriteButton.setAttribute("aria-pressed", String(active));
    favoriteButton.title = active ? "Remove from favorites" : "Add to favorites";
}

function renderFavorites() {
    favoritesSection.hidden = favorites.length === 0;
    favoritesListElement.replaceChildren(...favorites.map(createBrowseTile));
}

favoriteButton.addEventListener("click", toggleFavorite);
renderFavorites();

// --- Recently viewed --------------------------------------------------------

const RECENT_KEY = "pokedex:recent:v1";
const MAX_RECENT = 10;
const recentSection = document.getElementById("recentSection");
const recentListElement = document.getElementById("recentList");

let recentPokemon = loadStoredList(RECENT_KEY);

function addToRecent(pokemon) {
    recentPokemon = [pokemon, ...recentPokemon.filter((entry) => entry.id !== pokemon.id)].slice(0, MAX_RECENT);
    saveStoredList(RECENT_KEY, recentPokemon);
    renderRecent();
}

function renderRecent() {
    recentSection.hidden = recentPokemon.length === 0;
    recentListElement.replaceChildren(...recentPokemon.map(createBrowseTile));
}

document.getElementById("clearRecentBtn").addEventListener("click", () => {
    recentPokemon = [];
    saveStoredList(RECENT_KEY, recentPokemon);
    renderRecent();
});
renderRecent();

// --- Theme ------------------------------------------------------------------

const THEME_KEY = "pokedex:theme";
const themeToggleButton = document.getElementById("themeToggleBtn");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
    return document.documentElement.dataset.theme || (prefersDark.matches ? "dark" : "light");
}

function updateThemeButton() {
    const dark = currentTheme() === "dark";
    themeToggleButton.textContent = dark ? "☀️" : "🌙";
    themeToggleButton.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

themeToggleButton.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
        localStorage.setItem(THEME_KEY, next);
    }
    catch (error) {
        // theme just won't persist
    }
    updateThemeButton();
});
prefersDark.addEventListener("change", updateThemeButton);
updateThemeButton();

// Loads any Pokémon by id, including alternate forms above the National Dex range.
function showPokemon(id) {
    searchInput.value = id;
    loadPokemon(String(id));
}

function goToDexNumber(dexNumber) {
    if (dexNumber < 1 || dexNumber > MAX_DEX_NUMBER) {
        return;
    }
    searchInput.value = dexNumber;
    loadPokemon(String(dexNumber));
}

document.getElementById("randomPokemonBtn").addEventListener("click", () => {
    goToDexNumber(1 + Math.floor(Math.random() * MAX_DEX_NUMBER));
});
shinyButton.addEventListener("click", () => {
    showShiny = !showShiny;
    renderSprite();
});
prevButton.addEventListener("click", () => goToDexNumber(currentDexNumber - 1));
nextButton.addEventListener("click", () => goToDexNumber(currentDexNumber + 1));
document.getElementById("clearDataBtn").addEventListener("click", clearFields);
