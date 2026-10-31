// Shape checks for lists saved in localStorage. Anything else (hand-edited, or from an older
// version) is skipped rather than crashing the code that renders or counts it.

// Favourites and history: { id, name, ... } summaries.
export function isStoredEntry(entry) {
    return Boolean(entry) && Number.isInteger(entry.id) && typeof entry.name === "string";
}

// Team members: { id, label, types }.
export function isTeamMember(entry) {
    return (
        Boolean(entry) &&
        Number.isInteger(entry.id) &&
        typeof entry.label === "string" &&
        Array.isArray(entry.types) &&
        entry.types.every((type) => typeof type === "string")
    );
}
