import { API_BASE, SPRITE_BASE, fetchJson, getAllPokemonEntries } from "./api.js";
import { initCompare } from "./compare.js";
import { addToRecent, fadeInImage, initLists, updateFavoriteButton } from "./lists.js";
import {
    MAX_DEX_NUMBER,
    TYPE_ICONS,
    STAT_LABELS,
    pickSprite,
    describeEvolution,
    formatMultiplier,
    formLabel,
    formatName,
    idFromUrl,
    learnset,
    normalizeQuery,
    suggestionScore,
} from "./utils.js";

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
const formsElement = document.getElementById("pokemonForms");
const cryButton = document.getElementById("cryBtn");
const movesSection = document.getElementById("pokemonMoves");
const movesSummary = document.getElementById("movesSummary");
const movesTable = document.getElementById("movesTable");
const movesTableBody = movesTable.tBodies[0];
const movesTabs = document.getElementById("movesTabs");
let currentMoves = [];
let movesDetailsLoaded = false;
let currentCryUrl = null;
let cryAudio = null;
// Cries are Ogg Vorbis files, which some browsers (e.g. Safari) can't play.
const CAN_PLAY_CRIES = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
const evolutionListElement = document.getElementById("evolutionList");

const DEFAULT_TITLE = document.title;

const prevButton = document.getElementById("prevPokemonBtn");
const nextButton = document.getElementById("nextPokemonBtn");

const shinyButton = document.getElementById("shinyToggleBtn");

let currentDexNumber = null;
let currentPokemon = null; // { id, name } of the Pokémon on the card
let currentSprites = null;
let showShiny = false;
let latestRequest = 0;

function fetchData() {
    const query = normalizeQuery(searchInput.value);
    if (!query || query === "0") {
        return;
    }
    loadPokemon(query);
}

// fromHistory: the query came from the URL (page load or Back/Forward), so the
// URL is only normalised in place instead of adding a new history entry.
async function loadPokemon(query, { fromHistory = false } = {}) {
    const requestId = ++latestRequest;
    try {
        clearFields();
        setLoading(true);

        const data = await fetchJson(API_BASE + "pokemon/" + encodeURIComponent(query));
        if (requestId !== latestRequest) {
            return; // a newer search has started; drop this stale result
        }
        renderPokemon(data, query);
        setUrlPokemon(data.name, fromHistory);
        loadSpecies(data.species.url, requestId);
        loadMatchups(
            data.types.map((entry) => entry.type.name),
            requestId,
        );
    } catch (error) {
        if (requestId === latestRequest) {
            if (isNotFound(error)) {
                showNotFound(query, requestId);
            } else {
                showError("Couldn't reach the Pokédex. Check your connection and try again.");
            }
        }
    } finally {
        if (requestId === latestRequest) {
            setLoading(false);
        }
    }
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
    } catch {
        if (requestId === latestRequest) {
            genusElement.textContent = "";
            flavorTextElement.textContent = "";
            evolutionSection.hidden = true;
            formsElement.hidden = true;
        }
    }
}

// --- Type effectiveness -----------------------------------------------------

const matchupsSection = document.getElementById("pokemonMatchups");
const matchupsListElement = document.getElementById("matchupsList");

const MATCHUP_GROUPS = [
    { label: "Weak to", test: (multiplier) => multiplier > 1 },
    { label: "Resists", test: (multiplier) => multiplier > 0 && multiplier < 1 },
    { label: "Immune to", test: (multiplier) => multiplier === 0 },
];

// Multiplies damage relations across the Pokémon's types to get the damage
// each attacking type deals to it (e.g. Ground vs. Electric/Flying = 0×).
async function loadMatchups(types, requestId) {
    matchupsSection.hidden = true;
    try {
        const typeData = await Promise.all(types.map((type) => fetchJson(API_BASE + "type/" + type)));
        if (requestId !== latestRequest) {
            return;
        }

        const multipliers = Object.fromEntries(Object.keys(TYPE_ICONS).map((type) => [type, 1]));
        for (const { damage_relations: relations } of typeData) {
            for (const { name } of relations.double_damage_from) {
                multipliers[name] *= 2;
            }
            for (const { name } of relations.half_damage_from) {
                multipliers[name] *= 0.5;
            }
            for (const { name } of relations.no_damage_from) {
                multipliers[name] = 0;
            }
        }
        renderMatchups(multipliers);
    } catch {
        // matchups are optional; leave the section hidden
    }
}

