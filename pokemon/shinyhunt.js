// Shiny hunt: press Encounter for a random wild Pokémon; 1 in 50 is shiny (1 in 25 once the
// Shiny Charm is earned). Encounters and the shiny collection are saved locally.
import { SPRITE_BASE, getSpeciesSlugs, setSprite } from "./api.js";
import { shinyTierProgress } from "./progress.js";
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
const tierElement = document.getElementById("huntTier");

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

// Fewest encounters it took to find a shiny (counted from the previous shiny, or from the
// start of the hunt for the first); null before any shiny.
export function bestShinyGap(shinies) {
    let best = null;
    let previous = 0;
    for (const { encounter } of [...shinies].sort((a, b) => a.encounter - b.encounter)) {
        const gap = encounter - previous;
        best = best === null ? gap : Math.min(best, gap);
        previous = encounter;
    }
    return best;
}

// One readout on the counter's LCD: a label over zero-padded digits, with faint "8"s behind
// them like unlit segments.
// Digits that changed since the last render roll in from above, like an odometer (CSS keeps
// them still under reduced motion).
const lastShown = {};

function lcdCell(label, value, width) {
    const cell = document.createElement("span");
    cell.className = "lcdCell";
    const name = document.createElement("small");
    name.textContent = label;
    const digits = document.createElement("b");
    const text = String(value).padStart(width, "0");
    const before = lastShown[label];
    digits.append(
        ...[...text].map((digit, index) => {
            const span = document.createElement("span");
            span.textContent = digit;
            if (before !== undefined && (before.length !== text.length || before[index] !== digit)) {
                span.className = "roll";
            }
            return span;
        }),
    );
    lastShown[label] = text;
    digits.dataset.ghost = "8".repeat(Math.max(width, String(value).length));
    cell.append(name, digits);
    return cell;
}

function renderCounter({ newBest = false } = {}) {
    const odds = huntOdds(state.encounters);
    const best = bestShinyGap(state.shinies);
    const spoken = document.createElement("span");
    spoken.className = "visuallyHidden";
    spoken.textContent =
        "Encounters: " +
        state.encounters +
        " · Shinies found: " +
        state.shinies.length +
        " (odds 1 in " +
        odds +
        ")" +
        (best === null
            ? ""
            : " · Best: a shiny in " +
              best +
              (best === 1 ? " encounter" : " encounters") +
              " · " +
              (state.encounters - Math.max(...state.shinies.map((shiny) => shiny.encounter))) +
              " since the last shiny");
    const screen = document.createElement("span");
    screen.className = "lcdScreen";
    screen.setAttribute("aria-hidden", "true");
    screen.append(
        lcdCell("Encounters", state.encounters, 4),
        lcdCell("Shinies", state.shinies.length, 2),
        lcdCell("Odds 1 in", odds, 1),
    );
    if (best !== null) {
        // The quickest shiny so far; it blinks when a new shiny beats it.
        const bestCell = lcdCell("Best", best, 1);
        bestCell.classList.toggle("newBest", newBest);
        // Encounters since the last shiny; amber once this dry spell is longer than the best.
        const since = state.encounters - Math.max(...state.shinies.map((shiny) => shiny.encounter));
        const sinceCell = lcdCell("Since", since, 1);
        sinceCell.classList.toggle("overdue", since > best);
        screen.append(bestCell, sinceCell);
    }
    counterElement.replaceChildren(spoken, screen);
    const charmed = state.encounters >= CHARM_ENCOUNTERS;
    charmElement.hidden = !charmed && state.encounters < CHARM_ENCOUNTERS / 2;
    charmElement.classList.toggle("earned", charmed);
    charmElement.textContent = charmed
        ? "🔮 Shiny Charm earned — shinies are twice as likely!"
        : "🔮 Shiny Charm in " + (CHARM_ENCOUNTERS - state.encounters) + " encounters";
    const tier = shinyTierProgress(state.shinies.length);
    tierElement.textContent = tier
        ? "✨ Shiny hunter badge: " + tier
        : "✨ Shiny hunter badge: gold — legendary hunter!";
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
    const previousBest = bestShinyGap(state.shinies.slice(0, -1));
    const best = bestShinyGap(state.shinies);
    renderCounter({ newBest: shiny && previousBest !== null && best < previousBest });
    if (shiny) {
        flashShinyOnLcd();
    }
}

// A shiny takes over the counter's LCD for two seconds: the screen goes gold with "SHINY!" in
// glowing segment letters (the result line below already announces it to screen readers).
function flashShinyOnLcd() {
    const screen = counterElement.querySelector(".lcdScreen");
    const banner = document.createElement("span");
    banner.className = "lcdShiny";
    banner.textContent = "✦ SHINY! ✦";
    screen.append(banner);
    screen.classList.add("shinyFlash");
    setTimeout(() => {
        screen.classList.remove("shinyFlash");
        banner.remove();
    }, 2000);
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
