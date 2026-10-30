// Shiny hunt: press Encounter for a random wild Pokémon; 1 in 50 is shiny (1 in 25 once the
// Shiny Charm is earned). Encounters and the shiny collection are saved locally.
import { SPRITE_BASE, getSpeciesSlugs, setSprite } from "./api.js";
import { GENERATIONS, MAX_DEX_NUMBER, formatDexNumber, speciesDisplayName } from "./utils.js";

export const SHINY_ODDS = 50;
export const CHARM_ODDS = 25;
export const CHARM_ENCOUNTERS = 100;
const HUNT_KEY = "pokedex:shiny-hunt:v1";

const encounterButton = document.getElementById("huntEncounterBtn");
const stage = document.getElementById("huntStage");
const sprite = document.getElementById("huntSprite");
const resultElement = document.getElementById("huntResult");
const counterElement = document.getElementById("huntCounter");
const collectionElement = document.getElementById("huntCollection");
const generationSelect = document.getElementById("huntGeneration");
const charmElement = document.getElementById("huntCharm");

let state = { encounters: 0, shinies: [] }; // shinies: [{ id, encounter }]
let showPokemon = () => {};
let speciesSlugs = null;

// The Shiny Charm doubles the odds once the hunter has put in enough encounters.
export function huntOdds(encounters) {
    return encounters >= CHARM_ENCOUNTERS ? CHARM_ODDS : SHINY_ODDS;
}

export function rollShiny(random = Math.random, odds = SHINY_ODDS) {
    return random() < 1 / odds;
}

// A random National Dex number, limited to one generation when one is picked.
export function huntPick(generationNumber, random = Math.random) {
    const generation = GENERATIONS.find((gen) => gen.number === generationNumber);
    const first = generation?.first ?? 1;
    const last = generation?.last ?? MAX_DEX_NUMBER;
    return first + Math.floor(random() * (last - first + 1));
}

function huntName(id) {
    const slug = speciesSlugs?.get(id);
    return slug ? speciesDisplayName(slug) : formatDexNumber(id);
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
        huntOdds(state.encounters) +
        ")";
    const charmed = state.encounters >= CHARM_ENCOUNTERS;
    charmElement.hidden = !charmed && state.encounters < CHARM_ENCOUNTERS / 2;
    charmElement.classList.toggle("earned", charmed);
    charmElement.textContent = charmed
        ? "🔮 Shiny Charm earned — shinies are twice as likely!"
        : "🔮 Shiny Charm in " + (CHARM_ENCOUNTERS - state.encounters) + " encounters";
}

function renderCollection() {
    collectionElement.replaceChildren(
        ...state.shinies.map(({ id, encounter }) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "huntShiny";
            button.title = "Shiny " + huntName(id) + " (encounter " + encounter + ")";
            const image = document.createElement("img");
            image.alt = "Shiny " + huntName(id);
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
    const id = huntPick(Number(generationSelect.value) || null);
    const shiny = rollShiny(Math.random, huntOdds(state.encounters));
    state.encounters++;
    const name = huntName(id);
    stage.hidden = false;
    stage.classList.toggle("shiny", shiny);
    // Restart the "appear" animation for every encounter.
    sprite.classList.remove("appear");
    void sprite.offsetWidth;
    sprite.classList.add("appear");
    if (shiny) {
        sprite.src = SPRITE_BASE + "shiny/" + id + ".png";
        sprite.alt = "A shiny wild " + name;
        state.shinies = [...state.shinies, { id, encounter: state.encounters }];
        resultElement.textContent =
            "✨ SHINY! A shiny " + name + " appeared after " + state.encounters + " encounters!";
        renderCollection();
    } else {
        setSprite(sprite, id);
        sprite.alt = "A wild " + name;
        resultElement.textContent = "A wild " + name + " appeared. Not shiny — keep hunting!";
    }
    save();
    renderCounter();
}

export function initShinyHunt(options) {
    showPokemon = options.showPokemon;
    load();
    renderCounter();
    renderCollection();
    for (const generation of GENERATIONS) {
        const option = document.createElement("option");
        option.value = generation.number;
        option.textContent = generation.region + " (Gen " + generation.number + ")";
        generationSelect.append(option);
    }
    encounterButton.addEventListener("click", encounter);
    // Names arrive with the species list (one cached request); numbers are shown until then.
    getSpeciesSlugs()
        .then((slugs) => {
            speciesSlugs = slugs;
            renderCollection();
        })
        .catch(() => {});
}
