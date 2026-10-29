// Regenerates the trimmed PokéAPI fixtures in tests/fixtures from the live API.
// Run with: npm run fixtures
// (Behind an HTTP proxy, Node's fetch needs NODE_USE_ENV_PROXY=1, which the npm script sets.)
//
// Responses are trimmed to the fields the page reads so the fixtures stay small.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = "https://pokeapi.co/api/v2/";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
// Only this game's moves are kept (the page shows the newest game's learnset).
const MOVES_VERSION_GROUP = "scarlet-violet";

async function get(resource) {
    const response = await fetch(API + resource);
    if (!response.ok) {
        throw new Error(resource + ": HTTP " + response.status);
    }
    return response.json();
}

async function save(name, data) {
    await writeFile(path.join(OUT, name + ".json"), JSON.stringify(data));
    console.log("wrote", name);
}

const idFromUrl = (url) => Number(url.split("/").filter(Boolean).pop());

function trimPokemon(pokemon) {
    const { sprites } = pokemon;
    return {
        id: pokemon.id,
        name: pokemon.name,
        height: pokemon.height,
        weight: pokemon.weight,
        abilities: pokemon.abilities,
        stats: pokemon.stats,
        types: pokemon.types,
        species: pokemon.species,
        cries: pokemon.cries,
        sprites: {
            front_default: sprites.front_default,
            front_shiny: sprites.front_shiny,
            other: { home: sprites.other.home, "official-artwork": sprites.other["official-artwork"] },
        },
        moves: pokemon.moves
            .map(({ move, version_group_details: details }) => ({
                move,
                version_group_details: details.filter((detail) => detail.version_group.name === MOVES_VERSION_GROUP),
            }))
            .filter((entry) => entry.version_group_details.length),
    };
}

function trimSpecies(species) {
    const english = (entries) => entries.filter((entry) => entry.language.name === "en");
    return {
        id: species.id,
        name: species.name,
        names: english(species.names),
        genera: english(species.genera),
        flavor_text_entries: english(species.flavor_text_entries).slice(-1),
        evolution_chain: species.evolution_chain,
        varieties: species.varieties,
    };
}

function trimType(type) {
    const names = (list) => list.map(({ name }) => ({ name }));
    return {
        id: type.id,
        name: type.name,
        damage_relations: Object.fromEntries(
            Object.entries(type.damage_relations).map(([key, list]) => [key, names(list)]),
        ),
        pokemon: type.pokemon.map(({ pokemon, slot }) => ({ pokemon, slot })),
    };
}

for (const id of [24, 25, 26, 83, 94]) {
    const pokemon = trimPokemon(await get("pokemon/" + id));
    await save("pokemon-" + id, pokemon);

    // Pikachu's level-up moves get fixtures too, so the moves list can be tested.
    if (id === 25) {
        const levelUp = pokemon.moves.filter(({ version_group_details: details }) =>
            details.some((detail) => detail.move_learn_method.name === "level-up"),
        );
        for (const { move } of levelUp) {
            const details = await get("move/" + idFromUrl(move.url));
            await save("move-" + details.id, {
                id: details.id,
                name: details.name,
                power: details.power,
                accuracy: details.accuracy,
                damage_class: { name: details.damage_class.name },
                type: details.type,
            });
        }
    }
}
for (const id of [25, 94]) {
    await save("pokemon-species-" + id, trimSpecies(await get("pokemon-species/" + id)));
}
for (const id of [10, 40]) {
    await save("evolution-chain-" + id, await get("evolution-chain/" + id));
}
for (const type of ["electric", "ghost", "poison"]) {
    await save("type-" + type, trimType(await get("type/" + type)));
}
const list = await get("pokemon?limit=2000");
await save("pokemon-list", { count: list.count, results: list.results });
