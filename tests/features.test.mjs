// Unit tests for the quiz and team helpers. Both modules touch the DOM at import time, so
// they are imported with a tiny stand-in document.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.document = { getElementById: () => ({}) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { pickRandom } = await import("../pokemon/quiz.js");

test("pickRandom returns n distinct items", () => {
    const picked = pickRandom([1, 2, 3, 4, 5, 6], 4);
    assert.equal(picked.length, 4);
    assert.equal(new Set(picked).size, 4);
});

test("pickRandom never returns more items than it was given", () => {
    assert.deepEqual(pickRandom(["a"], 4), ["a"]);
});

test("teamCoverage counts weak and resisting members per attacking type", async () => {
    const { teamCoverage } = await import("../pokemon/team.js");
    const coverage = teamCoverage([
        { ground: 2, fire: 0.5 },
        { ground: 0, fire: 2 },
    ]);
    const byType = Object.fromEntries(coverage.map((row) => [row.type, row]));
    assert.deepEqual([byType.ground.weak, byType.ground.resist], [1, 1]);
    assert.deepEqual([byType.fire.weak, byType.fire.resist], [1, 1]);
    assert.equal(coverage.length, 18);
});

test("typeChartMatrix reads each type's attacking relations", async () => {
    const { typeChartMatrix } = await import("../pokemon/typechart.js");
    const relations = (double, half, none) => ({
        double_damage_to: double.map((name) => ({ name })),
        half_damage_to: half.map((name) => ({ name })),
        no_damage_to: none.map((name) => ({ name })),
    });
    const matrix = typeChartMatrix([
        { name: "electric", damage_relations: relations(["water"], ["electric"], ["ground"]) },
        { name: "water", damage_relations: relations([], ["water"], []) },
        { name: "ground", damage_relations: relations(["electric"], [], []) },
    ]);
    assert.equal(matrix.electric.water, 2);
    assert.equal(matrix.electric.ground, 0);
    assert.equal(matrix.electric.electric, 0.5);
    assert.equal(matrix.water.ground, 1);
    assert.equal(matrix.ground.electric, 2);
});

