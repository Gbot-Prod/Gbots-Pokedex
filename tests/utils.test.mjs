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
    normalizeQuery,
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
