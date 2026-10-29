// Side-by-side comparison of two or three Pokémon.
import { API_BASE, fetchJson, fetchPokemon } from "./api.js";
import {
    damageMultipliers,
    formatHeight,
    formatName,
    formatWeight,
    normalizeQuery,
    pickSprite,
    pokemonDisplayName,
    STAT_LABELS,
} from "./utils.js";

const compareForm = document.getElementById("compareForm");
const compareLeftInput = document.getElementById("compareLeftInput");
const compareRightInput = document.getElementById("compareRightInput");
const compareThirdInput = document.getElementById("compareThirdInput");
const compareStatusElement = document.getElementById("compareStatus");
const compareResultElement = document.getElementById("compareResult");
const compareTable = document.getElementById("compareTable");
let latestCompare = 0;

async function comparePokemon() {
    const [left, right, third] = [compareLeftInput, compareRightInput, compareThirdInput].map((input) =>
        normalizeQuery(input.value),
    );
    if (!left || !right) {
        compareStatusElement.textContent = "Enter at least two Pokémon to compare.";
        return;
    }
    const queries = third ? [left, right, third] : [left, right];

    const compareId = ++latestCompare;
    compareStatusElement.textContent = "Loading…";
    const results = await Promise.allSettled(queries.map((query) => fetchPokemon(query)));
    if (compareId !== latestCompare) {
        return;
    }

    const missing = queries.filter((query, index) => results[index].status === "rejected");
    if (missing.length) {
        compareResultElement.hidden = true;
        compareStatusElement.textContent =
            "Couldn't find " + missing.map((query) => "\u201c" + formatName(query) + "\u201d").join(" or ") + ".";
        return;
    }

    compareStatusElement.textContent = "";
    const pokemon = results.map((result) => result.value);
    renderComparison(pokemon, await loadMatchupCounts(pokemon));
}

// { weak, resist, immune } counts per Pokémon, or null if the type data can't be loaded.
async function loadMatchupCounts(pokemonList) {
    try {
        return await Promise.all(
            pokemonList.map(async (pokemon) => {
                const typeData = await Promise.all(
                    pokemon.types.map((entry) => fetchJson(API_BASE + "type/" + entry.type.name)),
                );
                const values = Object.values(damageMultipliers(typeData));
                return {
                    weak: values.filter((value) => value > 1).length,
                    resist: values.filter((value) => value > 0 && value < 1).length,
                    immune: values.filter((value) => value === 0).length,
                };
            }),
        );
    } catch {
        return null;
    }
}

// Set by initCompare: returns "metric" or "imperial".
let getUnits = () => "metric";
let lastComparison = null;

// Re-draws the current comparison, e.g. after the units setting changes.
export function refreshComparison() {
    if (lastComparison) {
        renderComparison(...lastComparison);
    }
}

function renderComparison(pokemonList, matchups) {
    lastComparison = [pokemonList, matchups];
    const head = compareTable.tHead;
    const body = compareTable.tBodies[0];
    head.replaceChildren();
    body.replaceChildren();

    const headRow = head.insertRow();
    headRow.append(document.createElement("th"));
    for (const pokemon of pokemonList) {
        const cell = document.createElement("th");
        cell.scope = "col";
        const sprite = document.createElement("img");
        sprite.src = pickSprite(pokemon.sprites, false);
        sprite.alt = pokemonDisplayName(pokemon) + " sprite";
        sprite.width = 96;
        sprite.height = 96;
        const name = document.createElement("span");
        name.textContent = pokemonDisplayName(pokemon);
        const types = document.createElement("small");
        types.textContent = pokemon.types.map((entry) => formatName(entry.type.name)).join(" / ");
        cell.append(sprite, name, types);
        headRow.append(cell);
    }

    const statValue = (pokemon, statName) =>
        pokemon.stats.find((entry) => entry.stat.name === statName)?.base_stat ?? 0;
    const total = (pokemon) => pokemon.stats.reduce((sum, entry) => sum + entry.base_stat, 0);
    // [label, value for each Pokémon, lowerIsBetter]
    const rows = Object.keys(STAT_LABELS).map((statName) => [
        STAT_LABELS[statName],
        pokemonList.map((pokemon) => statValue(pokemon, statName)),
    ]);
    rows.push(["Total", pokemonList.map(total)]);
    // Raw API values decide the winner; the cells show them in the chosen units.
    const units = getUnits();
    rows.push(["Height", pokemonList.map((pokemon) => pokemon.height), false, (value) => formatHeight(value, units)]);
    rows.push(["Weight", pokemonList.map((pokemon) => pokemon.weight), false, (value) => formatWeight(value, units)]);
    if (matchups) {
        // Fewer weaknesses is better, so that row highlights the lowest number.
        rows.push(["Weak to (types)", matchups.map((counts) => counts.weak), true]);
        rows.push(["Resists (types)", matchups.map((counts) => counts.resist)]);
        rows.push(["Immune to (types)", matchups.map((counts) => counts.immune)]);
    }

    for (const [label, values, lowerIsBetter = false, format = String] of rows) {
        const row = body.insertRow();
        const header = document.createElement("th");
        header.scope = "row";
        header.textContent = label;
        row.append(header);
        // Highlight the best value, unless every Pokémon ties.
        const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
        const allTied = values.every((value) => value === best);
        for (const value of values) {
            const cell = row.insertCell();
            cell.textContent = format(value);
            if (value === best && !allTied) {
                cell.className = "compareWinner";
            }
        }
    }

    compareResultElement.hidden = false;
}

// getCurrentPokemon returns the { id, name } on the main card (or null);
// loadNameSuggestions fills the shared autocomplete list.
export function initCompare({ getCurrentPokemon, loadNameSuggestions, getUnits: unitsGetter }) {
    getUnits = unitsGetter ?? getUnits;
    compareForm.addEventListener("submit", (event) => {
        event.preventDefault();
        comparePokemon();
    });
    compareLeftInput.addEventListener("focus", loadNameSuggestions);
    compareRightInput.addEventListener("focus", loadNameSuggestions);
    compareThirdInput.addEventListener("focus", loadNameSuggestions);

    document.getElementById("compareCurrentBtn").addEventListener("click", () => {
        const currentPokemon = getCurrentPokemon();
        if (!currentPokemon) {
            return;
        }
        compareLeftInput.value = formatName(currentPokemon.name);
        compareRightInput.value = "";
        compareThirdInput.value = "";
        document.getElementById("compareSection").scrollIntoView({ behavior: "smooth" });
        compareRightInput.focus({ preventScroll: true });
    });
}
