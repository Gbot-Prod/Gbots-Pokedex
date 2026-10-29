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

export const STAT_LABELS = {
    hp: "HP",
    attack: "Attack",
    defense: "Defense",
    "special-attack": "Sp. Atk",
    "special-defense": "Sp. Def",
    speed: "Speed",
};

// Not every form has a HOME render, so fall back to official artwork, then the game sprite.
export function pickSprite(sprites, shiny) {
    const key = shiny ? "front_shiny" : "front_default";
    return sprites.other.home[key] || sprites.other["official-artwork"][key] || sprites[key] || "";
}

// Highest National Pokédex number in PokéAPI (Pecharunt). Higher ids are alternate forms.
export const MAX_DEX_NUMBER = 1025;

export const TYPE_ICONS = {
    normal: "NormalIcon.png",
    fire: "FireIcon.png",
    water: "WaterIcon.png",
    grass: "GrassIcon.png",
    electric: "ElectricIcon.png",
    ice: "IceIcon.png",
    fighting: "FightingIcon.png",
    poison: "PoisonIcon.png",
    ground: "GroundIcon.png",
    flying: "FlyingIcon.png",
    psychic: "PsychicIcon.png",
    bug: "BugIcon.png",
    rock: "RockIcon.png",
    ghost: "GhostIcon.png",
    dark: "DarkIcon.png",
    dragon: "DragonIcon.png",
    steel: "SteelIcon.png",
    fairy: "FairyIcon.png",
};

// Short label for a form within its species: ("charizard", "charizard-mega-x") -> "Mega X".
export function formLabel(speciesName, pokemonName) {
    if (pokemonName === speciesName) {
        return "Standard";
    }
    const suffix = pokemonName.startsWith(speciesName + "-") ? pokemonName.slice(speciesName.length + 1) : pokemonName;
    return formatName(suffix);
}

// Main-series games newest first, used to pick which learnset to show. Version group
// ids aren't chronological (PokéAPI later added e.g. the Japanese Red/Green releases).
const VERSION_GROUP_PREFERENCE = [
    "scarlet-violet",
    "sword-shield",
    "brilliant-diamond-shining-pearl",
    "ultra-sun-ultra-moon",
    "sun-moon",
    "lets-go-pikachu-lets-go-eevee",
    "omega-ruby-alpha-sapphire",
    "x-y",
    "black-2-white-2",
    "black-white",
    "heartgold-soulsilver",
    "platinum",
    "diamond-pearl",
    "emerald",
    "firered-leafgreen",
    "ruby-sapphire",
    "crystal",
    "gold-silver",
    "yellow",
    "red-blue",
];

// Level-up moves from the most recent main-series game that lists any,
// sorted by level: [{ name, url, level }].
export function levelUpMoves(moves) {
    const levelUps = moves.flatMap(({ move, version_group_details: details }) =>
        details
            .filter((detail) => detail.move_learn_method.name === "level-up")
            .map((detail) => ({
                name: move.name,
                url: move.url,
                level: detail.level_learned_at,
                versionGroup: detail.version_group.name,
            })),
    );
    if (!levelUps.length) {
        return [];
    }
    const available = new Set(levelUps.map((entry) => entry.versionGroup));
    const chosen = VERSION_GROUP_PREFERENCE.find((group) => available.has(group)) ?? [...available].pop();
    return levelUps
        .filter((entry) => entry.versionGroup === chosen)
        .map(({ name, url, level }) => ({ name, url, level }))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// True if every character of `needle` appears in `haystack` in order ("charz" in "charizard").
export function isSubsequence(needle, haystack) {
    let position = 0;
    for (const char of haystack) {
        if (char === needle[position]) {
            position++;
        }
    }
    return position === needle.length;
}

// How well a Pokémon name matches a failed search; lower is better, Infinity means no match.
// Prefixes ("pika") beat substrings ("chu") beat in-order letters ("charz"), then typos ("pikachoo").
export function suggestionScore(query, name) {
    if (name.startsWith(query)) {
        return 0;
    }
    if (query.length >= 3 && name.includes(query)) {
        return 1;
    }
    if (query.length >= 4 && isSubsequence(query, name)) {
        return 2;
    }
    const distance = editDistance(query, name);
    return distance <= Math.max(2, Math.floor(query.length / 3)) ? 2 + distance : Infinity;
}
