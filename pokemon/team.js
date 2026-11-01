// Team builder: up to six Pokémon, saved locally, with a type-coverage chart showing how
// many team members are weak to / resist each attacking type.
import {
    ANIMATED_CHANGE_EVENT,
    API_BASE,
    fetchJson,
    fetchPokemon,
    getSpeciesSlugs,
    setSmallSprite,
    spriteUrl,
} from "./api.js";
import { drawTeamCard, loadCanvasImage, styleShareCard } from "./cardimage.js";
import { makeConfetti } from "./effects.js";
import { cardFontsReady, hasSeen, noteTeamBalance, shareOrDownload } from "./progress.js";
import {
    MAX_DEX_NUMBER,
    TYPE_COLORS,
    TYPE_ICONS,
    damageMultipliers,
    formatName,
    idFromUrl,
    pokemonDisplayName,
    speciesDisplayName,
} from "./utils.js";
import { isTeamMember } from "./storage.js";

const TEAM_KEY = "pokedex:team:v1";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
export const TEAM_SIZE = 6;

const section = document.getElementById("teamSection");
const slotsElement = document.getElementById("teamSlots");
const coverageElement = document.getElementById("teamCoverage");
const suggestElement = document.getElementById("teamSuggest");
const teamButton = document.getElementById("teamAddBtn");
const statusElement = document.getElementById("teamStatus");
const shareTeamButton = document.getElementById("teamShareBtn");
const teamCardButton = document.getElementById("teamCardBtn");
const sharedTeamElement = document.getElementById("sharedTeam");

let team = []; // [{ id, name, label, types: ["fire", "flying"] }]
let getCurrentPokemon = () => null;
let showPokemon = () => {};

function loadTeam() {
    try {
        const stored = JSON.parse(localStorage.getItem(TEAM_KEY));
        team = Array.isArray(stored) ? stored.filter(isTeamMember).slice(0, TEAM_SIZE) : [];
    } catch {
        team = [];
    }
}

function saveTeam() {
    try {
        localStorage.setItem(TEAM_KEY, JSON.stringify(team));
    } catch {
        // the team just won't persist
    }
}

// Types a member's own (STAB) types hit super-effectively, from their /type responses.
export function superEffectiveTargets(typeDataList) {
    return new Set(typeDataList.flatMap((type) => type.damage_relations.double_damage_to.map(({ name }) => name)));
}

// For each type: how many members take extra damage from it, how many resist or are immune,
// and (if memberHits is given) how many members hit it super-effectively with their own types.
export function teamCoverage(memberMultipliers, memberHits = []) {
    return Object.keys(TYPE_ICONS).map((type) => ({
        type,
        weak: memberMultipliers.filter((multipliers) => multipliers[type] > 1).length,
        resist: memberMultipliers.filter((multipliers) => multipliers[type] < 1).length,
        hits: memberHits.filter((targets) => targets.has(type)).length,
    }));
}

// The team's MVP: the member who resists (or is immune to) the most of the types the team as
// a whole is weak to. Returns its index, or -1 when there's no shared weakness to cover.
export function teamMvp(memberMultipliers) {
    const teamWeaknesses = sharedWeaknesses(memberMultipliers);
    if (!teamWeaknesses.length || memberMultipliers.length < 2) {
        return -1;
    }
    const covered = memberMultipliers.map(
        (multipliers) => teamWeaknesses.filter((type) => multipliers[type] < 1).length,
    );
    const best = Math.max(...covered);
    return best > 0 ? covered.indexOf(best) : -1;
}

// The weak link: the member weak to the most of the team's shared weaknesses (at least two),
// i.e. the one piling onto them most. -1 when nobody stands out or it would be the MVP.
export function teamWeakLink(memberMultipliers) {
    const shared = sharedWeaknesses(memberMultipliers);
    const piled = memberMultipliers.map((multipliers) => shared.filter((type) => multipliers[type] > 1).length);
    const worst = Math.max(0, ...piled);
    const index = piled.indexOf(worst);
    const unique = piled.filter((count) => count === worst).length === 1;
    return worst >= 2 && unique && index !== teamMvp(memberMultipliers) ? index : -1;
}

// A 0-100 balance score: up to 70 points for how many of the 18 types the team hits
// super-effectively, plus 30, minus 10 for each shared weakness.
export function teamBalance(memberMultipliers, memberHits) {
    const covered = teamCoverage(memberMultipliers, memberHits).filter(({ hits }) => hits > 0).length;
    const raw = (covered / Object.keys(TYPE_ICONS).length) * 70 + 30 - sharedWeaknesses(memberMultipliers).length * 10;
    return Math.max(0, Math.min(100, Math.round(raw)));
}

