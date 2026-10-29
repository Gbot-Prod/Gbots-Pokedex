// Side-by-side comparison of two Pokémon.
import { API_BASE, fetchJson } from "./api.js";
import { STAT_LABELS, damageMultipliers, formatName, normalizeQuery, pickSprite } from "./utils.js";

const compareForm = document.getElementById("compareForm");
const compareLeftInput = document.getElementById("compareLeftInput");
const compareRightInput = document.getElementById("compareRightInput");
const compareStatusElement = document.getElementById("compareStatus");
const compareResultElement = document.getElementById("compareResult");
const compareTable = document.getElementById("compareTable");
let latestCompare = 0;

async function comparePokemon() {
    const queries = [normalizeQuery(compareLeftInput.value), normalizeQuery(compareRightInput.value)];
    if (queries.some((query) => !query)) {
        compareStatusElement.textContent = "Enter two Pokémon to compare.";
        return;
    }

    const compareId = ++latestCompare;
    compareStatusElement.textContent = "Loading…";
    const results = await Promise.allSettled(
        queries.map((query) => fetchJson(API_BASE + "pokemon/" + encodeURIComponent(query))),
    );
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

function renderComparison([left, right], matchups) {
    const head = compareTable.tHead;
    const body = compareTable.tBodies[0];
    head.replaceChildren();
    body.replaceChildren();

    const headRow = head.insertRow();
    headRow.append(document.createElement("th"));
    for (const pokemon of [left, right]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        const sprite = document.createElement("img");
        sprite.src = pickSprite(pokemon.sprites, false);
        sprite.alt = formatName(pokemon.name) + " sprite";
        sprite.width = 96;
        sprite.height = 96;
        const name = document.createElement("span");
        name.textContent = formatName(pokemon.name);
        const types = document.createElement("small");
        types.textContent = pokemon.types.map((entry) => formatName(entry.type.name)).join(" / ");
        cell.append(sprite, name, types);
        headRow.append(cell);
    }

    const statValue = (pokemon, statName) =>
        pokemon.stats.find((entry) => entry.stat.name === statName)?.base_stat ?? 0;
    const rows = Object.keys(STAT_LABELS).map((statName) => [
        STAT_LABELS[statName],
        statValue(left, statName),
        statValue(right, statName),
    ]);
    const total = (pokemon) => pokemon.stats.reduce((sum, entry) => sum + entry.base_stat, 0);
    rows.push(["Total", total(left), total(right)]);
    rows.push(["Height (m)", left.height / 10, right.height / 10]);
    rows.push(["Weight (kg)", left.weight / 10, right.weight / 10]);
    if (matchups) {
        // Fewer weaknesses is better, so that row highlights the lower number.
        rows.push(["Weak to (types)", matchups[0].weak, matchups[1].weak, true]);
        rows.push(["Resists (types)", matchups[0].resist, matchups[1].resist]);
        rows.push(["Immune to (types)", matchups[0].immune, matchups[1].immune]);
    }

    for (const [label, leftValue, rightValue, lowerIsBetter = false] of rows) {
        const row = body.insertRow();
        const header = document.createElement("th");
        header.scope = "row";
        header.textContent = label;
        row.append(header);
        for (const [value, other] of [
            [leftValue, rightValue],
            [rightValue, leftValue],
        ]) {
            const cell = row.insertCell();
            cell.textContent = value;
            if (lowerIsBetter ? value < other : value > other) {
                cell.className = "compareWinner";
            }
        }
    }

    compareResultElement.hidden = false;
}

// getCurrentPokemon returns the { id, name } on the main card (or null);
// loadNameSuggestions fills the shared autocomplete list.
export function initCompare({ getCurrentPokemon, loadNameSuggestions }) {
    compareForm.addEventListener("submit", (event) => {
        event.preventDefault();
        comparePokemon();
    });
    compareLeftInput.addEventListener("focus", loadNameSuggestions);
    compareRightInput.addEventListener("focus", loadNameSuggestions);

    document.getElementById("compareCurrentBtn").addEventListener("click", () => {
        const currentPokemon = getCurrentPokemon();
        if (!currentPokemon) {
            return;
        }
        compareLeftInput.value = formatName(currentPokemon.name);
        compareRightInput.value = "";
        document.getElementById("compareSection").scrollIntoView({ behavior: "smooth" });
        compareRightInput.focus({ preventScroll: true });
    });
}
