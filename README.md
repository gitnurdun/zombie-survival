# Zombie Survival · 僵尸村庄2

A keyboard-driven, single-player browser survival game with Canvas graphics, synthesized Web Audio, safe houses, weapon upgrades, and persistent progression.

## Play

Clone the repository and open **app/index.html** in a desktop browser. No package installation, build, server, or external art/audio downloads are required. Click the page to allow audio playback.

```sh
git clone https://github.com/gitnurdun/zombie-survival.git
```

## Controls

| Key | Action |
| --- | --- |
| A / D | Move and face left/right |
| W | Jump |
| Space | Attack |
| Shift | Dodge |
| E | Interact |
| X / 1–3 | Cycle/select weapon slots |
| 4 | Select an available super weapon |
| P / Escape | Pause or return from a menu |
| R while paused | Restart the level |
| M | Toggle sound |

The shelf uses the arrow keys and Enter; U undoes a shelf action.

## Development

The game is split into ordered classic scripts under `app/js/`, allowing it to run directly from `file://`. Keep the script order in `app/index.html`. All artwork is drawn procedurally and audio is synthesized locally.

[Detailed Chinese architecture and testing guide](app/README.md) covers the systems, maps, combat, saves, and maintenance notes. `tools/` contains migration/patch scripts and the earlier single-file snapshot.

## Tests

Use an installed Node.js runtime; no npm packages are needed. Run individual checks from the repository root, for example:

```sh
node test/keyboard.test.js
node test/terrain.test.js
node test/chain-explosion.test.js
node test/smoke.test.js
```

The full test list is documented in [app/README.md](app/README.md). Browser saves are stored locally; no accounts or backend service are required.
