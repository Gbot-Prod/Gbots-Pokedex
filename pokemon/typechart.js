// Interactive 18×18 type chart: rows are attacking types, columns defending types.
// Hovering or focusing a cell highlights its row and column.
import { API_BASE, fetchJson } from "./api.js";
import { TYPE_ICONS, formatMultiplier, formatName } from "./utils.js";

const section = document.getElementById("typeChartSection");
const showButton = document.getElementById("typeChartBtn");
const chartElement = document.getElementById("typeChart");

// multipliers[attacker][defender] from each type's damage_relations.double/half/no_damage_to.
export function typeChartMatrix(typeDataList) {
    const types = typeDataList.map((type) => type.name);
    const matrix = {};
    for (const { name, damage_relations: relations } of typeDataList) {
        matrix[name] = Object.fromEntries(types.map((defender) => [defender, 1]));
        for (const { name: defender } of relations.double_damage_to) {
            matrix[name][defender] = 2;
        }
        for (const { name: defender } of relations.half_damage_to) {
            matrix[name][defender] = 0.5;
        }
        for (const { name: defender } of relations.no_damage_to) {
            matrix[name][defender] = 0;
        }
    }
    return matrix;
}

function typeIcon(type) {
    const icon = document.createElement("img");
    icon.src = "assets/" + TYPE_ICONS[type];
    icon.alt = formatName(type);
    icon.title = formatName(type);
    icon.width = 24;
    icon.height = 24;
    return icon;
}

function highlight(table, row, column) {
    for (const cell of table.querySelectorAll(".rowHighlight, .columnHighlight")) {
        cell.classList.remove("rowHighlight", "columnHighlight");
    }
    if (row < 0) {
        return;
    }
    for (const cell of table.rows[row].cells) {
        cell.classList.add("rowHighlight");
    }
    for (const tableRow of table.rows) {
        tableRow.cells[column]?.classList.add("columnHighlight");
    }
}

let renderPromise = null;

function renderChartOnce() {
    renderPromise ??= renderChart().finally(() => {
        if (!chartElement.querySelector("table")) {
            renderPromise = null; // failed; allow a retry
        }
    });
    return renderPromise;
}

async function renderChart() {
    chartElement.textContent = "Loading type chart…";
    const types = Object.keys(TYPE_ICONS);
    let matrix;
    try {
        matrix = typeChartMatrix(await Promise.all(types.map((type) => fetchJson(API_BASE + "type/" + type))));
    } catch {
        chartElement.textContent = "Couldn't load the type chart.";
        return;
    }

    const table = document.createElement("table");
    table.className = "typeChartTable";
    const caption = document.createElement("caption");
    caption.textContent = "Attacking type (rows) vs defending type (columns): damage multiplier";
    table.append(caption);

    const head = table.createTHead().insertRow();
    const corner = document.createElement("th");
    corner.textContent = "Atk \\ Def";
    head.append(corner);
    for (const defender of types) {
        const th = document.createElement("th");
        th.scope = "col";
        th.append(typeIcon(defender));
        head.append(th);
    }

    const body = table.createTBody();
    for (const attacker of types) {
        const row = body.insertRow();
        const th = document.createElement("th");
        th.scope = "row";
        th.append(typeIcon(attacker));
        row.append(th);
        for (const defender of types) {
            const multiplier = matrix[attacker][defender];
            const cell = row.insertCell();
            cell.tabIndex = -1;
            cell.className = "x" + String(multiplier).replace(".", "");
            cell.textContent = multiplier === 1 ? "" : formatMultiplier(multiplier);
            cell.title =
                formatName(attacker) + " → " + formatName(defender) + ": " + formatMultiplier(multiplier) + "×";
        }
    }

    table.addEventListener("mouseover", (event) => {
        const cell = event.target.closest("td, th");
        if (cell) {
            highlight(table, cell.parentElement.rowIndex, cell.cellIndex);
        }
    });
    table.addEventListener("mouseleave", () => highlight(table, -1, -1));

    // Keyboard: cells form a grid; arrow keys move between them and focus highlights too.
    table.tBodies[0].rows[0].cells[1].tabIndex = 0;
    table.addEventListener("focusin", (event) => {
        const cell = event.target.closest("td");
        if (cell) {
            highlight(table, cell.parentElement.rowIndex, cell.cellIndex);
        }
    });
    table.addEventListener("keydown", (event) => {
        const cell = event.target.closest("td");
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (!cell || !moves[event.key]) {
            return;
        }
        event.preventDefault();
        const [rowStep, columnStep] = moves[event.key];
        const rowIndex = Math.min(Math.max(cell.parentElement.rowIndex + rowStep, 1), types.length);
        const columnIndex = Math.min(Math.max(cell.cellIndex + columnStep, 1), types.length);
        const target = table.rows[rowIndex].cells[columnIndex];
        cell.tabIndex = -1;
        target.tabIndex = 0;
        target.focus();
    });
    chartElement.replaceChildren(table);
}

// Opens the chart with one type's row and column highlighted (its attacks and its weaknesses).
export async function showTypeInChart(type) {
    if (showButton.getAttribute("aria-expanded") !== "true") {
        showButton.click();
    }
    await renderChartOnce();
    const table = chartElement.querySelector("table");
    const index = Object.keys(TYPE_ICONS).indexOf(type) + 1;
    if (!table || index < 1) {
        return;
    }
    highlight(table, index, index);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    const cell = table.rows[index].cells[index];
    for (const other of table.querySelectorAll("td[tabindex='0']")) {
        other.tabIndex = -1;
    }
    cell.tabIndex = 0;
    cell.focus({ preventScroll: true });
}

export function initTypeChart() {
    section.hidden = false;
    showButton.addEventListener("click", () => {
        const expanded = showButton.getAttribute("aria-expanded") === "true";
        showButton.setAttribute("aria-expanded", String(!expanded));
        showButton.textContent = expanded ? "Show type chart" : "Hide type chart";
        chartElement.hidden = expanded;
        if (!expanded && !chartElement.querySelector("table")) {
            renderChartOnce();
        }
    });
}