// Types two or more members are weak to, with fewer members resisting them.
export function sharedWeaknesses(memberMultipliers) {
    return teamCoverage(memberMultipliers)
        .filter(({ weak, resist }) => weak >= 2 && weak > resist)
        .map(({ type }) => type);
}

// Every add, remove or load goes through here: it saves, re-renders, announces the change
// and offers an Undo (back to the team as it was) for a few seconds.
const undoElement = document.getElementById("teamUndo");
let undoTimer = null;

let justLanded = new Set(); // members added by the last change, for the settle bounce

function changeTeam(next, message) {
    const previous = team;
    team = next;
    justLanded = new Set(next.filter((member) => !previous.some((old) => old.id === member.id)).map(({ id }) => id));
    saveTeam();
    renderTeam();
    updateTeamButton();
    statusElement.textContent = message;
    const text = document.createElement("span");
    text.textContent = message;
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "linkBtn";
    undo.textContent = "Undo";
    undo.addEventListener("click", () => {
        clearTimeout(undoTimer);
        undoElement.hidden = true;
        team = previous;
        saveTeam();
        renderTeam();
        updateTeamButton();
        statusElement.textContent = "Undone: " + message.charAt(0).toLowerCase() + message.slice(1);
    });
    justLanded = new Set(); // only the render right after the change bounces
    undo.setAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    undo.title = "Undo (Ctrl+Z)";
    undoElement.replaceChildren(text, " · ", undo);
    undoElement.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undoElement.hidden = true), 8000);
}

// Ctrl/Cmd+Z presses the Undo while it's showing (and not while typing in a field).
document.addEventListener?.("keydown", (event) => {
    const typing = event.target.closest?.("input, textarea, select, [contenteditable]");
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing && !undoElement.hidden) {
        event.preventDefault();
        undoElement.querySelector("button")?.click();
    }
});

// --- Surprise me ---------------------------------------------------------------------------
// Builds a team of six from Pokémon you've seen: the 18 type lists say who has which types, then
// a quick random search keeps the best-balanced of a few hundred line-ups.

// Picks the best of `tries` random line-ups of `size` from `pool` ([{ multipliers, hits }]),
// scored by teamBalance. Returns the chosen indexes. `random` is injectable for tests.
export function bestLineUp(pool, size, tries = 400, random = Math.random) {
    let best = { score: -1, picks: [] };
    for (let attempt = 0; attempt < tries; attempt++) {
        const picks = [];
        while (picks.length < Math.min(size, pool.length)) {
            const index = Math.floor(random() * pool.length);
            if (!picks.includes(index)) {
                picks.push(index);
            }
        }
        const score = teamBalance(
            picks.map((index) => pool[index].multipliers),
            picks.map((index) => pool[index].hits),
        );
        if (score > best.score) {
            best = { score, picks };
        }
    }
    return best;
}

async function surpriseTeam() {
    const button = document.getElementById("teamSurpriseBtn");
    button.disabled = true;
    try {
        const typeNames = Object.keys(TYPE_ICONS);
        const typeData = Object.fromEntries(
            await Promise.all(typeNames.map(async (type) => [type, await fetchJson(API_BASE + "type/" + type)])),
        );
        // id → { name, types (in slot order) } for every seen National Dex Pokémon
        const seenPokemon = new Map();
        for (const type of typeNames) {
            for (const { pokemon, slot } of typeData[type].pokemon) {
                const id = idFromUrl(pokemon.url);
                if (id <= MAX_DEX_NUMBER && hasSeen(id)) {
                    const entry = seenPokemon.get(id) ?? { id, name: pokemon.name, types: [] };
                    entry.types[slot - 1] = type;
                    seenPokemon.set(id, entry);
                }
            }
        }
        const candidates = [...seenPokemon.values()].map((entry) => ({ ...entry, types: entry.types.filter(Boolean) }));
        if (candidates.length < TEAM_SIZE) {
            showUndoless("See at least six Pokémon first — then I can build you a team!");
            return;
        }
        const pool = candidates.map((candidate) => {
            const data = candidate.types.map((type) => typeData[type]);
            return { multipliers: damageMultipliers(data), hits: superEffectiveTargets(data) };
        });
        const { score, picks } = bestLineUp(pool, TEAM_SIZE);
        const slugs = await getSpeciesSlugs().catch(() => null);
        const members = picks.map((index) => {
            const { id, name, types } = candidates[index];
            return { id, name, label: slugs?.get(id) ? speciesDisplayName(slugs.get(id)) : formatName(name), types };
        });
        changeTeam(members, "🎲 A surprise team, balance " + score + " / 100");
    } catch {
        statusElement.textContent = "Couldn't load the type data — try again when you're online";
    } finally {
        button.disabled = false;
    }
}