function renderMatchups(multipliers) {
    matchupsListElement.replaceChildren();

    for (const group of MATCHUP_GROUPS) {
        const types = Object.keys(multipliers)
            .filter((type) => type in TYPE_ICONS && group.test(multipliers[type]))
            .sort((a, b) => multipliers[b] - multipliers[a]);
        if (!types.length) {
            continue;
        }

        const term = document.createElement("dt");
        term.textContent = group.label;
        const definition = document.createElement("dd");
        for (const type of types) {
            const badge = document.createElement("span");
            badge.className = "matchupBadge";
            badge.title = formatName(type) + ": " + formatMultiplier(multipliers[type]) + "× damage";

            const icon = document.createElement("img");
            icon.src = "assets/" + TYPE_ICONS[type];
            icon.alt = formatName(type);
            icon.width = 28;
            icon.height = 28;

            const value = document.createElement("span");
            value.textContent = formatMultiplier(multipliers[type]) + "×";

            badge.append(icon, value);
            definition.append(badge);
        }
        matchupsListElement.append(term, definition);
    }
    matchupsSection.hidden = false;
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
    fadeInImage(sprite, SPRITE_BASE + dexNumber + ".png");
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
    renderForms(species);

    const genus = species.genera.find((entry) => entry.language.name === "en");
    genusElement.textContent = genus ? genus.genus : "";

    // Entries are oldest-first; show the most recent English one.
    const entries = species.flavor_text_entries.filter((entry) => entry.language.name === "en");
    const latest = entries[entries.length - 1];
    // Game text uses form feeds and hard line breaks; collapse them into normal spaces.
    flavorTextElement.textContent = latest
        ? latest.flavor_text
              .replace(/[\f\n\r\u00ad]+/g, " ")
              .replace(/\s+/g, " ")
              .trim()
        : "";
}

// Buttons for the species' other forms (Mega, regional, Gigantamax…), if it has any.
function renderForms(species) {
    const varieties = species.varieties ?? [];
    formsElement.replaceChildren();
    formsElement.hidden = varieties.length < 2;
    if (formsElement.hidden) {
        return;
    }

    const label = document.createElement("span");
    label.className = "formsLabel";
    label.textContent = "Forms:";
    formsElement.append(label);

    for (const { pokemon } of varieties) {
        const id = idFromUrl(pokemon.url);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "formBtn";
        button.textContent = formLabel(species.name, pokemon.name);
        const isCurrent = currentPokemon !== null && currentPokemon.id === id;
        button.setAttribute("aria-pressed", String(isCurrent));
        button.addEventListener("click", () => {
            if (!isCurrent) {
                showPokemon(id);
            }
        });
        formsElement.append(button);
    }
}

function renderPokemon(data, query) {
    // Alternate forms (e.g. id 10034) navigate relative to their species' dex number.
    currentDexNumber = idFromUrl(data.species.url) || data.id;
    currentPokemon = { id: data.id, name: data.name };
    updateFavoriteButton();
    addToRecent(currentPokemon);
    announceResult(data);
    document.title = formatName(data.name) + " #" + data.id + " · Pokédex";
    prevButton.disabled = currentDexNumber <= 1;
    nextButton.disabled = currentDexNumber >= MAX_DEX_NUMBER;

    //fetch pokemon name
    nameElement.textContent = formatName(data.name);
    // Show what was loaded (e.g. after "25", Random or Next), unless the user is typing a new search.
    if (document.activeElement !== searchInput || normalizeQuery(searchInput.value) === query) {
        searchInput.value = formatName(data.name);
    }

    //fetch pokemon number
    numberElement.textContent = "Pokemon no#" + data.id;

    //species info arrives separately; clear the previous Pokémon's text meanwhile
    genusElement.textContent = "";
    flavorTextElement.textContent = "";
    evolutionSection.hidden = true;
    formsElement.hidden = true;

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
    renderMoves(data.moves ?? []);

    // Cries are .ogg files; older entries only have a "legacy" recording.
    currentCryUrl = data.cries?.latest || data.cries?.legacy || null;
    cryButton.hidden = !currentCryUrl || !CAN_PLAY_CRIES;

    //fetch pokemon sprite
    currentSprites = data.sprites;
    renderSprite();

    pokemonCard.classList.remove("hidden");
}

function renderSprite() {
    if (!currentSprites) {
        return;
    }
    const shinySrc = pickSprite(currentSprites, true);
    shinyButton.hidden = !shinySrc;
    const src = showShiny && shinySrc ? shinySrc : pickSprite(currentSprites, false);
    if (src) {
        fadeInImage(imgElement, src);
        const showingShiny = showShiny && src === shinySrc;
        imgElement.alt = (showingShiny ? "Shiny " : "") + nameElement.textContent.trim() + " sprite";
        imgElement.style.display = "block";
    } else {
        imgElement.removeAttribute("src");
        imgElement.style.display = "none";
    }
    shinyButton.setAttribute("aria-pressed", String(showShiny));
    shinyButton.classList.toggle("active", showShiny);
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

// Highest single base stat in the games (Blissey's HP), used to scale the bars.
const MAX_BASE_STAT = 255;

function renderStats(stats) {
    statsListElement.replaceChildren();
    let total = 0;

    for (const { stat, base_stat } of stats) {
        total += base_stat;
        statsListElement.append(
            createStatRow(STAT_LABELS[stat.name] || formatName(stat.name), base_stat, MAX_BASE_STAT),
        );
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
        fill.style.backgroundColor = "hsl(" + Math.round((Math.min(value, 150) / 150) * 120) + ", 70%, 45%)";

        bar.append(fill);
        row.append(bar);
    }

    return row;
}

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
        iconElement.alt = formatName(type) + " type";
        iconElement.title = formatName(type);
        iconElement.style.display = "block";
    } else {
        iconElement.removeAttribute("src");
        iconElement.style.display = "none";
    }
}