test("parseTeamParam keeps up to six valid ids", async () => {
    const { parseTeamParam } = await import("../pokemon/team.js");
    assert.deepEqual(parseTeamParam("6,94,x,25,0,-3"), [6, 94, 25]);
    assert.deepEqual(parseTeamParam("1,2,3,4,5,6,7,8"), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(parseTeamParam(null), []);
});

test("offensive coverage counts members whose own types hit a type super-effectively", async () => {
    const { superEffectiveTargets, teamCoverage } = await import("../pokemon/team.js");
    const fire = { damage_relations: { double_damage_to: [{ name: "grass" }, { name: "ice" }] } };
    const flying = { damage_relations: { double_damage_to: [{ name: "grass" }, { name: "fighting" }] } };
    const charizardHits = superEffectiveTargets([fire, flying]);
    assert.deepEqual([...charizardHits].sort(), ["fighting", "grass", "ice"]);

    const coverage = Object.fromEntries(
        teamCoverage([{}, {}], [charizardHits, new Set(["grass"])]).map((row) => [row.type, row]),
    );
    assert.equal(coverage.grass.hits, 2);
    assert.equal(coverage.ice.hits, 1);
    assert.equal(coverage.normal.hits, 0);
});

test("dailyPokemonId is deterministic per date and within the National Dex", async () => {
    const { dailyPokemonId } = await import("../pokemon/potd.js");
    assert.equal(dailyPokemonId("2026-10-30"), dailyPokemonId("2026-10-30"));
    assert.notEqual(dailyPokemonId("2026-10-30"), dailyPokemonId("2026-10-31"));
    for (const day of ["2026-01-01", "2026-06-15", "2027-12-31"]) {
        const id = dailyPokemonId(day);
        assert.ok(id >= 1 && id <= 1025, day + " -> " + id);
    }
});

test("rollShiny hits with probability 1/50", async () => {
    const { rollShiny, SHINY_ODDS } = await import("../pokemon/shinyhunt.js");
    assert.equal(SHINY_ODDS, 50);
    assert.equal(
        rollShiny(() => 0.019),
        true,
    );
    assert.equal(
        rollShiny(() => 0.02),
        false,
    );
    assert.equal(
        rollShiny(() => 0.5),
        false,
    );
    assert.equal(
        rollShiny(() => 0.039, 25),
        true,
    );
});

test("huntOdds earns the Shiny Charm at 100 encounters and huntPick stays in the region", async () => {
    const { huntOdds, huntPick } = await import("../pokemon/shinyhunt.js");
    assert.equal(huntOdds(99), 50);
    assert.equal(huntOdds(100), 25);
    assert.equal(
        huntPick(2, () => 0),
        152,
    );
    assert.equal(
        huntPick(2, () => 0.9999),
        251,
    );
    assert.equal(
        huntPick(null, () => 0.9999),
        1025,
    );
});

test("completionStats counts seen Pokémon overall and per generation", async () => {
    const { completionStats } = await import("../pokemon/progress.js");
    const stats = completionStats(new Set([1, 151, 152, 1025, 10034, 0]));
    assert.equal(stats.seen, 4);
    assert.equal(stats.total, 1025);
    assert.deepEqual(stats.generations[0], { number: 1, seen: 2, total: 151 });
    assert.deepEqual(stats.generations[1], { number: 2, seen: 1, total: 100 });
    assert.deepEqual(stats.generations[8], { number: 9, seen: 1, total: 120 });
});

test("completionMessage celebrates a finished region or the whole Pokédex", async () => {
    const { completionMessage } = await import("../pokemon/progress.js");
    const kanto = new Set(Array.from({ length: 151 }, (_, index) => index + 1));
    assert.equal(completionMessage(kanto, 25), "🏅 Kanto Pokédex complete!");
    assert.equal(completionMessage(new Set([...kanto, 152]), 152), null);
    const everything = new Set(Array.from({ length: 1025 }, (_, index) => index + 1));
    assert.match(completionMessage(everything, 1025), /National Pokédex complete/);
});

test("trainerSummary lists seen count, shinies and complete regions", async () => {
    const { completionStats, trainerSummary } = await import("../pokemon/progress.js");
    const kanto = new Set(Array.from({ length: 151 }, (_, index) => index + 1));
    assert.equal(
        trainerSummary({ name: "Gbot" }, completionStats(kanto), 2),
        "🎴 Gbot's Pokédex\n👀 151/1025 Pokémon seen (14%)\n✨ 2 shiny Pokémon caught\n🏅 Complete: Kanto",
    );
    assert.match(trainerSummary({}, completionStats(new Set()), 1), /^🎴 Trainer's Pokédex\n.*\n✨ 1 shiny caught$/);
});

test("partnerReaction loves its evolution line and fears super-effective types", async () => {
    const { partnerReaction } = await import("../pokemon/progress.js");
    const charizardTakes = { water: 2, rock: 4, grass: 0.25 };
    assert.equal(partnerReaction(6, [4, 5, 6], charizardTakes, ["fire"]), "❤️");
    assert.equal(partnerReaction(6, [7, 8, 9], charizardTakes, ["water"]), "😨");
    assert.equal(partnerReaction(6, [1, 2, 3], charizardTakes, ["grass", "poison"]), null);
    assert.equal(partnerReaction(6, [7, 8, 9], {}, ["water"]), null);
});

test("updateVisits tracks the first visit and the daily streak", async () => {
    const { updateVisits } = await import("../pokemon/progress.js");
    let visits = updateVisits(null, "2026-10-28");
    assert.deepEqual(visits, { first: "2026-10-28", last: "2026-10-28", streak: 1, best: 1 });
    visits = updateVisits(visits, "2026-10-28");
    assert.equal(visits.streak, 1);
    visits = updateVisits(updateVisits(visits, "2026-10-29"), "2026-10-30");
    assert.deepEqual(visits, { first: "2026-10-28", last: "2026-10-30", streak: 3, best: 3 });
    visits = updateVisits(visits, "2026-11-02");
    assert.deepEqual(visits, { first: "2026-10-28", last: "2026-11-02", streak: 1, best: 3 });
});

test("streakBadges awards flames at 7 and 30 days", async () => {
    const { streakBadges } = await import("../pokemon/progress.js");
    assert.deepEqual(streakBadges(6), []);
    assert.equal(streakBadges(7).length, 1);
    assert.deepEqual(
        streakBadges(30).map(([icon]) => icon),
        ["🔥", "☄️"],
    );
});
