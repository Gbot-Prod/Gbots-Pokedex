// Unit tests for the pure helpers in pokemon/utils.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    abilityDescription,
    damageMultipliers,
    describeEvolution,
    editDistance,
    entryDisplayName,
    formatDexNumber,
    formatHeight,
    formatWeight,
    formatMultiplier,
    formLabel,
    formatName,
    idFromUrl,
    learnset,
    levelUpMoves,
    normalizeQuery,
    pokemonDisplayName,
    pruneCacheEntries,
    radarPoints,
    speciesDisplayName,
    suggestionScore,
} from "../pokemon/utils.js";

test("normalizeQuery turns display names and numbers into API keys", () => {
    assert.equal(normalizeQuery("  Pikachu "), "pikachu");
    assert.equal(normalizeQuery("#025"), "25");
    assert.equal(normalizeQuery("Mr. Mime"), "mr-mime");
    assert.equal(normalizeQuery("Farfetch’d"), "farfetchd");
    assert.equal(normalizeQuery("Nidoran♀"), "nidoran-f");
    assert.equal(normalizeQuery("Type: Null"), "type-null");
    assert.equal(normalizeQuery("Flabébé"), "flabebe");
    assert.equal(normalizeQuery("   "), "");
});

test("formatName title-cases hyphenated slugs", () => {
    assert.equal(formatName("lightning-rod"), "Lightning Rod");
    assert.equal(formatName("pikachu"), "Pikachu");
});

test("idFromUrl reads the trailing id", () => {
    assert.equal(idFromUrl("https://pokeapi.co/api/v2/pokemon-species/94/"), 94);
});

test("formatMultiplier uses fractions for resistances", () => {
    assert.equal(formatMultiplier(0.25), "¼");
    assert.equal(formatMultiplier(0.5), "½");
    assert.equal(formatMultiplier(4), "4");
});

test("describeEvolution summarises the first evolution detail", () => {
    assert.equal(describeEvolution([]), "");
    assert.equal(describeEvolution([{ min_level: 16, trigger: { name: "level-up" } }]), "Lv. 16");
    assert.equal(
        describeEvolution([{ item: { name: "thunder-stone" }, trigger: { name: "use-item" } }]),
        "Thunder Stone",
    );
    assert.equal(describeEvolution([{ min_happiness: 160, trigger: { name: "level-up" } }]), "Friendship");
    assert.equal(describeEvolution([{ trigger: { name: "trade" } }]), "Trade");
});

test("editDistance counts single-character edits", () => {
    assert.equal(editDistance("pikachoo", "pikachu"), 2);
    assert.equal(editDistance("gengr", "gengar"), 1);
    assert.equal(editDistance("same", "same"), 0);
});

test("formLabel names a form relative to its species", () => {
    assert.equal(formLabel("charizard", "charizard"), "Standard");
    assert.equal(formLabel("charizard", "charizard-mega-x"), "Mega X");
    assert.equal(formLabel("raichu", "raichu-alola"), "Alola");
});

test("levelUpMoves uses the newest main-series game, not the highest version group id", () => {
    const detail = (level, group, method = "level-up") => ({
        level_learned_at: level,
        move_learn_method: { name: method },
        version_group: { name: group, url: "https://pokeapi.co/api/v2/version-group/1/" },
    });
    const moves = [
        {
            move: { name: "thunder-shock", url: "m/84/" },
            version_group_details: [detail(1, "scarlet-violet"), detail(1, "red-green-japan")],
        },
        { move: { name: "growl", url: "m/45/" }, version_group_details: [detail(5, "red-green-japan")] },
        { move: { name: "nuzzle", url: "m/609/" }, version_group_details: [detail(0, "scarlet-violet")] },
        { move: { name: "thunder", url: "m/87/" }, version_group_details: [detail(0, "scarlet-violet", "machine")] },
    ];
    assert.deepEqual(levelUpMoves(moves), [
        { name: "nuzzle", url: "m/609/", level: 0 },
        { name: "thunder-shock", url: "m/84/", level: 1 },
    ]);
    assert.deepEqual(levelUpMoves([]), []);
});

