// "Who's that Pokémon?": guess a Pokémon from its silhouette, with four choices.
import { SPRITE_BASE, getAllPokemonEntries, getSpeciesSlugs } from "./api.js";
import { GENERATIONS, MAX_DEX_NUMBER, entryDisplayName } from "./utils.js";

const SCORE_KEY = "pokedex:quiz:v1";
const ARTWORK_BASE = SPRITE_BASE + "other/official-artwork/";

const section = document.getElementById("quizSection");
const startButton = document.getElementById("quizStartBtn");
const stage = document.getElementById("quizStage");
const image = document.getElementById("quizImage");
const choicesElement = document.getElementById("quizChoices");
const resultElement = document.getElementById("quizResult");
const nextButton = document.getElementById("quizNextBtn");
const scoreElement = document.getElementById("quizScore");
const generationSelect = document.getElementById("quizGeneration");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let candidates = null; // National Dex entries with display names
let score = { correct: 0, played: 0, streak: 0, best: 0 };
let showPokemon = () => {};

function loadScore() {
    try {
        score = { ...score, ...JSON.parse(localStorage.getItem(SCORE_KEY)) };
    } catch {
        // keep the zeroed score
    }
}

function saveScore() {
    try {
        localStorage.setItem(SCORE_KEY, JSON.stringify(score));
    } catch {
        // score just won't persist
    }
}

function renderScore() {
    scoreElement.textContent =
        "Score " + score.correct + "/" + score.played + " · Streak " + score.streak + " · Best " + score.best;
}

// n distinct random items from a list.
export function pickRandom(list, n, random = Math.random) {
    const pool = [...list];
    const picked = [];
    while (picked.length < n && pool.length) {
        picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    return picked;
}

async function getCandidates() {
    if (!candidates) {
        const [entries, slugs] = await Promise.all([getAllPokemonEntries(), getSpeciesSlugs().catch(() => null)]);
        candidates = entries
            .filter((entry) => entry.id <= MAX_DEX_NUMBER)
            .map((entry) => ({ ...entry, label: entryDisplayName(entry, slugs) }));
    }
    return candidates;
}

async function nextRound() {
    let entries;
    try {
        entries = await getCandidates();
    } catch {
        resultElement.textContent = "Couldn't load Pokémon for the quiz. Please try again.";
        return;
    }
    // Optionally limit the round to one generation (choices too, so it stays fair).
    const generation = GENERATIONS.find((gen) => String(gen.number) === generationSelect.value);
    const pool = generation
        ? entries.filter((entry) => entry.id >= generation.first && entry.id <= generation.last)
        : entries;
    const choices = pickRandom(pool, 4);
    const answer = choices[Math.floor(Math.random() * choices.length)];

    stage.hidden = false;
    stage.classList.remove("revealed");
    resultElement.textContent = "";
    nextButton.hidden = true;
    image.alt = "Silhouette of a mystery Pokémon";
    image.src = ARTWORK_BASE + answer.id + ".png";

    choicesElement.replaceChildren(
        ...choices.map((choice) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "quizChoice";
            button.textContent = choice.label;
            button.addEventListener("click", () => answerRound(choice, answer, button));
            return button;
        }),
    );
    choicesElement.querySelector("button").focus({ preventScroll: true });
}

function answerRound(choice, answer, chosenButton) {
    const correct = choice.id === answer.id;
    score.played++;
    if (correct) {
        score.correct++;
        score.streak++;
        if (score.streak > score.best && score.streak >= 3) {
            celebrate(); // new best streak
        }
        score.best = Math.max(score.best, score.streak);
    } else {
        score.streak = 0;
    }
    saveScore();
    renderScore();

    stage.classList.add("revealed");
    image.alt = answer.label + " artwork";
    for (const button of choicesElement.querySelectorAll("button")) {
        button.disabled = true;
        if (button.textContent === answer.label) {
            button.classList.add("correct");
        }
    }
    if (!correct) {
        chosenButton.classList.add("wrong");
    }

    resultElement.replaceChildren(
        (correct ? "Correct! It's " : "Not quite — it's ") + answer.label + ". ",
        Object.assign(document.createElement("button"), {
            type: "button",
            className: "linkBtn",
            textContent: "View in Pokédex",
            onclick: () => {
                showPokemon(answer.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
            },
        }),
    );
    nextButton.hidden = false;
    nextButton.focus({ preventScroll: true });
}

// A short burst of confetti over the quiz art (skipped when reduced motion is preferred).
function celebrate() {
    if (reducedMotion.matches) {
        return;
    }
    const colors = ["#ffd447", "#ff6b6b", "#4dabf7", "#51cf66", "#cc5de8"];
    const burst = document.createElement("div");
    burst.className = "confetti";
    burst.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 40; index++) {
        const piece = document.createElement("span");
        piece.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
        piece.style.setProperty("--drift", ((Math.random() - 0.5) * 120).toFixed(0) + "px");
        piece.style.setProperty("--delay", (Math.random() * 0.3).toFixed(2) + "s");
        piece.style.setProperty("--spin", (Math.random() * 720 - 360).toFixed(0) + "deg");
        piece.style.backgroundColor = colors[index % colors.length];
        burst.append(piece);
    }
    stage.append(burst);
    setTimeout(() => burst.remove(), 2200);
}

export function initQuiz(options) {
    showPokemon = options.showPokemon;
    loadScore();
    renderScore();
    startButton.addEventListener("click", () => {
        startButton.hidden = true;
        nextRound();
    });
    nextButton.addEventListener("click", nextRound);
    for (const generation of GENERATIONS) {
        const option = document.createElement("option");
        option.value = generation.number;
        option.textContent = "Gen " + generation.number + " (" + generation.region + ")";
        generationSelect.append(option);
    }
    // Switching generation mid-game starts a fresh round from that generation.
    generationSelect.addEventListener("change", () => {
        if (!stage.hidden) {
            nextRound();
        }
    });
    section.hidden = false;
}
