// Pokédex completion: every species you open is remembered (localStorage) and shown as a
// ring in the device header and a progress bar on each region banner.
import { GENERATIONS, MAX_DEX_NUMBER } from "./utils.js";

const SEEN_KEY = "pokedex:seen:v1";
const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const ringElement = document.getElementById("dexProgress");
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

export function initProgress() {
    ringElement.querySelector(".dexProgressFill").style.strokeDasharray = String(RING_LENGTH);
    render();
}
