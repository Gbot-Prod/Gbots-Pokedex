// Unit tests for the combobox's matching logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchEntries } from "../pokemon/combobox.js";

const entries = [
    { id: 25, name: "pikachu", label: "Pikachu" },
    { id: 122, name: "mr-mime", label: "Mr. Mime" },
    { id: 439, name: "mime-jr", label: "Mime Jr." },
    { id: 150, name: "mewtwo", label: "Mewtwo" },
    { id: 15, name: "beedrill", label: "Beedrill" },
];

test("matchEntries ranks prefixes, then word starts, then substrings", () => {
    assert.deepEqual(
        matchEntries(entries, "mime").map((entry) => entry.label),
        ["Mime Jr.", "Mr. Mime"],
    );
    assert.deepEqual(
        matchEntries(entries, "chu").map((entry) => entry.label),
        ["Pikachu"],
    );
});

test("matchEntries matches Pokédex numbers by prefix and ignores empty input", () => {
    assert.deepEqual(
        matchEntries(entries, "15").map((entry) => entry.id),
        [150, 15], // list order
    );
    assert.deepEqual(matchEntries(entries, "  "), []);
});
