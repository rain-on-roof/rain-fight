# Rain Fight — design

A rooftop fighting game in the rain, by Rain on Roof. Original fighters, names
and phrases: inspired by the arcade fighters of the 90s, copying none of them.

## Goal

Two seconds from a link to a fight, on a phone or a desktop. Every match ends in
a ridiculous finisher worth clipping. It must look like a studio made it.

## Match

- 1P vs CPU (Easy / Normal / Hard) or 2P on one keyboard.
- First to 2 rounds. 60-second round timer; when it runs out, more health wins.
- Health 100. Damage, block chip (15%), hitstun, blockstun, pushback, juggles
  after a launcher, combo counter.
- Final round KO → **END IT!**: the loser staggers; the winner has 3 s to press
  SPECIAL in range for their finisher. Otherwise the loser simply drops.
- PERFECT when the winner took no damage that round.

## Fighters

Shared moveset: walk, jump (neutral/forward/back), crouch, block (standing
blocks high+mid, crouching blocks everything), punch, kick, low punch, sweep
(low, knockdown), uppercut (crouch+punch → launcher), jump kick, special.

| Fighter | Look | Special | Finisher |
| --- | --- | --- | --- |
| Volt | street fighter, electric gloves, scarf | lightning bolt projectile | TOASTED — opponent becomes burnt toast |
| Brick | huge bruiser, tank top, beard | ground slam shockwave (low) | NAILED — hammered into the roof |
| Shade | hooded ninja, glowing eyes | teleport behind + strike | UNDRESSED — only underwear left |
| Goose | the goose from Last Bite | HONK sound wave | HONKED — opponent flies to the horizon |

## Controls

- Keyboard P1: A/D move, W jump, S crouch, J punch, K kick, L special, Space
  block. In 1P mode arrows + Z/X/C/Shift also work.
- Keyboard P2: arrows, Numpad 1/2/3/0 or `,` `.` `/` and Right Shift.
- Touch: on-screen stick and P / K / S / BLOCK buttons. Portrait: arena on top,
  controls below. Landscape: controls over the arena.
- Gamepad: stick/d-pad, X punch, A kick, Y special, LB/RB block.

## Look

Night rooftop in a downpour: parallax neon skyline, a moon behind clouds,
lightning flashes, a RAIN ON ROOF neon sign, puddles reflecting the fighters,
rain streaks and splashes. Fighters are code-drawn puppets (bold outline, cel
shading, neon rim light) animated from keyframed poses. Hit-stop, shake,
sparks, slow motion on KO, manga impact frames.

## Structure

Static files, no build, no dependencies.

```
src/fight/   moves.js fighter.js match.js ai.js   — pure logic, unit tested
src/render/  stage.js puppet.js goose.js fx.js hud.js
src/input.js audio.js main.js share.js
```

`match.js` steps a fixed 60 Hz simulation from per-player intents and emits
events; rendering only reads state.

## Done when

- `npm test` green (damage, blocking, lows, launch/juggle, projectiles, rounds,
  timer, finisher window, CPU beats an idle dummy, CPU vs CPU always ends).
- Played in the browser on phone portrait, phone landscape and desktop.
- Repo: banner, PLAY NOW at the top, gameplay GIF, screenshots, OG image,
  description, topics; Pages live.