test("suggestionScore ranks prefixes, substrings, in-order letters, then typos", () => {
    assert.equal(suggestionScore("pika", "pikachu"), 0);
    assert.equal(suggestionScore("chu", "pikachu"), 1);
    assert.equal(suggestionScore("charz", "charizard"), 2);
    assert.equal(suggestionScore("pikachoo", "pikachu"), 4);
    assert.equal(suggestionScore("charz", "bulbasaur"), Infinity);
});

test("learnset groups the chosen game's moves by learn method", () => {
    const detail = (level, method, group = "scarlet-violet") => ({
        level_learned_at: level,
        move_learn_method: { name: method },
        version_group: { name: group, url: "" },
    });
    const { versionGroup, methods } = learnset([
        { move: { name: "thunder", url: "m/87/" }, version_group_details: [detail(0, "machine")] },
        { move: { name: "volt-tackle", url: "m/344/" }, version_group_details: [detail(0, "egg")] },
        {
            move: { name: "growl", url: "m/45/" },
            version_group_details: [detail(1, "level-up"), detail(0, "tutor", "x-y")],
        },
    ]);
    assert.equal(versionGroup, "scarlet-violet");
    assert.deepEqual(
        methods.machine.map((move) => move.name),
        ["thunder"],
    );
    assert.deepEqual(
        methods.egg.map((move) => move.name),
        ["volt-tackle"],
    );
    assert.deepEqual(
        methods["level-up"].map((move) => move.name),
        ["growl"],
    );
    assert.deepEqual(methods.tutor, []); // tutor entry belongs to another game
});

test("learnset honours a preferred game when that game has a learnset", () => {
    const detail = (group) => ({
        level_learned_at: 1,
        move_learn_method: { name: "level-up" },
        version_group: { name: group, url: "" },
    });
    const moves = [
        { move: { name: "growl", url: "m/45/" }, version_group_details: [detail("red-blue"), detail("x-y")] },
    ];
    assert.deepEqual(learnset(moves).games, ["x-y", "red-blue"]);
    assert.equal(learnset(moves, "red-blue").versionGroup, "red-blue");
    assert.equal(learnset(moves, "sun-moon").versionGroup, "x-y"); // not available, newest instead
});

test("formatDexNumber zero-pads to four digits", () => {
    assert.equal(formatDexNumber(25), "#0025");
    assert.equal(formatDexNumber(1025), "#1025");
});

test("damageMultipliers combines both types' damage relations", () => {
    const electric = {
        damage_relations: {
            double_damage_from: [{ name: "ground" }],
            half_damage_from: [{ name: "flying" }, { name: "steel" }, { name: "electric" }],
            no_damage_from: [],
        },
    };
    const flying = {
        damage_relations: {
            double_damage_from: [{ name: "rock" }, { name: "electric" }, { name: "ice" }],
            half_damage_from: [{ name: "grass" }],
            no_damage_from: [{ name: "ground" }],
        },
    };
    const multipliers = damageMultipliers([electric, flying]);
    assert.equal(multipliers.ground, 0);
    assert.equal(multipliers.electric, 1);
    assert.equal(multipliers.rock, 2);
    assert.equal(multipliers.normal, 1);
});

test("speciesDisplayName fixes punctuation the slug loses", () => {
    assert.equal(speciesDisplayName("farfetchd"), "Farfetch’d");
    assert.equal(speciesDisplayName("nidoran-f"), "Nidoran♀");
    assert.equal(speciesDisplayName("great-tusk"), "Great Tusk");
});

test("describeEvolution covers time of day, held items and trades, using the newest detail", () => {
    assert.equal(
        describeEvolution([{ min_happiness: 160, time_of_day: "night", trigger: { name: "level-up" } }]),
        "Friendship (night)",
    );
    assert.equal(
        describeEvolution([{ held_item: { name: "metal-coat" }, trigger: { name: "trade" } }]),
        "Trade holding Metal Coat",
    );
    assert.equal(
        describeEvolution([
            { location: { name: "eterna-forest" }, trigger: { name: "level-up" } },
            { item: { name: "leaf-stone" }, trigger: { name: "use-item" } },
        ]),
        "Leaf Stone",
    );
    assert.equal(
        describeEvolution([{ min_happiness: 160, known_move_type: { name: "fairy" }, trigger: { name: "level-up" } }]),
        "Friendship, knowing a Fairy move",
    );
});

