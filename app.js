(() => {
  'use strict';
  const F = globalThis.FLICK;
  const app = document.getElementById('app');
  const KEY = 'flick:v1';
  const SHIFT = parseInt(new URLSearchParams(location.search).get('day') || '0', 10) || 0;
  const day = () => F.today(SHIFT);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const $ = sel => app.querySelector(sel);
  const wait = ms => new Promise(r => setTimeout(r, reduced ? 30 : ms));

  let st = null;
  function load() {
    st = F.blank();
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.p) st = Object.assign(F.blank(), s);
    } catch {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }

  // ---------- icons ----------
  const P = {
    crown: 'M3 18h18l-2-10-5 4-2-7-2 7-5-4z',
    quill: 'M20 2c-6 1-11 6-13 13l-3 7 2 1 2-5c7-2 12-7 12-16z',
    flask: 'M9 2h6v2h-1v5l5 9a2 2 0 0 1-1.8 3H6.8A2 2 0 0 1 5 18l5-9V4H9z',
    medal: 'M8 2h8l-2.5 6h-3zM12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12z',
    note: 'M9 18a3 3 0 1 1-2-2.8V4l12-2v13a3 3 0 1 1-2-2.8V6.3L9 7.6z',
    palette: 'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-1.2-1-1.6-1-2.6 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 23 9.8C23 5.5 18 2 12 2zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    scroll: 'M6 3h11a3 3 0 0 1 3 3v2h-4v11a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z',
    hourglass: 'M6 2h12v2c0 3-2 5-4.5 8C16 15 18 17 18 20v2H6v-2c0-3 2-5 4.5-8C8 9 6 7 6 4z',
    star: 'M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z',
    heart: 'M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.8 12 21 12 21z',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z',
    close: 'M6 6l12 12M18 6 6 18',
    hand: 'M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.5V3.5a1.5 1.5 0 0 1 3 0V10h.5V5.5a1.5 1.5 0 0 1 3 0V15c0 4-2.5 7-6.5 7-3 0-4.6-1.4-6-3.6L4 13.6a1.6 1.6 0 0 1 2.6-1.8L9 14z',
    replay: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5',
  };
  const icon = (k, cls = '') => (k === 'close' || k === 'replay'
    ? `<svg viewBox="0 0 24 24" class="stroke ${cls}" aria-hidden="true"><path d="${P[k]}"/></svg>`
    : `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path d="${P[k]}"/></svg>`);
  const fieldIcon = f => icon(F.cfg.fields[f].icon);
  const starRow = n => [0, 1, 2].map(k => `<i class="${k < n ? 'on' : ''}">${icon('star')}</i>`).join('');

  // ---------- map ----------
  const SWAY = [0, 70, 105, 70, 0, -70, -105, -70];
  function map() {
    R = null;
    const cur = F.current(st);
    const due = F.due(st, day()).length;
    let html = '';
    F.levels.forEach((l, i) => {
      if (i === 0 || l.chapter !== F.levels[i - 1].chapter) html += `<h2 class="chapter"><span>Chapter ${l.chapter + 1}</span></h2>`;
      const open = F.unlocked(st, i);
      const stars = st.stars[l.id] || 0;
      const state = !open ? 'locked' : i === cur && !stars ? 'now' : 'done';
      html += `<div class="stop" style="--x:${SWAY[i % SWAY.length]}px">
        <button class="node f-${l.field} ${state}" data-level="${i}" ${open ? '' : 'disabled'} aria-label="Level ${i + 1}: ${esc(l.title)}${open ? '' : ', locked'}">
          ${state === 'now' ? '<span class="go">Play</span>' : ''}
          <span class="disc">${open ? fieldIcon(l.field) : icon('lock')}</span>
          <span class="num">${i + 1}</span>
        </button>
        <span class="nstars">${open && stars ? starRow(stars) : ''}</span>
        <span class="nlabel">${esc(l.title)}</span>
      </div>`;
    });
    app.innerHTML = `<main class="map">
      <header class="top">
        <h1 class="logo">Flick!</h1>
        <span class="chip">${icon('star')}<b>${F.totalStars(st)}</b></span>
      </header>
      <p class="pitch">Flick each card to the famous Brit or the time it belongs to. Learn the Life in the UK test without studying.</p>
      ${due ? `<button class="review" data-act="review">${icon('replay')}<span>Review time<small>${due} card${due > 1 ? 's' : ''} you're due to see again</small></span></button>` : ''}
      <div class="path">${html}</div>
    </main>`;
    const now = app.querySelector('.node.now') || app.querySelectorAll('.node:not(.locked)')[cur];
    if (now) now.scrollIntoView({ block: 'center' });
  }

  // ---------- a level ----------
  let R = null;
  let levelIndex = 0;
  let locked = false;
  let firstEver = false;

  function play(level, index) {
    levelIndex = index;
    R = F.start(st, level, { day: day() });
    locked = false;
    firstEver = !st.plays && index === 0;
    const bins = level.bins.map((b, k) => `<button class="bin b${k}" data-bin="${k}">
        <span class="bl">${esc(b.label)}</span>${b.sub && !/\d/.test(b.label) ? `<small>${esc(b.sub)}</small>` : ''}
      </button>`).join('');
    app.innerHTML = `<div class="level f-${level.field}">
      <header class="hud">
        <button class="sq" data-act="map" aria-label="Back to the map">${icon('close')}</button>
        <div class="bar"><i id="prog"></i></div>
        <div class="hearts" id="hearts">${[0, 1, 2].map(() => `<i>${icon('heart')}</i>`).join('')}</div>
      </header>
      <div class="sub">
        <span class="ltitle">${fieldIcon(level.field)}${esc(level.title)}</span>
        <span class="score"><b id="score">0</b><em id="mult"></em></span>
      </div>
      <div class="arena" id="arena">${bins}<div class="slot" id="slot"></div><div class="fx" id="fx"></div><div class="sheet" id="sheet" hidden></div></div>
      <p class="tip" id="tip">${level.kind === 'dates' ? 'Drag each card to the time it belongs to' : 'Drag each card to the person it belongs to'}</p>
    </div>`;
    deal();
  }

  function deal() {
    const card = F.card(R);
    const prog = R.i / R.queue.length;
    $('#prog').style.width = `${Math.round(prog * 100)}%`;
    const el = document.createElement('div');
    el.className = 'card' + (card.again ? ' again' : '');
    el.id = 'card';
    el.innerHTML = `${card.again ? '<span class="tag">Again!</span>' : ''}<span class="ct">${esc(card.text)}</span>`;
    $('#slot').replaceChildren(el);
    if (firstEver && R.i === 0) {
      const hand = document.createElement('div');
      hand.className = 'hand-hint';
      hand.innerHTML = icon('hand');
      $('#slot').appendChild(hand);
    }
    locked = false;
    bindDrag(el);
  }

  // ---------- dragging and flicking ----------
  function centre(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function aimAt(dx, dy) {
    if (Math.hypot(dx, dy) < 24) return -1;
    const c = centre($('#slot'));
    let best = -1, bestDiff = Infinity;
    app.querySelectorAll('.bin').forEach((b, k) => {
      const bc = centre(b);
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - Math.atan2(bc.y - c.y, bc.x - c.x)), Math.cos(Math.atan2(dy, dx) - Math.atan2(bc.y - c.y, bc.x - c.x))));
      if (diff < bestDiff) { bestDiff = diff; best = k; }
    });
    return best;
  }
  function markAim(k) {
    app.querySelectorAll('.bin').forEach((b, j) => b.classList.toggle('aim', j === k));
  }
  function bindDrag(el) {
    let start = null;
    el.addEventListener('pointerdown', e => {
      if (locked) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      el.setPointerCapture(e.pointerId);
      el.classList.add('held');
      const h = app.querySelector('.hand-hint');
      if (h) h.remove();
    });
    el.addEventListener('pointermove', e => {
      if (!start || locked) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)`;
      markAim(aimAt(dx, dy));
    });
    const end = e => {
      if (!start || locked) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const fast = Math.hypot(dx, dy) / Math.max(1, performance.now() - start.t) > 0.5;
      start = null;
      el.classList.remove('held');
      const k = aimAt(dx, dy);
      if (k >= 0 && (Math.hypot(dx, dy) > 70 || (fast && Math.hypot(dx, dy) > 30))) return throwTo(k);
      markAim(-1);
      el.style.transform = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function flyTo(el, bin, scale = 0.3) {
    const a = centre(el), b = centre(app.querySelector(`.bin[data-bin="${bin}"]`));
    const base = centre($('#slot'));
    el.style.transition = reduced ? 'none' : 'transform .24s cubic-bezier(.5, 0, .9, .6), opacity .24s';
    el.style.transform = `translate(${b.x - base.x}px, ${b.y - base.y}px) rotate(${(b.x - a.x) * 0.04}deg) scale(${scale})`;
  }
  function pop(text, cls, at) {
    const fx = $('#fx');
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    const a = $('#arena').getBoundingClientRect();
    el.style.left = `${at.x - a.left}px`;
    el.style.top = `${at.y - a.top}px`;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  async function throwTo(k) {
    if (locked || !R || R.done) return;
    locked = true;
    markAim(-1);
    const el = $('#card');
    const res = F.flick(R, k);
    save();
    const chosen = app.querySelector(`.bin[data-bin="${k}"]`);
    flyTo(el, k);
    await wait(230);
    if (res.ok) {
      el.style.opacity = '0';
      chosen.classList.remove('yes');
      void chosen.offsetWidth;
      chosen.classList.add('yes');
      setTimeout(() => chosen.classList.remove('yes'), 460);
      const at = centre(chosen);
      pop(R.level.kind === 'dates' ? F.about(res.card).year : `+${res.gain}`, 'good', at);
      if ([3, 5, 8].includes(res.combo)) {
        const c = $('#slot').getBoundingClientRect();
        pop(`Combo x${F.multiplier(res.combo)}!`, 'combo', { x: c.left + c.width / 2, y: c.top - 34 });
      }
      drawScore();
      await wait(260);
      return R.done ? finish() : deal();
    }
    // Wrong: bounce off the chosen name, slide to the right one, and explain.
    chosen.classList.add('no');
    if (res.lostHeart) loseHeart();
    drawScore();
    await wait(260);
    el.style.opacity = '1';
    flyTo(el, res.correct, 0.3);
    const right = app.querySelector(`.bin[data-bin="${res.correct}"]`);
    right.classList.add('answer');
    await wait(240);
    el.style.opacity = '0';
    sheet(res);
  }

  function drawScore() {
    $('#score').textContent = R.score;
    const m = F.multiplier(R.combo);
    const el = $('#mult');
    el.textContent = m > 1 ? `x${m}` : '';
    el.className = m > 1 ? 'hot' : '';
  }
  function loseHeart() {
    const hs = app.querySelectorAll('#hearts i:not(.gone)');
    const h = hs[hs.length - 1];
    if (h) h.classList.add('gone');
    $('#arena').classList.remove('hurt');
    void $('#arena').offsetWidth;
    $('#arena').classList.add('hurt');
  }

  function sheet(res) {
    const a = F.about(res.card);
    const bin = R.level.bins[res.correct];
    const dates = R.level.kind === 'dates';
    const s = $('#sheet');
    s.hidden = false;
    s.innerHTML = `<div class="panel bad">
      ${res.lostHeart ? `<p class="ouch">${icon('heart')} You've seen this one before</p>` : ''}
      <p class="verdict">It's <b>${esc(bin.label)}</b></p>
      <p class="clue">“${esc(res.card.text)}”${dates ? '' : `<span>${esc(a.year)}</span>`}</p>
      ${dates ? `<h3>${esc(a.name)}<span>${esc(a.year)}</span></h3>` : ''}
      <p class="fact">${esc(a.fact)}</p>
      ${R.done ? '' : '<p class="later">This card comes back in a moment.</p>'}
      <button class="btn" data-act="gotit">Got it</button>
    </div>`;
    s.querySelector('.btn').focus({ preventScroll: true });
  }
  function gotIt() {
    const s = $('#sheet');
    s.hidden = true;
    app.querySelectorAll('.bin').forEach(b => b.classList.remove('no', 'answer', 'yes'));
    if (R.done) return finish();
    deal();
  }

  // ---------- end of a level ----------
  function finish() {
    const win = !R.failed;
    const nextIndex = levelIndex + 1;
    const hasNext = win && !R.level.review && nextIndex < F.levels.length;
    const learn = R.misses.map(id => {
      const c = F.cardById[id] ? F.cardById[id].card : R.level.cards.find(x => x.id === id);
      const a = F.about(c);
      return `<li><b>“${esc(c.text)}”</b><span>${esc(R.level.bins[c.bin].label)}</span><p>${esc(a.fact)}</p></li>`;
    }).join('');
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="panel end ${win ? 'win' : 'lose'}">
      <div class="ribbon">${win ? (R.level.review ? 'Review done!' : 'Level complete!') : 'Out of hearts!'}</div>
      <div class="big-stars">${win ? starRow(R.stars) : [0, 1, 2].map(() => `<i class="broken">${icon('heart')}</i>`).join('')}</div>
      <p class="tally"><b>${R.score}</b> points · ${R.right} right · best combo ${R.bestCombo}</p>
      ${learn ? `<h4>Learn these</h4><ul class="learn">${learn}</ul>` : '<p class="perfect">Perfect round!</p>'}
      <div class="row">
        <button class="btn ghost" data-act="map">Map</button>
        ${hasNext ? `<button class="btn" data-act="next">Next level</button>` : `<button class="btn" data-act="again">${win ? 'Play again' : 'Try again'}</button>`}
      </div>
    </div>`;
    app.querySelector('.level').appendChild(ov);
    if (win) {
      ov.querySelectorAll('.big-stars i.on').forEach((s, k) => { s.style.animationDelay = `${0.25 + k * 0.3}s`; });
      if (!reduced) confetti(ov);
    }
  }
  function confetti(host) {
    const colours = ['#ffd23f', '#ff6b9a', '#4dd4ff', '#7cf08f', '#b98bff', '#ff8c42'];
    for (let k = 0; k < 70; k++) {
      const c = document.createElement('i');
      c.className = 'bit';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colours[k % colours.length];
      c.style.animationDelay = `${Math.random() * 0.5}s`;
      c.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      c.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      c.style.setProperty('--dx', `${Math.random() * 120 - 60}px`);
      host.appendChild(c);
    }
  }

  // ---------- input ----------
  app.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'map') return map();
    if (a === 'gotit') return gotIt();
    if (a === 'next') return play(F.levels[levelIndex + 1], levelIndex + 1);
    if (a === 'again') return R.level.review ? review() : play(F.levels[levelIndex], levelIndex);
    if (a === 'review') return review();
    if (b.dataset.level != null) return play(F.levels[+b.dataset.level], +b.dataset.level);
    if (b.dataset.bin != null && R && !locked && $('#sheet').hidden) return throwTo(+b.dataset.bin);
  });
  function review() {
    const l = F.reviewLevel(st, day());
    if (!l) return map();
    play(l, F.cardById[l.cards[0].id].level);
  }
  document.addEventListener('keydown', e => {
    if (!R) return;
    const s = $('#sheet');
    if (s && !s.hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return gotIt(); }
    const k = ['1', '2', '3', '4'].indexOf(e.key);
    if (k >= 0 && !locked && s && s.hidden && !R.done) throwTo(k);
  });

  async function content() {
    if (location.protocol !== 'file:') {
      try {
        const get = f => fetch(`content/${f}`, { cache: 'no-cache' }).then(r => r.json());
        const game = await get('game.json');
        return { game, people: await get(game.peopleFile), dates: await get(game.datesFile) };
      } catch {}
    }
    return window.FLICK_CONTENT;
  }
  content().then(c => { F.load(c); load(); map(); });
})();
