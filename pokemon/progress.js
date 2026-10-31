// Pokédex completion: every species you open is remembered (localStorage) and shown as a
// ring in the device header and a progress bar on each region banner.
import { API_BASE, fetchJson, fetchPokemon, getSpeciesSlugs, setSprite, spriteUrl } from "./api.js";
import { drawTrainerCard, loadCanvasImage } from "./cardimage.js";
import { makeConfetti } from "./effects.js";
import { isStoredEntry, isTeamMember } from "./storage.js";
import {
    GENERATIONS,
    MAX_DEX_NUMBER,
    REGION_MASCOTS,
    REGION_STARTERS,
    damageMultipliers,
    formatDexNumber,
    formatMultiplier,
    speciesDisplayName,
} from "./utils.js";

const SEEN_KEY = "pokedex:seen:v1";
const SEEN_DAYS_KEY = "pokedex:seen-days:v1"; // { "YYYY-MM-DD": new Pokémon seen that day }
const TRAINER_KEY = "pokedex:trainer:v1";
const VISITS_KEY = "pokedex:visits:v1";
const VIEWS_KEY = "pokedex:views:v1";
const HEARTS_SHOWN_KEY = "pokedex:hearts-shown:v1"; // { partner, hearts } as last shown on the card
const DECLINED_KEY = "pokedex:partner-declined:v1";
export const PARTNER_OFFER_VIEWS = 5;
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
    const regionsDone = stats.generations.filter((gen) => gen.seen === gen.total).length;
    const tier = tierProgress(regionsDone, REGION_TIERS);
    document.getElementById("regionTier").textContent =
        "🗺️ Region master badge: " + (tier ? tier.replace(" for ", " regions for ") : "gold — every region complete!");
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
    updateNewsDot();
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
    // A nudge on the region closest to complete. The chip is kept (and just relabelled) while
    // it stays on the same region, so its little bob animation doesn't restart on every render.
    const closest = closestRegion(stats.generations);
    const closestBanner = closest && document.querySelector('.regionBanner[data-generation="' + closest.number + '"]');
    let chip = document.querySelector(".regionChip");
    if (chip && (!closestBanner || chip.dataset.generation !== String(closest.number))) {
        chip.remove();
        chip = null;
    }
    if (closestBanner) {
        // Its own button beside the banner (not inside it), so keyboard users can reach it too.
        if (!chip) {
            chip = document.createElement("button");
            chip.type = "button";
            chip.className = "regionChip";
            chip.dataset.generation = closest.number;
            closestBanner.after(chip);
        }
        const left = closest.total - closest.seen;
        chip.textContent = "Only " + left + " to go!";
        chip.setAttribute("aria-label", "Only " + left + " to go: show the unseen Pokémon of this region");
    }
}

// The started-but-unfinished region with the fewest Pokémon left (ties: earliest region).
export function closestRegion(generations) {
    return (
        generations
            .filter((gen) => gen.seen > 0 && gen.seen < gen.total)
            .sort((a, b) => a.total - a.seen - (b.total - b.seen) || a.number - b.number)[0] ?? null
    );
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

// Eight little stars fly out of the ring when a new Pokémon is counted.
function sparkleRing() {
    if (reducedMotion.matches) {
        return;
    }
    const burst = document.createElement("span");
    burst.className = "ringSparkles";
    burst.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 8; index++) {
        const star = document.createElement("span");
        star.textContent = "✦";
        star.style.setProperty("--angle", index * 45 + "deg");
        burst.append(star);
    }
    ringElement.append(burst);
    setTimeout(() => burst.remove(), 900);
}

export function markSeen(dexNumber) {
    if (seen.has(dexNumber) || dexNumber < 1 || dexNumber > MAX_DEX_NUMBER) {
        return;
    }
    seen.add(dexNumber);
    const perDay = readStored(SEEN_DAYS_KEY, {});
    const today = localDay();
    perDay[today] = (perDay[today] ?? 0) + 1;
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
        localStorage.setItem(SEEN_DAYS_KEY, JSON.stringify(perDay));
    } catch {
        // progress just won't persist
    }
    render();
    window.dispatchEvent(new CustomEvent("pokedex:seen", { detail: dexNumber }));
    celebrateIfComplete(dexNumber);
    for (const tile of document.querySelectorAll('.browseTile[data-dex="' + dexNumber + '"]:not(:has(.tileSeen))')) {
        tile.append(seenMark());
    }
    sparkleRing();
    ringElement.classList.remove("bump");
    void ringElement.offsetWidth; // restart the bump animation
    ringElement.classList.add("bump");
}

// --- Region complete celebration ---------------------------------------------------------

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

// The first time all 1,025 are seen: a full-screen parade of every region's starter trio
// marching across under "Pokédex complete!" (a still lineup under reduced motion). Once only.
const FINALE_KEY = "pokedex:finale-shown:v1";
const CRY_BASE = "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/";
const MAX_PARADE_CRIES = 3;
const playingCries = new Set();

