import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContent } from './build.mjs';
import './engine.js';

const F = globalThis.FLICK;
const content = loadContent();
F.load(content);
const seeded = (seed = 1) => {
  let s = (seed * 2654435761) % 2147483647 || 1;
  const next = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 5; k++) next();
  return next;
};
// Plays a round. `pick(card)` returns the bin to flick to.
function round(st, level, pick = c => c.bin, day = 10) {
  const R = F.start(st, level, { rng: seeded(3), day });
  let n = 0;
  while (!R.done && n++ < 200) F.flick(R, pick(F.card(R), R));
  return R;
}
const wrongBin = c => (c.bin + 1) % 4;

test('content: every person has clues that do not give their name away', () => {
  assert.equal(content.people.length, 94);
  const seen = new Set();
  for (const p of content.people) {
    assert.ok(p.clues.length >= 2, p.id);
    assert.ok(F.cfg.fields[p.field], p.id);
    const surname = p.name.split(' ').pop().toLowerCase();
    for (const c of p.clues) {
      if (surname.length > 2) assert.ok(!new RegExp(`\\b${surname}\\b`).test(c.toLowerCase()), `${p.id}: "${c}"`);
      assert.ok(!seen.has(c.toLowerCase()), `clue used twice: ${c}`);
      seen.add(c.toLowerCase());
    }
  }
  const years = content.dates.map(d => d.year);
  for (const y of [43, 1066, 1215, 1348, 1485, 1588, 1605, 1649, 1666, 1707, 1805, 1815, 1914, 1928, 1939, 1948, 1969]) assert.ok(years.includes(y), y);
});

test('content: the bundle matches the JSON files', () => {
  const b = readFileSync(new URL('./content.bundle.js', import.meta.url), 'utf8');
  assert.deepEqual(JSON.parse(b.slice(b.indexOf('=') + 1).trim().replace(/;$/, '')), content, 'run: node build.mjs');
});

test('levels: every person is in a level, every level has 4 names and a fair deal', () => {
  const placed = new Set(F.levels.filter(l => l.kind === 'people').flatMap(l => l.bins.map(b => b.id)));
  for (const p of content.people) assert.ok(placed.has(p.id), p.id);
  for (const l of F.levels) {
    assert.equal(l.bins.length, 4, l.id);
    assert.equal(new Set(l.bins.map(b => b.label)).size, 4, l.id);
    assert.ok(l.cards.length >= 8 && l.cards.length <= 12, `${l.id}: ${l.cards.length} cards`);
    for (let b = 0; b < 4; b++) assert.ok(l.cards.some(c => c.bin === b), `${l.id}: bin ${b} is empty`);
    assert.equal(new Set(l.cards.map(c => c.text)).size, l.cards.length, `${l.id}: two cards read the same`);
  }
  const fields = F.levels.slice(0, 9).map(l => l.field);
  assert.ok(new Set(fields).size >= 7, 'the first chapter mixes the topics');
});

test('date levels: every card sits inside its period', () => {
  for (const l of F.levels.filter(x => x.kind === 'dates')) {
    const def = F.cfg.dateLevels[+l.id.split('-')[1] - 1];
    for (const c of l.cards) {
      const [, from, to] = def[c.bin];
      const y = F.byId[c.about].year;
      assert.ok(y >= from && y <= to, `${l.id}: ${c.text} (${y})`);
    }
  }
});

test('a right flick scores, and the combo grows the points', () => {
  const st = F.blank();
  const R = F.start(st, F.levels[0], { rng: seeded(1), day: 10 });
  const gains = [];
  for (let k = 0; k < 4; k++) gains.push(F.flick(R, F.card(R).bin).gain);
  assert.deepEqual(gains, [100, 100, 200, 200]);
  assert.equal(R.combo, 4);
});

test('a wrong flick shows the answer and the card comes back; a repeat miss costs a heart', () => {
  const st = F.blank();
  const R = F.start(st, F.levels[0], { rng: seeded(2), day: 10 });
  const card = F.card(R);
  const res = F.flick(R, wrongBin(card));
  assert.equal(res.ok, false);
  assert.equal(res.correct, card.bin);
  assert.equal(res.lostHeart, false, 'the first miss teaches, it does not hurt');
  assert.equal(R.hearts, 3);
  assert.equal(R.combo, 0);
  const back = R.queue.findIndex((c, i) => i >= R.i && c.id === card.id && c.again);
  assert.equal(back - R.i, F.cfg.retryGap, 'comes back a few cards later');
  while (F.card(R).id !== card.id) F.flick(R, F.card(R).bin);
  assert.equal(F.flick(R, wrongBin(card)).lostHeart, true);
  assert.equal(R.hearts, 2);
});

test('missing what you were shown runs you out of hearts; the level stays locked', () => {
  const st = F.blank();
  round(st, F.levels[0], wrongBin);
  assert.equal(F.unlocked(st, 1), false);
  const R = round(st, F.levels[0], wrongBin);
  assert.equal(R.failed, true, 'second time round, every miss is a repeat');
  assert.equal(R.hearts, 0);
  assert.equal(st.stars[F.levels[0].id] || 0, 0);
});

test('stars: 3 for no misses, 2 for one or two, and stars open the next level', () => {
  const st = F.blank();
  const R = round(st, F.levels[0]);
  assert.equal(R.stars, 3);
  assert.equal(st.stars[F.levels[0].id], 3);
  assert.ok(F.unlocked(st, 1));
  assert.equal(F.current(st), 1);
  let first = true;
  const R2 = round(st, F.levels[1], c => (first ? ((first = false), wrongBin(c)) : c.bin));
  assert.equal(R2.stars, 2);
});

test('misses come back as a review round; hits are spaced 1, 3, 7 days until known', () => {
  const st = F.blank();
  let first = true;
  const R = round(st, F.levels[2], c => (first ? ((first = false), wrongBin(c)) : c.bin));
  const missed = R.misses[0];
  assert.equal(st.p[missed].lv, 1, 'got right on the second go, so it is learning');
  assert.equal(st.p[missed].due, 11);
  const rev = F.reviewLevel(st, 11, seeded(4));
  assert.ok(rev.review);
  assert.ok(rev.cards.some(c => c.id === missed));
  const id = R.level.cards[0].id;
  const r = st.p[id];
  const gaps = [];
  while (r.lv < F.KNOWN) { const d = r.due; F.remember(st, id, true, d); if (r.due) gaps.push(r.due - d); }
  assert.deepEqual(gaps, [3, 7]);
  assert.equal(F.status(r), 'known');
  assert.equal(F.reviewLevel(F.blank(), 11), null, 'nothing due, no review');
});

test('the whole map can be played to the end', () => {
  const st = F.blank();
  for (let i = 0; i < F.levels.length; i++) {
    assert.ok(F.unlocked(st, i), F.levels[i].id);
    round(st, F.levels[i]);
  }
  assert.equal(F.totalStars(st), F.levels.length * 3);
});
