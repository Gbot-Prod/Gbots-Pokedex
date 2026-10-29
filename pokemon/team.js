// Team builder: up to six Pokémon, saved locally, with a type-coverage chart showing how
// many team members are weak to / resist each attacking type.
import { API_BASE, fetchJson, fetchPokemon, setSprite } from "./api.js";
import { TYPE_ICONS, damageMultipliers, formatName, pokemonDisplayName } from "./utils.js";

const TEAM_KEY = "pokedex:team:v1";
export const TEAM_SIZE = 6;

const section = document.getElementById("teamSection");
const slotsElement = document.getElementById("teamSlots");
const coverageElement = document.getElementById("teamCoverage");
const teamButton = document.getElementById("teamAddBtn");
const statusElement = document.getElementById("teamStatus");
const shareTeamButton = document.getElementById("teamShareBtn");
const sharedTeamElement = document.getElementById("sharedTeam");

let team = []; // [{ id, name, label, types: ["fire", "flying"] }]
let getCurrentPokemon = () => null;
let showPokemon = () => {};

function loadTeam() {
    try {
        const stored = JSON.parse(localStorage.getItem(TEAM_KEY));
        team = Array.isArray(stored) ? stored.slice(0, TEAM_SIZE) : [];
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
            setSprite(sprite, member.id);
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
        typeCell.append(icon, " " + formatName(type));
        row.append(typeCell);
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
    table.append(caption);
    coverageElement.replaceChildren(table);
}

function renderTeam() {
    section.hidden = false;
    shareTeamButton.hidden = team.length === 0;
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

async function shareTeam() {
    const url = new URL(window.location.href);
    url.searchParams.set("team", team.map((member) => member.id).join(","));
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
    text.textContent = "Someone shared a team: " + members.map((member) => member.label).join(", ") + ". ";
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
    dismiss.addEventListener("click", clearParam);
    sharedTeamElement.replaceChildren(text, load, dismiss);
    sharedTeamElement.hidden = false;
}

export function initTeam(options) {
    getCurrentPokemon = options.getCurrentPokemon;
    showPokemon = options.showPokemon;
    loadTeam();
    teamButton.addEventListener("click", toggleCurrent);
    shareTeamButton.addEventListener("click", shareTeam);
    renderTeam();
    offerSharedTeam();
}
