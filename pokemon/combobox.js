// Accessible autocomplete for Pokémon name inputs (ARIA 1.2 combobox pattern):
// typing shows up to 8 matches with sprites and official names; ↑/↓ move through them,
// Enter picks the highlighted one, Escape closes the list.
import { getAllPokemonEntries, getSpeciesSlugs, setSprite } from "./api.js";
import { entryDisplayName, entrySpecies, formatDexNumber, normalizeQuery } from "./utils.js";

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

// Splits a label into text nodes with the first case-insensitive match of the query
// wrapped in <mark>, e.g. ("Charizard", "char") -> [<mark>Char</mark>, "izard"].
export function highlightMatch(label, query) {
    const index = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (index === -1) {
        return [label];
    }
    const mark = document.createElement("mark");
    mark.textContent = label.slice(index, index + query.length);
    return [label.slice(0, index), mark, label.slice(index + query.length)].filter((part) => part !== "");
}

let labelledEntriesPromise = null;

// Every Pokémon with its display label, loaded once and shared by all comboboxes.
function getLabelledEntries() {
    if (!labelledEntriesPromise) {
        labelledEntriesPromise = Promise.all([getAllPokemonEntries(), getSpeciesSlugs().catch(() => null)])
            .then(([entries, slugs]) =>
                entries.map((entry) => ({
                    ...entry,
                    label: entryDisplayName(entry, slugs),
                    // forms show their species' number, not their internal id (10034)
                    dexNumber: entrySpecies(entry, slugs)?.id ?? entry.id,
                })),
            )
            .catch((error) => {
                labelledEntriesPromise = null; // allow a retry
                throw error;
            });
    }
    return labelledEntriesPromise;
}

// onSelect(entry) runs after the input is filled with the chosen Pokémon's name.
// getEmptySuggestions() returns [{ id }] to offer while the input is empty (e.g. recently viewed);
// onRemoveSuggestion(id), if given, lets Delete remove the highlighted one of those.
export function attachCombobox(input, { onSelect, getEmptySuggestions, onRemoveSuggestion } = {}) {
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
    // Announces removals for screen reader users (the list itself just changes).
    const status = document.createElement("span");
    status.className = "visuallyHidden";
    status.setAttribute("role", "status");
    list.after(status);

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
        if (input.value.trim()) {
            options = matchEntries(entries, input.value);
            list.setAttribute("aria-label", "Suggestions");
        } else {
            const byId = new Map(entries.map((entry) => [entry.id, entry]));
            options = (getEmptySuggestions?.() ?? [])
                .map((suggestion) => byId.get(suggestion.id))
                .filter(Boolean)
                .slice(0, MAX_OPTIONS);
            list.setAttribute(
                "aria-label",
                onRemoveSuggestion ? "Recently viewed (press Delete to remove one)" : "Recently viewed",
            );
        }
        list.replaceChildren(
            ...options.map((entry, index) => {
                const item = document.createElement("li");
                item.id = listId + "-" + index;
                item.className = "comboboxOption";
                item.setAttribute("role", "option");
                item.setAttribute("aria-selected", "false");

                const sprite = document.createElement("img");
                sprite.alt = "";
                sprite.width = 40;
                sprite.height = 40;
                sprite.loading = "lazy";
                setSprite(sprite, entry.id);

                const name = document.createElement("span");
                name.append(...highlightMatch(entry.label, input.value.trim()));
                const number = document.createElement("small");
                number.textContent = formatDexNumber(entry.dexNumber);

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
    // An empty box offers the empty-state suggestions as soon as it's focused or clicked.
    const showEmptySuggestions = () => {
        if (!input.value.trim() && getEmptySuggestions && list.hidden) {
            update();
        }
    };
    input.addEventListener("focus", showEmptySuggestions);
    input.addEventListener("click", showEmptySuggestions);
    input.addEventListener("blur", close);
    input.addEventListener("keydown", (event) => {
        if (list.hidden) {
            if (event.key === "ArrowDown" && (input.value || getEmptySuggestions)) {
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
        } else if (event.key === "Enter") {
            close(); // submitting the typed text: the suggestions are no longer needed
        } else if (event.key === "Delete" && activeIndex >= 0 && !input.value.trim() && onRemoveSuggestion) {
            event.preventDefault();
            const removed = options[activeIndex];
            onRemoveSuggestion(removed.id);
            status.textContent = removed.label + " removed from recently viewed";
            const nextIndex = Math.min(activeIndex, options.length - 2);
            update().then(() => {
                if (options.length && nextIndex >= 0) {
                    setActive(nextIndex);
                }
            });
        } else if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    });
}
