// Flick: the engine. Runs on content/*.json (bundled into content.bundle.js).
//
// Every level puts four names (people, or periods of time) on the table and deals a stack of
// cards. Each card belongs to one of the four: flick it there.
//   Right: points, and your combo grows.
//   Wrong: the card shows where it really goes, and comes back a few cards later.
//          Missing a card you've been shown before costs a heart. Three hearts and you're out.
// Every card is remembered: misses are due again today, hits come back after 1, 3, 7 days.
// Classic script; the node tests import it too.
(function (G) {
  'use strict';
  const F = (G.FLICK = G.FLICK || {});
  F.KNOWN = 4;
  F.yearLabel = y => (y < 1000 ? `AD ${y}` : String(y));
  F.today = (shift = 0) => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5) + shift;

  const shuffle = (a, rng) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- levels, built from the content ----------
  function peopleLevel(field, k, group) {
    return {
      id: `${field}-${k + 1}`,
      kind: 'people',
      field,
      title: `${F.cfg.fields[field].name} ${k + 1}`,
      bins: group.map(p => ({ id: p.id, label: p.name })),
      cards: group.flatMap((p, b) => p.clues.map((text, n) => ({ id: `${p.id}#${n}`, text, about: p.id, bin: b }))),
    };
  }
  // Date levels: four periods. Cards are dates, plus people whose year sits clearly inside one.
  function dateLevel(def, k) {
    const edge = 5;
    const items = [...F.dates.map(d => ({ d, ev: true })), ...F.people.map(d => ({ d, ev: false }))];
    const cards = [];
    def.forEach(([, from, to], b) => {
      const inside = items.filter(({ d, ev }) => d.year >= from + (ev ? 0 : edge) && d.year <= to - (ev ? 0 : edge));
      const pick = [...inside.filter(i => i.ev), ...inside.filter(i => !i.ev)].slice(0, 3);
      for (const { d, ev } of pick) cards.push({ id: `${d.id}@when`, text: ev ? d.title : `${d.name}: ${d.clues[0]}`, about: d.id, bin: b });
    });
    return {
      id: `dates-${k + 1}`,
      kind: 'dates',
      field: 'dates',
      title: `When? ${k + 1}`,
      bins: def.map(([label, from, to], b) => ({ id: `p${b}`, label, sub: `${F.yearLabel(from)} to ${to > 2050 ? 'now' : to}` })),
      cards,
    };
  }
  function buildLevels() {
    const byField = {};
    for (const p of F.people.slice().sort((a, b) => a.year - b.year)) (byField[p.field] = byField[p.field] || []).push(p);
    const queues = {};
    for (const [field, ps] of Object.entries(byField)) {
      const groups = [];
      for (let i = 0; i < ps.length; i += 4) {
        let g = ps.slice(i, i + 4);
        if (g.length < 4) g = [...ps.slice(Math.max(0, i - (4 - g.length)), i), ...g];
        groups.push(g);
      }
      queues[field] = groups.map((g, k) => peopleLevel(field, k, g));
    }
    queues.dates = F.cfg.dateLevels.map(dateLevel);
    // Chapters mix the fields: a level of kings, then writers, then dates, and so on.
    const out = [];
    for (let ch = 0; Object.values(queues).some(q => q.length); ch++) {
      for (const f of F.cfg.order) if (queues[f] && queues[f].length) out.push(Object.assign(queues[f].shift(), { chapter: ch }));
    }
    return out;
  }

  F.load = c => {
    F.cfg = c.game;
    F.people = c.people;
    F.dates = c.dates;
    F.byId = {};
    for (const x of [...c.people, ...c.dates]) F.byId[x.id] = x;
    F.levels = buildLevels();
    F.cardById = {};
    F.levels.forEach((l, i) => l.cards.forEach(card => { F.cardById[card.id] = { card, level: i }; }));
    return F;
  };
  F.chapters = () => Math.max(...F.levels.map(l => l.chapter)) + 1;

  // ---------- memory ----------
  F.blank = () => ({ p: {}, stars: {}, best: {}, plays: 0 });
  F.status = r => (!r ? 'new' : r.lv >= F.KNOWN ? 'known' : r.lv === 0 ? 'missed' : 'learning');
  F.remember = (st, id, ok, day) => {
    const r = st.p[id] || (st.p[id] = { lv: 0, due: day, right: 0, wrong: 0 });
    if (!ok) { r.wrong++; r.lv = 0; r.due = day; return r; }
    r.right++;
    if (r.lv === 0) { r.lv = 1; r.due = day + F.cfg.levels[1]; }
    else if (r.lv < F.KNOWN && r.due <= day) {
      r.lv++;
      r.due = r.lv >= F.KNOWN ? null : day + F.cfg.levels[r.lv];
    }
    return r;
  };
  F.unlocked = (st, i) => i === 0 || (st.stars[F.levels[i - 1].id] || 0) > 0;
  F.current = st => { let i = 0; while (i < F.levels.length - 1 && F.unlocked(st, i + 1)) i++; return i; };
  F.totalStars = st => Object.values(st.stars).reduce((a, b) => a + b, 0);
  F.due = (st, day) => Object.entries(st.p)
    .filter(([id, r]) => F.cardById[id] && r.lv < F.KNOWN && r.due != null && r.due <= day)
    .map(([id]) => id);

  // A review round: the level with the most cards due, playing those cards (plus a few others).
  F.reviewLevel = (st, day, rng = Math.random) => {
    const due = F.due(st, day);
    if (!due.length) return null;
    const count = {};
    for (const id of due) { const L = F.cardById[id].level; count[L] = (count[L] || 0) + 1; }
    const L = +Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    const base = F.levels[L];
    const mine = base.cards.filter(c => due.includes(c.id));
    const more = shuffle(base.cards.filter(c => !due.includes(c.id)), rng).slice(0, Math.max(0, 8 - mine.length));
    return Object.assign({}, base, { id: `review:${base.id}`, review: true, title: `Review: ${base.title}`, cards: [...mine, ...more] });
  };

  // ---------- a round ----------
  F.start = (st, level, { rng = Math.random, day = 0 } = {}) => ({
    level,
    queue: shuffle(level.cards, rng),
    i: 0,
    hearts: F.cfg.hearts,
    score: 0,
    combo: 0,
    bestCombo: 0,
    right: 0,
    misses: [],
    taught: new Set(),
    done: false,
    failed: false,
    stars: 0,
    ctx: { st, rng, day },
  });
  F.card = R => R.queue[R.i];
  F.multiplier = combo => (combo >= 8 ? 4 : combo >= 5 ? 3 : combo >= 3 ? 2 : 1);

  F.flick = (R, bin) => {
    if (R.done) return null;
    const { st, day } = R.ctx;
    const card = F.card(R);
    const ok = card.bin === bin;
    const shown = R.taught.has(card.id) || !!st.p[card.id];
    F.remember(st, card.id, ok, day);
    let gain = 0, lostHeart = false;
    if (ok) {
      R.combo++;
      R.bestCombo = Math.max(R.bestCombo, R.combo);
      gain = F.cfg.points * F.multiplier(R.combo);
      R.score += gain;
      R.right++;
    } else {
      R.combo = 0;
      if (!R.misses.includes(card.id)) R.misses.push(card.id);
      if (shown) { R.hearts--; lostHeart = true; }
      R.taught.add(card.id);
      R.queue.splice(Math.min(R.i + 1 + F.cfg.retryGap, R.queue.length), 0, Object.assign({}, card, { again: true }));
    }
    R.i++;
    if (R.hearts <= 0) { R.done = true; R.failed = true; }
    else if (R.i >= R.queue.length) {
      R.done = true;
      R.stars = R.misses.length === 0 ? 3 : R.misses.length <= 2 ? 2 : 1;
      const id = R.level.id;
      if (!R.level.review) {
        st.stars[id] = Math.max(st.stars[id] || 0, R.stars);
        st.best[id] = Math.max(st.best[id] || 0, R.score);
      }
    }
    if (R.done) st.plays++;
    return { ok, card, bin, correct: card.bin, gain, lostHeart, combo: R.combo, done: R.done, failed: R.failed };
  };

  // What to show when a card is revealed.
  F.about = card => {
    const x = F.byId[card.about];
    return { name: x.name || x.title, year: F.yearLabel(x.year), fact: x.fact };
  };
})(typeof window !== 'undefined' ? window : globalThis);
