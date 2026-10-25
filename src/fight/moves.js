// Frame data. Everything runs at 60 frames per second. Boxes are relative to
// the fighter's feet, x forward (toward the opponent), y up.
//
// level: 'high' and 'mid' are blocked standing; 'low' only crouching.
// Crouching ducks anything whose box starts above a crouching hurtbox.

const base = {
  jab: { startup: 4, active: 3, recovery: 9, damage: 5, box: [40, 140, 115, 195], level: 'high', hitstun: 15, blockstun: 9, push: 150 },
  kick: { startup: 7, active: 4, recovery: 15, damage: 8, box: [45, 80, 150, 150], level: 'mid', hitstun: 19, blockstun: 11, push: 210, heavy: true },
  uppercut: { startup: 7, active: 4, recovery: 24, damage: 12, box: [25, 70, 100, 245], level: 'mid', hitstun: 30, blockstun: 14, push: 120, launch: 1150, heavy: true },
  sweep: { startup: 8, active: 4, recovery: 22, damage: 7, box: [35, 0, 160, 45], level: 'low', hitstun: 24, blockstun: 12, push: 120, knockdown: true },
  jumpKick: { startup: 4, active: 12, recovery: 4, damage: 9, box: [25, 35, 130, 115], level: 'mid', hitstun: 20, blockstun: 11, push: 180, air: true, heavy: true },
  jumpPunch: { startup: 3, active: 9, recovery: 4, damage: 6, box: [30, 110, 120, 175], level: 'mid', hitstun: 16, blockstun: 9, push: 140, air: true },
};

function scaleMoves(moves, { reach = 1, damage = 1, speed = 1 } = {}) {
  const out = {};
  for (const [id, m] of Object.entries(moves)) {
    out[id] = {
      ...m,
      id,
      startup: Math.max(2, Math.round(m.startup * speed)),
      recovery: Math.max(3, Math.round(m.recovery * speed)),
      damage: Math.round(m.damage * damage),
      box: [m.box[0], m.box[1], Math.round(m.box[0] + (m.box[2] - m.box[0]) * reach), m.box[3]],
    };
  }
  return out;
}

export const FIGHTERS = {
  volt: {
    id: 'volt',
    name: 'VOLT',
    hp: 100,
    walk: 270,
    jump: 1180,
    moves: {
      ...scaleMoves(base),
      special: {
        id: 'special', kind: 'projectile', startup: 13, active: 1, recovery: 20, damage: 10, level: 'high', hitstun: 20, blockstun: 12, push: 200,
        projectile: { speed: 980, y: 150, w: 70, h: 34, life: 120, kind: 'bolt' }, cooldown: 55,
      },
    },
    finisher: 'toasted',
  },
  brick: {
    id: 'brick',
    name: 'BRICK',
    hp: 115,
    walk: 210,
    jump: 1080,
    moves: {
      ...scaleMoves(base, { reach: 1.05, damage: 1.2, speed: 1.15 }),
      special: {
        id: 'special', kind: 'projectile', startup: 17, active: 1, recovery: 24, damage: 12, level: 'low', hitstun: 26, blockstun: 14, push: 160, knockdown: true,
        projectile: { speed: 680, y: 0, w: 90, h: 55, life: 110, kind: 'wave' }, cooldown: 65,
      },
    },
    finisher: 'nailed',
  },
  shade: {
    id: 'shade',
    name: 'SHADE',
    hp: 95,
    walk: 310,
    jump: 1240,
    moves: {
      ...scaleMoves(base, { damage: 0.9, speed: 0.85 }),
      special: {
        id: 'special', kind: 'teleport', startup: 18, active: 4, recovery: 18, damage: 10, box: [20, 90, 120, 210], level: 'mid', hitstun: 24, blockstun: 12, push: 220,
        vanish: [4, 16], cooldown: 70, heavy: true,
      },
    },
    finisher: 'undressed',
  },
  goose: {
    id: 'goose',
    name: 'GOOSE',
    hp: 92,
    walk: 250,
    jump: 1300,
    moves: {
      ...scaleMoves(base, { reach: 1.3, damage: 0.95 }),
      special: {
        id: 'special', kind: 'area', startup: 11, active: 12, recovery: 18, damage: 9, box: [40, 50, 290, 240], level: 'high', hitstun: 34, blockstun: 16, push: 320,
        cooldown: 60, heavy: true,
      },
    },
    finisher: 'honked',
  },
};

export const ROSTER = ['volt', 'brick', 'shade', 'goose'];

export const FINISHERS = {
  toasted: { name: 'TOASTED', length: 150 },
  nailed: { name: 'NAILED', length: 150 },
  undressed: { name: 'UNDRESSED', length: 150 },
  honked: { name: 'HONKED', length: 160 },
};
