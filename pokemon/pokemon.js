const imgElement = document.getElementById("pokemonSprite");
const nameElement = document.getElementById("pokemonName");
const numberElement = document.getElementById("pokemonNumber");
const type1IconElement = document.getElementById("pokemonType1");
const type2IconElement = document.getElementById("pokemonType2");
const pokemonCard = document.getElementById("pokemonCardContainer");
const errorElement = document.getElementById("errorMessage");

async function fetchData() {
    try {
        const pokemonNameInput = document.getElementById('pokemonLookupInpt').value.trim().toLowerCase();
        if (!pokemonNameInput) {
            return;
        }
        clearFields();

        const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + pokemonNameInput);   
        
        if (!response.ok) {
            const err = new Error('Network response was not ok ' + response.statusText);
            err.status = response.status;
            throw err;
        } 
        
        const data = await response.json();
        console.log(data);

        //fetch pokemon name
        const pkmnName = data.name;
        nameElement.textContent = pkmnName.charAt(0).toUpperCase() + pkmnName.slice(1);

        //fetch pokemon number
        const pkmnNumber = data.id;
        numberElement.textContent = "Pokemon no#" + pkmnNumber;

        //fetch pokemon type
        const pkmnType = data.types[0].type.name;
        const pkmnType2 = data.types[1]?.type.name || "none";
        fetchPKMNType(pkmnType, pkmnType2);

        //fetch pokemon sprite
        const pkmnSprite = data.sprites.other.home.front_default;
        imgElement.src = pkmnSprite;
        imgElement.style.display = "block";

        pokemonCard.classList.remove("hidden");
    }
    catch (error) {
        showError(isNotFound(error) ? "Pokémon not found. Check the spelling and try again." : "Couldn't reach the Pokédex. Please try again.");
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

