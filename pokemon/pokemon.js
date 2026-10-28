const imgElement = document.getElementById("pokemonSprite");
const nameElement = document.getElementById("pokemonName");
const numberElement = document.getElementById("pokemonNumber");
const type1IconElement = document.getElementById("pokemonType1");
const type2IconElement = document.getElementById("pokemonType2");
const pokemonCard = document.getElementById("pokemonCardContainer");
const errorElement = document.getElementById("errorMessage");

async function fetchData() {
    try {
        clearFields(); 

        const pokemonNameInput = document.getElementById('pokemonLookupInpt').value.toLowerCase();
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

    function fetchPKMNType(pkmnType, pkmnType2) {
        type1IconElement.style.display = "none";
        type2IconElement.style.display = "none";

        switch (pkmnType) {
            case "normal":
                type1IconElement.src = "assets/NormalIcon.png";
                type1IconElement.style.display = "block";
                break
            case "fire":
                type1IconElement.src = "assets/FireIcon.png";
                type1IconElement.style.display = "block";
                break
            case "water":
                type1IconElement.src = "assets/WaterIcon.png";
                type1IconElement.style.display = "block";
                break
            case "grass":
                type1IconElement.src = "assets/GrassIcon.png";
                type1IconElement.style.display = "block";
                break
            case "electric":
                type1IconElement.src = "assets/ElectricIcon.png";
                type1IconElement.style.display = "block";
                break
            case "ice":
                type1IconElement.src = "assets/IceIcon.png";
                type1IconElement.style.display = "block";
                break
            case "fighting":
                type1IconElement.src = "assets/FightingIcon.png";
                type1IconElement.style.display = "block";
                break
            case "poison":
                type1IconElement.src = "assets/PoisonIcon.png";
                type1IconElement.style.display = "block";
                break
            case "ground":
                type1IconElement.src = "assets/GroundIcon.png";
                type1IconElement.style.display = "block";
                break
            case "flying":
                type1IconElement.src = "assets/FlyingIcon.png";
                type1IconElement.style.display = "block";
                break
            case "psychic":
                type1IconElement.src = "assets/PsychicIcon.png";
                type1IconElement.style.display = "block";
                break
            case "bug":
                type1IconElement.src = "assets/BugIcon.png";
                type1IconElement.style.display = "block";
                break
            case "rock":
                type1IconElement.src = "assets/RockIcon.png";
                type1IconElement.style.display = "block";
                break
            case "ghost":
                type1IconElement.src = "assets/GhostIcon.png";
                type1IconElement.style.display = "block";
                break
            case "dark":
                type1IconElement.src = "assets/DarkIcon.png";
                type1IconElement.style.display = "block";
                break
            case "dragon":
                type1IconElement.src = "assets/DragonIcon.png";
                type1IconElement.style.display = "block";
                break
            case "steel":
                type1IconElement.src = "assets/SteelIcon.png";
                type1IconElement.style.display = "block";
                break
            case "fairy":
                type1IconElement.src = "assets/FairyIcon.png";
                type1IconElement.style.display = "block";
                break
            default:
                return "none";
        }

        switch (pkmnType2) {
            case "normal":
                type2IconElement.src = "assets/NormalIcon.png";
                type2IconElement.style.display = "block";
                break
            case "fire":
                type2IconElement.src = "assets/FireIcon.png";
                type2IconElement.style.display = "block";
                break
            case "water":
                type2IconElement.src = "assets/WaterIcon.png";
                type2IconElement.style.display = "block";
                break
            case "grass":
                type2IconElement.src = "assets/GrassIcon.png";
                type2IconElement.style.display = "block";
                break
            case "electric":
                type2IconElement.src = "assets/ElectricIcon.png";
                type2IconElement.style.display = "block";
                break
            case "ice":
                type2IconElement.src = "assets/IceIcon.png";
                type2IconElement.style.display = "block";
                break
            case "fighting":
                type2IconElement.src = "assets/FightingIcon.png";
                type2IconElement.style.display = "block";
                break
            case "poison":
                type2IconElement.src = "assets/PoisonIcon.png";
                type2IconElement.style.display = "block";
                break
            case "ground":
                type2IconElement.src = "assets/GroundIcon.png";
                type2IconElement.style.display = "block";
                break
            case "flying":
                type2IconElement.src = "assets/FlyingIcon.png";
                type2IconElement.style.display = "block";
                break
            case "psychic":
                type2IconElement.src = "assets/PsychicIcon.png";
                type2IconElement.style.display = "block";
                break
            case "bug":
                type2IconElement.src = "assets/BugIcon.png";
                type2IconElement.style.display = "block";
                break
            case "rock":
                type2IconElement.src = "assets/RockIcon.png";
                type2IconElement.style.display = "block";
                break
            case "ghost":
                type2IconElement.src = "assets/GhostIcon.png";
                type2IconElement.style.display = "block";
                break
            case "dark":
                type2IconElement.src = "assets/DarkIcon.png";
                type2IconElement.style.display = "block";
                break
            case "dragon":
                type2IconElement.src = "assets/DragonIcon.png";
                type2IconElement.style.display = "block";
                break
            case "steel":
                type2IconElement.src = "assets/SteelIcon.png";
                type2IconElement.style.display = "block";
                break
            case "fairy":
                type2IconElement.src = "assets/FairyIcon.png";
                type2IconElement.style.display = "block";
                break
            default:
                return "none";
        }    
    }
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

