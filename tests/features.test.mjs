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