function showFinaleParade({ replay = false } = {}) {
    if (!replay) {
        try {
            if (localStorage.getItem(FINALE_KEY)) {
                return;
            }
            localStorage.setItem(FINALE_KEY, "1");
        } catch {
            return; // can't remember it, so don't risk showing it on every visit
        }
    }
    const dialog = document.createElement("dialog");
    dialog.id = "finaleParade";
    dialog.setAttribute("aria-labelledby", "finaleHeading");
    dialog.innerHTML =
        '<h2 id="finaleHeading">🏆 Pokédex complete!</h2>' +
        "<p>All 1,025 Pokémon seen. Every region's partners came to celebrate.</p>" +
        '<div class="paradeTrack" aria-hidden="true"><div class="paradeLine"></div></div>' +
        '<form method="dialog"><button class="btn" id="finaleClose">Hooray!</button></form>';
    const line = dialog.querySelector(".paradeLine");
    // The starters march first; each region's legendary follows, bigger, as the grand finale.
    const marchers = [
        ...Object.values(REGION_STARTERS)
            .flat()
            .map((id) => [id, false]),
        ...Object.values(REGION_MASCOTS).map((id) => [id, true]),
    ];
    for (const [id, legendary] of marchers) {
        const sprite = document.createElement("img");
        sprite.alt = "";
        sprite.width = legendary ? 148 : 104;
        sprite.height = legendary ? 148 : 104;
        sprite.classList.toggle("paradeLegend", legendary);
        sprite.dataset.id = id;
        setSprite(sprite, id);
        // Each marcher stands in its own slot, so a name bubble can pop up above it.
        const marcher = document.createElement("span");
        marcher.className = "paradeMarcher";
        marcher.append(sprite);
        line.append(marcher);
    }
    getSpeciesSlugs()
        .then((slugs) => (knownSlugs = slugs))
        .catch(() => {}); // names for the bubbles; numbers until (or unless) they load
    // A little toy while it's open: tap a marcher and it jumps and calls out its cry. (Pointer
    // only, since the parade is decorative; the dialog's button stays the keyboard path.)
    line.addEventListener("click", (event) => {
        const sprite = event.target.closest("img");
        if (!sprite) {
            return;
        }
        sprite.classList.remove("paradeJump");
        void sprite.offsetWidth; // restart the jump
        sprite.classList.add("paradeJump");
        // "Bulbasaur!" in a speech bubble above it for a moment.
        sprite.parentElement.querySelector(".paradeBubble")?.remove();
        const bubble = document.createElement("span");
        bubble.className = "paradeBubble";
        bubble.textContent = partnerLabel(Number(sprite.dataset.id)) + "!";
        sprite.parentElement.append(bubble);
        setTimeout(() => bubble.remove(), 1400);
        // At most three cries at once, so frantic tapping doesn't build a wall of sound.
        if (playingCries.size >= MAX_PARADE_CRIES) {
            return;
        }
        const cry = new Audio(CRY_BASE + sprite.dataset.id + ".ogg");
        cry.volume = 0.5;
        playingCries.add(cry);
        const done = () => playingCries.delete(cry);
        cry.addEventListener("ended", done);
        cry.addEventListener("error", done);
        cry.play().catch(done); // blocked or offline: the jump alone will do
    });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    if (!reducedMotion.matches) {
        dialog.append(makeConfetti(160, "confetti fullscreen")); // inside, so it shows over the backdrop
    }
}

function celebrateIfComplete(dexNumber) {
    const message = completionMessage(seen, dexNumber);
    if (message?.startsWith("🏆")) {
        showFinaleParade();
    }
    if (message) {
        // A region's toast offers "Show me" to that region in the browse grid.
        const generation = message.startsWith("🏅")
            ? GENERATIONS.find((gen) => dexNumber >= gen.first && dexNumber <= gen.last)
            : null;
        celebrate(message, 90, "", "", generation?.number ?? 0);
    }
}

// The red-and-gold toast at the bottom, with a confetti burst (no confetti under reduced motion).
// Toasts queue up so a region completion and the badge it earns are both shown, one after another.
const toastQueue = [];

// Adds a toast unless it's already queued; at most TOAST_QUEUE_LIMIT wait, so a burst of
// unlocks doesn't keep toasts on screen for ages (the extra ones are dropped).
const TOAST_QUEUE_LIMIT = 3;

export function enqueueToast(queue, toast) {
    if (queue.some((queued) => queued.message === toast.message) || queue.length >= TOAST_QUEUE_LIMIT) {
        return false;
    }
    queue.push(toast);
    return true;
}

let droppedToasts = 0; // over the cap; summed up in one last toast

function celebrate(message, confettiCount, icon = "", badgeLabel = "", region = 0) {
    const duplicate = toastQueue.some((queued) => queued.message === message);
    if (enqueueToast(toastQueue, { message, confettiCount, icon, badgeLabel, region })) {
        if (toastQueue.length === 1) {
            showNextToast();
        }
    } else if (!duplicate) {
        droppedToasts++;
    }
}

export function droppedSummary(count) {
    return "✨ +" + count + " more achievement" + (count === 1 ? "" : "s") + " — see your trainer card";
}

// Opens the trainer card on the badge shelf, scrolled to (and flashing) one badge if given.
function showBadgeOnCard(label) {
    openTrainerCard();
    const item = label && document.querySelector('#trainerCardBadges li[data-badge="' + CSS.escape(label) + '"]');
    (item || document.getElementById("trainerCardBadges")).scrollIntoView({ block: "center" });
    if (item) {
        item.classList.add("spotlight");
        setTimeout(() => item.classList.remove("spotlight"), 2400);
    }
}

// The toast's countdown pauses while it's hovered or focused, so "Show me" can be reached.
const TOAST_DURATION = 4000;
let toastTimer = null;
let toastRemaining = 0;
let toastStarted = 0;

function startToastTimer() {
    toastStarted = Date.now();
    toastTimer = setTimeout(nextToast, toastRemaining);
}

function pauseToastTimer() {
    if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
        toastRemaining = Math.max(500, toastRemaining - (Date.now() - toastStarted));
    }
}

