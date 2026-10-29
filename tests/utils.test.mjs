// Unit tests for the pure helpers in pokemon/utils.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    describeEvolution,
    editDistance,
    formatMultiplier,
    formLabel,
    formatName,
    idFromUrl,
    learnset,
    levelUpMoves,
    normalizeQuery,
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
