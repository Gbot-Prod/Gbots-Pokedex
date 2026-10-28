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

let currentPokemonId = null;
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

        const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + encodeURIComponent(query));

        if (!response.ok) {
            const err = new Error('Network response was not ok ' + response.statusText);
            err.status = response.status;
            throw err;
        }

        const data = await response.json();
        if (requestId !== latestRequest) {
            return; // a newer search has started; drop this stale result
        }
        renderPokemon(data);
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

function renderPokemon(data) {
    currentPokemonId = data.id;

    //fetch pokemon name
    nameElement.textContent = formatName(data.name);

    //fetch pokemon number
    numberElement.textContent = "Pokemon no#" + data.id;

    //fetch pokemon type
    const pkmnType = data.types[0].type.name;
    const pkmnType2 = data.types[1]?.type.name || "none";
    fetchPKMNType(pkmnType, pkmnType2);

    //fetch pokemon height (decimetres) and weight (hectograms)
    heightElement.textContent = (data.height / 10).toFixed(1) + " m";
    weightElement.textContent = (data.weight / 10).toFixed(1) + " kg";

    //fetch pokemon abilities
    renderAbilities(data.abilities);

    //fetch pokemon base stats
    renderStats(data.stats);

    //fetch pokemon sprite (not every form has a HOME render)
    const sprites = data.sprites;
    imgElement.src = sprites.other.home.front_default || sprites.other["official-artwork"].front_default || sprites.front_default || "";
    imgElement.style.display = imgElement.src ? "block" : "none";

    pokemonCard.classList.remove("hidden");
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

document.getElementById("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    fetchData();
});
document.getElementById("clearDataBtn").addEventListener("click", clearFields);