function resumeToastTimer() {
    const toast = document.getElementById("dexToast");
    if (toastTimer === null && toastQueue.length && !toast.matches(":hover, :focus-within")) {
        startToastTimer();
    }
}

const toastElement = document.getElementById("dexToast");
if (toastElement?.addEventListener) {
    toastElement.addEventListener("pointerenter", pauseToastTimer);
    toastElement.addEventListener("focusin", pauseToastTimer);
    toastElement.addEventListener("pointerleave", resumeToastTimer);
    toastElement.addEventListener("focusout", () => setTimeout(resumeToastTimer));
}

function toastShowMe(toast, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toastShowMe";
    button.textContent = "Show me";
    button.addEventListener("click", () => {
        toast.classList.remove("visible");
        // Whatever was still queued becomes one "+N more" toast shortly after, rather than a
        // string of toasts over the page you were just sent to. Restarting the timer here also
        // undoes the hover pause, which no pointerleave would end once the toast is hidden.
        droppedToasts += toastQueue.length - 1;
        toastQueue.splice(1);
        clearTimeout(toastTimer);
        toastRemaining = 1500;
        startToastTimer();
        onClick();
    });
    return button;
}

function showNextToast() {
    const toast = document.getElementById("dexToast");
    const { message, confettiCount, icon, opensCard, badgeLabel, region } = toastQueue[0];
    // Badge toasts lead with the badge itself, large, like an achievement pop-up, and offer
    // a "Show me" button to that badge on the trainer card.
    toast.classList.toggle("withIcon", Boolean(icon));
    if (icon) {
        const badge = document.createElement("span");
        badge.className = "toastIcon";
        badge.textContent = icon;
        const text = document.createElement("span");
        text.className = "toastMessage";
        text.textContent = message;
        toast.replaceChildren(
            badge,
            " ",
            text,
            toastShowMe(toast, () => showBadgeOnCard(badgeLabel)),
        );
    } else if (region) {
        // The browse grid (lists.js) listens for this and opens the region with its banner pulsing.
        const text = document.createElement("span");
        text.className = "toastMessage";
        text.textContent = message;
        const showRegion = () => window.dispatchEvent(new CustomEvent("pokedex:show-region", { detail: region }));
        // The region's starter trio walks across the top of the toast (stands still under
        // reduced motion).
        const trio = document.createElement("span");
        trio.className = "toastParade";
        trio.dataset.region = region; // each region's trio has its own walk (see the CSS)
        trio.setAttribute("aria-hidden", "true");
        for (const id of REGION_STARTERS[region]) {
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.width = 60;
            sprite.height = 60;
            setSprite(sprite, id);
            trio.append(sprite);
        }
        // ...leaving a trail of little footprints along the edge behind it.
        const footprints = document.createElement("span");
        footprints.className = "toastFootprints";
        footprints.setAttribute("aria-hidden", "true");
        toast.replaceChildren(footprints, trio, text, toastShowMe(toast, showRegion));
    } else if (opensCard) {
        // The "+N more" summary is a button straight to the badge shelf.
        const button = document.createElement("button");
        button.type = "button";
        button.className = "toastButton";
        button.textContent = message;
        button.addEventListener("click", () => {
            toast.classList.remove("visible");
            showBadgeOnCard("");
        });
        toast.replaceChildren(button);
    } else {
        toast.textContent = message;
    }
    toast.classList.toggle("withAction", Boolean(region) && !icon);
    toast.classList.toggle("clickable", Boolean(opensCard || icon || region));
    toast.classList.add("visible");
    if (confettiCount && !reducedMotion.matches) {
        const burst = makeConfetti(confettiCount, "confetti fullscreen");
        document.body.append(burst);
        setTimeout(() => burst.remove(), 3000);
    }
    toastRemaining = TOAST_DURATION;
    startToastTimer();
}

function nextToast() {
    toastTimer = null;
    toastQueue.shift();
    if (!toastQueue.length && droppedToasts) {
        toastQueue.push({ message: droppedSummary(droppedToasts), confettiCount: 0, opensCard: true });
        droppedToasts = 0;
    }
    if (toastQueue.length) {
        showNextToast();
    } else {
        document.getElementById("dexToast").classList.remove("visible");
    }
}

// --- Badge unlocks -----------------------------------------------------------------------
// Earned badges are remembered; a newly earned one gets the toast. The very first check only
// records what's already earned, so existing trainers aren't flooded with old badges.
const EARNED_KEY = "pokedex:badges-earned:v1";
const SHELF_SHOWN_KEY = "pokedex:badges-shown:v1"; // earned badge labels the shelf last showed

export function newlyEarned(shelf, known) {
    return shelf.filter((badge) => badge.earned && !known.includes(badge.label));
}

function checkBadges() {
    const shelf = badgeShelf(badgeProgress(completionStats(seen)));
    const known = readStored(EARNED_KEY, null);
    const fresh = newlyEarned(shelf, known ?? []);
    if (!fresh.length && known) {
        return;
    }
    try {
        localStorage.setItem(
            EARNED_KEY,
            JSON.stringify(shelf.filter((badge) => badge.earned).map((badge) => badge.label)),
        );
    } catch {
        return; // can't remember badges, so don't announce them over and over
    }
    if (known) {
        // Each new badge gets its toast; past the queue cap they're summed up in one.
        for (const badge of fresh) {
            celebrate("Badge earned! " + badge.label, 50, badge.icon, badge.label);
        }
    }
    updateNewsDot();
}