test("formatHeight/formatWeight convert PokéAPI units", () => {
    assert.equal(formatHeight(4), "0.4 m");
    assert.equal(formatHeight(4, "imperial"), "1′04″");
    assert.equal(formatHeight(17, "imperial"), "5′07″");
    assert.equal(formatWeight(60), "6.0 kg");
    assert.equal(formatWeight(60, "imperial"), "13.2 lbs");
});

test("pokemonDisplayName uses the species name and labels alternate forms", () => {
    const species = (name, id) => ({ name, url: "https://pokeapi.co/api/v2/pokemon-species/" + id + "/" });
    assert.equal(pokemonDisplayName({ id: 83, name: "farfetchd", species: species("farfetchd", 83) }), "Farfetch’d");
    assert.equal(pokemonDisplayName({ id: 718, name: "zygarde-50", species: species("zygarde", 718) }), "Zygarde");
    assert.equal(
        pokemonDisplayName({ id: 10034, name: "charizard-mega-x", species: species("charizard", 6) }),
        "Charizard (Mega X)",
    );
});

test("describeEvolution lists gender, stat and party conditions", () => {
    assert.equal(describeEvolution([{ min_level: 21, gender: 1, trigger: { name: "level-up" } }]), "Lv. 21 (female)");
    assert.equal(
        describeEvolution([{ min_level: 20, relative_physical_stats: 1, trigger: { name: "level-up" } }]),
        "Lv. 20 (Atk > Def)",
    );
    assert.equal(
        describeEvolution([{ party_species: { name: "remoraid" }, trigger: { name: "level-up" } }]),
        "Level Up (with Remoraid in party)",
    );
});

test("pruneCacheEntries drops expired entries and keeps the newest", () => {
    const entries = { old: { savedAt: 0 }, a: { savedAt: 90 }, b: { savedAt: 95 }, c: { savedAt: 99 } };
    assert.deepEqual(Object.keys(pruneCacheEntries(entries, 100, 50, 10)), ["c", "b", "a"]);
    assert.deepEqual(Object.keys(pruneCacheEntries(entries, 100, 50, 2)), ["c", "b"]);
});

test("entryDisplayName prefers the species name for National Dex entries", () => {
    const slugs = new Map([
        [83, "farfetchd"],
        [718, "zygarde"],
    ]);
    assert.equal(entryDisplayName({ id: 83, name: "farfetchd" }, slugs), "Farfetch’d");
    assert.equal(entryDisplayName({ id: 718, name: "zygarde-50" }, slugs), "Zygarde");
    assert.equal(
        entryDisplayName({ id: 10118, name: "zygarde-10-power-construct" }, slugs),
        "Zygarde 10 Power Construct",
    );
    assert.equal(entryDisplayName({ id: 718, name: "zygarde-50" }, null), "Zygarde 50"); // list not loaded yet
});

test("abilityDescription prefers the latest English game text", () => {
    const ability = {
        flavor_text_entries: [
            { language: { name: "en" }, flavor_text: "Old text." },
            { language: { name: "en" }, flavor_text: "May paralyze\nattackers." },
            { language: { name: "de" }, flavor_text: "Deutsch." },
        ],
        effect_entries: [{ language: { name: "en" }, short_effect: "30% paralysis on contact." }],
    };
    assert.equal(abilityDescription(ability), "May paralyze attackers.");
    assert.equal(abilityDescription({ effect_entries: ability.effect_entries }), "30% paralysis on contact.");
});

test("radarPoints puts the first axis at the top and scales by value", () => {
    // Two axes on a radius-100 chart centred at (100,100): top and bottom.
    assert.equal(radarPoints([100, 50], 100, 100, 100, 100), "100.0,0.0 100.0,150.0");
    assert.equal(radarPoints([300], 150, 100, 0, 0), "0.0,-100.0"); // capped at max
});
