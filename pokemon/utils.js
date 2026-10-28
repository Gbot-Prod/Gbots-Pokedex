// Pure helpers shared by the page and the unit tests (no DOM access).

// Accepts names ("Pikachu", "mr mime") and Pokédex numbers ("25", "#025").
export function normalizeQuery(rawQuery) {
    const query = rawQuery.trim().toLowerCase().replace(/^#/, "");
    if (/^\d+$/.test(query)) {
        return String(parseInt(query, 10));
    }
    // Turn display names into API slugs: "Farfetch'd" -> "farfetchd", "Mr. Mime" -> "mr-mime",
    // "Nidoran♀" -> "nidoran-f", "Type: Null" -> "type-null", "Flabébé" -> "flabebe".
    return query
        .replace(/♀/g, "-f")
        .replace(/♂/g, "-m")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.'’:]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function formatMultiplier(multiplier) {
    return { 0.25: "¼", 0.5: "½" }[multiplier] ?? String(multiplier);
}

export function idFromUrl(url) {
    return Number(url.split("/").filter(Boolean).pop());
}

// Summarises how a Pokémon evolves, e.g. "Lv. 16", "Thunder Stone", "Trade".
export function describeEvolution(details) {
    const detail = details[0];
    if (!detail) {
        return "";
    }
    if (detail.min_level) {
        return "Lv. " + detail.min_level;
    }
    if (detail.item) {
        return formatName(detail.item.name);
    }
    if (detail.min_happiness) {
        return "Friendship";
    }
    return formatName(detail.trigger.name);
}

// "lightning-rod" -> "Lightning Rod"
export function formatName(name) {
    return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Classic edit distance, used to suggest names close to a misspelled search.
export function editDistance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        previous = current;
    }
    return previous[b.length];
}