// A dot on the ring while a badge has been earned (or tiered up) that the trainer card
// hasn't shown yet.
function updateNewsDot() {
    if (!visits) {
        return; // before the first visit is recorded
    }
    const shown = readStored(SHELF_SHOWN_KEY, []);
    const shelf = badgeShelf(badgeProgress(completionStats(seen)));
    const news = shelf.some((badge) => badge.earned && !shown.includes(badge.label));
    // All tiered badges gold: the header ring and partner turn gold as well.
    document.documentElement.classList.toggle("allGold", allTiersGold(shelf));
    ringElement.classList.toggle("hasNews", news);
    const label = ringElement.getAttribute("aria-label").replace(/ · new badge!$/, "");
    ringElement.setAttribute("aria-label", label + (news ? " · new badge!" : ""));
}

// --- Visits --------------------------------------------------------------------------------
// First visit ("member since") and the run of consecutive days with a visit. Days are local
// calendar dates as "YYYY-MM-DD".

export function localDay(date = new Date()) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
        .map((part) => String(part).padStart(2, "0"))
        .join("-");
}

function dayNumber(day) {
    const [year, month, date] = day.split("-").map(Number);
    return Date.UTC(year, month - 1, date) / 86400000;
}

// Also keeps the last 60 visited days for the calendar.
export function updateVisits(visits, today) {
    if (!visits?.first) {
        return { first: today, last: today, streak: 1, best: 1, days: [today] };
    }
    const gap = dayNumber(today) - dayNumber(visits.last);
    if (gap <= 0) {
        return visits; // already counted today
    }
    const streak = gap === 1 ? visits.streak + 1 : 1;
    const days = [...(visits.days ?? [visits.last]), today].slice(-60);
    return { ...visits, last: today, streak, best: Math.max(visits.best, streak), days };
}

// The last `count` days ending today, oldest first, each marked visited or not.
export function calendarDays(visitedDays, today, count = 28) {
    const visited = new Set(visitedDays);
    const end = dayNumber(today);
    return Array.from({ length: count }, (_, index) => {
        const date = new Date((end - count + 1 + index) * 86400000);
        const day = date.toISOString().slice(0, 10);
        return { day, visited: visited.has(day) };
    });
}

// Heat level 0–4 for a day's count of newly seen Pokémon.
export function heatLevel(newSeen) {
    return newSeen <= 0 ? 0 : newSeen < 3 ? 1 : newSeen < 8 ? 2 : newSeen < 20 ? 3 : 4;
}

function renderCalendar() {
    const today = localDay();
    const perDay = readStored(SEEN_DAYS_KEY, {});
    document.getElementById("trainerCalendar").replaceChildren(
        ...calendarDays(visits.days ?? [visits.last], today).map(({ day, visited }) => {
            const cell = document.createElement("span");
            const newSeen = perDay[day] ?? 0;
            cell.className = (visited ? "visited heat" + heatLevel(newSeen) : "") + (day === today ? " today" : "");
            cell.title = day + (visited ? " · visited, " + newSeen + " new Pokémon" : "");
            return cell;
        }),
    );
    const count = calendarDays(visits.days ?? [visits.last], today).filter((entry) => entry.visited).length;
    document
        .getElementById("trainerCalendar")
        .setAttribute("aria-label", "Visited on " + count + " of the last 28 days");
}

let visits = null;

function recordVisit() {
    visits = updateVisits(readStored(VISITS_KEY, null), localDay());
    try {
        localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
    } catch {
        // the streak just won't persist
    }
    // A week-long streak sets the device LEDs on fire for the day.
    document.documentElement.classList.toggle("onFire", visits.streak >= 7);
}

export const SHINY_TIERS = [5, 15, 50];

export const QUIZ_TIERS = [20, 35, 50];
export const REGION_TIERS = [1, 3, 9];

// "3 / 5 for bronze": progress toward a badge's next tier, or null once gold.
export function tierProgress(value, tiers) {
    const tier = tiers.filter((threshold) => value >= threshold).length;
    if (tier === tiers.length) {
        return null;
    }
    return value + " / " + tiers[tier] + " for " + TIER_NAMES[tier];
}

export function shinyTierProgress(shinies) {
    return tierProgress(shinies, SHINY_TIERS);
}

// Every badge, in shelf order. `progress` picks the number it's measured on.
const BADGES = [
    { icon: "🔥", label: "Week flame: 7-day streak", hint: "Visit 7 days in a row", kind: "streak", need: 7 },
    { icon: "☄️", label: "Month blaze: 30-day streak", hint: "Visit 30 days in a row", kind: "streak", need: 30 },
    {
        icon: "📚",
        label: "Collector: one Pokémon opened 25 times",
        hint: "Open one Pokémon 25 times",
        kind: "collector",
        need: 25,
    },
    {
        icon: "🏆",
        label: "Superfan: one Pokémon opened 50 times",
        hint: "Open one Pokémon 50 times",
        kind: "collector",
        need: 50,
    },
    // Tiered badges: bronze, silver and gold at each threshold in `tiers`.
    {
        icon: "🗺️",
        name: "Region master",
        kind: "regions",
        tiers: REGION_TIERS,
        unit: (n) => (n === 1 ? "a regional Pokédex complete" : n + " regional Pokédexes complete"),
        hintFor: (n) => (n === 1 ? "See every Pokémon of one region" : "Complete " + n + " regions"),
    },
    {
        icon: "✨",
        name: "Shiny hunter",
        kind: "shinies",
        tiers: SHINY_TIERS,
        unit: (n) => n + " shinies caught",
        hintFor: (n) => "Catch " + n + " shinies in the shiny hunt",
    },
    {
        icon: "🧠",
        name: "Quiz whiz",
        kind: "quiz",
        tiers: QUIZ_TIERS,
        unit: (n) => "a " + n + "-answer quiz streak",
        hintFor: (n) => "Get " + n + " quiz answers right in a row",
    },
    { icon: "👥", label: "Team player: a full team of six", hint: "Fill all six team slots", kind: "team", need: 6 },
];

