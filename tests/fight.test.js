import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, START_X } from '../src/fight/match.js';
import { createAI, thinkAI } from '../src/fight/ai.js';
import { ROSTER } from '../src/fight/moves.js';

function toFight(m) {
  while (m.phase !== 'fight') stepMatch(m);
}

function closeIn(m, gap = 110) {
  m.fighters[0].x = 800 - gap / 2;
  m.fighters[1].x = 800 + gap / 2;
}

// Presses a button for one frame, then holds `after` for `frames` frames.
function press(m, side, buttons, frames = 40, after = {}) {
  const events = [];
  const intents = [{}, {}];
  intents[side] = buttons;
  events.push(...stepMatch(m, intents));
  for (let i = 0; i < frames; i++) {
    const it = [{}, {}];
    it[side] = after;
    events.push(...stepMatch(m, it));
  }
  return events;
}

test('a jab lands and deals damage', () => {
  const m = createMatch({ p1: 'volt', p2: 'volt' });
  toFight(m);
  closeIn(m);
  const ev = press(m, 0, { punch: true });
  const hit = ev.find((e) => e.type === 'hit');
  assert.ok(hit);
  assert.equal(m.fighters[1].hp, 100 - hit.damage);
});

test('standing block stops high and mid, takes only chip', () => {
  const m = createMatch({ p1: 'volt', p2: 'volt' });
  toFight(m);
  closeIn(m);
  stepMatch(m, [{}, { block: true }]);
  const ev = [];
  ev.push(...stepMatch(m, [{ kick: true }, { block: true }]));
  for (let i = 0; i < 30; i++) ev.push(...stepMatch(m, [{}, { block: true }]));
  const block = ev.find((e) => e.type === 'block');
  assert.ok(block);
  assert.ok(!ev.some((e) => e.type === 'hit'));
  assert.ok(m.fighters[1].hp >= 98);
});

test('a sweep goes under a standing block, not a crouching one', () => {
  for (const [guard, expect] of [[{ block: true }, 'hit'], [{ block: true, down: true }, 'block']]) {
    const m = createMatch({ p1: 'volt', p2: 'volt' });
    toFight(m);
    closeIn(m);
    stepMatch(m, [{}, guard]);
    const ev = [];
    ev.push(...stepMatch(m, [{ kick: true, down: true }, guard]));
    for (let i = 0; i < 30; i++) ev.push(...stepMatch(m, [{ down: true }, guard]));
    assert.ok(ev.some((e) => e.type === expect), JSON.stringify(guard));
  }
});

test('crouching ducks a jab', () => {
  const m = createMatch({ p1: 'volt', p2: 'volt' });
  toFight(m);
  closeIn(m);
  stepMatch(m, [{}, { down: true }]);
  const ev = [];
  ev.push(...stepMatch(m, [{ punch: true }, { down: true }]));
  for (let i = 0; i < 25; i++) ev.push(...stepMatch(m, [{}, { down: true }]));
  assert.ok(!ev.some((e) => e.type === 'hit' || e.type === 'block'));
});

test('an uppercut launches and the opponent can be juggled', () => {
  const m = createMatch({ p1: 'volt', p2: 'volt' });
  toFight(m);
  closeIn(m);
  const ev = press(m, 0, { punch: true, down: true }, 12, { down: true });
  assert.ok(ev.some((e) => e.type === 'hit' && e.launch));
  assert.equal(m.fighters[1].state, 'air-hit');
  // Recover, step in and hit them again before they land.
  const more = [];
  while (m.fighters[0].state !== 'idle' && m.fighters[0].state !== 'walk') more.push(...stepMatch(m, [{ right: true }, {}]));
  for (let i = 0; i < 3; i++) more.push(...stepMatch(m, [{ right: true }, {}]));
  more.push(...press(m, 0, { kick: true }, 20));
  assert.ok(more.some((e) => e.type === 'hit' && e.combo >= 2), JSON.stringify(more.filter((e) => e.type !== 'attack')));
});

test('a projectile crosses the stage and hits', () => {
  const m = createMatch({ p1: 'volt', p2: 'brick' });
  toFight(m);
  const ev = press(m, 0, { special: true }, 90);
  assert.ok(ev.some((e) => e.type === 'projectile'));
  assert.ok(ev.some((e) => e.type === 'hit' && e.move === 'special'));
});

test('jumping clears the ground wave', () => {
  const m = createMatch({ p1: 'brick', p2: 'volt' });
  toFight(m);
  m.fighters[1].x = 1000;
  const ev = [];
  ev.push(...stepMatch(m, [{ special: true }, {}]));
  for (let i = 0; i < 90; i++) {
    const wave = m.projectiles[0];
    const jump = wave && Math.abs(wave.x - m.fighters[1].x) < 170;
    ev.push(...stepMatch(m, [{}, jump ? { up: true } : {}]));
  }
  assert.ok(!ev.some((e) => e.type === 'hit'));
});

