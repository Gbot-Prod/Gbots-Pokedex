// Service worker: makes the Pokédex work offline for Pokémon you've already viewed.
// - App shell (HTML, CSS, JS, icons) and PokéAPI data/sprites: network first, falling back
//   to the last cached copy when offline. The shell is also pre-cached on install.

const SHELL_CACHE = "pokedex-shell-v2";
const RUNTIME_CACHE = "pokedex-runtime-v1";
const SHELL_FILES = [
    "pokemon.html",
    "pokemon.css",
    "pokemon.js",
    "api.js",
    "cardimage.js",
    "combobox.js",
    "compare.js",
    "effects.js",
    "lists.js",
    "potd.js",
    "progress.js",
    "quiz.js",
    "shinyhunt.js",
    "team.js",
    "typechart.js",
    "utils.js",
    "manifest.webmanifest",
    "assets/BugIcon.png",
    "assets/DarkIcon.png",
    "assets/DragonIcon.png",
    "assets/ElectricIcon.png",
    "assets/FairyIcon.png",
    "assets/FightingIcon.png",
    "assets/FireIcon.png",
    "assets/FlyingIcon.png",
    "assets/GhostIcon.png",
    "assets/GrassIcon.png",
    "assets/GroundIcon.png",
    "assets/IceIcon.png",
    "assets/NormalIcon.png",
    "assets/PoisonIcon.png",
    "assets/PsychicIcon.png",
    "assets/RockIcon.png",
    "assets/SteelIcon.png",
    "assets/WaterIcon.png",
    "assets/favicon.svg",
];
const RUNTIME_HOSTS = ["pokeapi.co", "raw.githubusercontent.com"];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    const keep = [SHELL_CACHE, RUNTIME_CACHE];
    event.waitUntil(
        caches
            .keys()
            .then((names) =>
                Promise.all(names.filter((name) => !keep.includes(name)).map((name) => caches.delete(name))),
            )
            .then(() => self.clients.claim()),
    );
});

// Always try the network so online visitors get the latest files and data (no cache
// version to bump on every edit, and never a mix of old and new modules); fall back to
// the last cached copy when offline.
async function networkFirst(request, cacheName, matchOptions, fetchOptions) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request, fetchOptions);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request, matchOptions);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") {
        return;
    }
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        // ignoreSearch: pokemon.html?pokemon=gengar is served from the cached pokemon.html
        // cache: "no-cache" revalidates with the server, so the browser's HTTP cache can't
        // hand back a stale copy of an edited file.
        event.respondWith(networkFirst(request, SHELL_CACHE, { ignoreSearch: true }, { cache: "no-cache" }));
    } else if (RUNTIME_HOSTS.includes(url.hostname)) {
        event.respondWith(networkFirst(request, RUNTIME_CACHE));
    }
});