// Screen readers don't notice the card changing, so summarise each result in a live region.
function announceResult(data) {
    const types = data.types.map((entry) => formatName(entry.type.name)).join(" and ");
    document.getElementById("resultAnnouncer").textContent =
        "Showing " + formatName(data.name) + ", number " + data.id + ", " + types + " type.";
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
    const text = document.createElement("p");
    text.textContent = message;
    errorElement.replaceChildren(text);
    errorElement.classList.remove("hidden");
}

function showNotFound(query, requestId) {
    if (/^\d+$/.test(query)) {
        showError("There's no Pokémon #" + query + ". Try a number from 1 to " + MAX_DEX_NUMBER + ".");
        return;
    }
    showError("No Pokémon called \u201c" + formatName(query) + "\u201d. Check the spelling and try again.");
    addNameSuggestions(query, requestId);
}

async function addNameSuggestions(query, requestId) {
    let entries;
    try {
        entries = await getAllPokemonEntries();
    } catch {
        return; // suggestions are a bonus; the message is already shown
    }
    if (requestId !== latestRequest) {
        return;
    }

    const suggestions = entries
        .map((entry) => ({ entry, score: suggestionScore(query, entry.name) }))
        .filter((candidate) => candidate.score !== Infinity)
        .sort((a, b) => a.score - b.score || a.entry.id - b.entry.id)
        .slice(0, 3);

    if (!suggestions.length) {
        return;
    }

    const line = document.createElement("p");
    line.className = "suggestions";
    line.append("Did you mean ");
    suggestions.forEach(({ entry }, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "suggestionBtn";
        button.textContent = formatName(entry.name);
        button.addEventListener("click", () => {
            searchInput.value = formatName(entry.name);
            loadPokemon(entry.name);
        });
        line.append(button, index < suggestions.length - 1 ? " " : "?");
    });
    errorElement.append(line);
}

function clearFields() {
    pokemonCard.classList.add("hidden");
    document.title = DEFAULT_TITLE;
    errorElement.classList.add("hidden");
    errorElement.replaceChildren();
}

// --- Autocomplete -------------------------------------------------------

const nameListElement = document.getElementById("pokemonNameList");
let nameListLoaded = false;

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
    } catch {
        nameListLoaded = false; // allow a retry on the next focus
    }
}

searchInput.addEventListener("focus", loadNameSuggestions);

document.getElementById("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    fetchData();
});

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
    } catch {
        // theme just won't persist
    }
    updateThemeButton();
});
prefersDark.addEventListener("change", updateThemeButton);
updateThemeButton();

initCompare({ getCurrentPokemon: () => currentPokemon, loadNameSuggestions });
initLists({ showPokemon, getCurrentPokemon: () => currentPokemon });

// Loads any Pokémon by id, including alternate forms above the National Dex range.
function showPokemon(id) {
    loadPokemon(String(id));
}

