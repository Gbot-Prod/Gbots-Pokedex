import {
    ANIMATED_CHANGE_EVENT,
    ANIMATED_KEY,
    API_BASE,
    SPRITE_BASE,
    fetchJson,
    fetchPokemon,
    getAllPokemonEntries,
    getMachineItemName,
    getMoveSummary,
    getSpeciesSlugs,
    setSmallSprite,
    setSprite,
} from "./api.js";
import { attachCombobox } from "./combobox.js";
import { initCompare, refreshComparison } from "./compare.js";
import { initPotd, setPotdVisible } from "./potd.js";
import { hopPartner, initProgress, markSeen, notePokemonView, partnerSay, reactToPokemon } from "./progress.js";
import { initQuiz } from "./quiz.js";
import { initShinyHunt } from "./shinyhunt.js";
import { initTypeChart, showTypeInChart } from "./typechart.js";
import { initTeam, onCardChange as updateTeamButton } from "./team.js";
import {
    addToRecent,
    fadeInImage,
    getRecentPokemon,
    initLists,
    removeFromRecent,
    updateFavoriteButton,
} from "./lists.js";
import {
    MAX_DEX_NUMBER,
    STAT_LABELS,
    TYPE_COLORS,
    TYPE_ICONS,
    VERSION_GROUPS,
    abilityDescription,
    damageMultipliers,
    describeEvolution,
    entryDisplayName,
    formatDexNumber,
    formatHeight,
    formatMultiplier,
    formatName,
    formatWeight,
    formLabel,
    idFromUrl,
    isNightHour,
    learnset,
    normalizeQuery,
    pickSprite,
    pokemonDisplayName,
    sizeComparison,
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
const abilityDescriptionElement = document.getElementById("abilityDescription");
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
const movesGameSelect = document.getElementById("movesGame");
const GAME_NAMES = new Map(VERSION_GROUPS);
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
let currentTypes = [];
let currentSprites = null;
let showShiny = false;
const animatedButton = document.getElementById("animatedToggleBtn");
let showAnimated = false;
try {
    showAnimated = localStorage.getItem(ANIMATED_KEY) === "true";
} catch {
    // default to static artwork
}
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

        const data = await fetchPokemon(query);
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
            reactToPokemon(chainSpeciesIds(chain.chain), currentTypes);
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

// Every species id in an evolution chain (all branches).
function chainSpeciesIds(node) {
    return [idFromUrl(node.species.url), ...node.evolves_to.flatMap(chainSpeciesIds)];
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

        const multipliers = damageMultipliers(typeData);
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
    setSmallSprite(sprite, dexNumber, fadeInImage);
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
    applyDisplayName(species);

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

// Swap the title-cased slug ("Farfetchd", "Nidoran F") for the official English name
// ("Farfetch’d", "Nidoran♀"); forms keep their label ("Charizard (Mega X)").
function applyDisplayName(species) {
    const english = species.names?.find((entry) => entry.language.name === "en")?.name;
    if (!english || !currentPokemon) {
        return;
    }
    const previous = formatName(currentPokemon.name);
    const isForm = currentPokemon.id !== currentDexNumber;
    const displayName = isForm ? english + " (" + formLabel(species.name, currentPokemon.name) + ")" : english;

    nameElement.textContent = displayName;
    renderSprite(); // refreshes the sprite's alt text with the new name
    if (currentMeasurements) {
        renderSizeComparison(); // label with the official name too
    }
    const announcer = document.getElementById("resultAnnouncer");
    announcer.textContent = announcer.textContent.replace(previous, displayName);
    document.title = displayName + " " + formatDexNumber(currentDexNumber) + " · Pokédex";
    if (searchInput.value === previous) {
        searchInput.value = displayName;
    }
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
    currentTypes = data.types.map((entry) => entry.type.name);
    updateFavoriteButton();
    updateTeamButton();
    addToRecent(currentPokemon);
    markSeen(currentDexNumber);
    hopPartner();
    notePokemonView(currentDexNumber, pokemonDisplayName(data), currentTypes);
    announceResult(data);
    document.title = formatName(data.name) + " " + formatDexNumber(currentDexNumber) + " · Pokédex";
    prevButton.disabled = currentDexNumber <= 1;
    nextButton.disabled = currentDexNumber >= MAX_DEX_NUMBER;

    //fetch pokemon name
    nameElement.textContent = formatName(data.name);
    // Show what was loaded (e.g. after "25", Random or Next), unless the user is typing a new search.
    if (document.activeElement !== searchInput || normalizeQuery(searchInput.value) === query) {
        searchInput.value = formatName(data.name);
    }

    //fetch pokemon number
    // Alternate forms have internal ids (e.g. 10034); show the species' number and name the form.
    const isForm = data.id !== currentDexNumber;
    numberElement.textContent =
        formatDexNumber(currentDexNumber) + (isForm ? " · " + formLabel(data.species.name, data.name) + " form" : "");

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
    currentMeasurements = { height: data.height, weight: data.weight };
    renderMeasurements();

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
    setPotdVisible(false);
    playTypeBurst();
}

// Animated Showdown sprites (small GIFs) exist for most Pokémon; null when there isn't one.
function animatedSprite(sprites, shiny) {
    return sprites.other?.showdown?.[shiny ? "front_shiny" : "front_default"] ?? null;
}

function renderSprite() {
    if (!currentSprites) {
        return;
    }
    const shinySrc = pickSprite(currentSprites, true);
    shinyButton.hidden = !shinySrc;
    const wantShiny = showShiny && Boolean(shinySrc);
    const animatedSrc = animatedSprite(currentSprites, wantShiny);
    animatedButton.hidden = !animatedSrc;
    const useAnimated = showAnimated && Boolean(animatedSrc);
    const src = useAnimated ? animatedSrc : wantShiny ? shinySrc : pickSprite(currentSprites, false);
    if (src) {
        fadeInImage(imgElement, src);
        imgElement.classList.toggle("animatedSprite", useAnimated);
        imgElement.alt =
            (wantShiny ? "Shiny " : "") +
            nameElement.textContent.trim() +
            (useAnimated ? " animated sprite" : " sprite");
        imgElement.style.display = "block";
    } else {
        imgElement.removeAttribute("src");
        imgElement.style.display = "none";
    }
    shinyButton.setAttribute("aria-pressed", String(showShiny));
    shinyButton.classList.toggle("active", showShiny);
    animatedButton.setAttribute("aria-pressed", String(showAnimated));
    animatedButton.classList.toggle("active", showAnimated);
}

function renderAbilities(abilities) {
    abilityElement.replaceChildren();
    abilityDescriptionElement.hidden = true;
    abilityDescriptionElement.textContent = "";

    const label = document.createElement("span");
    label.className = "abilityLabel";
    label.textContent = abilities.length === 1 ? "Ability:" : "Abilities:";
    abilityElement.append(label);

    for (const { ability, is_hidden } of abilities) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "abilityChip" + (is_hidden ? " hiddenAbility" : "");
        chip.textContent = formatName(ability.name) + (is_hidden ? " (hidden)" : "");
        chip.setAttribute("aria-expanded", "false");
        chip.setAttribute("aria-controls", "abilityDescription");
        chip.title = "What does " + formatName(ability.name) + " do?";
        chip.addEventListener("click", () => toggleAbilityDescription(chip, ability));
        abilityElement.append(chip);
    }
}

// Clicking an ability chip shows its description below the chips; clicking again hides it.
async function toggleAbilityDescription(chip, ability) {
    const wasOpen = chip.getAttribute("aria-expanded") === "true";
    for (const other of abilityElement.querySelectorAll(".abilityChip")) {
        other.setAttribute("aria-expanded", "false");
    }
    if (wasOpen) {
        abilityDescriptionElement.hidden = true;
        return;
    }
    chip.setAttribute("aria-expanded", "true");
    abilityDescriptionElement.hidden = false;
    abilityDescriptionElement.textContent = "Loading…";
    try {
        const details = await fetchJson(ability.url);
        if (chip.getAttribute("aria-expanded") === "true") {
            abilityDescriptionElement.textContent =
                formatName(ability.name) + ": " + (abilityDescription(details) || "No description available.");
        }
    } catch {
        abilityDescriptionElement.textContent = "Couldn't load the description.";
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
    animateStats();
}

// Bars grow from zero and the numbers count up (skipped when reduced motion is preferred).
function animateStats() {
    if (reducedMotion.matches) {
        return;
    }
    const fills = [...statsListElement.querySelectorAll(".statFill")];
    const targets = fills.map((fill) => fill.style.width);
    for (const fill of fills) {
        fill.style.width = "0%";
    }
    requestAnimationFrame(() =>
        requestAnimationFrame(() => fills.forEach((fill, index) => (fill.style.width = targets[index]))),
    );

    const numbers = [...statsListElement.querySelectorAll(".statValue")].map((element) => [
        element,
        Number(element.textContent),
    ]);
    const start = performance.now();
    const DURATION = 600;
    const step = (now) => {
        const progress = Math.min(1, (now - start) / DURATION);
        const eased = 1 - (1 - progress) ** 3;
        for (const [element, value] of numbers) {
            element.textContent = Math.round(value * eased);
        }
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
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

// Card theme per type (TYPE_COLORS in utils.js): strong (header), light (body) and deep shades.
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
    // The animated page backdrop follows the same type (see "Type backdrop" in pokemon.css).
    const root = document.documentElement;
    if (colors) {
        root.dataset.type = type;
        root.style.setProperty("--theme-strong", colors[0]);
        root.style.setProperty("--theme-light", colors[1]);
    } else {
        delete root.dataset.type;
        root.style.removeProperty("--theme-strong");
        root.style.removeProperty("--theme-light");
    }
}

// Decorative particles for the backdrop; each gets a random position, size, speed and drift.
function createBackdropParticles(count = 18) {
    const backdrop = document.getElementById("typeBackdrop");
    for (let index = 0; index < count; index++) {
        const particle = document.createElement("span");
        particle.className = "particle";
        particle.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
        particle.style.setProperty("--size", (6 + Math.random() * 10).toFixed(1) + "px");
        particle.style.setProperty("--duration", (9 + Math.random() * 10).toFixed(1) + "s");
        particle.style.setProperty("--delay", (-Math.random() * 18).toFixed(1) + "s");
        particle.style.setProperty("--drift", ((Math.random() - 0.5) * 160).toFixed(0) + "px");
        backdrop.append(particle);
    }
}
createBackdropParticles();

// After sunset the backdrop becomes a night sky (stars and a moon; see "Night sky" in pokemon.css).
function updateNightSky() {
    document.documentElement.classList.toggle("night", isNightHour(new Date().getHours()));
}
updateNightSky();
setInterval(updateNightSky, 10 * 60 * 1000);

function setTypeIcon(iconElement, type) {
    const icon = TYPE_ICONS[type];
    if (icon) {
        iconElement.src = "assets/" + icon;
        iconElement.alt = formatName(type) + " type";
        iconElement.dataset.type = type;
        iconElement.title = formatName(type) + " — show in the type chart";
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
        "Showing " + formatName(data.name) + ", number " + currentDexNumber + ", " + types + " type.";
}

function fetchPKMNType(pkmnType, pkmnType2) {
    setTypeIcon(type1IconElement, pkmnType);
    setTypeIcon(type2IconElement, pkmnType2);
}

function setLoading(isLoading) {
    loadingElement.classList.toggle("hidden", !isLoading);
    // The Pokédex device's LEDs blink while a Pokémon loads.
    document.documentElement.classList.toggle("isLoading", isLoading);
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
    const speciesSlugs = await getSpeciesSlugs().catch(() => null); // for official names
    if (requestId !== latestRequest) {
        return;
    }

    const suggestions = entries
        .map((entry) => ({ entry, score: suggestionScore(query, entry.name) }))
        .filter((candidate) => candidate.score !== Infinity)
        // Alternate forms (ids above the National Dex) rank just below species with the same score.
        .sort(
            (a, b) =>
                a.score - b.score ||
                (a.entry.id > MAX_DEX_NUMBER) - (b.entry.id > MAX_DEX_NUMBER) ||
                a.entry.id - b.entry.id,
        )
        // Skip forms of a species that's already suggested ("gengar-mega" after "gengar",
        // "zygarde-10-power-construct" after "zygarde-50", whose species is "zygarde").
        .filter((candidate, index, all) =>
            all.slice(0, index).every(({ entry }) => {
                const base = (entry.id <= MAX_DEX_NUMBER && speciesSlugs?.get(entry.id)) || entry.name;
                return !candidate.entry.name.startsWith(base + "-");
            }),
        )
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
        button.textContent = entryDisplayName(entry, speciesSlugs);
        button.addEventListener("click", () => {
            searchInput.value = entryDisplayName(entry, speciesSlugs);
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

// The main search gets the custom combobox; picking a suggestion searches straight away.
attachCombobox(searchInput, {
    onSelect: (entry) => loadPokemon(entry.name),
    getEmptySuggestions: getRecentPokemon,
    onRemoveSuggestion: removeFromRecent,
});

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

// The button cycles Light → Dark → Retro (Game Boy greens).
const THEMES = ["light", "dark", "retro"];
const THEME_ICONS = { light: "☀️", dark: "🌙", retro: "🎮" };

function nextTheme() {
    return THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
}

function updateThemeButton() {
    // Lets CSS target "dark, whether chosen or from the system" (used by the night sky).
    document.documentElement.classList.toggle("darkTheme", currentTheme() === "dark");
    const next = nextTheme();
    themeToggleButton.textContent = THEME_ICONS[next];
    themeToggleButton.setAttribute("aria-label", "Switch to " + next + " theme");
    themeToggleButton.title = "Theme: " + currentTheme() + " (switch to " + next + ")";
}

themeToggleButton.addEventListener("click", () => {
    const next = nextTheme();
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

initCompare({ getCurrentPokemon: () => currentPokemon, getUnits: () => units });
initLists({ showPokemon, getCurrentPokemon: () => currentPokemon });
initQuiz({ showPokemon });
initProgress({ showPokemon });
initShinyHunt({ showPokemon });
initTypeChart();
initPotd({ showPokemon, isCardShowing: () => Boolean(getUrlPokemon()) || !pokemonCard.classList.contains("hidden") });

// The card's type icons open the type chart at that type.
for (const icon of [type1IconElement, type2IconElement]) {
    icon.setAttribute("role", "button");
    icon.tabIndex = 0;
    const open = () => icon.dataset.type && showTypeInChart(icon.dataset.type);
    icon.addEventListener("click", open);
    icon.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
        }
    });
}
initTeam({
    showPokemon,
    getCurrentPokemon: () =>
        currentPokemon && { ...currentPokemon, label: nameElement.textContent.trim(), types: currentTypes },
});

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
    if (showShiny) {
        partnerSay("⭐");
    }
});
animatedButton.addEventListener("click", () => {
    showAnimated = !showAnimated;
    try {
        localStorage.setItem(ANIMATED_KEY, String(showAnimated));
    } catch {
        // preference just won't persist
    }
    renderSprite();
    // Small sprites (evolution chain, team) follow the same setting.
    for (const image of document.querySelectorAll(".evolutionMember img[data-sprite-id]")) {
        setSmallSprite(image, image.dataset.spriteId, fadeInImage);
    }
    window.dispatchEvent(new Event(ANIMATED_CHANGE_EVENT));
});
prevButton.addEventListener("click", () => goToDexNumber(currentDexNumber - 1));
nextButton.addEventListener("click", () => goToDexNumber(currentDexNumber + 1));
document.getElementById("clearDataBtn").addEventListener("click", () => {
    clearFields();
    setPotdVisible(true);
    setUrlPokemon(null);
});

// --- Moves ----------------------------------------------------------------------

const MOVE_CATEGORIES = {
    physical: { short: "Phys", label: "Physical" },
    special: { short: "Spec", label: "Special" },
    status: { short: "Stat", label: "Status" },
};

const MOVE_METHODS = [
    { method: "level-up", label: "Level-up" },
    { method: "machine", label: "TM" },
    { method: "egg", label: "Egg" },
    { method: "tutor", label: "Tutor" },
];
let currentLearnset = null;
let currentMoveMethod = "level-up";

let currentRawMoves = [];
let preferredGame = null; // the game picked in the selector, kept while browsing

function renderMoves(moves, { keepOpen = false } = {}) {
    currentRawMoves = moves;
    currentLearnset = learnset(moves, preferredGame);
    movesGameSelect.replaceChildren(
        ...currentLearnset.games.map((game) => {
            const option = document.createElement("option");
            option.value = game;
            option.textContent = GAME_NAMES.get(game);
            option.selected = game === currentLearnset.versionGroup;
            return option;
        }),
    );
    movesGameSelect.hidden = currentLearnset.games.length < 2;
    const counts = Object.fromEntries(
        MOVE_METHODS.map(({ method }) => [method, currentLearnset.methods[method].length]),
    );
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (!keepOpen) {
        movesSection.open = false;
    }
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
    const showMachine = currentMoveMethod === "machine";
    // The first column holds the level for level-up moves and the TM number for TMs.
    movesTable.classList.toggle("noLevel", !showLevel && !showMachine);
    movesTable.tHead.rows[0].cells[0].querySelector("button").textContent = showMachine ? "TM" : "Lv.";
    resetMoveSort();

    movesTableBody.replaceChildren();
    for (const move of currentMoves) {
        const row = movesTableBody.insertRow();
        // level 0 = learned on evolution; TM numbers are filled in by loadMoveDetails
        row.insertCell().textContent = showLevel ? move.level || "Evo" : showMachine ? "…" : "";
        row.insertCell().textContent = formatName(move.name);
        for (let column = 0; column < 4; column++) {
            row.insertCell().textContent = "…"; // type, category, power, accuracy
        }
    }
}

movesGameSelect.addEventListener("change", () => {
    preferredGame = movesGameSelect.value;
    renderMoves(currentRawMoves, { keepOpen: true });
    loadMoveDetails();
});

// TM rows start alphabetical; once the numbers are in, order them TM01, TM02, … then HMs/TRs,
// with moves that have no machine in this game last.
// --- Sortable moves table ---------------------------------------------------------
// Each header becomes a button; clicking sorts by that column, clicking again reverses.

function moveSortKey(row, column) {
    const text = row.cells[column].textContent.trim();
    if (column === 0) {
        const machine = /^(TM|HM|TR)(\d+)$/.exec(text);
        if (machine) {
            return ["TM", "HM", "TR"].indexOf(machine[1]) * 1000 + Number(machine[2]);
        }
        return text === "Evo" ? 0 : Number(text) || Infinity;
    }
    if (column >= 4) {
        const number = parseInt(text, 10); // "90", "100%"; "—" (none) sorts as -1
        return Number.isNaN(number) ? -1 : number;
    }
    return text.toLowerCase();
}

function sortMovesBy(column) {
    const header = movesTable.tHead.rows[0].cells[column];
    const direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
    resetMoveSort();
    header.setAttribute("aria-sort", direction);
    const sign = direction === "ascending" ? 1 : -1;
    const rows = [...movesTableBody.rows].sort((a, b) => {
        const keyA = moveSortKey(a, column);
        const keyB = moveSortKey(b, column);
        const order = typeof keyA === "string" ? keyA.localeCompare(keyB) : keyA - keyB;
        return sign * order;
    });
    movesTableBody.append(...rows);
}

function resetMoveSort() {
    for (const header of movesTable.tHead.rows[0].cells) {
        header.removeAttribute("aria-sort");
    }
}

[...movesTable.tHead.rows[0].cells].forEach((header, column) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sortBtn";
    button.append(...header.childNodes);
    header.append(button);
    button.addEventListener("click", () => sortMovesBy(column));
});

function sortRowsByTmNumber() {
    const key = (row) => {
        const match = /^(TM|HM|TR)(\d+)$/.exec(row.cells[0].textContent);
        return match ? ["TM", "HM", "TR"].indexOf(match[1]) * 1000 + Number(match[2]) : Infinity;
    };
    const rows = [...movesTableBody.rows].sort((a, b) => key(a) - key(b));
    movesTableBody.append(...rows);
}

// A TM's number comes from its machine record for the selected game (item "tm085" -> "TM085").
async function loadTmNumber(summary, versionGroup, cell, moves) {
    const machine = summary.machines.find(([group]) => group === versionGroup);
    if (!machine) {
        cell.textContent = "—";
        return;
    }
    try {
        const itemName = await getMachineItemName(machine[1]);
        if (moves === currentMoves) {
            cell.textContent = itemName.toUpperCase();
        }
    } catch {
        cell.textContent = "?";
    }
}

// Type and power need one request per move, so they're only fetched once the list is opened.
async function loadMoveDetails() {
    if (!movesSection.open || movesDetailsLoaded) {
        return;
    }
    movesDetailsLoaded = true;
    const moves = currentMoves;
    const method = currentMoveMethod;
    const versionGroup = currentLearnset.versionGroup;
    const rows = [...movesTableBody.rows];
    await Promise.all(
        moves.map(async (move, index) => {
            const [firstCell, , typeCell, categoryCell, powerCell, accuracyCell] = rows[index].cells;
            try {
                const details = await getMoveSummary(move.url);
                if (moves !== currentMoves) {
                    return; // a different Pokémon is showing now
                }
                const type = details.type;
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
                accuracyCell.textContent = details.accuracy ? details.accuracy + "%" : "—";
                if (method === "machine") {
                    await loadTmNumber(details, versionGroup, firstCell, moves);
                }
                const category = details.category;
                categoryCell.replaceChildren();
                if (MOVE_CATEGORIES[category]) {
                    const badge = document.createElement("span");
                    badge.className = "moveCategory " + category;
                    badge.textContent = MOVE_CATEGORIES[category].short;
                    badge.title = MOVE_CATEGORIES[category].label;
                    categoryCell.append(badge);
                }
            } catch {
                for (const cell of [typeCell, categoryCell, powerCell, accuracyCell]) {
                    cell.textContent = "?";
                }
            }
        }),
    );
    if (method === "machine" && moves === currentMoves) {
        sortRowsByTmNumber();
    }
}

movesSection.addEventListener("toggle", loadMoveDetails);

// --- Units ----------------------------------------------------------------------

const UNITS_KEY = "pokedex:units";
const unitsButton = document.getElementById("unitsToggleBtn");
let currentMeasurements = null;
let units = "metric";
try {
    units = localStorage.getItem(UNITS_KEY) === "imperial" ? "imperial" : "metric";
} catch {
    // storage unavailable; default to metric
}

function renderMeasurements() {
    if (currentMeasurements) {
        heightElement.textContent = formatHeight(currentMeasurements.height, units);
        weightElement.textContent = formatWeight(currentMeasurements.weight, units);
        renderSizeComparison();
    }
    unitsButton.textContent = units === "metric" ? "Show lbs / ft" : "Show kg / m";
}

// --- Size comparison --------------------------------------------------------------------
// The Pokémon (as a silhouette in its type colour, masked from its artwork) next to a
// 1.7 m trainer, both scaled to their real heights.
const SIZE_BOX_PX = 160;
const TRAINER_DECIMETRES = 17;

function renderSizeComparison() {
    const { height } = currentMeasurements;
    const { pokemonPx, trainerPx } = sizeComparison(height, SIZE_BOX_PX, TRAINER_DECIMETRES);
    const silhouette = document.getElementById("pokemonSilhouette");
    const artwork = SPRITE_BASE + "other/official-artwork/" + currentPokemon.id + ".png";
    silhouette.style.height = pokemonPx + "px";
    silhouette.style.width = pokemonPx + "px";
    silhouette.style.setProperty("--silhouette", "url(" + JSON.stringify(artwork) + ")");
    document.getElementById("trainerSilhouette").style.height = trainerPx + "px";

    const name = nameElement.textContent.trim();
    document.getElementById("trainerLabel").textContent = "Trainer " + formatHeight(TRAINER_DECIMETRES, units);
    document.getElementById("pokemonSizeLabel").textContent = name + " " + formatHeight(height, units);
    const ratio = height / TRAINER_DECIMETRES;
    document.getElementById("sizeCaption").textContent =
        ratio >= 1
            ? name + " is " + ratio.toFixed(1) + "× as tall as a 1.7 m trainer"
            : name + " is " + Math.round(ratio * 100) + "% of a 1.7 m trainer's height";
}

unitsButton.addEventListener("click", () => {
    units = units === "metric" ? "imperial" : "metric";
    try {
        localStorage.setItem(UNITS_KEY, units);
    } catch {
        // the choice just won't persist
    }
    renderMeasurements();
    refreshComparison();
});
renderMeasurements();

// --- Cry ------------------------------------------------------------------------

function playCry() {
    if (!currentCryUrl) {
        return;
    }
    cryAudio?.pause();
    cryAudio = new Audio();
    cryAudio.crossOrigin = "anonymous"; // the cries repo sends CORS headers, so the analyser can read it
    cryAudio.src = currentCryUrl;
    cryAudio.volume = 0.5;
    cryButton.classList.add("playing");
    const stop = () => {
        cryButton.classList.remove("playing");
        stopCryWave();
    };
    cryAudio.addEventListener("ended", stop, { once: true });
    cryAudio.play().then(() => {
        visualiseCry(cryAudio);
        partnerSay("🎵", Math.max(1500, (cryAudio.duration || 1.5) * 1000));
    }, stop); // e.g. format unsupported
}

// Equaliser bars under the name that follow the cry (Web Audio analyser); skipped under
// reduced motion or without Web Audio.
const CRY_BARS = 24;
const cryWave = document.createElement("div");
cryWave.id = "cryWave";
cryWave.setAttribute("aria-hidden", "true");
cryWave.append(...Array.from({ length: CRY_BARS }, () => document.createElement("span")));
document.getElementById("pokemonNameRow").after(cryWave);
let audioContext = null;
let cryAnalyser = null;
let cryWaveFrame = 0;

function visualiseCry(audio) {
    if (reducedMotion.matches || !window.AudioContext || audio !== cryAudio) {
        return;
    }
    try {
        if (!audioContext) {
            audioContext = new AudioContext();
            cryAnalyser = audioContext.createAnalyser();
            cryAnalyser.fftSize = 64;
            cryAnalyser.smoothingTimeConstant = 0.6;
            cryAnalyser.connect(audioContext.destination);
        }
        audioContext.createMediaElementSource(audio).connect(cryAnalyser);
        audioContext.resume();
    } catch {
        return; // the cry still plays, just without bars
    }
    const levels = new Uint8Array(cryAnalyser.frequencyBinCount);
    const bars = cryWave.children;
    cancelAnimationFrame(cryWaveFrame);
    cryWave.classList.add("active");
    const draw = () => {
        cryAnalyser.getByteFrequencyData(levels);
        // Mirror the low (loudest) bins out from the centre so the bars look like a symmetric equaliser.
        for (let index = 0; index < bars.length; index++) {
            const level = (levels[Math.floor(Math.abs(index - (bars.length - 1) / 2))] / 255) ** 1.6;
            bars[index].style.transform = "scaleY(" + Math.max(0.08, level).toFixed(3) + ")";
        }
        cryWaveFrame = requestAnimationFrame(draw);
    };
    draw();
}

function stopCryWave() {
    cancelAnimationFrame(cryWaveFrame);
    cryWave.classList.remove("active");
}

cryButton.addEventListener("click", playCry);

// --- Share ------------------------------------------------------------------------
// Phones get the system share sheet; elsewhere the link (with ?pokemon=) is copied.

const shareButton = document.getElementById("shareBtn");
const shareStatus = document.getElementById("shareStatus");

shareButton.addEventListener("click", async () => {
    const url = window.location.href;
    const title = document.title;
    try {
        if (navigator.share) {
            await navigator.share({ title, url });
            return;
        }
        await navigator.clipboard.writeText(url);
        shareStatus.textContent = "Link copied";
        shareButton.textContent = "✓";
        setTimeout(() => {
            shareButton.textContent = "🔗";
            shareStatus.textContent = "";
        }, 1500);
    } catch {
        // share sheet dismissed, or clipboard blocked: nothing to do
    }
});

// --- Keyboard shortcuts -------------------------------------------------------
// ←/→ previous/next Pokémon, "/" focuses the search box, "s" toggles shiny, "c" plays the cry,
// "n" follows the "Next missing" button while a region filter is active, "g" jumps to a number,
// "?" lists them all.

function isTypingTarget(element) {
    return element.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName);
}

const shortcutsDialog = document.getElementById("shortcutsDialog");
document.getElementById("shortcutsBtn").addEventListener("click", () => shortcutsDialog.showModal());

// "g": a little LCD prompt that jumps straight to a Pokédex number.
const gotoDialog = document.getElementById("gotoDialog");
const gotoInput = document.getElementById("gotoInput");
function openGoto() {
    shortcutsDialog.close();
    gotoInput.value = "";
    gotoInput.dispatchEvent(new Event("input")); // clear the preview
    gotoDialog.showModal();
    gotoInput.focus();
}
// As you type, the LCD shows who you'd land on: a number, or the first name starting with
// what's typed ("gen" → Gengar), as a green-tinted sprite and the name.
const gotoPreviewImage = document.querySelector("#gotoPreview img");
const gotoPreviewName = document.querySelector("#gotoPreview span");
async function findGotoTarget(rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (!query) {
        return null;
    }
    const number = /^\d+$/.test(query) ? Number(query) : null;
    if (number !== null && (number < 1 || number > MAX_DEX_NUMBER)) {
        return null;
    }
    let entries = [];
    let speciesSlugs = null;
    try {
        [entries, speciesSlugs] = await Promise.all([getAllPokemonEntries(), getSpeciesSlugs().catch(() => null)]);
    } catch {
        // no name list (offline): numbers still work, names can't be matched
    }
    const entry =
        number !== null
            ? entries.find((candidate) => candidate.id === number)
            : entries.find((candidate) => candidate.id <= MAX_DEX_NUMBER && candidate.name.startsWith(query));
    // Proper names on the LCD: "farfetchd" → "Farfetch’d", "mr-mime" → "Mr. Mime".
    const label = entry ? entryDisplayName(entry, speciesSlugs) : "";
    if (number !== null) {
        return { id: number, label };
    }
    return entry ? { id: entry.id, label } : null;
}

gotoInput.addEventListener("input", async () => {
    const typed = gotoInput.value;
    const target = await findGotoTarget(typed);
    if (gotoInput.value !== typed) {
        return; // a newer keystroke is already being looked up
    }
    gotoPreviewImage.hidden = !target;
    gotoPreviewName.textContent = target ? target.label || "#" + target.id : typed.trim() ? "No match" : "";
    if (target) {
        setSprite(gotoPreviewImage, target.id);
    } else {
        gotoPreviewImage.removeAttribute("src");
    }
});

gotoDialog.addEventListener("close", async () => {
    // Looked up afresh, so an Enter pressed before the preview caught up still lands right.
    const target = gotoDialog.returnValue === "go" ? await findGotoTarget(gotoInput.value) : null;
    if (target) {
        goToDexNumber(target.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    gotoDialog.returnValue = "";
});

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
    } else if (event.key.toLowerCase() === "g") {
        event.preventDefault(); // don't type the "g" into the prompt
        openGoto();
    } else if (event.key === "?") {
        shortcutsDialog.showModal();
    } else if (event.key.toLowerCase() === "n") {
        const nextMissing = document.getElementById("nextMissingBtn");
        if (!nextMissing.hidden) {
            nextMissing.click();
        }
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

// A one-off burst of sparks in the type colour from the artwork (skipped under reduced motion).
function playTypeBurst() {
    if (reducedMotion.matches) {
        return;
    }
    const burst = document.createElement("div");
    burst.className = "typeBurst";
    burst.setAttribute("aria-hidden", "true");
    const sparks = 22;
    for (let index = 0; index < sparks; index++) {
        const spark = document.createElement("span");
        spark.style.setProperty("--angle", (index * 360) / sparks + Math.random() * 12 + "deg");
        spark.style.setProperty("--distance", 110 + Math.random() * 60 + "px");
        burst.append(spark);
    }
    // A fixed overlay centred on the artwork: the art window itself clips its contents.
    const rect = artWindow.getBoundingClientRect();
    burst.style.left = rect.left + rect.width / 2 + "px";
    burst.style.top = rect.top + rect.height / 2 + "px";
    document.body.append(burst);
    setTimeout(() => burst.remove(), 900);
}

// --- Holo art tilt ---------------------------------------------------------------
// The artwork window tilts toward the pointer and its holo sheen slides with it.

const artWindow = document.getElementById("pokemonSpriteContainer");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const MAX_TILT_DEGREES = 10;

artWindow.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || event.pointerType === "touch") {
        return;
    }
    const rect = artWindow.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width; // 0..1
    const y = (event.clientY - rect.top) / rect.height;
    artWindow.style.setProperty("--tilt-y", ((x - 0.5) * 2 * MAX_TILT_DEGREES).toFixed(2) + "deg");
    artWindow.style.setProperty("--tilt-x", ((0.5 - y) * 2 * MAX_TILT_DEGREES).toFixed(2) + "deg");
    artWindow.style.setProperty("--sheen-x", (x * 100).toFixed(1) + "%");
    artWindow.style.setProperty("--sheen-y", (y * 100).toFixed(1) + "%");
});

artWindow.addEventListener("pointerleave", () => {
    for (const property of ["--tilt-x", "--tilt-y", "--sheen-x", "--sheen-y"]) {
        artWindow.style.removeProperty(property);
    }
});

// --- Offline banner ---------------------------------------------------------------

const offlineBanner = document.getElementById("offlineBanner");

function updateOfflineBanner() {
    offlineBanner.hidden = navigator.onLine;
}

window.addEventListener("online", updateOfflineBanner);
window.addEventListener("offline", updateOfflineBanner);
updateOfflineBanner();

// --- Install as an app -----------------------------------------------------------
// Browsers that support installing (Chrome, Edge, Android) fire beforeinstallprompt once the
// manifest and service worker qualify; we keep the event and offer our own button.

const installButton = document.getElementById("installBtn");
let installPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // show our button instead of the browser's mini-infobar
    installPrompt = event;
    installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
    if (!installPrompt) {
        return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null; // a prompt can only be used once
    installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
});

// Offline support: cache the app and the Pokémon you've viewed (see sw.js).
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
        // e.g. unsupported context; the site still works online
    });
}