// All badges with whether each is earned, given the best streak and the view counts.
// progress: { streak, views, regions, shinies, quiz, team } (missing values count as 0).
export function badgeShelf({ streak = 0, views: viewCounts = {}, regions = 0, shinies = 0, quiz = 0, team = 0 }) {
    const progress = { streak, collector: Math.max(0, ...Object.values(viewCounts)), regions, shinies, quiz, team };
    return BADGES.map((badge) => {
        if (!badge.tiers) {
            return { ...badge, earned: progress[badge.kind] >= badge.need, tier: 0 };
        }
        const tier = badge.tiers.filter((threshold) => progress[badge.kind] >= threshold).length;
        const reached = badge.tiers[Math.max(0, tier - 1)];
        return {
            icon: badge.icon,
            kind: badge.kind,
            tiered: true,
            tier,
            earned: tier > 0,
            label: badge.name + ": " + badge.unit(reached) + (tier ? " (" + TIER_NAMES[tier - 1] + ")" : ""),
            // what to aim for next: the first tier, or the next one up (none once gold)
            hint: tier < badge.tiers.length ? badge.hintFor(badge.tiers[tier]) : null,
        };
    });
}

const TIER_NAMES = ["bronze", "silver", "gold"];

export function allTiersGold(shelf) {
    const tiered = shelf.filter((badge) => badge.tiered);
    return tiered.length > 0 && tiered.every((badge) => badge.tier === 3);
}

// How many valid entries a saved list holds (junk entries don't count).
function storedCount(key, isValid) {
    const list = readStored(key, []);
    return Array.isArray(list) ? list.filter(isValid).length : 0;
}

// Everything the badges are measured on, from what this browser has saved.
function badgeProgress(stats) {
    return {
        streak: visits.best,
        views,
        regions: stats.generations.filter((gen) => gen.seen === gen.total).length,
        shinies: readStored("pokedex:shiny-hunt:v1", {}).shinies?.length ?? 0,
        quiz: readStored("pokedex:quiz:v1", {}).best ?? 0,
        team: storedCount("pokedex:team:v1", isTeamMember),
    };
}

// Earned badges only, as [icon, label].
export function collectorBadges(viewCounts) {
    return badgeShelf({ views: viewCounts })
        .filter((badge) => badge.kind === "collector" && badge.earned)
        .map((badge) => [badge.icon, badge.label]);
}

export function streakBadges(best) {
    return badgeShelf({ streak: best })
        .filter((badge) => badge.kind === "streak" && badge.earned)
        .map((badge) => [badge.icon, badge.label]);
}

function visitsText() {
    const since = new Date(dayNumber(visits.first) * 86400000).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
    return "Member since " + since + " · 🔥 " + visits.streak + "-day streak (best " + visits.best + ")";
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
        knownSlugs = slugs ?? knownSlugs;
        renderTopViewed();
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
    renderAffection(partner);
}

const CARD_STYLES = ["classic", "holo", "retro"];

function applyCardStyle(style) {
    const value = CARD_STYLES.includes(style) ? style : "classic";
    document.getElementById("trainerStyle").value = value;
    trainerCard.dataset.style = value;
}

function showPartner(id) {
    document.getElementById("dexPartnerBtn").hidden = !id;
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

const partnerInfoCache = new Map();

// The partner's types and the damage multipliers it takes, cached per partner.
async function getPartnerInfo(id) {
    if (!partnerInfoCache.has(id)) {
        const pokemon = await fetchPokemon(String(id));
        const types = pokemon.types.map((entry) => entry.type.name);
        partnerInfoCache.set(id, { types, multipliers: await takenMultipliers(types) });
    }
    return partnerInfoCache.get(id);
}

async function takenMultipliers(types) {
    return damageMultipliers(await Promise.all(types.map((type) => fetchJson(API_BASE + "type/" + type))));
}

// Best multiplier each side's types deal to the other: { hits, takes } from the partner's view.
export function matchupSummary(partnerTypes, partnerTakes, openedTypes, openedTakes) {
    const best = (types, takes) => Math.max(...types.map((type) => takes[type] ?? 1));
    return { hits: best(partnerTypes, openedTakes), takes: best(openedTypes, partnerTakes) };
}

let bubbleTimer = 0;

export async function reactToPokemon(chainIds, openedTypes) {
    const partner = currentPartner();
    if (!partner) {
        return;
    }
    let reaction;
    try {
        reaction = partnerReaction(partner, chainIds, (await getPartnerInfo(partner)).multipliers, openedTypes);
    } catch {
        return; // offline or not cached: no reaction
    }
    // Nothing to feel about this one? At night the partner is just sleepy.
    partnerSay(reaction ?? (document.documentElement.classList.contains("night") ? "😴" : null));
}

// Shows a speech bubble over the header partner (if there is one) for a while.
export function partnerSay(text, duration = 2500) {
    const bubble = document.getElementById("dexPartnerBubble");
    if (!text || partnerElement.hidden) {
        bubble.classList.remove("visible");
        return;
    }
    bubble.textContent = text;
    bubble.classList.add("visible");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("visible"), duration);
}

