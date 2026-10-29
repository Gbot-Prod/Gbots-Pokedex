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
    chartElement.replaceChildren(table);
}

export function initTypeChart() {
    section.hidden = false;
    showButton.addEventListener("click", () => {
        const expanded = showButton.getAttribute("aria-expanded") === "true";
        showButton.setAttribute("aria-expanded", String(!expanded));
        showButton.textContent = expanded ? "Show type chart" : "Hide type chart";
        chartElement.hidden = expanded;
        if (!expanded && !chartElement.querySelector("table")) {
            renderChart();
        }
    });
}
