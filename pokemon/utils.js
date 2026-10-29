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

// Summarises how a Pokémon evolves, e.g. "Lv. 16", "Thunder Stone", "Friendship (day)",
// "Trade holding Metal Coat". PokéAPI lists one detail per game, oldest first, and methods
// changed over time (Leafeon: mossy rock, later a Leaf Stone), so the newest game's is used.
export function describeEvolution(details) {
    // Prefer the detail from the newest main-series game; otherwise the last one listed.
    const rank = (detail) => {
        const index = VERSION_GROUP_PREFERENCE.indexOf(detail.version_group?.name);
        return index === -1 ? Infinity : index;
    };
    const detail = details.reduce(
        (best, candidate) => (rank(candidate) <= rank(best) ? candidate : best),
        details[details.length - 1],
    );
    if (!detail) {
        return "";
    }
    const trigger = detail.trigger?.name;
    let text;
    if (trigger === "trade") {
        text = "Trade";
        if (detail.trade_species) {
            text += " for " + formatName(detail.trade_species.name);
        }
    } else if (detail.min_level) {
        text = "Lv. " + detail.min_level;
    } else if (detail.item) {
        text = formatName(detail.item.name);
    } else if (detail.min_happiness) {
        text = "Friendship";
    } else if (detail.min_affection) {
        text = "Affection";
    } else if (detail.known_move) {
        text = "Knowing " + formatName(detail.known_move.name);
    } else if (detail.known_move_type) {
        text = "Knowing a " + formatName(detail.known_move_type.name) + " move";
    } else if (detail.location) {
        text = "At " + formatName(detail.location.name);
    } else {
        text = formatName(trigger ?? "unknown");
    }
    if (detail.held_item) {
        text += " holding " + formatName(detail.held_item.name);
    }
    // e.g. Sylveon: friendship while knowing a Fairy move
    if (detail.known_move_type && !text.startsWith("Knowing")) {
        text += ", knowing a " + formatName(detail.known_move_type.name) + " move";
    }
    // Extra conditions, e.g. Tyrogue's stat comparison, Mantyke's party member, Inkay's upside-down console.
    const conditions = [];
    if (detail.time_of_day) {
        conditions.push(detail.time_of_day);
    }
    if (detail.gender === 1) {
        conditions.push("female");
    } else if (detail.gender === 2) {
        conditions.push("male");
    }
    if (detail.relative_physical_stats === 1) {
        conditions.push("Atk > Def");
    } else if (detail.relative_physical_stats === -1) {
        conditions.push("Atk < Def");
    } else if (detail.relative_physical_stats === 0) {
        conditions.push("Atk = Def");
    }
    if (detail.party_species) {
        conditions.push("with " + formatName(detail.party_species.name) + " in party");
    }
    if (detail.party_type) {
        conditions.push("with a " + formatName(detail.party_type.name) + " type in party");
    }
    if (detail.needs_overworld_rain) {
        conditions.push("in rain");
    }
    if (detail.turn_upside_down) {
        conditions.push("console upside down");
    }
    if (detail.min_beauty) {
        conditions.push("high Beauty");
    }
    if (conditions.length) {
        text += " (" + conditions.join(", ") + ")";
    }
    return text;
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

// Official English names that title-casing the API slug gets wrong.
const SPECIES_NAME_EXCEPTIONS = {
    "nidoran-f": "Nidoran♀",
    "nidoran-m": "Nidoran♂",
    farfetchd: "Farfetch’d",
    sirfetchd: "Sirfetch’d",
    "mr-mime": "Mr. Mime",
    "mr-rime": "Mr. Rime",
    "mime-jr": "Mime Jr.",
    "ho-oh": "Ho-Oh",
    "porygon-z": "Porygon-Z",
    "type-null": "Type: Null",
    "jangmo-o": "Jangmo-o",
    "hakamo-o": "Hakamo-o",
    "kommo-o": "Kommo-o",
    flabebe: "Flabébé",
    "wo-chien": "Wo-Chien",
    "chien-pao": "Chien-Pao",
    "ting-lu": "Ting-Lu",
    "chi-yu": "Chi-Yu",
};

// Display name for a species slug without a request: "mr-mime" -> "Mr. Mime", "great-tusk" -> "Great Tusk".
export function speciesDisplayName(slug) {
    return SPECIES_NAME_EXCEPTIONS[slug] ?? formatName(slug);
}

// PokéAPI gives height in decimetres and weight in hectograms.
export function formatHeight(decimetres, units = "metric") {
    if (units === "imperial") {
        const totalInches = Math.round(decimetres * 3.93701);
        return Math.floor(totalInches / 12) + "′" + String(totalInches % 12).padStart(2, "0") + "″";
    }
    return (decimetres / 10).toFixed(1) + " m";
}

export function formatWeight(hectograms, units = "metric") {
    if (units === "imperial") {
        return (hectograms * 0.220462).toFixed(1) + " lbs";
    }
    return (hectograms / 10).toFixed(1) + " kg";
}

// Display name for a /pokemon response: "Farfetch’d", "Charizard (Mega X)", "Zygarde" (not "Zygarde 50").
export function pokemonDisplayName(pokemon) {
    const species = pokemon.species?.name;
    if (!species) {
        return formatName(pokemon.name);
    }
    const isDefault = idFromUrl(pokemon.species.url) === pokemon.id;
    const base = speciesDisplayName(species);
    return isDefault ? base : base + " (" + formLabel(species, pokemon.name) + ")";
}

// Drops cache entries ({ key: { savedAt, … } }) older than maxAgeMs, then keeps only the
// newest maxEntries. Returns a new object.
export function pruneCacheEntries(entries, now, maxAgeMs, maxEntries) {
    const fresh = Object.entries(entries).filter(([, value]) => now - (value.savedAt ?? 0) <= maxAgeMs);
    fresh.sort(([, a], [, b]) => b.savedAt - a.savedAt);
    return Object.fromEntries(fresh.slice(0, maxEntries));
}

// Species (dex number and slug) an entry belongs to. Forms like "charizard-mega-x" aren't
// linked to their species in the list, so the longest species slug that prefixes the name wins.
// speciesSlugs: Map dex number -> species slug.
const speciesBySlugCache = new WeakMap();
export function entrySpecies(entry, speciesSlugs) {
    if (!speciesSlugs) {
        return null;
    }
    if (entry.id <= MAX_DEX_NUMBER) {
        const slug = speciesSlugs.get(entry.id);
        return slug ? { id: entry.id, slug } : null;
    }
    if (!speciesBySlugCache.has(speciesSlugs)) {
        speciesBySlugCache.set(speciesSlugs, new Map([...speciesSlugs].map(([id, slug]) => [slug, id])));
    }
    const bySlug = speciesBySlugCache.get(speciesSlugs);
    const parts = entry.name.split("-");
    for (let length = parts.length - 1; length > 0; length--) {
        const slug = parts.slice(0, length).join("-");
        if (bySlug.has(slug)) {
            return { id: bySlug.get(slug), slug };
        }
    }
    return null;
}

// Display name for a { name, id } list entry: National Dex entries use their species' name
// ("zygarde-50" -> "Zygarde", "farfetchd" -> "Farfetch’d"); forms add their label
// ("charizard-mega-x" -> "Charizard (Mega X)").
export function entryDisplayName(entry, speciesSlugs) {
    const species = entrySpecies(entry, speciesSlugs);
    if (!species) {
        return formatName(entry.name);
    }
    const base = speciesDisplayName(species.slug);
    return entry.id <= MAX_DEX_NUMBER ? base : base + " (" + formLabel(species.slug, entry.name) + ")";
}

// Plain-English description of an ability: the latest English in-game text, falling back to
// the short effect. Game text has hard line breaks, which are collapsed.
export function abilityDescription(ability) {
    const english = (entries) => (entries ?? []).filter((entry) => entry.language.name === "en");
    const flavor = english(ability.flavor_text_entries).pop()?.flavor_text;
    const text = flavor ?? english(ability.effect_entries).pop()?.short_effect ?? "";
    return text.replace(/\s+/g, " ").trim();
}

// Corner points of a radar-chart polygon: one axis per value, starting at the top and
// going clockwise, each scaled by value / max of the radius. Returns "x,y x,y …" for <polygon>.
export function radarPoints(values, max, radius, centerX, centerY) {
    return values
        .map((value, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / values.length;
            const distance = (Math.min(value, max) / max) * radius;
            return (
                (centerX + distance * Math.cos(angle)).toFixed(1) +
                "," +
                (centerY + distance * Math.sin(angle)).toFixed(1)
            );
        })
        .join(" ");
}
