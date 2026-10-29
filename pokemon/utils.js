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

// Main-series games newest first, with display names. Used to pick which learnset to
// show; version group ids aren't chronological (PokéAPI later added e.g. the Japanese
// Red/Green releases).
export const VERSION_GROUPS = [
    ["scarlet-violet", "Scarlet & Violet"],
    ["sword-shield", "Sword & Shield"],
    ["brilliant-diamond-shining-pearl", "Brilliant Diamond & Shining Pearl"],
    ["ultra-sun-ultra-moon", "Ultra Sun & Ultra Moon"],
    ["sun-moon", "Sun & Moon"],
    ["lets-go-pikachu-lets-go-eevee", "Let's Go Pikachu & Eevee"],
    ["omega-ruby-alpha-sapphire", "Omega Ruby & Alpha Sapphire"],
    ["x-y", "X & Y"],
    ["black-2-white-2", "Black 2 & White 2"],
    ["black-white", "Black & White"],
    ["heartgold-soulsilver", "HeartGold & SoulSilver"],
    ["platinum", "Platinum"],
    ["diamond-pearl", "Diamond & Pearl"],
    ["emerald", "Emerald"],
    ["firered-leafgreen", "FireRed & LeafGreen"],
    ["ruby-sapphire", "Ruby & Sapphire"],
    ["crystal", "Crystal"],
    ["gold-silver", "Gold & Silver"],
    ["yellow", "Yellow"],
    ["red-blue", "Red & Blue"],
];
const VERSION_GROUP_PREFERENCE = VERSION_GROUPS.map(([name]) => name);

// A Pokémon's moves in one main-series game, grouped by how they're learned:
// { versionGroup, games, methods: { "level-up": [{ name, url, level }], machine: [...], egg: [...], tutor: [...] } }
// `games` lists the main-series games (newest first) that have a level-up learnset.
// Uses `preferredGame` when it's one of them, otherwise the newest.
// Level-up moves are sorted by level, the rest by name.
export function learnset(moves, preferredGame = null) {
    const entries = moves.flatMap(({ move, version_group_details: details }) =>
        details.map((detail) => ({
            name: move.name,
            url: move.url,
            level: detail.level_learned_at,
            method: detail.move_learn_method.name,
            versionGroup: detail.version_group.name,
        })),
    );
    const levelUpGroups = new Set(entries.filter((e) => e.method === "level-up").map((e) => e.versionGroup));
    const available = levelUpGroups.size ? levelUpGroups : new Set(entries.map((e) => e.versionGroup));
    const games = VERSION_GROUP_PREFERENCE.filter((group) => available.has(group));
    const versionGroup = games.includes(preferredGame) ? preferredGame : (games[0] ?? [...available].pop() ?? null);

    const methods = { "level-up": [], machine: [], egg: [], tutor: [] };
    for (const entry of entries) {
        if (entry.versionGroup === versionGroup && methods[entry.method]) {
            methods[entry.method].push({ name: entry.name, url: entry.url, level: entry.level });
        }
    }
    methods["level-up"].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    for (const method of ["machine", "egg", "tutor"]) {
        methods[method].sort((a, b) => a.name.localeCompare(b.name));
    }
    return { versionGroup, games, methods };
}

// Level-up moves from the most recent main-series game that lists any,
// sorted by level: [{ name, url, level }].
export function levelUpMoves(moves) {
    return learnset(moves).methods["level-up"];
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

// Pokédex numbers are shown zero-padded, as in the games: 25 -> "#0025".
export function formatDexNumber(id) {
    return "#" + String(id).padStart(4, "0");
}

// Damage multiplier each attacking type deals to a Pokémon with the given types, from the
// types' damage_relations (e.g. Ground vs. Electric/Flying = 0, Rock vs. Fire/Flying = 4).
export function damageMultipliers(typeDataList) {
    const multipliers = Object.fromEntries(Object.keys(TYPE_ICONS).map((type) => [type, 1]));
    for (const { damage_relations: relations } of typeDataList) {
        for (const { name } of relations.double_damage_from) {
            multipliers[name] *= 2;
        }
        for (const { name } of relations.half_damage_from) {
            multipliers[name] *= 0.5;
        }
        for (const { name } of relations.no_damage_from) {
            multipliers[name] = 0;
        }
    }
    return multipliers;
}
