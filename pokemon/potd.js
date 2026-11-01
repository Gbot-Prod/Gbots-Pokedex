// "Pokémon of the day": a hero card on the empty landing state, the same for everyone on a
// given (UTC) day.
import { SPRITE_BASE, fetchPokemon } from "./api.js";
import { MAX_DEX_NUMBER, formatDexNumber, formatName, pokemonDisplayName } from "./utils.js";

const section = document.getElementById("potdSection");
const art = document.getElementById("potdArt");
const nameElement = document.getElementById("potdName");
const detailElement = document.getElementById("potdDetail");
const seeButton = document.getElementById("potdSeeBtn");

// Deterministic National Dex number for a date string like "2026-10-30" (FNV-1a hash).
export function dailyPokemonId(dateString) {
    let hash = 0x811c9dc5;
    for (const char of dateString) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return (hash % MAX_DEX_NUMBER) + 1;
}

let todaysId = null;

export function setPotdVisible(visible) {
    section.hidden = !visible || todaysId === null;
}

export async function initPotd({ showPokemon, isCardShowing }) {
    todaysId = dailyPokemonId(new Date().toISOString().slice(0, 10));
    art.src = SPRITE_BASE + "other/official-artwork/" + todaysId + ".png";
    // Shown until (or if) the details load.
    nameElement.textContent = "Today's pick";
    detailElement.textContent = formatDexNumber(todaysId);
    seeButton.addEventListener("click", () => showPokemon(todaysId));
    setPotdVisible(!isCardShowing());
    try {
        const pokemon = await fetchPokemon(String(todaysId));
        const name = pokemonDisplayName(pokemon);
        nameElement.textContent = name;
        art.alt = name + " artwork";
        detailElement.textContent =
            formatDexNumber(todaysId) + " · " + pokemon.types.map((entry) => formatName(entry.type.name)).join(" / ");
        seeButton.textContent = "See " + name;
    } catch {
        // keep the number-only version; the button still works
    }
}
