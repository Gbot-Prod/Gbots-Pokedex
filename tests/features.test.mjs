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
    assert.deepEqual(visits, { first: "2026-10-28", last: "2026-10-28", streak: 1, best: 1, days: ["2026-10-28"] });
    visits = updateVisits(visits, "2026-10-28");
    assert.equal(visits.streak, 1);
    visits = updateVisits(updateVisits(visits, "2026-10-29"), "2026-10-30");
    assert.deepEqual(visits.days, ["2026-10-28", "2026-10-29", "2026-10-30"]);
    assert.equal(visits.streak, 3);
    visits = updateVisits(visits, "2026-11-02");
    assert.equal(visits.streak, 1);
    assert.equal(visits.best, 3);
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

test("shouldOfferPartner fires once, on the fifth view of a non-partner", async () => {
    const { shouldOfferPartner } = await import("../pokemon/progress.js");
    assert.equal(shouldOfferPartner(4, 25, 6), false);
    assert.equal(shouldOfferPartner(5, 25, 6), true);
    assert.equal(shouldOfferPartner(6, 25, 6), false);
    assert.equal(shouldOfferPartner(5, 6, 6), false);
    assert.equal(shouldOfferPartner(5, 25, 6, 5), false);
    assert.equal(shouldOfferPartner(25, 25, 6, 5), true);
    assert.equal(shouldOfferPartner(26, 25, 6, 5), false);
});

test("affectionHearts grows one heart every three views, up to five", async () => {
    const { affectionHearts } = await import("../pokemon/progress.js");
    assert.deepEqual([undefined, 2, 3, 9, 12, 40].map(affectionHearts), [1, 1, 2, 4, 5, 5]);
});

test("topViewed ranks the most-opened Pokémon", async () => {
    const { topViewed } = await import("../pokemon/progress.js");
    assert.deepEqual(topViewed({ 25: 3, 6: 9, 1: 3, 94: 1 }, 3), [
        [6, 9],
        [1, 3],
        [25, 3],
    ]);
    assert.deepEqual(topViewed({}), []);
});

test("calendarDays lists the last four weeks and marks visited days", async () => {
    const { calendarDays } = await import("../pokemon/progress.js");
    const days = calendarDays(["2026-10-30", "2026-10-03", "2026-10-02"], "2026-10-30");
    assert.equal(days.length, 28);
    assert.deepEqual(days[0], { day: "2026-10-03", visited: true });
    assert.deepEqual(days[27], { day: "2026-10-30", visited: true });
    assert.equal(days.filter((entry) => entry.visited).length, 2);
});

test("heatLevel buckets a day's new Pokémon into five shades", async () => {
    const { heatLevel } = await import("../pokemon/progress.js");
    assert.deepEqual([0, 1, 3, 8, 20, 99].map(heatLevel), [0, 1, 2, 3, 4, 4]);
});

test("matchupSummary finds the best hit each way", async () => {
    const { matchupSummary } = await import("../pokemon/progress.js");
    // Charizard (fire/flying) vs Venusaur (grass/poison)
    const charizardTakes = { water: 2, rock: 4, grass: 0.25, poison: 1 };
    const venusaurTakes = { fire: 2, flying: 2, psychic: 2 };
    assert.deepEqual(matchupSummary(["fire", "flying"], charizardTakes, ["grass", "poison"], venusaurTakes), {
        hits: 2,
        takes: 1,
    });
});

test("collectorBadges rewards opening one Pokémon 25 and 50 times", async () => {
    const { collectorBadges } = await import("../pokemon/progress.js");
    assert.deepEqual(collectorBadges({}), []);
    assert.deepEqual(collectorBadges({ 25: 24, 6: 3 }), []);
    assert.equal(collectorBadges({ 25: 25 }).length, 1);
    assert.deepEqual(
        collectorBadges({ 25: 60 }).map(([icon]) => icon),
        ["📚", "🏆"],
    );
});

test("badgeShelf marks each badge earned or locked", async () => {
    const { badgeShelf } = await import("../pokemon/progress.js");
    const shelf = badgeShelf({ streak: 8, views: { 25: 30 }, shinies: 5, team: 4 });
    assert.equal(shelf.length, 8);
    assert.deepEqual(
        shelf.map((badge) => badge.earned),
        [true, false, true, false, false, true, false, false],
    );
    assert.equal(shelf.find((badge) => !badge.earned).hint, "Visit 30 days in a row");
});

test("matchupEdge says who comes out ahead", async () => {
    const { matchupEdge } = await import("../pokemon/progress.js");
    assert.equal(matchupEdge(2, 1), "win");
    assert.equal(matchupEdge(1, 2), "lose");
    assert.equal(matchupEdge(1, 1), "even");
});

test("newlyEarned lists earned badges not seen before", async () => {
    const { badgeShelf, newlyEarned } = await import("../pokemon/progress.js");
    const shelf = badgeShelf({ streak: 8, team: 6 });
    assert.deepEqual(
        newlyEarned(shelf, []).map((badge) => badge.icon),
        ["🔥", "👥"],
    );
    assert.deepEqual(
        newlyEarned(shelf, ["Week flame: 7-day streak"]).map((badge) => badge.icon),
        ["👥"],
    );
});

test("tiered badges climb bronze, silver and gold", async () => {
    const { badgeShelf } = await import("../pokemon/progress.js");
    const shiny = (shinies) => badgeShelf({ shinies }).find((badge) => badge.kind === "shinies");
    assert.equal(shiny(4).earned, false);
    assert.equal(shiny(4).hint, "Catch 5 shinies in the shiny hunt");
    assert.equal(shiny(5).label, "Shiny hunter: 5 shinies caught (bronze)");
    assert.equal(shiny(5).hint, "Catch 15 shinies in the shiny hunt");
    assert.equal(shiny(20).tier, 2);
    assert.equal(shiny(50).label, "Shiny hunter: 50 shinies caught (gold)");
    assert.equal(shiny(50).hint, null);
});

test("shinyTierProgress counts toward the next Shiny hunter tier", async () => {
    const { shinyTierProgress } = await import("../pokemon/progress.js");
    assert.equal(shinyTierProgress(3), "3 / 5 for bronze");
    assert.equal(shinyTierProgress(5), "5 / 15 for silver");
    assert.equal(shinyTierProgress(49), "49 / 50 for gold");
    assert.equal(shinyTierProgress(50), null);
});
