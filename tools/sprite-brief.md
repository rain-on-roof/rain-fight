You are producing in-game sprite sheets for RAIN FIGHT. Use your image generation tool. Use the existing images in `assets/art/` (`lineup.png`, `portrait-*.png`, `keyart.png`) as the exact style and character reference — same designs, same colours, same thick dark outlines and cel shading. Save results into `assets/sprites/` (create it). Do not modify any other files.

## Sheet format (very important, the sheets are cut automatically)

- Background: one flat, pure chroma green `#00FF00` over the whole image. No gradient, no floor, no shadow on the ground, no rain, no sparks, no text, no labels, no frame lines.
- 8 poses per sheet in a 4 columns × 2 rows grid, landscape image (1536×1024 or larger).
- Every pose is the FULL body, head to toe (nothing cropped), all at the SAME scale, all FACING RIGHT.
- Leave clear green space between poses; poses must not touch or overlap each other or the image edge.
- Feet of standing poses sit on the same baseline within a row.
- Keep glow effects tight to the body (Volt's gloves may glow, but no big halos).

## Characters (exact designs from the reference images)

- VOLT — spiky pale-blond hair, hot-pink headband, cyan sleeveless top with yellow lightning bolt, black trousers, white sneakers, big black-and-cyan electric gloves, pink scarf.
- BRICK — huge bald bruiser, black beard, white tank top, olive cargo trousers, brown boots, white wrist wraps, gold buckle.
- SHADE — purple hooded ninja, face in shadow with glowing magenta eyes, hot-pink sash, dark hand and foot wraps.
- GOOSE — white goose, orange beak with orange knob, serrated "toothy" beak edge, angry brow, orange feet.

## Poses

Sheet A (`<name>-a.png`), left to right, top row then bottom row:
1. idle fighting stance
2. walking forward, mid-stride
3. crouching guard
4. jumping, knees tucked, mid-air
5. jab: front arm fully extended in a straight punch
6. high kick: front leg extended straight forward at chest height
7. uppercut: fist driving straight up above the head, body rising
8. low sweep: crouched low, one leg extended along the floor

Sheet B (`<name>-b.png`):
1. standing block: forearms crossed in front of the face
2. crouching block
3. hit reaction: recoiling backwards, head snapped back, pained face
4. knocked down: lying flat on the back on the floor (horizontal)
5. special move (see below)
6. flying kick in mid-air, leg extended diagonally down-forward
7. victory pose, triumphant
8. dizzy: wobbling on the spot, eyes spinning, stars optional but tight to the head

Special moves: VOLT thrusts both glowing gloves forward firing lightning (lightning kept short, near the gloves); BRICK slams both fists down into the ground; SHADE lunges forward with a palm strike trailing a little purple smoke; GOOSE stretches its neck forward honking with the beak wide open.

For the GOOSE adapt the poses to a goose: punch = neck jab with the beak, kick = wing slap, uppercut = neck strike upward, sweep = low neck swipe along the floor, block = head turned away with eyes shut ("not looking"), knocked down = on its back with feet in the air, victory = wings raised like a champion, walking = angry waddle.

Deliverables: `volt-a.png`, `volt-b.png`, `brick-a.png`, `brick-b.png`, `shade-a.png`, `shade-b.png`, `goose-a.png`, `goose-b.png`. Keep every character identical across its two sheets. When done, print the saved files with pixel sizes.
