// "Who's that Pokémon?": guess a Pokémon from its silhouette, with four choices.
import { SPRITE_BASE, getAllPokemonEntries, getSpeciesSlugs } from "./api.js";
import { MAX_DEX_NUMBER, entryDisplayName } from "./utils.js";

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
    const choices = pickRandom(entries, 4);
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

export function initQuiz(options) {
    showPokemon = options.showPokemon;
    loadScore();
    renderScore();
    startButton.addEventListener("click", () => {
        startButton.hidden = true;
        nextRound();
    });
    nextButton.addEventListener("click", nextRound);
    section.hidden = false;
}
