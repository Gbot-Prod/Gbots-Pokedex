// Service worker: makes the Pokédex work offline for Pokémon you've already viewed.
// - App shell (HTML, CSS, JS, icons): served from cache, refreshed in the background.
// - PokéAPI data and sprites: network first, falling back to the last cached copy.

const SHELL_CACHE = "pokedex-shell-v1";
const RUNTIME_CACHE = "pokedex-runtime-v1";
const SHELL_FILES = [
    "pokemon.html",
    "pokemon.css",
    "pokemon.js",
    "api.js",
    "compare.js",
    "lists.js",
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

// Serve the cached copy straight away and update the cache for next time.
async function staleWhileRevalidate(request) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request)
        .then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);
    return cached ?? network;
}

async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
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
        event.respondWith(staleWhileRevalidate(request));
    } else if (RUNTIME_HOSTS.includes(url.hostname)) {
        event.respondWith(networkFirst(request));
    }
});