// --- Views and the partner offer ----------------------------------------------------------
// Opening the same Pokémon five times makes it want to join you as your partner.

let views = readStored(VIEWS_KEY, {});

function countView(dexNumber) {
    views = { ...views, [dexNumber]: (views[dexNumber] ?? 0) + 1 };
    try {
        localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    } catch {
        // counts just won't persist
    }
    return views[dexNumber];
}

// Affection hearts (1–5) grow with how often you open your partner: one more every 3 views.
export function affectionHearts(viewCount) {
    return Math.min(5, 1 + Math.floor((viewCount ?? 0) / 3));
}

function renderAffection(partner) {
    const element = document.getElementById("trainerAffection");
    element.hidden = !partner;
    if (!partner) {
        return;
    }
    const hearts = affectionHearts(views[partner]);
    // Hearts earned since the card last showed this partner pop in.
    const shown = readStored(HEARTS_SHOWN_KEY, {});
    const before = shown.partner === partner ? shown.hearts : hearts;
    element.replaceChildren(
        ...Array.from({ length: 5 }, (_, index) => {
            const heart = document.createElement("span");
            heart.setAttribute("aria-hidden", "true");
            heart.textContent = index < hearts ? "♥" : "♡";
            if (index >= before && index < hearts) {
                heart.className = "heartPop";
                heart.style.animationDelay = 0.4 + (index - before) * 0.25 + "s";
            }
            return heart;
        }),
    );
    try {
        localStorage.setItem(HEARTS_SHOWN_KEY, JSON.stringify({ partner, hearts }));
    } catch {
        // the pop may just repeat
    }
    element.setAttribute("aria-label", "Affection " + hearts + " of 5");
    element.title = "How do I earn more hearts?";
    document.getElementById("trainerHeartHint").textContent = "💕 " + heartHint(views[partner]);
}

// What it takes to earn the next heart (a heart per 3 views of the partner).
export function heartHint(viewCount = 0) {
    const hearts = affectionHearts(viewCount);
    if (hearts === 5) {
        return "Max affection: your partner adores you!";
    }
    const more = hearts * 3 - viewCount;
    return "Open your partner " + more + " more time" + (more === 1 ? "" : "s") + " for the next heart.";
}

let knownSlugs = null; // species names, once the list has loaded

function partnerLabel(id) {
    const slug = knownSlugs?.get(id);
    return slug ? speciesDisplayName(slug) : formatDexNumber(id);
}

// The most-opened Pokémon as [dexNumber, views], most first (ties: lower number first).
export function topViewed(viewCounts, count = 5) {
    return Object.entries(viewCounts)
        .map(([id, views]) => [Number(id), views])
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, count);
}

function renderTopViewed() {
    const top = topViewed(views);
    document.getElementById("trainerTopHeading").hidden = top.length === 0;
    document.getElementById("trainerTop").replaceChildren(
        ...top.map(([id, count]) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            const label = partnerLabel(id);
            button.setAttribute("aria-label", label + ", opened " + count + " times");
            button.title = label;
            const sprite = document.createElement("img");
            sprite.alt = "";
            sprite.width = 56;
            sprite.height = 56;
            setSprite(sprite, id);
            const badge = document.createElement("span");
            badge.textContent = "×" + count;
            badge.setAttribute("aria-hidden", "true");
            button.append(sprite, badge);
            button.addEventListener("click", () => {
                trainerCard.close();
                openPokemon(id);
            });
            item.append(button);
            return item;
        }),
    );
}

// Ask on the fifth view; after a "no thanks", ask once more 20 views later.
export function shouldOfferPartner(viewCount, dexNumber, partner, declinedAt = null) {
    if (dexNumber === partner) {
        return false;
    }
    return declinedAt === null ? viewCount === PARTNER_OFFER_VIEWS : viewCount === declinedAt + 20;
}

// Called for every Pokémon opened (with its display name).
let opened = { name: "", types: [] }; // the Pokémon on the card, for the cameo matchup

export function notePokemonView(dexNumber, name, types = []) {
    opened = { name, types };
    document.getElementById("cameoMatchup").classList.remove("visible");
    const offer = document.getElementById("partnerOffer");
    const count = countView(dexNumber);
    checkBadges();
    updateDevotion(dexNumber);
    const declinedAt = readStored(DECLINED_KEY, {})[dexNumber] ?? null;
    offer.hidden = !shouldOfferPartner(count, dexNumber, currentPartner(), declinedAt);
    if (!offer.hidden) {
        offer.dataset.id = dexNumber;
        document.getElementById("partnerOfferText").textContent =
            "💕 " + name + " seems to like you! Make it your partner?";
    }
}

// At full affection the partner glows in the header and pops into the corner of other
// Pokémon's artwork as a little cameo.
function updateDevotion(openedDexNumber) {
    const partner = currentPartner();
    const devoted = Boolean(partner) && affectionHearts(views[partner]) === 5;
    partnerElement.classList.toggle("devoted", devoted);
    const cameo = document.getElementById("partnerCameo");
    const cameoButton = document.getElementById("partnerCameoBtn");
    cameoButton.hidden = !devoted || openedDexNumber === partner;
    if (!cameoButton.hidden && cameo.dataset.id !== String(partner)) {
        cameo.dataset.id = partner;
        setSprite(cameo, partner);
    }
}

// Who comes out ahead: "win" (partner hits harder than it takes), "lose", or "even".
export function matchupEdge(hits, takes) {
    return hits > takes ? "win" : hits < takes ? "lose" : "even";
}

