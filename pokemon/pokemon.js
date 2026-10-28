const imgElement = document.getElementById("pokemonSprite");
const nameElement = document.getElementById("pokemonName");
const numberElement = document.getElementById("pokemonNumber");
const type1IconElement = document.getElementById("pokemonType1");
const type2IconElement = document.getElementById("pokemonType2");
const heightElement = document.getElementById("pokemonHeight");
const weightElement = document.getElementById("pokemonWeight");
const abilityElement = document.getElementById("pokemonAbility");
const pokemonCard = document.getElementById("pokemonCardContainer");
const errorElement = document.getElementById("errorMessage");
const loadingElement = document.getElementById("loadingIndicator");
const searchButton = document.getElementById("getPokemonBtn");

async function fetchData() {
    try {
        const pokemonNameInput = document.getElementById('pokemonLookupInpt').value.trim().toLowerCase();
        if (!pokemonNameInput) {
            return;
        }
        clearFields();
        setLoading(true);

        const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + pokemonNameInput);   
        
        if (!response.ok) {
            const err = new Error('Network response was not ok ' + response.statusText);
            err.status = response.status;
            throw err;
        } 
        
        const data = await response.json();

        //fetch pokemon name
        const pkmnName = data.name;
        nameElement.textContent = formatName(pkmnName);

        //fetch pokemon number
        const pkmnNumber = data.id;
        numberElement.textContent = "Pokemon no#" + pkmnNumber;

        //fetch pokemon type
        const pkmnType = data.types[0].type.name;
        const pkmnType2 = data.types[1]?.type.name || "none";
        fetchPKMNType(pkmnType, pkmnType2);

        //fetch pokemon height (decimetres) and weight (hectograms)
        heightElement.textContent = (data.height / 10).toFixed(1) + " m";
        weightElement.textContent = (data.weight / 10).toFixed(1) + " kg";

        //fetch pokemon abilities
        renderAbilities(data.abilities);

        //fetch pokemon sprite
        const pkmnSprite = data.sprites.other.home.front_default;
        imgElement.src = pkmnSprite;
        imgElement.style.display = "block";

        pokemonCard.classList.remove("hidden");
    }
    catch (error) {
        showError(isNotFound(error) ? "Pokémon not found. Check the spelling and try again." : "Couldn't reach the Pokédex. Please try again.");
    }
    finally {
        setLoading(false);
    }
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