// A message in the undo bar's place, without an Undo (nothing changed).
function showUndoless(message) {
    statusElement.textContent = message;
    undoElement.replaceChildren(message);
    undoElement.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undoElement.hidden = true), 6000);
}

// --- Saved teams -------------------------------------------------------------------------
// Up to three named teams, kept alongside the current one; loading one goes through
// changeTeam(), so it can be undone like any other change.
const PRESETS_KEY = "pokedex:team-presets:v1";
const MAX_PRESETS = 3;

function loadPresets() {
    try {
        const stored = JSON.parse(localStorage.getItem(PRESETS_KEY));
        return Array.isArray(stored)
            ? stored
                  .filter((preset) => typeof preset?.name === "string" && Array.isArray(preset.members))
                  .map((preset) => ({ name: preset.name, members: preset.members.filter(isTeamMember) }))
                  .slice(0, MAX_PRESETS)
            : [];
    } catch {
        return [];
    }
}

function savePresets(presets) {
    try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
        // can't keep them: nothing else to do
    }
}

function renderPresets() {
    const presets = loadPresets();
    const list = document.getElementById("teamPresetList");
    list.replaceChildren(
        ...presets.map((preset) => {
            const item = document.createElement("li");
            const load = document.createElement("button");
            load.type = "button";
            load.className = "btn teamPresetLoad";
            // the name, then the team's sprites in a little row
            const sprites = document.createElement("span");
            sprites.className = "teamPresetSprites";
            sprites.setAttribute("aria-hidden", "true");
            for (const member of preset.members) {
                const sprite = document.createElement("img");
                sprite.alt = "";
                sprite.width = 28;
                sprite.height = 28;
                setSmallSprite(sprite, member.id);
                sprites.append(sprite);
            }
            load.append(preset.name + " (" + preset.members.length + ")", sprites);
            load.title = preset.members.map((member) => member.label).join(", ");
            load.addEventListener("click", () => changeTeam(preset.members, "Loaded “" + preset.name + "”"));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "linkBtn";
            remove.textContent = "Delete";
            remove.setAttribute("aria-label", "Delete saved team " + preset.name);
            remove.addEventListener("click", () => {
                savePresets(loadPresets().filter((other) => other.name !== preset.name));
                renderPresets();
                statusElement.textContent = "Deleted “" + preset.name + "”";
            });
            item.append(load, remove);
            return item;
        }),
    );
    if (!presets.length) {
        const empty = document.createElement("li");
        empty.className = "teamPresetEmpty";
        empty.textContent = "No saved teams yet — up to " + MAX_PRESETS + ".";
        list.append(empty);
    }
}

function saveCurrentAsPreset(event) {
    event.preventDefault();
    const input = document.getElementById("teamPresetName");
    const name = input.value.trim();
    if (!name || !team.length) {
        statusElement.textContent = team.length ? "Give the team a name first" : "Add some Pokémon first";
        return;
    }
    // Same name replaces; past the limit the oldest goes.
    const presets = [{ name, members: team }, ...loadPresets().filter((preset) => preset.name !== name)];
    savePresets(presets.slice(0, MAX_PRESETS));
    input.value = "";
    renderPresets();
    statusElement.textContent = "Saved this team as “" + name + "”";
}

function updateTeamButton() {
    const current = getCurrentPokemon();
    const inTeam = current && team.some((member) => member.id === current.id);
    teamButton.setAttribute("aria-pressed", String(Boolean(inTeam)));
    teamButton.title = inTeam ? "Remove from team" : team.length >= TEAM_SIZE ? "Team is full" : "Add to team";
    teamButton.classList.toggle("active", Boolean(inTeam));
}

function toggleCurrent() {
    const current = getCurrentPokemon();
    if (!current) {
        return;
    }
    if (team.some((member) => member.id === current.id)) {
        changeTeam(
            team.filter((member) => member.id !== current.id),
            current.label + " removed from your team",
        );
    } else if (team.length >= TEAM_SIZE) {
        statusElement.textContent = "Your team already has six Pokémon";
        return;
    } else {
        changeTeam([...team, current], current.label + " added to your team (" + (team.length + 1) + "/6)");
    }
}