function flashVs(edge) {
    const vs = document.getElementById("cameoVs");
    vs.className = "";
    void vs.offsetWidth; // restart the animation
    vs.className = "flash " + edge;
}

// Clicking the cameo: the partner cheers and sizes up the Pokémon on the card.
let matchupTimer = 0;

async function cheerPartner() {
    const partner = currentPartner();
    const cameo = document.getElementById("partnerCameo");
    cameo.classList.remove("cheer");
    void cameo.offsetWidth; // restart the animation
    cameo.classList.add("cheer");
    partnerSay("🎉");
    const pill = document.getElementById("cameoMatchup");
    knownSlugs ??= await getSpeciesSlugs().catch(() => null);
    try {
        const info = await getPartnerInfo(partner);
        const { hits, takes } = matchupSummary(
            info.types,
            info.multipliers,
            opened.types,
            await takenMultipliers(opened.types),
        );
        flashVs(matchupEdge(hits, takes));
        pill.textContent =
            partnerLabel(partner) +
            " vs " +
            opened.name +
            ": hits " +
            formatMultiplier(hits) +
            "×, takes " +
            formatMultiplier(takes) +
            "×";
    } catch {
        pill.textContent = partnerLabel(partner) + " is cheering you on!";
    }
    pill.classList.add("visible");
    clearTimeout(matchupTimer);
    matchupTimer = setTimeout(() => pill.classList.remove("visible"), 5000);
}

