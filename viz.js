/* The three data figures: the LH forecast replay, the Jeju SMP week and the household month.
   Data: the JSON in #viz-data (built from the project files; see the build notes beside the page).
   Every figure draws its finished state on load; it moves only when a control is used, and rests
   under reduced motion. Inline SVG in a 1000-wide user space stretched to the plot (lines keep their
   width with non-scaling-stroke); labels are HTML laid over it. */
(() => {
  const src = document.getElementById('viz-data');
  if (!src) return;
  const D = JSON.parse(src.textContent);
  const EN = document.documentElement.lang === 'en';
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1000;

  const T = EN ? {
    prev: 'Day before', day: 'Target day', cut: (h) => `Information cutoff ${h}`, h: (x) => `${String(x).padStart(2, '0')}:00`,
    act: 'Actual', fc: 'Forecast', band: '80% band', err: 'Error', d1: 'Day-ahead', d0: 'Same-day',
    lhAria: (c, d, run, e) => `Complex ${c}, ${d}, ${run} forecast against actual load, as a share of the complex's peak. Error ${e}% of mean load.`,
    smp: 'SMP', base4: 'Value 4 h ago', base24: 'Value 1 day ago', wind: 'Wind', dem: 'Jeju demand', won: 'KRW/kWh', ms: 'm/s', mw: 'MW',
    neg: 'Below 0', rmse: 'Repeat RMSE', r24: '1 day', r4: '4 h', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    vppAria: (w, n) => `Jeju SMP in 15-minute steps for the week of ${w}; ${n} of 672 slots below zero.`,
    md: (m, d) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`,
    upto: (m, d) => d === 0 ? 'Start of month' : `Through ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`,
    med: 'median', over: 'past 400 kWh', end: 'by month end', mid: 'middle half', play: 'Play the month', pause: 'Pause',
    hnAria: (m, d, med, o, oe) => `${m}, through day ${d}: median household ${med} kWh, ${o}% past 400 kWh, ${oe}% by month end.`,
    tier: '400 kWh tier', kwh: 'kWh', dayN: (n) => `day ${n}`,
  } : {
    prev: '전날', day: '예측일', cut: (h) => `정보 컷 ${h}`, h: (x) => `${String(x).padStart(2, '0')}시`,
    act: '실측', fc: '예측', band: '80% 구간', err: '오차', d1: '하루 전', d0: '당일',
    lhAria: (c, d, run, e) => `단지 ${c}, ${d}, ${run} 예측과 실측. 단지 최대 사용량 대비 %. 오차는 실측 평균의 ${e}%.`,
    smp: 'SMP', base4: '4시간 전 값', base24: '하루 전 값', wind: '풍속', dem: '제주 수요', won: '원/kWh', ms: 'm/s', mw: 'MW',
    neg: '음수 칸', rmse: '그대로 쓴 기준선 RMSE', r24: '하루 전 값', r4: '4시간 전 값', days: ['일', '월', '화', '수', '목', '금', '토'],
    vppAria: (w, n) => `${w} 주의 제주 SMP, 15분 단위. 672칸 중 ${n}칸이 0원 아래.`,
    md: (m, d) => `${m}월 ${d}일`,
    upto: (m, d) => d === 0 ? '월초' : `${m}월 ${d}일까지`,
    med: '중앙값', over: '400kWh 넘은 세대', end: '이 달 말', mid: '가운데 절반', play: '한 달 재생', pause: '멈춤',
    hnAria: (m, d, med, o, oe) => `${m}, ${d}일까지: 세대 중앙값 ${med}kWh, 400kWh 넘은 세대 ${o}%, 이 달 말 ${oe}%.`,
    tier: '누진 구간 400kWh', kwh: 'kWh', dayN: (n) => `${n}일`,
  };

  /* ---------- helpers */
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const div = (cls, parent, text) => {
    const e = document.createElement('span');
    e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const ok = (v) => v != null && !Number.isNaN(v);
  const line = (vals, X, Y) => {
    let d = '', pen = false;
    vals.forEach((v, i) => {
      if (!ok(v)) { pen = false; return; }
      d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
      pen = true;
    });
    return d;
  };
  const band = (lo, hi, X, Y) => {
    let d = '', seg = [];
    const flush = () => {
      if (seg.length > 1) {
        d += 'M' + seg.map((i) => X(i).toFixed(1) + ' ' + Y(hi[i]).toFixed(1)).join('L');
        d += 'L' + seg.slice().reverse().map((i) => X(i).toFixed(1) + ' ' + Y(lo[i]).toFixed(1)).join('L') + 'Z';
      }
      seg = [];
    };
    lo.forEach((v, i) => { if (ok(v) && ok(hi[i])) seg.push(i); else flush(); });
    flush();
    return d;
  };
  const mix = (a, b, t) => b.map((v, i) => (ok(v) && a && ok(a[i]) ? a[i] + (v - a[i]) * t : v));
  // one tween per figure; a new one cancels the last
  const tweener = () => {
    let raf = 0;
    return (ms, step) => {
      cancelAnimationFrame(raf);
      if (RM.matches || !ms) { step(1); return; }
      const t0 = performance.now();
      const f = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        step(1 - Math.pow(1 - t, 3));
        if (t < 1) raf = requestAnimationFrame(f);
      };
      raf = requestAnimationFrame(f);
    };
  };
  const pct = (x) => `${(x / W) * 100}%`;
  // labels are SVG text in an unstretched overlay: x and y in % of the plot, nudged in px
  const tx = (svg, cls, text, x, y, o = {}) => {
    const t = el('text', { class: cls, x, y, dx: o.dx || 0, dy: o.dy || 0, 'text-anchor': o.a || 'start' }, svg);
    t.textContent = text;
    return t;
  };
  const overlay = (plot) => el('svg', { class: 'lbl', 'aria-hidden': 'true', focusable: 'false' }, plot);
  const xlab = (xax, text, x, i, n) => tx(xax, '', text, pct(x), 12, { a: i === 0 && x < 20 ? 'start' : i === n - 1 && x > W - 20 ? 'end' : 'middle' });
  const seg = (fig, name, onPick) => {
    const g = fig.querySelector(`[data-seg="${name}"]`);
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      for (const x of g.querySelectorAll('button[data-v]')) x.setAttribute('aria-pressed', String(x === b));
      onPick(b.dataset.v);
    });
    return () => g.querySelector('button[aria-pressed="true"]').dataset.v;
  };
  // a crosshair and a tooltip that follow the pointer and snap to the nearest step
  const hover = (plot, idx, xOf, fill) => {
    const xh = div('xh', plot), tip = div('tip', plot);
    xh.setAttribute('aria-hidden', 'true'); tip.setAttribute('aria-hidden', 'true');
    const at = (clientX) => {
      const r = plot.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const i = idx(f);
      const x = xOf(i) / W;
      xh.style.left = `${x * 100}%`;
      tip.replaceChildren();
      fill(i, tip);
      xh.style.display = tip.style.display = 'block';
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(r.width - tw, Math.max(0, x * r.width - tw / 2))}px`;
    };
    plot.addEventListener('pointermove', (e) => at(e.clientX));
    plot.addEventListener('pointerleave', () => { xh.style.display = tip.style.display = 'none'; });
  };
  const row = (tip, value, label, cls) => {
    const p = document.createElement('span');
    p.className = 'tip__row' + (cls ? ` ${cls}` : '');
    const b = document.createElement('b'); b.textContent = value;
    const s = document.createElement('span'); s.textContent = label;
    p.append(b, s);
    tip.appendChild(p);
  };
  const head = (tip, text) => { const h = div('tip__h', tip, text); return h; };

  /* ---------- 1. LH replay: 48 hours, the day before and the target day */
  const lh = document.querySelector('[data-viz="lh"]');
  if (lh && D.lh) {
    const plot = lh.querySelector('.plot'), xax = lh.querySelector('.xax'), read = lh.querySelector('.viz-read');
    const H = 400;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, plot);
    const gGrid = el('g', { class: 'grid' }, svg);
    const unknown = el('rect', { class: 'unknown', y: 0, height: H }, svg);
    el('line', { class: 'daysep', x1: W / 2, x2: W / 2, y1: 0, y2: H }, svg);
    const pBand = el('path', { class: 'ar ar--band' }, svg);
    const pAct = el('path', { class: 'ln ln--act' }, svg);
    const pFc = el('path', { class: 'ln ln--fc' }, svg);
    const cutL = el('line', { class: 'cut', y1: 0, y2: H }, svg);
    const lbl = overlay(plot), gY = el('g', {}, lbl);
    const cutLab = tx(lbl, 't-ink', '', '0%', '100%', { dx: 8, dy: -8 });
    tx(lbl, '', T.prev, pct(0), 0, { dx: 8, dy: 14 });
    tx(lbl, '', T.day, pct(W / 2), 0, { dx: 8, dy: 14 });
    for (let h = 0, k = 0; h <= 48; h += 6, k++) xlab(xax, T.h(h === 48 ? 24 : h % 24), (h / 48) * W, k, 9);
    const X = (i) => ((i + 0.5) / 48) * W;
    let yMax = 110, cur = null;
    const Y = (v) => 10 + (1 - v / yMax) * (H - 20);
    const tw = tweener();
    const pick = { date: () => '', cx: () => '', run: () => '' };
    const state = () => {
      const c = D.lh.cx.find((x) => x.id === pick.cx()), day = c.days[pick.date()], run = pick.run();
      const f = day[run];
      return {
        c, day, run,
        act: [...day.prev, ...day.act],
        fc: [...Array(24).fill(null), ...f[0]], lo: [...Array(24).fill(null), ...f[1]], hi: [...Array(24).fill(null), ...f[2]],
        cut: run === 'd1' ? 4 : 24,
      };
    };
    const grid = () => {
      gGrid.replaceChildren();
      gY.replaceChildren();
      for (const v of [0, 50, 100]) {
        el('line', { x1: 0, x2: W, y1: Y(v), y2: Y(v) }, gGrid);
        tx(gY, 't-y', v === 100 ? '100%' : String(v), 0, `${(Y(v) / H) * 100}%`, { dy: -6 });
      }
    };
    const draw = (s) => {
      pAct.setAttribute('d', line(s.act, X, Y));
      pFc.setAttribute('d', line(s.fc, X, Y));
      pBand.setAttribute('d', band(s.lo, s.hi, X, Y));
      const cx = (s.cut / 48) * W;
      cutL.setAttribute('x1', cx); cutL.setAttribute('x2', cx);
      unknown.setAttribute('x', cx); unknown.setAttribute('width', W - cx);
      cutLab.setAttribute('x', pct(cx));
    };
    const update = (animate) => {
      const s = state();
      const all = [...s.act, ...s.hi].filter(ok);
      const nextMax = Math.max(110, Math.ceil(Math.max(...all) / 10) * 10 + 10);
      const from = cur, fromMax = yMax;
      cutLab.textContent = T.cut(s.run === 'd1' ? `${T.prev} ${T.h(4)}` : `${T.day} ${T.h(0)}`);
      const e1 = s.day.e1, e0 = s.day.e0, e = s.run === 'd1' ? e1 : e0;
      read.replaceChildren();
      const k = document.createElement('span'); k.textContent = T.err;
      const b = document.createElement('b'); b.textContent = `${e}%`;
      const m = document.createElement('small'); m.textContent = `${T.d1} ${e1}% · ${T.d0} ${e0}%`;
      read.append(k, ' ', b, ' ', m);
      plot.setAttribute('aria-label', T.lhAria(s.c.id, s.day === undefined ? '' : pick.date(), s.run === 'd1' ? T.d1 : T.d0, e));
      tw(animate && from ? 520 : 0, (t) => {
        yMax = fromMax + (nextMax - fromMax) * t;
        grid();
        draw(from ? { act: mix(from.act, s.act, t), fc: mix(from.fc, s.fc, t), lo: mix(from.lo, s.lo, t), hi: mix(from.hi, s.hi, t), cut: from.cut + (s.cut - from.cut) * t } : s);
      });
      cur = s;
    };
    pick.date = seg(lh, 'date', () => update(true));
    pick.cx = seg(lh, 'cx', () => update(true));
    pick.run = seg(lh, 'run', () => update(true));
    hover(plot, (f) => Math.min(47, Math.max(0, Math.floor(f * 48))), X, (i, tip) => {
      const s = cur, hh = i % 24;
      head(tip, `${i < 24 ? T.prev : T.day} ${T.h(hh)}`);
      if (ok(s.act[i])) row(tip, `${Math.round(s.act[i])}%`, T.act, 'tip__row--act');
      if (ok(s.fc[i])) {
        row(tip, `${Math.round(s.fc[i])}%`, T.fc, 'tip__row--fc');
        row(tip, `${Math.round(s.lo[i])}–${Math.round(s.hi[i])}%`, T.band);
      }
    });
    update(false);
  }

  /* ---------- 2. Jeju SMP week: 672 fifteen-minute slots, a strip under it */
  const vp = document.querySelector('[data-viz="vpp"]');
  if (vp && D.vpp) {
    const plot = vp.querySelector('.plot'), xax = vp.querySelector('.xax'), read = vp.querySelector('.viz-read');
    const H = 420, TOP = [10, 286], BOT = [318, 410];
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, plot);
    const gGrid = el('g', { class: 'grid' }, svg);
    const gDays = el('g', { class: 'days' }, svg);
    const zero = el('line', { class: 'zero', x1: 0, x2: W }, svg);
    const pNeg = el('path', { class: 'ar ar--neg' }, svg);
    const pBase = el('path', { class: 'ln ln--base' }, svg);
    const pSmp = el('path', { class: 'ln ln--fc' }, svg);
    const pLow = el('path', { class: 'ln ln--low' }, svg);
    const pLowA = el('path', { class: 'ar ar--low' }, svg);
    const lbl = overlay(plot);
    const X = (j) => ((j + 0.5) / 672) * W;
    const XH = (k) => ((k * 4 + 2) / 672) * W;
    const tw = tweener();
    let cur = null, lim = null;
    const pick = { wk: () => '', low: () => '', base: () => '' };
    const lab = (cls, text, x, y) => tx(lbl, cls, text, 0, `${(y / H) * 100}%`, { dy: -6 });
    const state = () => {
      const w = D.vpp.weeks.find((x) => x.start === pick.wk()), low = pick.low(), base = pick.base();
      const smp = w.smp.slice(96);
      const lag = base === 'b4' ? 16 : base === 'b24' ? 96 : 0;
      const bs = lag ? w.smp.slice(96 - lag, 768 - lag) : smp.map(() => null);
      const strip = (low === 'wind' ? w.wind : w.dem).slice(24);
      return { w, low, base, smp, bs, strip, neg: smp.map((v) => (ok(v) ? Math.min(v, 0) : null)) };
    };
    const limits = (s) => {
      const v = [...s.smp, ...s.bs].filter(ok);
      const lo = Math.min(0, ...v), hi = Math.max(...v);
      const step = hi - lo > 220 ? 100 : 50;
      const sv = s.strip.filter(ok);
      const slo = s.low === 'wind' ? 0 : Math.floor(Math.min(...sv) / 100) * 100;
      const shi = s.low === 'wind' ? Math.max(8, Math.ceil(Math.max(...sv) / 2) * 2) : Math.ceil(Math.max(...sv) / 100) * 100;
      return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step, slo, shi };
    };
    const Yt = (L) => (v) => TOP[0] + (1 - (v - L.lo) / (L.hi - L.lo)) * (TOP[1] - TOP[0]);
    const Yb = (L) => (v) => BOT[0] + (1 - (v - L.slo) / (L.shi - L.slo)) * (BOT[1] - BOT[0]);
    const frame = (s, L) => {
      gGrid.replaceChildren(); lbl.replaceChildren();
      const yt = Yt(L), yb = Yb(L);
      for (let v = L.lo; v <= L.hi + 0.1; v += L.step) {
        if (v === 0) continue;
        el('line', { x1: 0, x2: W, y1: yt(v), y2: yt(v) }, gGrid);
        lab('t-y', String(v), null, yt(v));
      }
      zero.setAttribute('y1', yt(0)); zero.setAttribute('y2', yt(0));
      lab('t-y t-ink', `0 ${T.won}`, null, yt(0));
      el('line', { x1: 0, x2: W, y1: BOT[1], y2: BOT[1] }, gGrid);
      lab('t-y', `${s.low === 'wind' ? T.wind : T.dem} · ${L.shi} ${s.low === 'wind' ? T.ms : T.mw}`, null, BOT[0] - 2);
    };
    const days = (w) => {
      gDays.replaceChildren(); xax.replaceChildren();
      const t0 = new Date(`${w.start}T00:00:00`);
      for (let k = 0; k < 7; k++) {
        const d = new Date(t0.getTime() + k * 864e5);
        if (k) el('line', { x1: (k / 7) * W, x2: (k / 7) * W, y1: 0, y2: H }, gDays);
        tx(xax, '', `${d.getMonth() + 1}/${d.getDate()} ${T.days[d.getDay()]}`, pct(((k + 0.5) / 7) * W), 12, { a: 'middle' });
      }
    };
    const draw = (s, L) => {
      const yt = Yt(L), yb = Yb(L);
      pSmp.setAttribute('d', line(s.smp, X, yt));
      pBase.setAttribute('d', line(s.bs, X, yt));
      pNeg.setAttribute('d', band(s.neg, s.neg.map((v) => (ok(v) ? 0 : null)), X, yt));
      pLow.setAttribute('d', line(s.strip, XH, yb));
      pLowA.setAttribute('d', band(s.strip.map((v) => (ok(v) ? L.slo : null)), s.strip, XH, yb));
    };
    const update = (animate, keepWeek) => {
      const s = state(), L = limits(s);
      if (!keepWeek) days(s.w);
      const from = cur, fromL = lim;
      read.replaceChildren();
      const k1 = document.createElement('span'); k1.textContent = T.neg;
      const b1 = document.createElement('b'); b1.textContent = `${s.w.neg}`;
      const m1 = document.createElement('small'); m1.textContent = `/ 672`;
      const k2 = document.createElement('span'); k2.className = 'viz-read__k2'; k2.textContent = `${T.rmse}`;
      const m2 = document.createElement('small');
      m2.textContent = `${T.r24} ${s.w.r24} · ${T.r4} ${s.w.r4}`;
      read.append(k1, ' ', b1, ' ', m1, ' ', k2, ' ', m2);
      plot.setAttribute('aria-label', T.vppAria(s.w.start, s.w.neg));
      const same = from && from.w === s.w && from.low === s.low;
      tw(animate && same ? 420 : 0, (t) => {
        const LL = same && fromL ? { ...L, lo: fromL.lo + (L.lo - fromL.lo) * t, hi: fromL.hi + (L.hi - fromL.hi) * t } : L;
        frame(s, LL);
        draw(same ? { ...s, bs: from.base === 'none' ? s.bs : mix(from.bs, s.bs, t) } : s, LL);
      });
      cur = s; lim = L;
    };
    pick.wk = seg(vp, 'wk', () => update(true));
    pick.low = seg(vp, 'low', () => update(true, true));
    pick.base = seg(vp, 'base', () => update(true, true));
    hover(plot, (f) => Math.min(671, Math.max(0, Math.floor(f * 672))), X, (j, tip) => {
      const s = cur, t = new Date(new Date(`${s.w.start}T00:00:00`).getTime() + j * 9e5);
      head(tip, `${T.md(t.getMonth() + 1, t.getDate())} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
      if (ok(s.smp[j])) row(tip, `${s.smp[j]}`, `${T.smp} ${T.won}`, 'tip__row--fc');
      if (ok(s.bs[j])) row(tip, `${s.bs[j]}`, s.base === 'b4' ? T.base4 : T.base24, 'tip__row--base');
      const v = s.strip[Math.floor(j / 4)];
      if (ok(v)) row(tip, `${Math.round(v)}`, s.low === 'wind' ? `${T.wind} ${T.ms}` : `${T.dem} ${T.mw}`);
    });
    update(false);
  }

  /* ---------- 3. Household month: cumulative use of every household, as percentiles */
  const hn = document.querySelector('[data-viz="hn"]');
  if (hn && D.hn) {
    const plot = hn.querySelector('.plot'), xax = hn.querySelector('.xax'), read = hn.querySelector('.viz-read');
    const range = hn.querySelector('input[type="range"]'), play = hn.querySelector('[data-play]');
    const H = 400;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, plot);
    const gGrid = el('g', { class: 'grid' }, svg);
    const defs = el('defs', {}, svg);
    const clip = el('clipPath', { id: 'hn-past' }, defs);
    const clipR = el('rect', { x: 0, y: -10, height: H + 20, width: 0 }, clip);
    const faded = el('g', { class: 'fan fan--future' }, svg);
    const past = el('g', { class: 'fan', 'clip-path': 'url(#hn-past)' }, svg);
    const mk = (g) => ({ b90: el('path', { class: 'ar ar--q90' }, g), b50: el('path', { class: 'ar ar--q50' }, g), med: el('path', { class: 'ln ln--fc' }, g) });
    const F = mk(faded), P = mk(past);
    const tier = el('line', { class: 'tier', x1: 0, x2: W }, svg);
    const cursor = el('line', { class: 'cursor', y1: 0, y2: H }, svg);
    const dot = div('dot', plot), lbl = overlay(plot), gY = el('g', {}, lbl), tierLab = tx(lbl, 't-y t-ink', T.tier, '100%', 0, { dy: -6, a: 'end' });
    let m = null, d = 0, timer = 0, yMax = 600;
    const X = (i) => (i / m.days) * W;
    const Y = (v) => 10 + (1 - v / yMax) * (H - 20);
    const pick = { mo: () => '' };
    const setPlay = (on) => {
      play.setAttribute('aria-pressed', String(on));
      play.querySelector('span').textContent = on ? T.pause : T.play;
    };
    const stop = () => { clearInterval(timer); timer = 0; setPlay(false); };
    const readout = () => {
      const o = m.over[d], oe = m.over[m.days], med = m.q[2][d];
      read.replaceChildren();
      const k = document.createElement('span'); k.textContent = T.upto(m.month, d);
      const b = document.createElement('b'); b.textContent = `${o}%`;
      const s1 = document.createElement('small'); s1.textContent = T.over;
      const s2 = document.createElement('small'); s2.className = 'viz-read__k2'; s2.textContent = `${T.end} ${oe}% · ${T.med} ${med} ${T.kwh}`;
      read.append(k, ' ', b, ' ', s1, ' ', s2);
      range.setAttribute('aria-valuetext', `${T.upto(m.month, d)}: ${T.med} ${med} ${T.kwh}, ${T.over} ${o}%`);
      plot.setAttribute('aria-label', T.hnAria(`${m.year}-${String(m.month).padStart(2, '0')}`, d, med, o, oe));
    };
    const place = () => {
      const x = X(d);
      clipR.setAttribute('width', x);
      cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
      dot.style.left = pct(x); dot.style.top = `${(Y(m.q[2][d]) / H) * 100}%`;
      range.value = String(d);
      readout();
    };
    const build = () => {
      m = D.hn.months.find((x) => String(x.month) === pick.mo());
      yMax = Math.ceil((Math.max(m.q[4][m.days], 400) * 1.15) / 100) * 100;
      gGrid.replaceChildren(); gY.replaceChildren(); xax.replaceChildren();
      for (let v = 0; v <= yMax; v += 200) {
        el('line', { x1: 0, x2: W, y1: Y(v), y2: Y(v) }, gGrid);
        tx(gY, 't-y', v ? `${v}` : `0 ${T.kwh}`, 0, `${(Y(v) / H) * 100}%`, { dy: -6 });
      }
      const ticks = [5, 10, 15, 20, 25, m.days].filter((t) => !(t === 25 && m.days - 25 < 3));
      ticks.forEach((t, k) => xlab(xax, t === m.days ? T.dayN(t) : String(t), X(t), k, ticks.length));
      tier.setAttribute('y1', Y(400)); tier.setAttribute('y2', Y(400));
      tierLab.setAttribute('y', `${(Y(400) / H) * 100}%`);
      for (const G of [F, P]) {
        G.b90.setAttribute('d', band(m.q[0], m.q[4], X, Y));
        G.b50.setAttribute('d', band(m.q[1], m.q[3], X, Y));
        G.med.setAttribute('d', line(m.q[2], X, Y));
      }
      range.max = String(m.days);
      d = Math.min(d, m.days);
      place();
    };
    pick.mo = seg(hn, 'mo', () => { stop(); build(); });
    range.addEventListener('input', () => { stop(); d = Number(range.value); place(); });
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      if (RM.matches) { d = m.days; place(); return; }
      if (d >= m.days) d = 0;
      setPlay(true);
      place();
      timer = setInterval(() => {
        d += 1; place();
        if (d >= m.days) stop();
      }, 140);
    });
    hover(plot, (f) => Math.round(f * m.days), (i) => X(i), (i, tip) => {
      head(tip, T.upto(m.month, i));
      row(tip, `${m.q[2][i]} ${T.kwh}`, T.med, 'tip__row--fc');
      row(tip, `${m.q[1][i]}–${m.q[3][i]}`, T.mid);
      row(tip, `${m.over[i]}%`, T.over);
    });
    setPlay(false);
    d = Number(range.value) || 7;
    build();
  }
})();
