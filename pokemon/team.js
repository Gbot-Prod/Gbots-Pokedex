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
import { cardFontsReady, hasSeen, shareOrDownload } from "./progress.js";
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

// Types two or more members are weak to, with fewer members resisting them.
export function sharedWeaknesses(memberMultipliers) {
    return teamCoverage(memberMultipliers)
        .filter(({ weak, resist }) => weak >= 2 && weak > resist)
        .map(({ type }) => type);
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
        team = team.filter((member) => member.id !== current.id);
        statusElement.textContent = current.label + " removed from your team";
    } else if (team.length >= TEAM_SIZE) {
        statusElement.textContent = "Your team already has six Pokémon";
        return;
    } else {
        team = [...team, current];
        statusElement.textContent = current.label + " added to your team (" + team.length + "/6)";
    }
    saveTeam();
    renderTeam();
}

function renderSlots() {
    const slots = [];
    for (let index = 0; index < TEAM_SIZE; index++) {
        const member = team[index];
        const slot = document.createElement("li");
        slot.className = "teamSlot" + (member ? "" : " empty");
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
                team = team.filter((other) => other.id !== member.id);
                statusElement.textContent = member.label + " removed from your team";
                saveTeam();
                renderTeam();
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

async function renderCoverage() {
    const requestId = ++coverageRequest;
    if (!team.length) {
        coverageElement.replaceChildren();
        suggestElement.replaceChildren();
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
        const names = (test) =>
            team.filter((_, index) => test(memberMultipliers[index][type] ?? 1)).map((member) => member.label);
        const details = document.createElement("tr");
        details.className = "coverageDetails";
        details.hidden = true;
        const detailCell = document.createElement("td");
        detailCell.colSpan = 4;
        const weakNames = names((multiplier) => multiplier > 1);
        const resistNames = names((multiplier) => multiplier < 1);
        detailCell.textContent =
            "Weak: " + (weakNames.join(", ") || "nobody") + " · Resists: " + (resistNames.join(", ") || "nobody");
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
    coverageElement.replaceChildren(table);
    suggestFixes(memberMultipliers, requestId);
}

// "Try adding…": up to three Pokémon you've already seen whose type resists the team's worst
// shared weakness (the one most members are weak to), as buttons that open them.
async function suggestFixes(memberMultipliers, requestId) {
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
                    return { ...candidate, added, order };
                }),
            ),
        ]);
        picks = scored
            .sort((a, b) => a.added - b.added || a.order - b.order)
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
    const heading = document.createElement("p");
    heading.textContent =
        "Try adding — they resist " + formatName(worst.type) + ", which " + worst.weak + " of your team are weak to:";
    const list = document.createElement("ul");
    list.append(
        ...picks.slice(0, 3).map(({ id, label }) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "teamSuggestion";
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.width = 48;
            sprite.height = 48;
            setSmallSprite(sprite, id);
            button.append(sprite, label);
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
                        team = [
                            ...team,
                            {
                                id: pokemon.id,
                                name: pokemon.name,
                                label: pokemonDisplayName(pokemon),
                                types: pokemon.types.map((entry) => entry.type.name),
                            },
                        ];
                        saveTeam();
                        renderTeam();
                        updateTeamButton();
                        statusElement.textContent =
                            pokemonDisplayName(pokemon) + " added to your team (" + team.length + "/6)";
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
    let summary = { weakTo: [], hits: [], strip: [], mvp: -1 };
    try {
        const memberTypeData = await Promise.all(
            members.map((member) => Promise.all(member.types.map((type) => fetchJson(API_BASE + "type/" + type)))),
        );
        const coverage = teamCoverage(memberTypeData.map(damageMultipliers), memberTypeData.map(superEffectiveTargets));
        summary = {
            mvp: teamMvp(memberTypeData.map(damageMultipliers)),
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
        team = members;
        saveTeam();
        renderTeam();
        statusElement.textContent = "Shared team loaded";
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
    window.addEventListener(ANIMATED_CHANGE_EVENT, renderSlots);
    renderTeam();
    offerSharedTeam();
}
