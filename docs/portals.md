# Portal build

`node tools/build_portal.mjs` writes `dist/portal/` and `dist/rain-fight-portal.zip` (about 4.3 MB, 51 files). The zip is what you upload. The GitHub Pages copy is not affected.

The game talks to portals through [Playgama Bridge](https://github.com/Playgama/bridge), one SDK that maps the same calls onto each portal's own SDK. Bridge lists Playgama, Y8, CrazyGames, Poki, GameDistribution, Yandex Games and others, so the same zip is the starting point for all of them.

## What the build changes

| | Open web (GitHub Pages) | Portal zip |
|---|---|---|
| SDK | none | Bridge v2 from `bridge.playgama.com`, the only external request |
| Language | browser | `platform.language` from the portal |
| Saves (CPU level) | `localStorage` | Bridge storage, cloud where the portal has it |
| Studio link, Share button | shown | removed |
| Open Graph tags | present | removed |
| Ads | none | interstitial between matches |

Fonts are served from `assets/fonts` in both, so nothing loads from Google.

## How the game meets the portal rules

Bridge's own list of required steps, and where each happens (`src/portal.js`, `src/main.js`):

1. **Wait for the SDK.** `portal.init()` awaits `bridge.initialize()`, with an 8 s ceiling so a broken SDK never blocks the game.
2. **Platform language.** Applied as soon as Bridge reports it. Eight languages: en, ru, uk, es, pt, de, fr, tr. Fighter names, round calls and finisher names stay in English, as in the genre.
3. **Saves through Bridge**, never `localStorage` directly.
4. **Pause and audio events.** `PAUSE_STATE_CHANGED` freezes the fight and suspends the sound; `AUDIO_STATE_CHANGED` mutes it; the state at start is applied by hand.
5. **`game_ready`** once the title screen and its demo fight are on screen.
6. **Interstitials at natural breaks only.** The game asks for one when the player leaves the result screen (Rematch, Change fighter, Main menu). Round breaks inside a match last two seconds and count as gameplay, so no ad there. Bridge enforces at most one a minute and none in the first 30 s (`playgama-bridge-config.json`). The game stays muted and waits until the ad closes or fails; if the portal declines to show one, it carries on at once.

Also sent: `level_started` when a match starts, `level_completed` / `level_failed` when it ends (used by CrazyGames, Poki and Yandex).

Tested locally under Bridge's mock platform: the SDK initialises, the language follows the browser, the share button and studio link are gone, and a simulated 2 s interstitial keeps the game muted on the result screen until it closes.

## Uploading

### Playgama

1. Developer account at playgama.com, add a game, upload `dist/rain-fight-portal.zip`.
2. Store images are in `docs/store/`: `icon-512.png`, `cover-1280x720.jpg`, `cover-1920x1080.jpg`. Check the form for any other sizes it asks for.
3. Genre: fighting / action. Content: cartoon violence, no blood.

### Y8

Y8 is a Bridge platform (`y8`), but it needs three ids from a Y8 developer account. Register the game there first, then build with them:

```sh
node tools/build_portal.mjs --y8-game-id <id> --y8-host-id <id> --y8-adsense-id <id>
```

Without them the zip still works on Playgama and the other portals.

### Later: CrazyGames and Poki

Same zip, nothing to change in the code. Poki asks for web exclusivity, which would mean taking the game off GitHub Pages; leave it for last.

## Not verified

Review times, revenue shares and the exact image sizes each portal asks for; none of these could be confirmed from public docs.
