# Gbot's Pokédex

A small Pokédex website built with plain HTML, CSS and JavaScript. Type a
Pokémon's name and it fetches the data from [PokéAPI](https://pokeapi.co)
and shows its sprite, Pokédex number and type icons.

## Project layout

```
pokemon/
  pokemon.html   page markup
  pokemon.css    styles
  pokemon.js     fetches data from PokéAPI and fills in the card
  assets/        type icons (one PNG per type, e.g. FireIcon.png)
TODO.md          living improvement backlog
```

## Running it

There's no build step. Either open `pokemon/pokemon.html` in a browser, or
serve the folder locally (recommended, so the browser treats it like a real
site):

```sh
cd pokemon
python3 -m http.server 8000
# then open http://localhost:8000/pokemon.html
```

An internet connection is needed, since all Pokémon data and sprites come
from PokéAPI.

## Contributing

Pick the next unchecked item in [`TODO.md`](TODO.md), implement it, check it
off in the "Done" section, and add any new ideas you discover.