test('shade teleports behind the opponent', () => {
  const m = createMatch({ p1: 'shade', p2: 'volt' });
  toFight(m);
  const before = Math.sign(m.fighters[1].x - m.fighters[0].x);
  const ev = press(m, 0, { special: true }, 40);
  assert.ok(ev.some((e) => e.type === 'teleport'));
  assert.notEqual(Math.sign(m.fighters[1].x - m.fighters[0].x), before);
});

test('KO wins rounds; the final round opens END IT and a finisher ends the match', () => {
  const m = createMatch({ p1: 'volt', p2: 'brick' });
  for (let round = 0; round < 2; round++) {
    toFight(m);
    m.fighters[1].hp = 1;
    closeIn(m);
    const ev = press(m, 0, { punch: true }, 20);
    assert.ok(ev.some((e) => e.type === (round === 0 ? 'ko' : 'endIt')), 'round ' + round);
    if (round === 0) {
      while (m.phase !== 'intro') stepMatch(m);
      assert.equal(m.fighters[0].wins, 1);
    }
  }
  assert.equal(m.phase, 'finish');
  closeIn(m, 150);
  const ev = press(m, 0, { special: true }, 200);
  assert.ok(ev.some((e) => e.type === 'finisher' && e.id === 'toasted'));
  const end = ev.find((e) => e.type === 'matchEnd');
  assert.ok(end);
  assert.equal(end.side, 0);
  assert.equal(end.finisher, 'toasted');
});

test('missing the END IT window still ends the match', () => {
  const m = createMatch({ p1: 'volt', p2: 'brick' });
  m.fighters[0].wins = 1;
  toFight(m);
  m.fighters[1].hp = 1;
  closeIn(m);
  press(m, 0, { punch: true }, 20);
  assert.equal(m.phase, 'finish');
  const ev = [];
  for (let i = 0; i < 400 && !m.over; i++) ev.push(...stepMatch(m));
  const end = ev.find((e) => e.type === 'matchEnd');
  assert.ok(end);
  assert.equal(end.finisher, null);
});

test('time up gives the round to whoever has more health', () => {
  const m = createMatch({ p1: 'volt', p2: 'brick' });
  toFight(m);
  m.fighters[1].hp = 50;
  m.timer = 2;
  const ev = [];
  for (let i = 0; i < 5; i++) ev.push(...stepMatch(m));
  assert.ok(ev.some((e) => e.type === 'timeUp'));
  assert.equal(m.roundWinner.side, 0);
});

test('fighters never pass through each other or the walls', () => {
  const m = createMatch({ p1: 'brick', p2: 'brick' });
  toFight(m);
  for (let i = 0; i < 400; i++) {
    stepMatch(m, [{ right: true }, { right: true }]);
    const [a, b] = m.fighters;
    assert.ok(a.x <= b.x, 'crossed at frame ' + i);
    assert.ok(b.x <= 1510 && a.x >= 90);
  }
});

test('the CPU beats a dummy that never moves', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const m = createMatch({ p1: 'volt', p2: 'brick', seed: 3 });
    const ai = createAI(1, level, 5);
    for (let i = 0; i < 60 * 60 * 6 && !m.over; i++) stepMatch(m, [{}, thinkAI(ai, m)]);
    assert.ok(m.over, level + ' never finished');
    assert.equal(m.winner.side, 1, level);
  }
});

test('CPU against CPU always reaches the end, for every pairing', () => {
  for (const p1 of ROSTER) {
    for (const p2 of ROSTER) {
      const m = createMatch({ p1, p2, seed: p1.length * 7 + p2.length });
      const a = createAI(0, 'hard', 11);
      const b = createAI(1, 'normal', 12);
      for (let i = 0; i < 60 * 60 * 8 && !m.over; i++) stepMatch(m, [thinkAI(a, m), thinkAI(b, m)]);
      assert.ok(m.over, `${p1} vs ${p2}`);
    }
  }
});

test('the same seed and inputs replay the same fight', () => {
  const play = () => {
    const m = createMatch({ p1: 'shade', p2: 'goose', seed: 9 });
    const a = createAI(0, 'hard', 1);
    const b = createAI(1, 'hard', 2);
    for (let i = 0; i < 3000 && !m.over; i++) stepMatch(m, [thinkAI(a, m), thinkAI(b, m)]);
    return JSON.stringify(m.fighters.map((f) => [f.x, f.hp, f.wins, f.state]));
  };
  assert.equal(play(), play());
  assert.deepEqual(START_X, [600, 1000]);
});