function renderSlots() {
    const slots = [];
    for (let index = 0; index < TEAM_SIZE; index++) {
        const member = team[index];
        const slot = document.createElement("li");
        slot.className = "teamSlot" + (member ? "" : " empty") + (member && justLanded.has(member.id) ? " landed" : "");
        if (member) {
            const open = document.createElement("button");
            open.type = "button";
            open.className = "teamMember";
            open.title = "View " + member.label;
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.width = 72;
            sprite.height = 72;
            setSmallSprite(sprite, member.id);
            const name = document.createElement("span");
            name.textContent = member.label;
            const types = document.createElement("small");
            types.textContent = member.types.map(formatName).join(" / ");
            open.append(sprite, name, types);
            open.addEventListener("click", () => {
                showPokemon(member.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
            });

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "teamRemove";
            remove.setAttribute("aria-label", "Remove " + member.label + " from team");
            remove.textContent = "×";
            remove.addEventListener("click", () => {
                changeTeam(
                    team.filter((other) => other.id !== member.id),
                    member.label + " removed from your team",
                );
            });
            slot.append(open, remove);
        } else {
            slot.textContent = "Empty slot";
        }
        slots.push(slot);
    }
    slotsElement.replaceChildren(...slots);
}

let coverageRequest = 0;
let lastBalance = null; // the score last shown, for the change floater
let wasGreat = false; // whether the team was already full and well balanced

async function renderCoverage() {
    const requestId = ++coverageRequest;
    if (!team.length) {
        coverageElement.replaceChildren();
        suggestElement.replaceChildren();
        lastBalance = null;
        return;
    }
    let memberMultipliers;
    let memberHits;
    try {
        const memberTypeData = await Promise.all(
            team.map((member) => Promise.all(member.types.map((type) => fetchJson(API_BASE + "type/" + type)))),
        );
        memberMultipliers = memberTypeData.map(damageMultipliers);
        memberHits = memberTypeData.map(superEffectiveTargets);
    } catch {
        coverageElement.textContent = "Couldn't load type data for the coverage chart.";
        return;
    }
    if (requestId !== coverageRequest) {
        return;
    }
    // The MVP gets a gold ★ badge on its slot (and its name says so to screen readers).
    const mvp = teamMvp(memberMultipliers);
    const weakLink = teamWeakLink(memberMultipliers);
    const shared = sharedWeaknesses(memberMultipliers);
    [...slotsElement.querySelectorAll(".teamSlot")].forEach((slot, index) => {
        slot.classList.toggle("mvp", index === mvp);
        slot.classList.toggle("weakLink", index === weakLink);
        slot.querySelector(".mvpBadge, .weakLinkBadge")?.remove();
        if (index === weakLink) {
            // ...and the weak link, in orange, with what it piles onto
            const piles = shared.filter((type) => memberMultipliers[index][type] > 1).map(formatName);
            const badge = document.createElement("span");
            badge.className = "weakLinkBadge";
            badge.textContent = "⚠ Weak link";
            badge.title = "Also weak to " + piles.join(" and ") + ", like the rest of your team";
            const spoken = document.createElement("span");
            spoken.className = "visuallyHidden";
            spoken.textContent = ": " + badge.title.toLowerCase();
            badge.append(spoken);
            slot.querySelector(".teamMember").append(badge);
        }
        if (index === mvp) {
            const badge = document.createElement("span");
            badge.className = "mvpBadge";
            badge.textContent = "★ MVP";
            const covers = sharedWeaknesses(memberMultipliers)
                .filter((type) => memberMultipliers[mvp][type] < 1)
                .map(formatName);
            badge.title = "Resists " + covers.join(" and ") + ", which the rest of your team is weak to";
            const spoken = document.createElement("span");
            spoken.className = "visuallyHidden";
            spoken.textContent = ": " + badge.title.toLowerCase();
            badge.append(spoken);
            slot.querySelector(".teamMember").append(badge);
        }
    });

    const table = document.createElement("table");
    table.className = "coverageTable";
    const caption = document.createElement("caption");
    caption.textContent =
        "Defence: members weak to / resisting each type · Offence: members whose own types hit it super-effectively";
    const head = table.createTHead().insertRow();
    for (const label of ["Type", "Weak", "Resist", "Your hits"]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = label;
        head.append(th);
    }
    const body = table.createTBody();
    const rowDetails = [];
    for (const { type, weak, resist, hits } of teamCoverage(memberMultipliers, memberHits)) {
        const row = body.insertRow();
        // Flag types that hit half or more of the team and that nobody resists.
        row.classList.toggle("danger", weak * 2 >= team.length && resist === 0);
        const typeCell = document.createElement("th");
        typeCell.scope = "row";
        const icon = document.createElement("img");
        icon.src = "assets/" + TYPE_ICONS[type];
        icon.alt = "";
        icon.width = 22;
        icon.height = 22;
        // The type is a button: it opens a line naming who's weak to it and who resists it.
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "coverageToggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.append(icon, " " + formatName(type));
        typeCell.append(toggle);
        row.append(typeCell);
        const members = (test) => team.filter((_, index) => test(memberMultipliers[index][type] ?? 1));
        const details = document.createElement("tr");
        details.className = "coverageDetails";
        details.hidden = true;
        const detailCell = document.createElement("td");
        detailCell.colSpan = 4;
        // Each name is a link-style button that opens that member.
        const nameList = (list) => {
            if (!list.length) {
                return ["nobody"];
            }
            return list.flatMap((member, index) => {
                const link = document.createElement("button");
                link.type = "button";
                link.className = "linkBtn";
                link.textContent = member.label;
                link.addEventListener("click", () => {
                    showPokemon(member.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                });
                return index ? [", ", link] : [link];
            });
        };
        detailCell.append(
            "Weak: ",
            ...nameList(members((multiplier) => multiplier > 1)),
            " · Resists: ",
            ...nameList(members((multiplier) => multiplier < 1)),
        );
        details.append(detailCell);
        toggle.addEventListener("click", () => {
            details.hidden = !details.hidden;
            toggle.setAttribute("aria-expanded", String(!details.hidden));
        });
        rowDetails.push([row, details]);
        row.classList.toggle("noHits", hits === 0);
        for (const [count, kind] of [
            [weak, "weak"],
            [resist, "resist"],
            [hits, "hits"],
        ]) {
            const cell = row.insertCell();
            cell.className = kind;
            const bar = document.createElement("span");
            bar.className = "coverageBar";
            bar.style.width = (count / TEAM_SIZE) * 100 + "%";
            cell.append(bar, String(count));
        }
    }
    for (const [row, details] of rowDetails) {
        row.after(details);
    }
    table.append(caption);
    // The balance meter above the chart: red to gold to green as the team rounds out.
    const balance = teamBalance(memberMultipliers, memberHits);
    const meter = document.createElement("div");
    meter.className = "teamBalance";
    const label = document.createElement("span");
    label.id = "teamBalanceLabel";
    label.textContent = "Team balance";
    const bar = document.createElement("span");
    bar.className = "teamBalanceBar";
    bar.setAttribute("role", "meter");
    bar.setAttribute("aria-labelledby", "teamBalanceLabel");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(balance));
    const fill = document.createElement("span");
    fill.style.setProperty("--balance", balance);
    bar.append(fill);
    const score = document.createElement("strong");
    score.className = "teamBalanceScore";
    score.textContent = balance + " / 100";
    // When the team changes, the difference floats up from the score ("+6" / "−4").
    if (lastBalance !== null && balance !== lastBalance) {
        const change = balance - lastBalance;
        const floater = document.createElement("span");
        floater.className = "balanceFloater" + (change < 0 ? " down" : "");
        floater.setAttribute("aria-hidden", "true");
        floater.textContent = (change > 0 ? "+" : "−") + Math.abs(change);
        score.append(floater);
    }
    // A full, well-balanced team (six members, 70+) gets a confetti pop the moment it gets there.
    const great = team.length === TEAM_SIZE && balance >= 70;
    if (great && !wasGreat && lastBalance !== null && !reducedMotion.matches) {
        const burst = makeConfetti(70, "confetti fullscreen");
        document.body.append(burst);
        setTimeout(() => burst.remove(), 3000);
    }
    if (great && !wasGreat && lastBalance !== null) {
        statusElement.textContent = "A full, well-balanced team: " + balance + " / 100!";
    }
    wasGreat = great;
    lastBalance = balance;
    noteTeamBalance(balance); // the best so far counts toward the Master strategist badge
    meter.append(label, bar, score);
    // Open (or close) every type's who-is-weak line at once.
    const expandAll = document.createElement("button");
    expandAll.type = "button";
    expandAll.className = "linkBtn coverageExpandAll";
    expandAll.textContent = "Show who's weak to everything";
    expandAll.setAttribute("aria-expanded", "false");
    expandAll.addEventListener("click", () => {
        const open = expandAll.getAttribute("aria-expanded") !== "true";
        for (const [row, details] of rowDetails) {
            details.hidden = !open;
            row.querySelector(".coverageToggle").setAttribute("aria-expanded", String(open));
        }
        expandAll.setAttribute("aria-expanded", String(open));
        expandAll.textContent = open ? "Hide the details" : "Show who's weak to everything";
    });
    coverageElement.replaceChildren(meter, expandAll, table);
    suggestFixes(memberMultipliers, memberHits, requestId);
}

// "Try adding…": up to three Pokémon you've already seen whose type resists the team's worst
// shared weakness (the one most members are weak to), as buttons that open them.
async function suggestFixes(memberMultipliers, memberHits, requestId) {
    const coverage = teamCoverage(memberMultipliers);
    const worst = sharedWeaknesses(memberMultipliers)
        .map((type) => coverage.find((entry) => entry.type === type))
        .sort((a, b) => b.weak - a.weak)[0];
    if (!worst || team.length >= TEAM_SIZE) {
        suggestElement.replaceChildren();
        return;
    }
    let picks;
    let resisting = [];
    try {
        const attacking = await fetchJson(API_BASE + "type/" + worst.type);
        resisting = [...attacking.damage_relations.no_damage_to, ...attacking.damage_relations.half_damage_to].map(
            ({ name }) => name,
        );
        const lists = await Promise.all(resisting.map((type) => fetchJson(API_BASE + "type/" + type)));
        const inTeam = new Set(team.map((member) => member.id));
        const candidates = lists.flatMap((typeData) =>
            typeData.pokemon.map(({ pokemon }) => ({ id: idFromUrl(pokemon.url), name: pokemon.name })),
        );
        const seenIds = new Set();
        const fitting = candidates
            .filter(({ id }) => {
                const fits = id <= MAX_DEX_NUMBER && hasSeen(id) && !inTeam.has(id) && !seenIds.has(id);
                seenIds.add(id);
                return fits;
            })
            .slice(0, 8);
        // Among the first few, prefer ones that don't bring a new shared weakness with them,
        // and show their proper names ("Farfetch’d", not "farfetchd").
        const before = sharedWeaknesses(memberMultipliers).length;
        const [slugs, scored] = await Promise.all([
            getSpeciesSlugs().catch(() => null),
            Promise.all(
                fitting.map(async (candidate, order) => {
                    const pokemon = await fetchPokemon(String(candidate.id));
                    const typeData = await Promise.all(
                        pokemon.types.map((entry) => fetchJson(API_BASE + "type/" + entry.type.name)),
                    );
                    const added = sharedWeaknesses([...memberMultipliers, damageMultipliers(typeData)]).length - before;
                    const types = pokemon.types.map((entry) => entry.type.name);
                    // the balance score the team would have with it
                    const balance = teamBalance(
                        [...memberMultipliers, damageMultipliers(typeData)],
                        [...memberHits, superEffectiveTargets(typeData)],
                    );
                    return { ...candidate, added, order, types, balance };
                }),
            ),
        ]);
        picks = scored
            .sort((a, b) => b.balance - a.balance || a.added - b.added || a.order - b.order)
            .map((pick) => ({
                ...pick,
                label: slugs?.get(pick.id) ? speciesDisplayName(slugs.get(pick.id)) : formatName(pick.name),
            }));
    } catch {
        picks = []; // no type data: no suggestions
    }
    if (requestId !== coverageRequest) {
        return;
    }
    if (!picks.length) {
        // Nothing seen fits yet: say which types would, so there's something to look for.
        const hint = document.createElement("p");
        hint.className = "teamSuggestHint";
        hint.textContent = resisting.length
            ? "Nothing you've seen resists " +
              formatName(worst.type) +
              " yet — look for " +
              resisting
                  .slice(0, 4)
                  .map(formatName)
                  .join(", ")
                  .replace(/, ([^,]+)$/, " or $1") +
              " types to cover " +
              worst.weak +
              " of your team."
            : "";
        suggestElement.replaceChildren(...(hint.textContent ? [hint] : []));
        return;
    }
    const currentBalance = teamBalance(memberMultipliers, memberHits);
    const heading = document.createElement("p");
    heading.textContent =
        "Try adding — they resist " + formatName(worst.type) + ", which " + worst.weak + " of your team are weak to:";
    const list = document.createElement("ul");
    list.append(
        ...picks.slice(0, 3).map(({ id, label, types, balance }) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "teamSuggestion";
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.width = 48;
            sprite.height = 48;
            setSmallSprite(sprite, id);
            // its types as tiny icons, so the reason it's suggested shows at a glance
            const icons = types.map((type) => {
                const icon = document.createElement("img");
                icon.src = "assets/" + TYPE_ICONS[type];
                icon.alt = formatName(type);
                icon.title = formatName(type);
                icon.width = 18;
                icon.height = 18;
                icon.className = "teamSuggestionType";
                return icon;
            });
            // how the balance score would change (green up, red down)
            const change = balance - currentBalance;
            const after = document.createElement("small");
            after.className = "teamSuggestionScore" + (change < 0 ? " down" : "");
            after.textContent = (change > 0 ? "+" : change < 0 ? "−" : "±") + Math.abs(change);
            after.title = "Team balance with " + label + ": " + balance + " / 100 (now " + currentBalance + ")";
            const spokenScore = document.createElement("span");
            spokenScore.className = "visuallyHidden";
            spokenScore.textContent = ", team balance would go from " + currentBalance + " to " + balance;
            button.append(sprite, label, ...icons, after, spokenScore);
            button.addEventListener("click", () => {
                showPokemon(id);
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
            // ＋ adds it straight to the team (the chart, badges and suggestions update).
            const add = document.createElement("button");
            add.type = "button";
            add.className = "teamSuggestionAdd";
            add.textContent = "＋";
            add.setAttribute("aria-label", "Add " + label + " to your team");
            add.addEventListener("click", async () => {
                add.disabled = true;
                try {
                    const pokemon = await fetchPokemon(String(id));
                    if (team.length < TEAM_SIZE && !team.some((member) => member.id === pokemon.id)) {
                        changeTeam(
                            [
                                ...team,
                                {
                                    id: pokemon.id,
                                    name: pokemon.name,
                                    label: pokemonDisplayName(pokemon),
                                    types: pokemon.types.map((entry) => entry.type.name),
                                },
                            ],
                            pokemonDisplayName(pokemon) + " added to your team (" + (team.length + 1) + "/6)",
                        );
                    }
                } catch {
                    add.disabled = false; // couldn't load it: let them try again
                }
            });
            item.append(button, add);
            return item;
        }),
    );
    suggestElement.replaceChildren(heading, list);
}

function renderTeam() {
    section.hidden = false;
    shareTeamButton.hidden = team.length === 0;
    teamCardButton.hidden = team.length === 0;
    renderSlots();
    renderCoverage();
    updateTeamButton();
}

// Call when the card shows a new Pokémon so the "Add to team" button reflects it.
export function onCardChange() {
    updateTeamButton();
}

// --- Sharing ---------------------------------------------------------------------------
// A team travels as ?team=6,94,25 (Pokémon ids). Opening such a link offers to load it
// rather than silently replacing the visitor's own team.

export function parseTeamParam(value) {
    return (value ?? "")
        .split(",")
        .map((part) => Number(part))
        .filter((id) => Number.isInteger(id) && id > 0)
        .slice(0, TEAM_SIZE);
}

function trainerName() {
    try {
        return String(JSON.parse(localStorage.getItem("pokedex:trainer:v1"))?.name ?? "").trim();
    } catch {
        return ""; // no trainer name
    }
}

async function shareTeam() {
    const url = new URL(window.location.href);
    url.searchParams.set("team", team.map((member) => member.id).join(","));
    // ...signed with the trainer's name, if they've set one, so the link says who shared it.
    const name = trainerName();
    if (name) {
        url.searchParams.set("by", name);
    } else {
        url.searchParams.delete("by");
    }
    try {
        if (navigator.share) {
            await navigator.share({ title: "My Pokémon team", url: url.href });
            return;
        }
        await navigator.clipboard.writeText(url.href);
        statusElement.textContent = "Team link copied";
        shareTeamButton.textContent = "✓ Link copied";
        setTimeout(() => (shareTeamButton.textContent = "Share team"), 1500);
    } catch {
        // share sheet dismissed or clipboard blocked
    }
}

// The team as a share card (through the same preview as the other cards): the six members,
// the types that hit the most of them with nobody resisting, and the types they hit hardest.
async function saveTeamCard(members = team, byline = null, heading = undefined) {
    let summary = { weakTo: [], hits: [], strip: [], mvp: -1, balance: null };
    try {
        const memberTypeData = await Promise.all(
            members.map((member) => Promise.all(member.types.map((type) => fetchJson(API_BASE + "type/" + type)))),
        );
        const coverage = teamCoverage(memberTypeData.map(damageMultipliers), memberTypeData.map(superEffectiveTargets));
        summary = {
            mvp: teamMvp(memberTypeData.map(damageMultipliers)),
            balance: teamBalance(memberTypeData.map(damageMultipliers), memberTypeData.map(superEffectiveTargets)),
            // one square per type: "weak" (more of the team weak than resisting), "hit" (someone
            // hits it super-effectively) or neither
            strip: coverage.map(({ type, weak, resist, hits }) => [
                type,
                weak > resist ? "weak" : hits > 0 ? "hit" : "",
            ]),
            weakTo: coverage
                .filter(({ weak, resist }) => weak >= 2 && weak > resist)
                .sort((a, b) => b.weak - a.weak)
                .slice(0, 4)
                .map(({ type, weak }) => [type, weak]),
            hits: coverage
                .filter(({ hits }) => hits >= 2)
                .sort((a, b) => b.hits - a.hits)
                .slice(0, 5)
                .map(({ type }) => type),
        };
    } catch {
        // no type data (offline): the card shows the members alone
    }
    const sprites = await Promise.all(members.map((member) => loadCanvasImage(spriteUrl(member.id))));
    if (byline === null) {
        byline = trainerName();
    }
    const typeColors = Object.fromEntries(Object.entries(TYPE_COLORS).map(([type, colours]) => [type, colours[0]]));
    await cardFontsReady();
    await shareOrDownload(
        (style) => {
            const canvas = document.createElement("canvas");
            drawTeamCard(
                canvas,
                { members, ...summary, heading, byline, retro: style === "retro" },
                sprites,
                typeColors,
            );
            styleShareCard(canvas, style);
            return canvas;
        },
        "my-team.png",
        "My Pokémon team",
    );
}

async function offerSharedTeam() {
    const ids = parseTeamParam(new URLSearchParams(window.location.search).get("team"));
    const sameAsMine = ids.length === team.length && ids.every((id, index) => team[index]?.id === id);
    if (!ids.length || sameAsMine) {
        return;
    }
    let members;
    try {
        members = (await Promise.all(ids.map((id) => fetchPokemon(String(id))))).map((pokemon) => ({
            id: pokemon.id,
            name: pokemon.name,
            label: pokemonDisplayName(pokemon),
            types: pokemon.types.map((entry) => entry.type.name),
        }));
    } catch {
        return; // a broken link just shows your own team
    }

    const text = document.createElement("span");
    // "Ash shared a team" when the link is signed (trimmed to a sensible length), else "Someone".
    const sharer = (new URLSearchParams(window.location.search).get("by") ?? "").trim().slice(0, 24);
    text.textContent =
        (sharer || "Someone") + " shared a team: " + members.map((member) => member.label).join(", ") + ". ";
    const load = Object.assign(document.createElement("button"), {
        type: "button",
        className: "btn",
        textContent: "Load this team",
    });
    const dismiss = Object.assign(document.createElement("button"), {
        type: "button",
        className: "linkBtn",
        textContent: "Keep mine",
    });
    const clearParam = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete("team");
        url.searchParams.delete("by");
        history.replaceState(history.state, "", url);
        sharedTeamElement.hidden = true;
    };
    load.addEventListener("click", () => {
        changeTeam(members, "Shared team loaded");
        clearParam();
    });
    // See it as a team card first, headed "A shared team" (it's someone else's).
    const viewCard = Object.assign(document.createElement("button"), {
        type: "button",
        className: "btn",
        textContent: "🖼️ View as card",
    });
    viewCard.addEventListener("click", () => saveTeamCard(members, "", sharer ? sharer + "'s team" : "A shared team"));
    dismiss.addEventListener("click", clearParam);
    sharedTeamElement.replaceChildren(text, load, viewCard, dismiss);
    sharedTeamElement.hidden = false;
}

export function initTeam(options) {
    getCurrentPokemon = options.getCurrentPokemon;
    showPokemon = options.showPokemon;
    loadTeam();
    teamButton.addEventListener("click", toggleCurrent);
    shareTeamButton.addEventListener("click", shareTeam);
    teamCardButton.addEventListener("click", () => saveTeamCard());
    document.getElementById("teamPresetForm").addEventListener("submit", saveCurrentAsPreset);
    document.getElementById("teamSurpriseBtn").addEventListener("click", surpriseTeam);
    renderPresets();
    window.addEventListener(ANIMATED_CHANGE_EVENT, renderSlots);
    renderTeam();
    offerSharedTeam();
}
