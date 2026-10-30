// Pokédex completion: every species you open is remembered (localStorage) and shown as a
// ring in the device header and a progress bar on each region banner.
import { API_BASE, fetchJson, fetchPokemon, getSpeciesSlugs, setSprite, spriteUrl } from "./api.js";
import { drawTrainerCard, loadCanvasImage } from "./cardimage.js";
import { makeConfetti } from "./effects.js";
import { GENERATIONS, MAX_DEX_NUMBER, damageMultipliers, formatDexNumber, speciesDisplayName } from "./utils.js";

const SEEN_KEY = "pokedex:seen:v1";
const TRAINER_KEY = "pokedex:trainer:v1";
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
        banner.classList.toggle("regionComplete", count === total);
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
    celebrateIfComplete(dexNumber);
    for (const tile of document.querySelectorAll('.browseTile[data-dex="' + dexNumber + '"]:not(:has(.tileSeen))')) {
        tile.append(seenMark());
    }
    ringElement.classList.remove("bump");
    void ringElement.offsetWidth; // restart the bump animation
    ringElement.classList.add("bump");
}

// --- Region complete celebration ---------------------------------------------------------

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let toastTimer = 0;

// The message to show when this newly seen Pokémon completes something, or null.
export function completionMessage(seenIds, dexNumber) {
    const stats = completionStats(seenIds);
    if (stats.seen === stats.total) {
        return "🏆 National Pokédex complete! You've seen all " + stats.total + " Pokémon!";
    }
    const generation = GENERATIONS.find((gen) => dexNumber >= gen.first && dexNumber <= gen.last);
    const counts = stats.generations.find((gen) => gen.number === generation?.number);
    return counts && counts.seen === counts.total ? "🏅 " + generation.region + " Pokédex complete!" : null;
}

