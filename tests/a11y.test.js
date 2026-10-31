// Accessibility checks (axe) for the Pokédex page, in their own file so node:test runs them in
// parallel with the main smoke tests. Same mocked setup as smoke.test.js (see harness.js).
// Run with: npm test

/* global document, window -- used inside page.evaluate callbacks, which run in the browser */

const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { AxeBuilder } = require("@axe-core/playwright");
const { useMockedPages } = require("./harness.js");

let page;
useMockedPages({ before, after, beforeEach, afterEach }, (state) => {
    ({ page } = state);
});

async function search(query) {
    await page.fill("#pokemonLookupInpt", query);
    await page.press("#pokemonLookupInpt", "Enter");
}

for (const [colorScheme, width] of [
    ["light", 1280],
    ["dark", 1280],
    ["light", 375],
    ["dark", 375],
]) {
    test("no serious accessibility violations (" + colorScheme + " mode, " + width + "px)", async () => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 900 });
        // Show the install button and offline banner too.
        await page.evaluate(() => {
            const event = new Event("beforeinstallprompt", { cancelable: true });
            event.prompt = () => {};
            event.userChoice = Promise.resolve({ outcome: "dismissed" });
            window.dispatchEvent(event);
            document.getElementById("offlineBanner").hidden = false;
        });
        await search("pikachu");
        await page.waitForSelector("#pokemonMoves:not([hidden])");
        await page.click("#movesSummary");
        await page.fill("#compareLeftInput", "pikachu");
        await page.fill("#compareRightInput", "gengar");
        await page.press("#compareRightInput", "Enter"); // submits; at phone width the suggestion list covers the button
        await page.waitForSelector("#compareResult:not([hidden])");
        await page.waitForSelector("#browseGrid .browseTile");

        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations
            .filter((violation) => ["serious", "critical"].includes(violation.impact))
            .map((violation) => violation.id + ": " + violation.nodes.map((node) => node.target.join(" ")).join(", "));
        assert.deepEqual(serious, []);
    });
}

// Hover states can fail contrast where the resting state passes (the jump pills on the retro
// card did), so the trainer card is checked in every style with each of its buttons hovered.
for (const colorScheme of ["light", "dark"]) {
    test("trainer card buttons keep their contrast when hovered (" + colorScheme + " mode)", async () => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.setViewportSize({ width: 375, height: 800 });
        const problems = [];
        for (const style of ["classic", "holo", "retro"]) {
            await page.evaluate((cardStyle) => {
                localStorage.setItem("pokedex:seen:v1", "[25]");
                localStorage.setItem("pokedex:trainer:v1", JSON.stringify({ partner: 25, style: cardStyle }));
            }, style);
            await page.reload();
            await page.click("#dexProgress");
            await page.waitForSelector("#trainerCard[open]");
            const buttons = page.locator("#trainerCard button:visible");
            for (let index = 0; index < (await buttons.count()); index++) {
                await buttons.nth(index).hover();
                const results = await new AxeBuilder({ page })
                    .include("#trainerCard")
                    .withRules(["color-contrast"])
                    .analyze();
                for (const violation of results.violations) {
                    problems.push(style + ": " + violation.nodes.map((node) => node.target.join(" ")).join(", "));
                }
            }
        }
        assert.deepEqual([...new Set(problems)], []);
    });
}

for (const colorScheme of ["light", "dark"]) {
    test("the keyboard shortcut list passes axe (" + colorScheme + " mode)", async () => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.click("#shortcutsBtn");
        await page.waitForSelector("#shortcutsDialog[open]");
        await page.hover("#shortcutsClose");
        const results = await new AxeBuilder({ page }).include("#shortcutsDialog").analyze();
        const serious = results.violations
            .filter((violation) => ["serious", "critical"].includes(violation.impact))
            .map((violation) => violation.id + ": " + violation.nodes.map((node) => node.target.join(" ")).join(", "));
        assert.deepEqual(serious, []);
    });
}
