// Shiny hunt: press Encounter for a random wild Pokémon; 1 in 50 is shiny. Encounters and the
// shiny collection are saved locally.
import { SPRITE_BASE, setSprite } from "./api.js";
import { MAX_DEX_NUMBER, formatDexNumber } from "./utils.js";

export const SHINY_ODDS = 50;
const HUNT_KEY = "pokedex:shiny-hunt:v1";

const encounterButton = document.getElementById("huntEncounterBtn");
const stage = document.getElementById("huntStage");
const sprite = document.getElementById("huntSprite");
const resultElement = document.getElementById("huntResult");
const counterElement = document.getElementById("huntCounter");
const collectionElement = document.getElementById("huntCollection");

let state = { encounters: 0, shinies: [] }; // shinies: [{ id, encounter }]
let showPokemon = () => {};

export function rollShiny(random = Math.random) {
    return random() < 1 / SHINY_ODDS;
}

function load() {
    try {
        state = { ...state, ...JSON.parse(localStorage.getItem(HUNT_KEY)) };
    } catch {
        // fresh hunt
    }
}

function save() {
    try {
        localStorage.setItem(HUNT_KEY, JSON.stringify(state));
    } catch {
        // the hunt just won't persist
    }
}

function renderCounter() {
    counterElement.textContent =
        "Encounters: " +
        state.encounters +
        " · Shinies found: " +
        state.shinies.length +
        " (odds 1 in " +
        SHINY_ODDS +
        ")";
}

function renderCollection() {
    collectionElement.replaceChildren(
        ...state.shinies.map(({ id, encounter }) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "huntShiny";
            button.title = "Shiny " + formatDexNumber(id) + " (encounter " + encounter + ")";
            const image = document.createElement("img");
            image.alt = "Shiny Pokémon " + formatDexNumber(id);
            image.width = 64;
            image.height = 64;
            image.src = SPRITE_BASE + "shiny/" + id + ".png";
            button.append(image);
            button.addEventListener("click", () => {
                showPokemon(id);
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
            item.append(button);
            return item;
        }),
    );
}

function encounter() {
    const id = 1 + Math.floor(Math.random() * MAX_DEX_NUMBER);
    const shiny = rollShiny();
    state.encounters++;
    stage.hidden = false;
    stage.classList.toggle("shiny", shiny);
    // Restart the "appear" animation for every encounter.
    sprite.classList.remove("appear");
    void sprite.offsetWidth;
    sprite.classList.add("appear");
    if (shiny) {
        sprite.src = SPRITE_BASE + "shiny/" + id + ".png";
        sprite.alt = "A shiny wild Pokémon, " + formatDexNumber(id);
        state.shinies = [...state.shinies, { id, encounter: state.encounters }];
        resultElement.textContent =
            "✨ SHINY! A shiny " + formatDexNumber(id) + " appeared after " + state.encounters + " encounters!";
        renderCollection();
    } else {
        setSprite(sprite, id);
        sprite.alt = "A wild Pokémon, " + formatDexNumber(id);
        resultElement.textContent = "A wild " + formatDexNumber(id) + " appeared. Not shiny — keep hunting!";
    }
    save();
    renderCounter();
}

export function initShinyHunt(options) {
    showPokemon = options.showPokemon;
    load();
    renderCounter();
    renderCollection();
    encounterButton.addEventListener("click", encounter);
}