function acceptPartnerOffer() {
    const offer = document.getElementById("partnerOffer");
    saveTrainer({ partner: Number(offer.dataset.id) });
    offer.hidden = true;
    hopPartner();
    partnerSay("❤️");
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

// Numbers on the card roll up from 0 as it opens (instant under reduced motion); screen readers
// get the final text straight away. `format` turns a number into the line to show.
function countUp(element, target, format, delay = 0) {
    const final = format(target);
    if (reducedMotion.matches || !target) {
        element.textContent = final;
        return;
    }
    const shown = document.createElement("span");
    shown.setAttribute("aria-hidden", "true");
    shown.textContent = format(0);
    const spoken = document.createElement("span");
    spoken.className = "visuallyHidden";
    spoken.textContent = final;
    element.replaceChildren(shown, spoken);
    const start = performance.now() + delay;
    const step = (now) => {
        const progress = Math.max(0, Math.min(1, (now - start) / 900));
        shown.textContent = format(Math.round(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            element.textContent = final;
        }
    };
    requestAnimationFrame(step);
}

// The six stat tiles: [icon, label, value].
function trainerFacts(stats) {
    const hunt = readStored("pokedex:shiny-hunt:v1", {});
    return [
        ["✨", "Shinies caught", hunt.shinies?.length ?? 0],
        ["🌿", "Wild encounters", hunt.encounters ?? 0],
        ["❓", "Quiz best streak", readStored("pokedex:quiz:v1", {}).best ?? 0],
        ["⭐", "Favorites", storedCount("pokedex:favorites:v1", isStoredEntry)],
        ["👥", "Team members", storedCount("pokedex:team:v1", isTeamMember)],
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
    // Phones can hand the image straight to another app; everywhere else it downloads.
    const file = new File([blob], "trainer-card.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: "My trainer card" });
            return;
        } catch (error) {
            if (error.name === "AbortError") {
                return; // share sheet dismissed
            }
        }
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "trainer-card.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    document.getElementById("trainerShareStatus").textContent = "Image saved!";
}

function renderTrainerCard() {
    renderTrainerProfile();
    checkBadges();
    document.getElementById("trainerShareStatus").textContent = "";
    const stats = completionStats(seen);
    countUp(document.getElementById("trainerCardSeen"), stats.seen, (seen) => seenText({ ...stats, seen }));
    // A finished National Dex can watch its parade again from the card.
    document.getElementById("replayParadeBtn").hidden = stats.seen < stats.total;
    document.getElementById("trainerCardVisits").textContent = visitsText();
    renderCalendar();
    const shelf = badgeShelf(badgeProgress(stats));
    // Badges earned or tiered up since the shelf was last shown get a one-off spin.
    const shownBefore = readStored(SHELF_SHOWN_KEY, null);
    const earnedLabels = shelf.filter((badge) => badge.earned).map((badge) => badge.label);
    try {
        localStorage.setItem(SHELF_SHOWN_KEY, JSON.stringify(earnedLabels));
    } catch {
        // the flourish may just repeat
    }
    updateNewsDot(); // seen now: clear the ring's dot and label
    document.getElementById("trainerCardBadges").replaceChildren(
        ...shelf.map((badge) => {
            const item = document.createElement("li");
            item.className = badge.kind + (badge.earned ? "" : " locked") + (badge.tier ? " tier" + badge.tier : "");
            if (badge.earned && shownBefore && !shownBefore.includes(badge.label)) {
                item.classList.add("fresh");
            }
            item.dataset.badge = badge.label;
            item.title = badge.earned ? badge.label : "Locked: " + badge.hint;
            item.innerHTML = '<span aria-hidden="true"></span><span class="visuallyHidden"></span>';
            item.children[0].textContent = badge.earned ? badge.icon : "🔒";
            item.children[1].textContent = item.title;
            return item;
        }),
    );
    // Hall of fame: gold-tier badges get a banner at the top of the card.
    const gold = shelf.filter((badge) => badge.tier === 3);
    // Every tiered badge at gold: the whole card gets a gold-foil border, whatever its style.
    trainerCard.classList.toggle("allGold", allTiersGold(shelf));
    const hall = document.getElementById("trainerHallOfFame");
    hall.hidden = gold.length === 0;
    hall.replaceChildren(
        "🏛️ Hall of fame: ",
        ...gold.flatMap((badge, index) => {
            const icon = document.createElement("span");
            icon.className = "hallIcon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = badge.icon;
            return [index ? " · " : "", icon, " " + badge.label.split(":")[0]];
        }),
    );
    // Next goal: the first locked badge, else the next tier of a tiered one.
    const next = shelf.find((badge) => !badge.earned) ?? shelf.find((badge) => badge.tier && badge.hint);
    document.getElementById("trainerNextBadge").textContent = next
        ? "Next badge: " + next.hint
        : "Every badge earned — legendary!";
    document.getElementById("trainerCardStats").replaceChildren(
        ...trainerFacts(stats).map(([icon, label, value], index) => {
            const item = document.createElement("li");
            item.innerHTML = '<span aria-hidden="true"></span><strong></strong><small></small>';
            item.children[0].textContent = icon;
            // The tiles roll up one after another, 80 ms apart, after the seen count starts.
            countUp(item.children[1], value, String, 150 + 80 * index);
            item.children[2].textContent = label;
            return item;
        }),
    );
    document.getElementById("trainerCardRegions").replaceChildren(
        ...stats.generations.map(({ number, seen: count, total }, index) => {
            const generation = GENERATIONS.find((gen) => gen.number === number);
            const item = document.createElement("li");
            item.className = "region" + number + (count === total ? " complete" : "");
            item.style.setProperty("--fill-order", index); // the bars fill one after another
            item.innerHTML =
                '<span class="trainerRegionName"></span><span class="regionProgressBar"><span></span></span><span class="trainerRegionCount"></span>';
            item.children[0].textContent = generation.region;
            item.querySelector(".regionProgressBar span").style.width = (100 * count) / total + "%";
            countUp(item.children[2], count, (shown) => shown + "/" + total, 300 + 70 * index);
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

let openPokemon = () => {};

export function openTrainerCard() {
    renderTrainerCard();
    trainerCard.showModal();
}

export function initProgress({ showPokemon }) {
    openPokemon = showPokemon;
    document.getElementById("partnerOfferYes").addEventListener("click", acceptPartnerOffer);
    document.getElementById("trainerAffection").addEventListener("click", (event) => {
        const hint = document.getElementById("trainerHeartHint");
        hint.hidden = !hint.hidden;
        event.currentTarget.setAttribute("aria-expanded", String(!hint.hidden));
    });
    document.getElementById("partnerCameoBtn").addEventListener("click", cheerPartner);
    document.getElementById("replayParadeBtn").addEventListener("click", () => {
        trainerCard.close();
        showFinaleParade({ replay: true });
    });
    document.getElementById("partnerOfferNo").addEventListener("click", () => {
        const offer = document.getElementById("partnerOffer");
        offer.hidden = true;
        const id = Number(offer.dataset.id);
        try {
            localStorage.setItem(
                DECLINED_KEY,
                JSON.stringify({ ...readStored(DECLINED_KEY, {}), [id]: views[id] ?? PARTNER_OFFER_VIEWS }),
            );
        } catch {
            // it may just ask again sooner
        }
    });
    recordVisit();
    checkBadges();
    document.getElementById("dexPartnerBtn").addEventListener("click", () => {
        const partner = currentPartner();
        if (partner) {
            showPokemon(partner);
        }
    });
    showPartner(currentPartner());
    document.getElementById("trainerShareBtn").addEventListener("click", shareTrainerCard);
    document.getElementById("trainerImageBtn").addEventListener("click", saveTrainerCardImage);
    ringElement.addEventListener("click", openTrainerCard);
    // The "badge: x / y for tier" lines open the card at the badge shelf.
    for (const id of ["regionTier", "quizTier", "huntTier"]) {
        document.getElementById(id).addEventListener("click", () => {
            openTrainerCard();
            document.getElementById("trainerCardBadges").scrollIntoView({ block: "center" });
        });
    }
    document.getElementById("trainerCardClose").addEventListener("click", () => trainerCard.close());
    // The jump link for the section at the top of the card is marked current as it scrolls.
    const jumpButtons = [...document.querySelectorAll(".trainerJump button")];
    const markCurrentSection = () => {
        const line = trainerCard.scrollTop + trainerCard.querySelector(".trainerCardTop").offsetHeight + 24;
        const atBottom = trainerCard.scrollTop + trainerCard.clientHeight >= trainerCard.scrollHeight - 2;
        const current = atBottom
            ? jumpButtons.at(-1) // the last section can't scroll up to the bar
            : (jumpButtons
                  .filter((button) => document.getElementById(button.dataset.target).offsetTop <= line)
                  .at(-1) ?? jumpButtons[0]);
        for (const button of jumpButtons) {
            if (button === current) {
                button.setAttribute("aria-current", "true");
            } else {
                button.removeAttribute("aria-current");
            }
        }
    };
    trainerCard.addEventListener("scroll", markCurrentSection, { passive: true });
    trainerCard.addEventListener("toggle", markCurrentSection);
    // Jump links in the sticky title bar scroll the card to a section (below the bar).
    for (const button of document.querySelectorAll(".trainerJump button")) {
        button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.target);
            const bar = trainerCard.querySelector(".trainerCardTop").offsetHeight;
            trainerCard.scrollTo({
                top: target.offsetTop - bar - 8,
                behavior: reducedMotion.matches ? "auto" : "smooth",
            });
        });
    }
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
