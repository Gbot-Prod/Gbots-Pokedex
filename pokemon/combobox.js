// Accessible autocomplete for Pokémon name inputs (ARIA 1.2 combobox pattern):
// typing shows up to 8 matches with sprites and official names; ↑/↓ move through them,
// Enter picks the highlighted one, Escape closes the list.
import { SPRITE_BASE, getAllPokemonEntries, getSpeciesSlugs } from "./api.js";
import { entryDisplayName, formatDexNumber, normalizeQuery } from "./utils.js";

const MAX_OPTIONS = 8;
let comboboxCount = 0;

// Matches for a query among { name, id, label } entries: Pokédex numbers match by id;
// names match label prefixes first, then words starting with the query, then anywhere.
export function matchEntries(entries, rawQuery, limit = MAX_OPTIONS) {
    const query = normalizeQuery(rawQuery);
    if (!query) {
        return [];
    }
    if (/^\d+$/.test(query)) {
        return entries.filter((entry) => String(entry.id).startsWith(query)).slice(0, limit);
    }
    const scored = [];
    for (const entry of entries) {
        const key = normalizeQuery(entry.label);
        let score;
        if (key.startsWith(query)) {
            score = 0;
        } else if (key.includes("-" + query)) {
            score = 1;
        } else if (key.includes(query)) {
            score = 2;
        } else {
            continue;
        }
        scored.push({ entry, score });
    }
    scored.sort((a, b) => a.score - b.score || a.entry.id - b.entry.id);
    return scored.slice(0, limit).map(({ entry }) => entry);
}

let labelledEntriesPromise = null;

// Every Pokémon with its display label, loaded once and shared by all comboboxes.
function getLabelledEntries() {
    if (!labelledEntriesPromise) {
        labelledEntriesPromise = Promise.all([getAllPokemonEntries(), getSpeciesSlugs().catch(() => null)])
            .then(([entries, slugs]) => entries.map((entry) => ({ ...entry, label: entryDisplayName(entry, slugs) })))
            .catch((error) => {
                labelledEntriesPromise = null; // allow a retry
                throw error;
            });
    }
    return labelledEntriesPromise;
}

// onSelect(entry) runs after the input is filled with the chosen Pokémon's name.
export function attachCombobox(input, { onSelect } = {}) {
    const listId = "combobox-list-" + ++comboboxCount;
    const list = document.createElement("ul");
    list.id = listId;
    list.className = "comboboxList";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Suggestions");
    list.hidden = true;
    // The list is positioned under the input, so both live in a relative wrapper.
    if (!input.parentElement.classList.contains("comboboxWrap")) {
        const wrap = document.createElement("div");
        wrap.className = "comboboxWrap";
        input.replaceWith(wrap);
        wrap.append(input);
    }
    input.after(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.removeAttribute("list");

    let options = [];
    let activeIndex = -1;
    let latestQuery = 0;

    function close() {
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        activeIndex = -1;
    }

    function setActive(index) {
        activeIndex = index;
        [...list.children].forEach((item, itemIndex) => {
            item.setAttribute("aria-selected", String(itemIndex === index));
        });
        if (index >= 0) {
            input.setAttribute("aria-activedescendant", list.children[index].id);
            list.children[index].scrollIntoView({ block: "nearest" });
        } else {
            input.removeAttribute("aria-activedescendant");
        }
    }

    function choose(entry) {
        input.value = entry.label;
        close();
        onSelect?.(entry);
    }

    async function update() {
        const queryId = ++latestQuery;
        let entries;
        try {
            entries = await getLabelledEntries();
        } catch {
            return; // no suggestions without the list; plain search still works
        }
        if (queryId !== latestQuery) {
            return;
        }
        options = matchEntries(entries, input.value);
        list.replaceChildren(
            ...options.map((entry, index) => {
                const item = document.createElement("li");
                item.id = listId + "-" + index;
                item.className = "comboboxOption";
                item.setAttribute("role", "option");
                item.setAttribute("aria-selected", "false");

                const sprite = document.createElement("img");
                sprite.src = SPRITE_BASE + entry.id + ".png";
                sprite.alt = "";
                sprite.width = 40;
                sprite.height = 40;
                sprite.loading = "lazy";

                const name = document.createElement("span");
                name.textContent = entry.label;
                const number = document.createElement("small");
                number.textContent = formatDexNumber(entry.id);

                item.append(sprite, name, number);
                // mousedown (not click) so the input doesn't lose focus and close the list first
                item.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    choose(entry);
                });
                return item;
            }),
        );
        activeIndex = -1;
        if (options.length && document.activeElement === input) {
            list.hidden = false;
            input.setAttribute("aria-expanded", "true");
        } else {
            close();
        }
    }

    input.addEventListener("input", update);
    input.addEventListener("blur", close);
    input.addEventListener("keydown", (event) => {
        if (list.hidden) {
            if (event.key === "ArrowDown" && input.value) {
                update();
                event.preventDefault();
            }
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((activeIndex + 1) % options.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(activeIndex <= 0 ? options.length - 1 : activeIndex - 1);
        } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault(); // don't also submit the typed text
            choose(options[activeIndex]);
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    });
}