function celebrateIfComplete(dexNumber) {
    const message = completionMessage(seen, dexNumber);
    if (!message) {
        return;
    }
    const toast = document.getElementById("dexToast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 5000);
    if (!reducedMotion.matches) {
        const burst = makeConfetti(90, "confetti fullscreen");
        document.body.append(burst);
        setTimeout(() => burst.remove(), 3000);
    }
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

// Trainer name and partner Pokémon (any seen species; defaults to the first one seen).
function renderTrainerProfile() {
    const trainer = readStored(TRAINER_KEY, {});
    const nameInput = document.getElementById("trainerName");
    const partnerSelect = document.getElementById("trainerPartner");
    nameInput.value = trainer.name ?? "";
    const seenIds = [...seen].sort((a, b) => a - b);
    const partner = seen.has(trainer.partner) ? trainer.partner : [...seen][0];
    const label = (id, slugs) => {
        const slug = slugs?.get(id);
        return formatDexNumber(id) + " " + (slug ? speciesDisplayName(slug) : "");
    };
    const fillPartners = (slugs) => {
        partnerSelect.replaceChildren(
            ...seenIds.map((id) => new Option(label(id, slugs).trim(), id, false, id === partner)),
        );
    };
    fillPartners(null);
    getSpeciesSlugs()
        .then(fillPartners)
        .catch(() => {});
    partnerSelect.disabled = seenIds.length === 0;
    if (seenIds.length === 0) {
        partnerSelect.append(new Option("Open a Pokémon first", ""));
    }
    showPartner(partner);
    applyCardStyle(trainer.style);
}

const CARD_STYLES = ["classic", "holo", "retro"];

function applyCardStyle(style) {
    const value = CARD_STYLES.includes(style) ? style : "classic";
    document.getElementById("trainerStyle").value = value;
    trainerCard.dataset.style = value;
}

function showPartner(id) {
    for (const image of [document.getElementById("trainerAvatar"), partnerElement]) {
        image.hidden = !id;
        if (id && image.dataset.id !== String(id)) {
            image.dataset.id = id;
            setSprite(image, id);
        }
    }
}

// The partner (chosen on the trainer card, else the first Pokémon seen) rides along in the
// header and hops whenever a Pokémon is opened.
const partnerElement = document.getElementById("dexPartner");

function currentPartner() {
    const partner = readStored(TRAINER_KEY, {}).partner;
    return seen.has(partner) ? partner : [...seen][0];
}

// How the partner feels about the Pokémon just opened: ❤️ for its own evolution line, 😨 when
// one of the opened Pokémon's types hits the partner super effectively, otherwise nothing.
export function partnerReaction(partnerId, chainIds, partnerMultipliers, openedTypes) {
    if (chainIds.includes(partnerId)) {
        return "❤️";
    }
    return openedTypes.some((type) => (partnerMultipliers[type] ?? 1) > 1) ? "😨" : null;
}

const partnerMultipliersCache = new Map();

async function getPartnerMultipliers(id) {
    if (!partnerMultipliersCache.has(id)) {
        const pokemon = await fetchPokemon(String(id));
        const typeData = await Promise.all(
            pokemon.types.map((entry) => fetchJson(API_BASE + "type/" + entry.type.name)),
        );
        partnerMultipliersCache.set(id, damageMultipliers(typeData));
    }
    return partnerMultipliersCache.get(id);
}

let bubbleTimer = 0;

export async function reactToPokemon(chainIds, openedTypes) {
    const partner = currentPartner();
    if (!partner) {
        return;
    }
    let reaction;
    try {
        reaction = partnerReaction(partner, chainIds, await getPartnerMultipliers(partner), openedTypes);
    } catch {
        return; // offline or not cached: no reaction
    }
    const bubble = document.getElementById("dexPartnerBubble");
    bubble.textContent = reaction ?? "";
    bubble.classList.toggle("visible", Boolean(reaction));
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("visible"), 2500);
}

export function hopPartner() {
    showPartner(currentPartner());
    partnerElement.classList.remove("hop");
    void partnerElement.offsetWidth; // restart the animation
    partnerElement.classList.add("hop");
}

function saveTrainer(changes) {
    try {
        localStorage.setItem(TRAINER_KEY, JSON.stringify({ ...readStored(TRAINER_KEY, {}), ...changes }));
    } catch {
        // the card just won't remember it
    }
}

function seenText(stats) {
    return stats.seen + " of " + stats.total + " Pokémon seen (" + Math.floor((100 * stats.seen) / stats.total) + "%)";
}

// The six stat tiles: [icon, label, value].
function trainerFacts(stats) {
    const hunt = readStored("pokedex:shiny-hunt:v1", {});
    return [
        ["✨", "Shinies caught", hunt.shinies?.length ?? 0],
        ["🌿", "Wild encounters", hunt.encounters ?? 0],
        ["❓", "Quiz best streak", readStored("pokedex:quiz:v1", {}).best ?? 0],
        ["⭐", "Favorites", readStored("pokedex:favorites:v1", []).length],
        ["👥", "Team members", readStored("pokedex:team:v1", []).filter(Boolean).length],
        ["🏅", "Regions complete", stats.generations.filter((gen) => gen.seen === gen.total).length],
    ];
}

// Draws the card as it is now and downloads it as trainer-card.png.
async function saveTrainerCardImage() {
    const stats = completionStats(seen);
    const trainer = readStored(TRAINER_KEY, {});
    const partner = currentPartner();
    const partnerSelect = document.getElementById("trainerPartner");
    const canvas = document.createElement("canvas");
    await document.fonts?.ready;
    drawTrainerCard(
        canvas,
        {
            name: trainer.name,
            partnerName: partner ? partnerSelect.selectedOptions[0]?.textContent.replace(/^#\d+\s*/, "") : "",
            seenText: seenText(stats),
            facts: trainerFacts(stats),
            regions: stats.generations.map(({ number, seen: count, total }) => ({
                name: GENERATIONS.find((gen) => gen.number === number).region,
                seen: count,
                total,
            })),
            style: trainerCard.dataset.style,
        },
        await loadCanvasImage(partner ? spriteUrl(partner) : null),
    );
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "trainer-card.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    document.getElementById("trainerShareStatus").textContent = "Image saved!";
}

function renderTrainerCard() {
    renderTrainerProfile();
    document.getElementById("trainerShareStatus").textContent = "";
    const stats = completionStats(seen);
    document.getElementById("trainerCardSeen").textContent = seenText(stats);
    document.getElementById("trainerCardStats").replaceChildren(
        ...trainerFacts(stats).map(([icon, label, value]) => {
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

// A plain-text summary of the trainer card, for sharing.
export function trainerSummary(trainer, stats, shinies) {
    const lines = [
        "🎴 " + (trainer.name || "Trainer") + "'s Pokédex",
        "👀 " +
            stats.seen +
            "/" +
            stats.total +
            " Pokémon seen (" +
            Math.floor((100 * stats.seen) / stats.total) +
            "%)",
        "✨ " + shinies + " shiny" + (shinies === 1 ? "" : " Pokémon") + " caught",
    ];
    const complete = stats.generations.filter((gen) => gen.seen === gen.total);
    if (complete.length) {
        const names = complete.map((gen) => GENERATIONS.find((entry) => entry.number === gen.number).region);
        lines.push("🏅 Complete: " + names.join(", "));
    }
    return lines.join("\n");
}

async function shareTrainerCard() {
    const status = document.getElementById("trainerShareStatus");
    const text =
        trainerSummary(
            readStored(TRAINER_KEY, {}),
            completionStats(seen),
            readStored("pokedex:shiny-hunt:v1", {}).shinies?.length ?? 0,
        ) +
        "\n" +
        location.origin +
        location.pathname;
    try {
        if (navigator.share) {
            await navigator.share({ title: "My trainer card", text });
            return;
        }
        await navigator.clipboard.writeText(text);
        status.textContent = "Copied to clipboard!";
    } catch {
        status.textContent = ""; // share sheet dismissed or clipboard blocked
    }
}

export function initProgress() {
    showPartner(currentPartner());
    document.getElementById("trainerShareBtn").addEventListener("click", shareTrainerCard);
    document.getElementById("trainerImageBtn").addEventListener("click", saveTrainerCardImage);
    ringElement.addEventListener("click", () => {
        renderTrainerCard();
        trainerCard.showModal();
    });
    document.getElementById("trainerCardClose").addEventListener("click", () => trainerCard.close());
    document.getElementById("trainerName").addEventListener("input", (event) => {
        saveTrainer({ name: event.target.value.trim() });
    });
    document.getElementById("trainerStyle").addEventListener("change", (event) => {
        saveTrainer({ style: event.target.value });
        applyCardStyle(event.target.value);
    });
    document.getElementById("trainerPartner").addEventListener("change", (event) => {
        const id = Number(event.target.value);
        saveTrainer({ partner: id });
        showPartner(id);
    });
    // Holo style: a light sheen follows the pointer across the card (not for touch or reduced motion).
    trainerCard.addEventListener("pointermove", (event) => {
        if (trainerCard.dataset.style !== "holo" || event.pointerType === "touch" || reducedMotion.matches) {
            return;
        }
        const box = trainerCard.getBoundingClientRect();
        trainerCard.style.setProperty("--sheen-x", (((event.clientX - box.left) / box.width) * 100).toFixed(1) + "%");
        trainerCard.style.setProperty("--sheen-y", (((event.clientY - box.top) / box.height) * 100).toFixed(1) + "%");
        trainerCard.classList.add("sheen");
    });
    trainerCard.addEventListener("pointerleave", () => trainerCard.classList.remove("sheen"));
    // Clicking the backdrop (outside the card) closes it too.
    trainerCard.addEventListener("click", (event) => event.target === trainerCard && trainerCard.close());
    ringElement.querySelector(".dexProgressFill").style.strokeDasharray = String(RING_LENGTH);
    render();
}