function goToDexNumber(dexNumber) {
    if (dexNumber < 1 || dexNumber > MAX_DEX_NUMBER) {
        return;
    }
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
document.getElementById("clearDataBtn").addEventListener("click", () => {
    clearFields();
    setUrlPokemon(null);
});

// --- Moves ----------------------------------------------------------------------

const MOVE_METHODS = [
    { method: "level-up", label: "Level-up" },
    { method: "machine", label: "TM" },
    { method: "egg", label: "Egg" },
    { method: "tutor", label: "Tutor" },
];
let currentLearnset = null;
let currentMoveMethod = "level-up";

function renderMoves(moves) {
    currentLearnset = learnset(moves);
    const counts = Object.fromEntries(
        MOVE_METHODS.map(({ method }) => [method, currentLearnset.methods[method].length]),
    );
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    movesSection.open = false;
    movesSection.hidden = total === 0;
    movesSummary.textContent = "Moves (" + total + ")";

    if (!counts[currentMoveMethod]) {
        currentMoveMethod = MOVE_METHODS.find(({ method }) => counts[method])?.method ?? "level-up";
    }
    movesTabs.replaceChildren(
        ...MOVE_METHODS.filter(({ method }) => counts[method]).map(({ method, label }) => {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = "movesTab";
            tab.setAttribute("role", "tab");
            tab.dataset.method = method;
            tab.textContent = label + " (" + counts[method] + ")";
            tab.addEventListener("click", () => {
                currentMoveMethod = method;
                renderMoveRows();
                loadMoveDetails();
            });
            return tab;
        }),
    );
    renderMoveRows();
}

function renderMoveRows() {
    currentMoves = currentLearnset.methods[currentMoveMethod];
    movesDetailsLoaded = false;
    for (const tab of movesTabs.children) {
        tab.setAttribute("aria-selected", String(tab.dataset.method === currentMoveMethod));
    }
    const showLevel = currentMoveMethod === "level-up";
    movesTable.classList.toggle("noLevel", !showLevel);

    movesTableBody.replaceChildren();
    for (const move of currentMoves) {
        const row = movesTableBody.insertRow();
        row.insertCell().textContent = showLevel ? move.level || "Evo" : ""; // level 0 = learned on evolution
        row.insertCell().textContent = formatName(move.name);
        row.insertCell().textContent = "…";
        row.insertCell().textContent = "…";
    }
}

// Type and power need one request per move, so they're only fetched once the list is opened.
async function loadMoveDetails() {
    if (!movesSection.open || movesDetailsLoaded) {
        return;
    }
    movesDetailsLoaded = true;
    const moves = currentMoves;
    const rows = [...movesTableBody.rows];
    await Promise.all(
        moves.map(async (move, index) => {
            const [, , typeCell, powerCell] = rows[index].cells;
            try {
                const details = await fetchJson(move.url);
                if (moves !== currentMoves) {
                    return; // a different Pokémon is showing now
                }
                const type = details.type.name;
                typeCell.replaceChildren();
                if (TYPE_ICONS[type]) {
                    const icon = document.createElement("img");
                    icon.src = "assets/" + TYPE_ICONS[type];
                    icon.alt = "";
                    icon.width = 20;
                    icon.height = 20;
                    typeCell.append(icon);
                }
                typeCell.append(" " + formatName(type));
                powerCell.textContent = details.power ?? "—";
            } catch {
                typeCell.textContent = "?";
                powerCell.textContent = "?";
            }
        }),
    );
}

movesSection.addEventListener("toggle", loadMoveDetails);

// --- Cry ------------------------------------------------------------------------

function playCry() {
    if (!currentCryUrl) {
        return;
    }
    cryAudio?.pause();
    cryAudio = new Audio(currentCryUrl);
    cryAudio.volume = 0.5;
    cryButton.classList.add("playing");
    cryAudio.addEventListener("ended", () => cryButton.classList.remove("playing"), { once: true });
    cryAudio.play().catch(() => cryButton.classList.remove("playing")); // e.g. format unsupported
}

cryButton.addEventListener("click", playCry);

// --- Keyboard shortcuts -------------------------------------------------------
// ←/→ previous/next Pokémon, "/" focuses the search box, "s" toggles shiny, "c" plays the cry.

function isTypingTarget(element) {
    return element.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName);
}

document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) {
        return;
    }
    const cardVisible = !pokemonCard.classList.contains("hidden");

    if (event.key === "/") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
    } else if (event.key === "ArrowLeft" && cardVisible && !prevButton.disabled) {
        prevButton.click();
    } else if (event.key === "ArrowRight" && cardVisible && !nextButton.disabled) {
        nextButton.click();
    } else if (event.key.toLowerCase() === "s" && cardVisible && !shinyButton.hidden) {
        shinyButton.click();
    } else if (event.key.toLowerCase() === "c" && cardVisible && !cryButton.hidden) {
        playCry();
    }
});

// --- Shareable URLs -----------------------------------------------------------
// The current Pokémon lives in ?pokemon=<name> so links can be shared and Back/Forward work.

function getUrlPokemon() {
    return new URLSearchParams(window.location.search).get("pokemon");
}

function setUrlPokemon(name, replace = false) {
    const url = new URL(window.location.href);
    if (name) {
        url.searchParams.set("pokemon", name);
    } else {
        url.searchParams.delete("pokemon");
    }
    if (url.href === window.location.href) {
        return;
    }
    if (replace) {
        history.replaceState({ pokemon: name }, "", url);
    } else {
        history.pushState({ pokemon: name }, "", url);
    }
}

function loadFromUrl() {
    const name = getUrlPokemon();
    const query = name ? normalizeQuery(name) : "";
    if (query) {
        loadPokemon(query, { fromHistory: true });
    } else {
        latestRequest++; // ignore any request still in flight
        setLoading(false);
        clearFields();
    }
}

window.addEventListener("popstate", loadFromUrl);
if (getUrlPokemon()) {
    loadFromUrl();
}
