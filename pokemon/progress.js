// Pokédex completion: every species you open is remembered (localStorage) and shown as a
// ring in the device header and a progress bar on each region banner.
import { GENERATIONS, MAX_DEX_NUMBER } from "./utils.js";

const SEEN_KEY = "pokedex:seen:v1";
const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const ringElement = document.getElementById("dexProgress");
const trainerCard = document.getElementById("trainerCard");
let seen = new Set();
load(); // before any card renders, so a fast first load can't overwrite saved progress

// Seen totals overall and per generation for a collection of National Dex numbers.
export function completionStats(seenIds) {
    const ids = [...seenIds].filter((id) => Number.isInteger(id) && id >= 1 && id <= MAX_DEX_NUMBER);
    return {
        seen: ids.length,
        total: MAX_DEX_NUMBER,
        generations: GENERATIONS.map((generation) => ({
            number: generation.number,
            seen: ids.filter((id) => id >= generation.first && id <= generation.last).length,
            total: generation.last - generation.first + 1,
        })),
    };
}

function load() {
    try {
        seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) ?? []);
    } catch {
        seen = new Set();
    }
}

function render() {
    const stats = completionStats(seen);
    const fraction = stats.seen / stats.total;
    ringElement.querySelector(".dexProgressFill").style.strokeDashoffset = String(RING_LENGTH * (1 - fraction));
    ringElement.querySelector(".dexProgressCount").textContent = stats.seen;
    ringElement.setAttribute(
        "aria-label",
        "Pokédex completion: " +
            stats.seen +
            " of " +
            stats.total +
            " Pokémon seen (" +
            Math.floor(fraction * 100) +
            "%)",
    );
    ringElement.title = stats.seen + " / " + stats.total + " seen";
    for (const { number, seen: count, total } of stats.generations) {
        const banner = document.querySelector('.regionBanner[data-generation="' + number + '"]');
        if (!banner) {
            continue;
        }
        let bar = banner.querySelector(".regionProgress");
        if (!bar) {
            bar = document.createElement("span");
            bar.className = "regionProgress";
            bar.innerHTML =
                '<span class="regionProgressBar"><span></span></span><span class="regionProgressText"></span>';
            banner.append(bar);
        }
        bar.classList.toggle("complete", count === total);
        bar.querySelector(".regionProgressBar span").style.width = (100 * count) / total + "%";
        bar.querySelector(".regionProgressText").textContent = count + "/" + total + " seen";
    }
}

// The "seen" tick on tiles for Pokémon already opened.
export function seenMark() {
    const mark = document.createElement("span");
    mark.className = "tileSeen";
    mark.title = "Seen";
    mark.innerHTML = '<span aria-hidden="true">✓</span><span class="visuallyHidden">, seen</span>';
    return mark;
}

export function hasSeen(dexNumber) {
    return seen.has(dexNumber);
}

export function markSeen(dexNumber) {
    if (seen.has(dexNumber) || dexNumber < 1 || dexNumber > MAX_DEX_NUMBER) {
        return;
    }
    seen.add(dexNumber);
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
        // progress just won't persist
    }
    render();
    for (const tile of document.querySelectorAll('.browseTile[data-dex="' + dexNumber + '"]:not(:has(.tileSeen))')) {
        tile.append(seenMark());
    }
    ringElement.classList.remove("bump");
    void ringElement.offsetWidth; // restart the bump animation
    ringElement.classList.add("bump");
}

// --- Trainer card ------------------------------------------------------------------------
// A summary of everything saved in this browser: completion, shinies, quiz and team.

function readStored(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function renderTrainerCard() {
    const stats = completionStats(seen);
    const hunt = readStored("pokedex:shiny-hunt:v1", {});
    const quiz = readStored("pokedex:quiz:v1", {});
    const percent = Math.floor((100 * stats.seen) / stats.total);
    document.getElementById("trainerCardSeen").textContent =
        stats.seen + " of " + stats.total + " Pokémon seen (" + percent + "%)";
    const facts = [
        ["✨", "Shinies caught", hunt.shinies?.length ?? 0],
        ["🌿", "Wild encounters", hunt.encounters ?? 0],
        ["❓", "Quiz best streak", quiz.best ?? 0],
        ["⭐", "Favorites", readStored("pokedex:favorites:v1", []).length],
        ["👥", "Team members", readStored("pokedex:team:v1", []).filter(Boolean).length],
        ["🏅", "Regions complete", stats.generations.filter((gen) => gen.seen === gen.total).length],
    ];
    document.getElementById("trainerCardStats").replaceChildren(
        ...facts.map(([icon, label, value]) => {
            const item = document.createElement("li");
            item.innerHTML = '<span aria-hidden="true"></span><strong></strong><small></small>';
            item.children[0].textContent = icon;
            item.children[1].textContent = value;
            item.children[2].textContent = label;
            return item;
        }),
    );
    document.getElementById("trainerCardRegions").replaceChildren(
        ...stats.generations.map(({ number, seen: count, total }) => {
            const generation = GENERATIONS.find((gen) => gen.number === number);
            const item = document.createElement("li");
            item.className = "region" + number + (count === total ? " complete" : "");
            item.innerHTML =
                '<span class="trainerRegionName"></span><span class="regionProgressBar"><span></span></span><span class="trainerRegionCount"></span>';
            item.children[0].textContent = generation.region;
            item.querySelector(".regionProgressBar span").style.width = (100 * count) / total + "%";
            item.children[2].textContent = count + "/" + total;
            return item;
        }),
    );
}

export function initProgress() {
    ringElement.addEventListener("click", () => {
        renderTrainerCard();
        trainerCard.showModal();
    });
    document.getElementById("trainerCardClose").addEventListener("click", () => trainerCard.close());
    // Clicking the backdrop (outside the card) closes it too.
    trainerCard.addEventListener("click", (event) => event.target === trainerCard && trainerCard.close());
    ringElement.querySelector(".dexProgressFill").style.strokeDasharray = String(RING_LENGTH);
    render();
}
