// Unit tests for the quiz helpers. quiz.js touches the DOM at import time, so the
// helper is tested through a tiny stand-in document.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.document = { getElementById: () => ({}) };
const { pickRandom } = await import("../pokemon/quiz.js");

test("pickRandom returns n distinct items", () => {
    const picked = pickRandom([1, 2, 3, 4, 5, 6], 4);
    assert.equal(picked.length, 4);
    assert.equal(new Set(picked).size, 4);
});

test("pickRandom never returns more items than it was given", () => {
    assert.deepEqual(pickRandom(["a"], 4), ["a"]);
});
