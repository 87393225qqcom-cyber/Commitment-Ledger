(() => {
  const BLOCKERS = ['Meetings', 'Distraction', 'Underestimated', 'Low energy', 'Unclear next step', 'Interruptions'];
  const ESTS = [25, 50, 90, 120];
  const CATS = [
    { id: 'passion', name: 'Passion-driven', blurb: 'Work you want to do. Protect time for it before it gets crowded out.' },
    { id: 'must', name: 'Must-do', blurb: 'Obligations with real consequences if they slip.' },
    { id: 'baseline', name: 'Baseline', blurb: 'Routine upkeep that keeps everything else running.' }
  ];
  const catName = id => (CATS.find(c => c.id === id) || CATS[1]).name;
  const METRICS = [
    { id: 'words', name: 'Word count', hint: 'Papers, manuscripts, chapters' },
    { id: 'time', name: 'Time', hint: 'Workouts, practice, study' },
    { id: 'other', name: 'Other', hint: 'Components, milestones, notes' }
  ];
  const metricName = id => (METRICS.find(m => m.id === id) || METRICS[1]).name;
  const projMetric = p => METRICS.some(m => m.id === p.metric) ? p.metric : 'time';
  const nf = n => Math.round(n).toLocaleString();
  const targetHint = (metric, hasDue) => metric === 'words' ? 'Target words (optional)' : metric === 'time' ? (hasDue ? 'Total hours (optional)' : 'Hours per week (optional)') : '';

  // ---------- progress maths ----------
  function allLogs() {
    const out = [];
    Object.values(state.days).forEach(d => (d.logs || []).forEach(l => out.push(Object.assign({ date: d.date }, l))));
    return out;
  }
  function projWords(pid, from) { return allLogs().filter(l => l.project === pid && l.kind === 'words' && (!from || l.date >= from)).reduce((a, l) => a + (l.value || 0), 0); }
  function projMinutes(pid, from) {
    let m = 0;
    Object.values(state.days).forEach(d => { if (from && d.date < from) return; (d.tasks || []).forEach(t => { if (t.project === pid) m += t.minutes || 0; }); (d.logs || []).forEach(l => { if (l.project === pid && l.kind === 'time') m += l.value || 0; }); });
    return m;
  }
  function progressOf(p) {
    const today = todayKey(), ws = weekStart(today), metric = projMetric(p);
    const left = p.deadline ? daysBetween(today, p.deadline) : null;
    const out = { metric, ratio: null, head: '', sub: [] };
    if (metric === 'words') {
      const total = (p.startWords || 0) + projWords(p.id);
      const week = projWords(p.id, ws);
      out.head = p.target ? `${nf(total)} / ${nf(p.target)} words` : `${nf(total)} words`;
      if (p.target) out.ratio = Math.min(1, total / p.target);
      out.sub.push(`${nf(week)} this week`);
      if (p.target && total < p.target && left != null) out.sub.push(left > 0 ? `≈ ${nf(Math.ceil((p.target - total) / left))} words/day to finish on time` : `${nf(p.target - total)} words short of the target`);
      if (p.target && total >= p.target) out.sub.push('Target reached');
    } else if (metric === 'time') {
      if (p.deadline) {
        const total = projMinutes(p.id);
        out.head = p.target ? `${mins(total)} / ${p.target}h` : `${mins(total)} total`;
        if (p.target) { out.ratio = Math.min(1, total / (p.target * 60)); if (total < p.target * 60 && left > 0) out.sub.push(`≈ ${mins(Math.ceil((p.target * 60 - total) / left))}/day to finish on time`); }
        out.sub.push(`${mins(projMinutes(p.id, ws))} this week`);
      } else {
        const week = projMinutes(p.id, ws);
        out.head = p.target ? `${mins(week)} / ${p.target}h this week` : `${mins(week)} this week`;
        if (p.target) out.ratio = Math.min(1, week / (p.target * 60));
        out.sub.push(`${mins(projMinutes(p.id))} all time`);
      }
    } else {
      const items = backlog().filter(b => b.project === p.id);
      const done = items.filter(b => b.done).length;
      out.head = items.length ? `${done} of ${items.length} milestones` : 'No milestones yet';
      if (items.length) out.ratio = done / items.length;
      const notes = allLogs().filter(l => l.project === p.id && l.note).sort((a, b) => (a.at || '') < (b.at || '') ? 1 : -1);
      if (notes[0]) out.sub.push(`Latest: “${notes[0].note}” (${shortDate(notes[0].date)})`);
    }
    return out;
  }
  const CHECK = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const state = { days: {}, profile: { projects: [] }, ready: false, view: 'today', ui: { dropping: null, confirmDel: null }, note: '', settings: {} };

  // ---------- dates ----------
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return fmt(d); };
  const todayKey = () => fmt(new Date());
  const weekStart = k => { const d = parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); };
  const longDate = k => parse(k).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const shortDate = k => parse(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const mins = m => m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `${m}m`;
  const rid = () => Math.random().toString(36).slice(2, 10);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- model ----------
  const newDay = k => ({ date: k, locked: false, lockedAt: null, rest: false, tasks: [], review: { closed: false, rating: 0, blockers: [], note: '', tomorrow: '' } });
  const getDay = k => state.days[k] || newDay(k);
  function stats(d) {
    const tasks = d.tasks || [];
    const committed = tasks.filter(t => !t.late);
    const done = committed.filter(t => t.done).length;
    return {
      committed: committed.length, done,
      extra: tasks.filter(t => t.late && t.done).length,
      dropped: tasks.filter(t => t.dropped).length,
      rate: committed.length ? done / committed.length : null,
      minutes: tasks.reduce((a, t) => a + (t.minutes || 0), 0)
    };
  }
  const projectName = id => (state.profile.projects || []).find(p => p.id === id)?.name || '';
  const projectOf = id => (state.profile.projects || []).find(p => p.id === id) || null;
  const activeProjects = () => (state.profile.projects || []).filter(p => !p.archived);
  const projCat = p => CATS.some(c => c.id === p.category) ? p.category : 'must';
  const backlog = () => state.profile.backlog || [];
  // A day task's category: its own, else its project's.
  const taskCat = t => t.category || (t.project && projectOf(t.project) ? projCat(projectOf(t.project)) : null);
  const counts = d => d && d.rest ? 'rest' : (d && d.review?.closed && (stats(d).rate ?? 0) >= 0.5 ? 'kept' : 'no');
  function streak() {
    let k = todayKey(), s = 0;
    const t = state.days[k];
    if (!(t && (t.rest || t.review?.closed))) k = addDays(k, -1);
    for (let guard = 0; guard < 2000; guard++) {
      const c = counts(state.days[k]);
      if (c === 'rest') { k = addDays(k, -1); continue; }
      if (c === 'kept') { s++; k = addDays(k, -1); continue; }
      break;
    }
    return s;
  }
  function weekStats(start) {
    const out = { committed: 0, done: 0, minutes: 0, closed: 0 };
    const today = todayKey();
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i); if (k > today) break;
      const d = state.days[k]; if (!d) continue;
      const s = stats(d);
      out.committed += s.committed; out.done += s.done; out.minutes += s.minutes;
      if (d.review?.closed) out.closed++;
    }
    out.rate = out.committed ? out.done / out.committed : null;
    return out;
  }
  const pct = r => r == null ? '—' : Math.round(r * 100) + '%';

  // ---------- storage (this device only: localStorage) ----------
  const LOCAL = 'commitment-ledger.v1';
  const SCHEMA = 1;
  const DEFAULT_SETTINGS = { alarmSound: 'celebration', morningBriefing: true, eveningSummary: true, eveningHour: 18, lastBriefing: null, lastEvening: null, lastBackup: null };
  const Store = {
    backend: 'local', saveTimer: null, failed: false,
    init() {
      try {
        const raw = localStorage.getItem(LOCAL);
        if (raw) this.apply(JSON.parse(raw));
      } catch (e) { state.note = 'Saved data couldn’t be read. Import a backup from Settings.'; }
      state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
      // Ask the browser to keep this data even when space is low (best effort).
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
      state.ready = true; render(); triggers();
    },
    apply(v) {
      state.days = v.days && typeof v.days === 'object' ? v.days : {};
      state.profile = v.profile && typeof v.profile === 'object' ? v.profile : { projects: [], backlog: [] };
      if (!state.profile.projects) state.profile.projects = [];
      if (!state.profile.backlog) state.profile.backlog = [];
      state.settings = Object.assign({}, DEFAULT_SETTINGS, v.settings || {});
    },
    snapshot() { return { app: 'commitment-ledger', schema: SCHEMA, exportedAt: new Date().toISOString(), days: state.days, profile: state.profile, settings: state.settings }; },
    // Every change goes through here; writes are batched into one save per 300 ms.
    save() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.flush(), 300);
    },
    flush() {
      clearTimeout(this.saveTimer);
      try { localStorage.setItem(LOCAL, JSON.stringify(this.snapshot())); this.failed = false; }
      catch (e) { if (!this.failed) toast('Couldn’t save on this device. Export a backup from Settings now.'); this.failed = true; }
    }
  };
  // Save immediately when the app is hidden or closed (iOS may suspend it any time after).
  window.addEventListener('pagehide', () => Store.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(); });

  function mutateDay(k, fn, opts = {}) {
    const d = JSON.parse(JSON.stringify(getDay(k)));
    fn(d);
    state.days[k] = d;
    if (opts.debounce) {
      clearTimeout(mutateDay.t[k]);
      mutateDay.t[k] = setTimeout(() => Store.save(k, state.days[k]), 700);
    } else Store.save(k, d);
    if (!opts.quiet) render();
  }
  mutateDay.t = {};
  function mutateProfile(fn) {
    const p = JSON.parse(JSON.stringify(state.profile || { projects: [] }));
    if (!p.projects) p.projects = [];
    if (!p.backlog) p.backlog = [];
    fn(p); state.profile = p; Store.save('profile', p); render();
  }

  // ---------- focus timer (full-screen view, countdown to a target, wake lock, chime) ----------
  const TKEY = 'commitment-ledger.timer';
  const TARGETS = [15, 25, 50, 90];
  let timer = null;
  try { timer = JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) {}
  if (timer && !timer.target) timer.target = 25;
  const saveTimer = () => { try { timer ? localStorage.setItem(TKEY, JSON.stringify(timer)) : localStorage.removeItem(TKEY); } catch (e) {} };
  let focusOpen = false, wakeLock = null, audioCtx = null;
  const baseTitle = document.title;
  const timerTask = () => timer ? getDay(timer.day).tasks.find(x => x.id === timer.taskId) : null;

  function startTimer(day, taskId) {
    if (timer) stopTimer();
    const t = getDay(day).tasks.find(x => x.id === taskId);
    const left = (t && t.est ? t.est : 50) - (t && t.minutes || 0);
    // Default target: what's left of the task's estimate, or a 25-minute block once it's used up.
    timer = { day, taskId, start: Date.now(), target: left >= 5 ? left : 25, alerted: false };
    saveTimer(); unlockAudio(); render(); openFocus();
  }
  function stopTimer() {
    if (!timer) return;
    const m = Math.round((Date.now() - timer.start) / 60000);
    const t = timer; timer = null; saveTimer();
    closeFocus();
    document.title = baseTitle;
    if (m >= 1) {
      mutateDay(t.day, d => { const task = d.tasks.find(x => x.id === t.taskId); if (task) task.minutes = (task.minutes || 0) + m; });
      toast(`Logged ${mins(m)} of focus.`);
    } else { toast('Under a minute, so nothing was logged.'); render(); }
  }

  // Full-screen view
  function openFocus() {
    if (!timer) return;
    focusOpen = true;
    const el = document.getElementById('focus');
    renderFocus(); el.hidden = false;
    document.body.classList.add('modal-open');
    requestWakeLock();
    try { if (el.requestFullscreen && !document.fullscreenElement && !isStandalone()) el.requestFullscreen().catch(() => {}); } catch (e) {}
    tick();
  }
  function closeFocus() {
    focusOpen = false;
    const el = document.getElementById('focus');
    el.hidden = true; el.innerHTML = '';
    if (document.getElementById('modal').hidden) document.body.classList.remove('modal-open');
    releaseWakeLock();
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  }
  // The dial: a ring of irregular ticks that wears away clockwise as the session runs.
  const TR = 262; // radius of the text circle, inside both rings
  const C330 = 2 * Math.PI * TR;
  function seededRandom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // One ring of ticks. `top` is the distance in from the dial's edge (viewBox 1000, centre 500).
  function ringTicks(rnd, o) {
    const phase = rnd() * 6.28;
    let out = '';
    for (let i = 0; i < o.n; i++) {
      const f = i / o.n, density = Math.sin(f * Math.PI * o.waves + phase) * 0.5 + 0.5;
      if (rnd() < o.gap + (1 - density) * o.gapWave) continue;
      const k = rnd();
      let w, len;
      if (k < o.thin) { w = o.wThin[0] + rnd() * o.wThin[1]; len = o.len[0] + rnd() * o.len[1]; }
      else if (k < o.thin + o.mid) { w = o.wMid[0] + rnd() * o.wMid[1]; len = o.len[0] + 10 + rnd() * o.len[1]; }
      else { w = o.wBig[0] + rnd() * o.wBig[1]; len = o.len[0] + rnd() * o.len[1] * 0.8; }
      const top = o.top + rnd() * o.topJitter;
      let s = `<rect x="${(500 - w / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${len.toFixed(1)}"/>`;
      if (w > 18 && rnd() < 0.6) {
        const w2 = w * (0.35 + rnd() * 0.45), x2 = rnd() < 0.5 ? 500 - w / 2 : 500 + w / 2 - w2;
        s += `<rect x="${x2.toFixed(1)}" y="${(top + len + 5).toFixed(1)}" width="${w2.toFixed(1)}" height="${(14 + rnd() * 26).toFixed(1)}"/>`;
      }
      const a = f * 360 + (rnd() - 0.5) * 0.8;
      out += `<g${o.track ? ` class="tk" data-f="${f.toFixed(4)}"` : ''} transform="rotate(${a.toFixed(2)} 500 500)">${s}</g>`;
    }
    return out;
  }
  // Two overlapping concentric rings, each its own layer so the phone can spin them cheaply:
  // the outer ring turns clockwise and wears away with the session; the inner one turns counter-clockwise.
  function dialSVG(seed) {
    const rnd = seededRandom(seed || 'focus');
    const outer = ringTicks(rnd, { n: 168, waves: 5, gap: 0.08, gapWave: 0.32, thin: 0.55, mid: 0.31, wThin: [3, 2.5], wMid: [8, 7], wBig: [22, 16], len: [34, 54], top: 22, topJitter: 22, track: true });
    const inner = ringTicks(rnd, { n: 210, waves: 7, gap: 0.1, gapWave: 0.4, thin: 0.72, mid: 0.22, wThin: [1.6, 2], wMid: [5, 5], wBig: [14, 10], len: [18, 44], top: 108, topJitter: 26, track: false });
    const lap = `A${TR},${TR} 0 1,1 500,${500 + TR} A${TR},${TR} 0 1,1 500,${500 - TR}`;
    return `<svg class="dial-svg ring-cw" viewBox="0 0 1000 1000" aria-hidden="true"><g class="dial-ticks">${outer}</g></svg>
      <svg class="dial-svg ring-ccw" viewBox="0 0 1000 1000" aria-hidden="true"><g class="dial-ticks inner">${inner}</g></svg>
      <svg class="dial-svg" viewBox="0 0 1000 1000" aria-hidden="true">
        <defs><path id="dial-path" d="M500,${500 - TR} ${lap} ${lap}"/></defs>
        <circle id="dial-dot" r="11" cx="500" cy="${500 - TR}"/>
        <text class="dial-text"><textPath id="dial-label" href="#dial-path" startOffset="0"></textPath></text>
        <text class="dial-text"><textPath id="dial-meta" href="#dial-path" startOffset="25%"></textPath></text>
      </svg>`;
  }
  let dialTicks = [];

  function renderFocus() {
    const el = document.getElementById('focus'); if (!timer) return;
    const t = timerTask(), c = t ? taskCat(t) : null;
    const meta = [c ? catName(c) : null, t && t.project ? projectName(t.project) : null].filter(Boolean).join(' · ');
    el.innerHTML = `<div class="dial">${dialSVG(timer.taskId + ':' + timer.start)}</div>
      <div class="f-layer">
        <div class="f-top"><span id="wake-status" class="f-small"></span>
          <span class="f-links"><button class="f-link" data-act="focus-test">Test sound</button><button class="f-link" data-act="focus-min">Minimize</button></span></div>
        <div class="f-title">${meta ? `<span class="f-small">${esc(meta)}</span>` : ''}<h2>${esc(t ? t.text : 'Focus session')}</h2></div>
        <div class="f-center"><div id="focus-time">--:--</div><div id="focus-sub" class="f-small"></div></div>
        <div class="f-bottom">
          <div id="focus-alert" class="f-alert" role="alert" ${timer.alerted && !timer.ack ? '' : 'hidden'}>
            <p class="f-alert-head">● Time’s up</p><p>You reached your ${mins(timer.target)} target. Log it, or keep going.</p>
            <div class="f-row"><button class="f-btn inv" data-act="focus-add10">+10 min</button><button class="f-btn inv" data-act="focus-keep">Keep going</button><button class="f-btn inv solid" data-act="stop">Stop and log</button></div></div>
          <div class="f-targets"><span class="f-small">Target</span>
            ${[...new Set([...TARGETS, timer.target])].sort((a, b) => a - b).map(v => `<button class="f-chip" data-act="focus-target" data-v="${v}" aria-pressed="${v === timer.target}">${mins(v)}</button>`).join('')}</div>
          <div class="f-row"><button class="f-btn" data-act="focus-done">Mark done</button><button class="f-btn solid" data-act="stop">Stop and log</button></div>
        </div>
      </div>`;
    dialTicks = [...el.querySelectorAll('.tk')].map(g => ({ g, f: Number(g.dataset.f), gone: false }));
    updateWake();
  }
  const clockText = s => s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  function endsAt() { return new Date(timer.start + timer.target * 60000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  function tick() {
    if (!timer) return;
    const s = Math.floor((Date.now() - timer.start) / 1000), targetS = timer.target * 60;
    const card = document.getElementById('clock'); if (card) card.textContent = clockText(s);
    const over = s >= targetS;
    document.title = over ? `+${clockText(s - targetS)} · Focus` : `${clockText(targetS - s)} · Focus`;
    if (focusOpen) {
      const time = document.getElementById('focus-time'), sub = document.getElementById('focus-sub');
      if (time) time.textContent = over ? `+${clockText(s - targetS)}` : clockText(targetS - s);
      if (sub) sub.textContent = over ? `over your ${mins(timer.target)} target` : `left of ${mins(timer.target)}`;
      const p = over ? 1 : s / targetS;
      dialTicks.forEach(tk => { const gone = !over && tk.f < p; if (gone !== tk.gone) { tk.gone = gone; tk.g.classList.toggle('gone', gone); } });
      const ang = 2 * Math.PI * (over ? 0 : p);
      const dot = document.getElementById('dial-dot');
      if (dot) { dot.setAttribute('cx', (500 + TR * Math.sin(ang)).toFixed(1)); dot.setAttribute('cy', (500 - TR * Math.cos(ang)).toFixed(1)); }
      const pos = over ? 0 : p, label = document.getElementById('dial-label'), metaEl = document.getElementById('dial-meta');
      if (label) { label.setAttribute('startOffset', ((pos * C330 + 26) / (2 * C330) * 100).toFixed(3) + '%'); { const tt = timerTask(); const name = tt ? (tt.text.length > 42 ? tt.text.slice(0, 40) + "…" : tt.text) : "Focus"; label.textContent = over ? `Over by ${clockText(s - targetS)}` : name; } }
      if (metaEl) { metaEl.setAttribute('startOffset', (((pos + 0.5) % 1) * C330 / (2 * C330) * 100).toFixed(3) + '%'); metaEl.textContent = `Ends ${endsAt()} · ${mins(timer.target)} session`; }
      document.getElementById('focus').classList.toggle('over', over);
    }
    if (over && !timer.alerted) { timer.alerted = true; timer.ack = false; saveTimer(); fireAlert(); }
  }
  setInterval(tick, 1000);

  function fireAlert() {
    playChime();
    // Play once more after 8 s if the alert is still waiting for you.
    const startedAt = timer && timer.start;
    setTimeout(() => { const a = document.getElementById("focus-alert"); if (timer && timer.start === startedAt && !timer.ack && a && !a.hidden) playChime(); }, 8000);
    try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {}
    if (!focusOpen) openFocus();
    const a = document.getElementById('focus-alert'); if (a) a.hidden = false;
  }

  // Keep the screen on while the full-screen view is open (iOS 16.4+, most modern browsers).
  async function requestWakeLock() {
    if (!focusOpen || document.hidden) return;
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; updateWake(); }); } }
    catch (e) { wakeLock = null; }
    updateWake();
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
  function updateWake() {
    const s = document.getElementById('wake-status'); if (!s) return;
    s.textContent = wakeLock ? '● Screen stays on' : 'Screen may sleep. Keep the app open for the alert.';
  }

  // Sound: browsers only allow audio after a tap, so the context is unlocked when you press Focus.
  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(); g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.03);
    } catch (e) {}
  }
  // ---- Alarm sounds, synthesized live (no audio files) ----
  const SOUNDS = [
    { id: 'celebration', name: 'Celebration', hint: 'Bright bell fanfare with a sparkle finish' },
    { id: 'marimba', name: 'Marimba', hint: 'Bouncy wooden riff' },
    { id: 'musicbox', name: 'Music box', hint: 'Soft little tune' }
  ];
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note number to Hz
  function voice(ctx, out, t, midi, dur, vel, kind) {
    const f = NOTE(midi), env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vel, t + (kind === 'marimba' ? 0.004 : 0.008));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(out);
    const osc = (type, freq, gain) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = gain; o.connect(g); g.connect(env); o.start(t); o.stop(t + dur + 0.05); return o; };
    if (kind === 'bell') {
      // FM bell: a modulator at 3.5x makes the metallic shimmer, fading faster than the tone.
      const car = osc('sine', f, 1);
      const mod = ctx.createOscillator(), mg = ctx.createGain();
      mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.6);
      mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + dur + 0.05);
      osc('triangle', f * 2, 0.12);
    } else if (kind === 'marimba') {
      osc('sine', f, 1); osc('sine', f * 4, 0.18); osc('sine', f * 10, 0.04);
    } else {
      osc('triangle', f, 0.9); osc('sine', f * 2, 0.25); osc('sine', f * 3, 0.08);
    }
  }
  function sparkle(ctx, out, t, len, gain) {
    // A short burst of filtered noise: confetti / shaker.
    const n = Math.floor(ctx.sampleRate * len), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 7500; bp.Q.value = 0.7; g.gain.value = gain;
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t);
  }
  function playMelody(id) {
    if (!audioCtx) unlockAudio(); if (!audioCtx) return;
    try {
      const ctx = audioCtx; ctx.resume && ctx.resume();
      const out = ctx.createDynamicsCompressor(), master = ctx.createGain();
      master.gain.value = 0.9; out.connect(master); master.connect(ctx.destination);
      const t0 = ctx.currentTime + 0.06;
      const play = (notes, kind) => notes.forEach(([dt, m, dur, v]) => voice(ctx, out, t0 + dt, m, dur, v, kind));
      if (id === 'marimba') {
        // C major pentatonic bounce, up and back, landing on a high C with a chord.
        play([[0, 72, .35, .5], [.11, 76, .35, .5], [.22, 79, .35, .5], [.33, 81, .35, .5], [.44, 79, .3, .45], [.55, 84, .5, .6],
          [.86, 79, .3, .4], [.97, 81, .3, .45], [1.08, 84, .9, .65], [1.08, 76, .9, .35], [1.08, 72, .9, .3]], 'marimba');
      } else if (id === 'musicbox') {
        play([[0, 88, .9, .35], [.26, 91, .9, .35], [.52, 96, 1.1, .4], [.86, 95, .7, .3], [1.12, 91, .7, .3], [1.4, 96, 1.6, .42], [1.4, 84, 1.6, .2]], 'box');
      } else {
        // Celebration: rising arpeggio, a quick pickup, then a big bell chord with sparkles.
        play([[0, 67, .5, .35], [.1, 72, .5, .38], [.2, 76, .5, .4], [.3, 79, .7, .45],
          [.56, 76, .25, .35], [.66, 79, .25, .38], [.78, 84, 1.8, .6], [.78, 76, 1.6, .3], [.78, 72, 1.6, .28], [.78, 60, 1.4, .25]], 'bell');
        sparkle(ctx, out, t0 + .78, .5, .35);
        [[1.0, 100], [1.12, 103], [1.24, 105], [1.4, 108]].forEach(([dt, m]) => voice(ctx, out, t0 + dt, m, .45, .12, 'bell'));
      }
    } catch (e) {}
  }
  function playChime() { playMelody((state.settings && state.settings.alarmSound) || 'celebration'); }
  document.addEventListener('pointerdown', () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) { tick(); if (focusOpen) requestWakeLock(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && focusOpen) closeFocus(); });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !timer) return;
    switch (b.dataset.act) {
      case 'focus-open': unlockAudio(); openFocus(); break;
      case 'focus-min': closeFocus(); render(); break;
      case 'focus-test': unlockAudio(); playChime(); break;
      case 'focus-add10': timer.target += 10; timer.alerted = false; timer.ack = true; saveTimer(); renderFocus(); tick(); break;
      case 'focus-keep': timer.ack = true; saveTimer(); { const a = document.getElementById('focus-alert'); if (a) a.hidden = true; } break;
      case 'focus-target': {
        const v = Number(b.dataset.v), passed = (Date.now() - timer.start) / 1000 >= v * 60;
        timer.target = v; timer.alerted = passed; timer.ack = true; saveTimer(); renderFocus(); tick(); break;
      }
      case 'focus-done': {
        const day = timer.day, tid = timer.taskId;
        stopTimer();
        const t = getDay(day).tasks.find(x => x.id === tid);
        if (t && !t.done && !getDay(day).review.closed) {
          mutateDay(day, d => { const x = d.tasks.find(y => y.id === tid); if (x) x.done = true; });
          if (t.backlogId) setBacklogDone(t.backlogId, true);
          toast('Done and logged.');
        }
        break;
      }
    }
  });

  // ---------- render ----------
  function render() {
    document.getElementById('today-date').textContent = longDate(todayKey());
    const wk = weekStats(weekStart(todayKey()));
    document.getElementById('pills').innerHTML = state.ready ? `
      <div class="pill" title="Closed days where you kept at least half your commitments. Rest days don’t break it."><b>${streak()}</b><span>day streak</span></div>
      <div class="pill" title="Commitments kept this week (Monday to today)"><b>${pct(wk.rate)}</b><span>kept this week</span></div>` : '';
    document.querySelectorAll('nav.tabs a').forEach(a => a.setAttribute('aria-current', a.dataset.view === state.view ? 'page' : 'false'));
    document.getElementById('note').textContent = state.note;
    if (!state.ready) return;

    const ae = document.activeElement;
    const focusId = ae && ae.id ? ae.id : null;
    const sel = focusId && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;

    const v = document.getElementById('view');
    v.innerHTML = state.view === 'history' ? viewHistory() : state.view === 'projects' ? viewProjects() : state.view === 'settings' ? viewSettings() : viewToday();
    tick();

    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  }

  function projectOptions(id, selected) {
    const ps = activeProjects();
    return `<select id="${id}" aria-label="Category or project"><option value="">No category</option>${CATS.map(c => `<optgroup label="${esc(c.name)}">
      <option value="c:${c.id}">${esc(c.name)} (no project)</option>
      ${ps.filter(p => projCat(p) === c.id).map(p => `<option value="p:${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  }
  function addForm(late) {
    return `<form class="add-form" data-form="${late ? 'add-late' : 'add'}">
      <input type="text" id="${late ? 'late' : 'new'}-text" placeholder="${late ? 'Something that came up…' : 'A concrete outcome, e.g. “Draft section 3 of the paper”'}" aria-label="Task" maxlength="200" autocomplete="off">
      ${projectOptions(late ? 'late-project' : 'new-project', '')}
      <select id="${late ? 'late' : 'new'}-est" aria-label="Estimate">${ESTS.map(e => `<option value="${e}"${e === 50 ? ' selected' : ''}>${mins(e)}</option>`).join('')}</select>
      <button class="btn ${late ? '' : 'primary'}" type="submit">${late ? 'Add unplanned' : 'Add'}</button>
    </form>`;
  }
  function previousDay(k) {
    const keys = Object.keys(state.days).filter(x => x < k).sort();
    return keys.length ? state.days[keys[keys.length - 1]] : null;
  }

  function taskRow(k, d, t) {
    const meta = [];
    const tc = taskCat(t);
    if (tc) meta.push(`<span class="cat-label cat-${tc}"><span class="cat-dot"></span>${esc(catName(tc))}</span>`);
    if (t.project && projectName(t.project)) meta.push(`<span class="tag">${esc(projectName(t.project))}</span>`);
    meta.push(`<span class="num">${t.minutes ? mins(t.minutes) : '0m'} / ${mins(t.est || 0)}</span>`);
    if (t.late) meta.push('<span class="unplanned">unplanned</span>');
    if (t.dropped) meta.push(`<span>Dropped: ${esc(t.reason || 'no reason given')}</span>`);
    if (t.carried) meta.push('<span>carried over</span>');
    const running = timer && timer.day === k && timer.taskId === t.id;
    let actions = '';
    if (!d.locked) actions = `<button class="btn quiet small" data-act="remove" data-id="${t.id}" aria-label="Remove task">Remove</button>`;
    else if (!d.review.closed) {
      if (t.dropped) actions = `<button class="btn quiet small" data-act="restore" data-id="${t.id}">Restore</button>`;
      else if (!t.done) actions = `${running ? `<button class="btn small primary" data-act="stop">Stop</button>` : `<button class="btn small" data-act="focus" data-id="${t.id}">Focus</button>`}
        <button class="btn quiet small" data-act="drop" data-id="${t.id}">Drop</button>`;
    }
    const dropping = state.ui.dropping === t.id ? `<div class="drop-box">
        <input type="text" id="drop-reason" placeholder="Why are you dropping this?" aria-label="Reason for dropping" maxlength="160">
        <button class="btn small" data-act="confirm-drop" data-id="${t.id}">Drop it</button>
        <button class="btn quiet small" data-act="cancel-drop">Cancel</button></div>` : '';
    const checkable = d.locked && !t.dropped && !d.review.closed;
    return `<li class="task ${t.done ? 'is-done' : ''} ${t.dropped ? 'is-dropped' : ''}">
      ${d.locked ? `<button class="check" ${checkable ? `data-act="toggle" data-id="${t.id}"` : 'disabled'} aria-pressed="${!!t.done}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${CHECK}</button>` : '<span class="step" aria-hidden="true">•</span>'}
      <div class="t-body"><div class="t-text">${esc(t.text)}</div><div class="t-meta">${meta.join('')}</div></div>
      <div class="t-actions">${actions}</div>
      ${dropping}
    </li>`;
  }

  function logLine(l) {
    const p = projectOf(l.project);
    const what = l.kind === 'words' ? `${nf(l.value)} words` : l.kind === 'time' ? mins(l.value) : 'Done';
    return `<b class="num">${esc(what)}</b> · ${esc(p ? p.name : 'Removed project')}${l.note ? ` · ${esc(l.note)}` : ''}`;
  }
  function logPanel(k, d) {
    const ps = activeProjects();
    const logs = d.logs || [];
    let h = `<div class="field" style="border-top:1px solid var(--line);padding-top:14px"><span class="label">Log progress</span>`;
    if (!ps.length) return h + '<p class="muted small">Add a project on the Projects tab to log words, time or milestones.</p></div>';
    const sel = projectOf(state.ui.logProj) || null;
    h += `<select id="log-proj" aria-label="Project to log"><option value="">Choose a project…</option>${CATS.map(c => {
      const cps = ps.filter(p => projCat(p) === c.id); if (!cps.length) return '';
      return `<optgroup label="${esc(c.name)}">${cps.map(p => `<option value="${esc(p.id)}"${sel && sel.id === p.id ? ' selected' : ''}>${esc(p.name)} (${esc(metricName(projMetric(p)))})</option>`).join('')}</optgroup>`;
    }).join('')}</select>`;
    if (sel) h += logForm('lg-today', sel);
    if (logs.length) h += `<ul class="todaylogs">${logs.map(l => `<li><span>${logLine(l)}</span><button class="btn quiet small" data-act="del-log" data-id="${l.id}">Remove</button></li>`).join('')}</ul>`;
    return h + '</div>';
  }

  function pickerPanel(d) {
    const used = new Set(d.tasks.map(t => t.backlogId).filter(Boolean));
    const open = backlog().filter(b => !b.done && !used.has(b.id));
    if (!open.length) return '';
    const catOf = b => b.project && projectOf(b.project) ? projCat(projectOf(b.project)) : b.category;
    const groups = CATS.map(c => {
      const items = open.filter(b => catOf(b) === c.id);
      if (!items.length) return '';
      const shown = items.slice(0, 6);
      return `<div class="grp cat-${c.id}"><span class="cat-label"><span class="cat-dot"></span>${esc(c.name)}</span>
        ${shown.map(b => `<div class="carry-item"><span>${esc(b.text)}${b.project && projectName(b.project) ? ` <span class="tag">${esc(projectName(b.project))}</span>` : ''}</span><button class="btn small" data-act="pick" data-id="${b.id}">Add</button></div>`).join('')}
        ${items.length > shown.length ? `<a class="muted" href="#projects" style="font-size:13px">${items.length - shown.length} more in Projects</a>` : ''}</div>`;
    }).join('');
    return `<div class="picker"><span class="label">Pick from your lists</span>${groups}</div>`;
  }

  function viewToday() {
    const k = todayKey(), d = getDay(k), s = stats(d);
    let h = '';

    // 1 — commit
    h += `<section class="card"><div class="sec-head"><h2><span class="step">1</span>Commit</h2>
      ${d.rest ? '<span class="chip">Rest day</span>' : d.locked ? `<span class="chip on">Locked at ${fmtTime(d.lockedAt)}</span>` : '<span class="chip warn">Not locked yet</span>'}</div>`;
    if (d.rest) {
      h += `<p class="muted">Today is marked as a rest day. It won’t count for or against your streak.</p>
        <div class="row"><button class="btn" data-act="unrest">Undo rest day</button></div></section>`;
      return h;
    }
    if (!d.locked) {
      h += `<p class="muted">Write down what you will finish today. Pick outcomes you can check off, not activities. Three is usually plenty.</p>`;
      const prev = previousDay(k);
      if (prev && !d.tasks.length) {
        const open = (prev.tasks || []).filter(t => !t.done && !t.dropped);
        const tom = prev.review?.tomorrow;
        if (open.length || tom) {
          h += `<div class="carry"><span class="label">Left over from ${esc(shortDate(prev.date))}</span>
            ${tom ? `<div class="carry-item"><span>“${esc(tom)}” <span class="muted">(your first task for today)</span></span><button class="btn small" data-act="carry-tom">Add</button></div>` : ''}
            ${open.map(t => `<div class="carry-item"><span>${esc(t.text)}</span><button class="btn small" data-act="carry" data-id="${t.id}">Add</button></div>`).join('')}
          </div>`;
        }
      }
      if (d.tasks.length) h += `<ul class="tasks">${d.tasks.map(t => taskRow(k, d, t)).join('')}</ul>`;
      h += pickerPanel(d);
      h += addForm(false);
      h += `<div class="row" style="justify-content:space-between">
        <button class="btn quiet small" data-act="rest">Mark today as a rest day</button>
        <button class="btn primary" data-act="lock" ${d.tasks.length ? '' : 'disabled'}>Lock in ${d.tasks.length || ''} commitment${d.tasks.length === 1 ? '' : 's'}</button></div>
        <p class="muted" style="font-size:13px">After you lock in, tasks can be finished or dropped with a reason. They can’t be quietly deleted.</p>`;
      h += '</section>';
      return h;
    }

    // locked
    h += `<div class="meter-row"><div class="row" style="justify-content:space-between"><span><b class="num">${s.done}</b> of <b class="num">${s.committed}</b> commitments kept${s.extra ? ` · <span class="num">${s.extra}</span> unplanned done` : ''}</span><span class="num muted">${pct(s.rate)}</span></div>
      <div class="meter" role="img" aria-label="${pct(s.rate)} kept"><span style="width:${(s.rate || 0) * 100}%"></span></div></div>`;
    h += `<ul class="tasks">${d.tasks.map(t => taskRow(k, d, t)).join('')}</ul>`;
    if (!d.review.closed) h += addForm(true);
    h += '</section>';

    // 2 — focus
    const tt = timer ? getDay(timer.day).tasks.find(x => x.id === timer.taskId) : null;
    h += `<section class="card"><div class="sec-head"><h2><span class="step">2</span>Work</h2><span class="chip">${mins(s.minutes)} logged today</span></div>
      <div class="timer ${timer ? 'running' : ''}">
        <div><div class="clock" id="clock">${timer ? '' : '00:00:00'}</div>
        <p class="muted">${timer ? `On: ${esc(tt ? tt.text : 'a task')}` : 'Press Focus on a task to open the full-screen timer. It counts down to your target and chimes when time is up.'}</p></div>
        ${timer ? '<span class="row"><button class="btn" data-act="focus-open">Full screen</button><button class="btn primary" data-act="stop">Stop and log</button></span>' : ''}
      </div>${logPanel(k, d)}</section>`;

    // 3 — close
    const r = d.review;
    h += `<section class="card"><div class="sec-head"><h2><span class="step">3</span>Close the day</h2>${r.closed ? `<span class="chip on">Closed</span>` : ''}</div>`;
    if (r.closed) {
      h += `<p>${r.rating ? `Rated <b class="num">${r.rating}/5</b>. ` : ''}${s.done} of ${s.committed} kept${r.blockers.length ? `. Got in the way: ${esc(r.blockers.join(', ').toLowerCase())}` : ''}.</p>
        ${r.note ? `<p class="muted">${esc(r.note)}</p>` : ''}
        ${r.tomorrow ? `<p><span class="label">Tomorrow starts with</span><br>${esc(r.tomorrow)}</p>` : ''}
        <div class="row"><button class="btn" data-act="reopen">Reopen today</button></div>`;
    } else {
      h += `<div class="field"><span class="label">How did today go?</span><div class="choices rating">
          ${[1, 2, 3, 4, 5].map(n => `<button class="choice" data-act="rate" data-v="${n}" aria-pressed="${r.rating === n}">${n}</button>`).join('')}</div></div>
        <div class="field"><span class="label">What got in the way?</span><div class="choices">
          ${BLOCKERS.map(b => `<button class="choice" data-act="blocker" data-v="${esc(b)}" aria-pressed="${r.blockers.includes(b)}">${esc(b)}</button>`).join('')}</div></div>
        <div class="field"><label class="label" for="rev-note">Honest note to yourself</label>
          <textarea id="rev-note" data-field="note" maxlength="1200" placeholder="What worked, what didn’t, what you’ll change.">${esc(r.note)}</textarea></div>
        <div class="field"><label class="label" for="rev-tomorrow">First task tomorrow</label>
          <input type="text" id="rev-tomorrow" data-field="tomorrow" maxlength="200" value="${esc(r.tomorrow)}" placeholder="The one thing you’ll start with"></div>
        <div class="row"><button class="btn primary" data-act="close">Close the day</button></div>`;
    }
    h += '</section>';
    return h;
  }

  function viewHistory() {
    const today = todayKey();
    const ws = weekStart(today);
    const cur = weekStats(ws), last = weekStats(addDays(ws, -7));
    const delta = (a, b, f) => (a == null || b == null) ? '' : `<span class="delta">${a >= b ? '+' : '−'}${f(Math.abs(a - b))} vs last week</span>`;
    let h = `<section class="card"><div class="sec-head"><h2>This week</h2><span class="muted">Since ${esc(shortDate(ws))}</span></div>
      <div class="stats">
        <div class="stat"><span class="label">Kept</span><b>${pct(cur.rate)}</b>${delta(cur.rate, last.rate, x => Math.round(x * 100) + ' pts')}</div>
        <div class="stat"><span class="label">Commitments</span><b>${cur.done}/${cur.committed}</b><span class="delta">last week ${last.done}/${last.committed}</span></div>
        <div class="stat"><span class="label">Focus</span><b>${(cur.minutes / 60).toFixed(1)}h</b><span class="delta">last week ${(last.minutes / 60).toFixed(1)}h</span></div>
        <div class="stat"><span class="label">Days closed</span><b>${cur.closed}</b><span class="delta">last week ${last.closed}</span></div>
      </div></section>`;

    // progress by tracking type
    {
      const ps = activeProjects();
      const logs = allLogs();
      const from14 = addDays(today, -13);
      // Word count
      const daily = [];
      for (let i = 13; i >= 0; i--) { const k = addDays(today, -i); daily.push(logs.filter(l => l.kind === 'words' && l.date === k).reduce((a, l) => a + l.value, 0)); }
      const dMax = Math.max(1, ...daily);
      const wordsWeek = logs.filter(l => l.kind === 'words' && l.date >= ws).reduce((a, l) => a + l.value, 0);
      const wordsLast = logs.filter(l => l.kind === 'words' && l.date >= addDays(ws, -7) && l.date < ws).reduce((a, l) => a + l.value, 0);
      const wps = ps.filter(p => projMetric(p) === 'words');
      // Time
      const tps = ps.filter(p => projMetric(p) === 'time');
      const timeWeek = tps.reduce((a, p) => a + projMinutes(p.id, ws), 0);
      const timeLast = tps.reduce((a, p) => a + projMinutes(p.id, addDays(ws, -7)) - projMinutes(p.id, ws), 0);
      // Other
      const ops = ps.filter(p => projMetric(p) === 'other');
      const oid = new Set(ops.map(p => p.id));
      const feed = [];
      logs.filter(l => oid.has(l.project) && l.date >= from14 && l.note).forEach(l => feed.push({ at: l.at || l.date, date: l.date, text: l.note, p: l.project }));
      backlog().filter(b => oid.has(b.project) && b.done && b.doneAt && fmt(new Date(b.doneAt)) >= from14).forEach(b => feed.push({ at: b.doneAt, date: fmt(new Date(b.doneAt)), text: `Milestone: ${b.text}`, p: b.project }));
      feed.sort((a, b) => a.at < b.at ? 1 : -1);
      const msDone = backlog().filter(b => oid.has(b.project) && b.done && b.doneAt && fmt(new Date(b.doneAt)) >= ws).length;
      const plist = (items, val) => items.length ? `<ul class="plist">${items.map(p => `<li class="cat-${projCat(p)}"><span><span class="cat-dot"></span>${esc(p.name)}</span><span class="num">${val(p)}</span></li>`).join('')}</ul>` : '';
      h += `<section class="card"><div class="sec-head"><h2>Progress</h2><span class="muted">This week, by how you track it</span></div><div class="tri">
        <div><span class="label">Word count</span><span class="big">${nf(wordsWeek)}</span><span class="delta">words this week · last week ${nf(wordsLast)}</span>
          <div class="cols" role="img" aria-label="Words written per day, last 14 days">${daily.map(v => `<span class="${v ? '' : 'zero'}" style="height:${Math.max(4, v / dMax * 100)}%" title="${nf(v)} words"></span>`).join('')}</div>
          <span class="delta">Last 14 days</span>
          ${plist(wps, p => nf(projWords(p.id, ws))) || '<p class="muted small">No word-count projects yet.</p>'}</div>
        <div><span class="label">Time</span><span class="big">${mins(timeWeek)}</span><span class="delta">this week · last week ${mins(timeLast)}</span>
          ${plist(tps, p => { const w = projMinutes(p.id, ws); return !p.deadline && p.target ? `${mins(w)} / ${p.target}h` : mins(w); }) || '<p class="muted small">No time-tracked projects yet.</p>'}</div>
        <div><span class="label">Other</span><span class="big">${msDone}</span><span class="delta">milestones finished this week</span>
          ${feed.length ? `<ul class="feed">${feed.slice(0, 8).map(f => `<li><span class="num muted">${esc(shortDate(f.date))}</span> · ${esc(projectName(f.p))}<br>${esc(f.text)}</li>`).join('')}</ul>` : `<p class="muted small">${ops.length ? 'Notes and finished milestones from the last 14 days will show here.' : 'No milestone projects yet.'}</p>`}</div>
      </div></section>`;
    }

    // category balance, last 14 days
    const bal = { passion: { m: 0, n: 0 }, must: { m: 0, n: 0 }, baseline: { m: 0, n: 0 } };
    for (let i = 0; i < 14; i++) {
      const d = state.days[addDays(today, -i)];
      (d?.tasks || []).forEach(t => { const c = taskCat(t); if (c && bal[c]) { bal[c].m += t.minutes || 0; if (t.done) bal[c].n++; } });
    }
    const balMax = Math.max(1, ...Object.values(bal).map(x => x.m));
    const anyBal = Object.values(bal).some(x => x.m || x.n);
    h += `<section class="card"><div class="sec-head"><h2>Where your time goes</h2><span class="muted">Last 14 days, by category</span></div>
      ${anyBal ? `<div class="cat-sum">${CATS.map(c => `<div class="bar cat-${c.id}"><span class="cat-label"><span class="cat-dot"></span>${esc(c.name)}</span>
          <span class="track"><span style="width:${bal[c.id].m / balMax * 100}%"></span></span><span class="num" style="white-space:nowrap">${mins(bal[c.id].m)}</span></div>
          <span class="muted" style="font-size:12px;margin-top:-6px">${bal[c.id].n} task${bal[c.id].n === 1 ? '' : 's'} done</span>`).join('')}</div>
        ${bal.passion.m === 0 && (bal.must.m + bal.baseline.m) > 0 ? '<p class="muted" style="font-size:13px">No focused time on passion-driven work in two weeks.</p>' : ''}`
      : '<p class="muted">Tag today’s tasks with a category or project and the time you focus will add up here.</p>'}</section>`;

    // heatmap
    const start = addDays(ws, -77);
    let cells = '<span></span>';
    let prevMonth = null;
    for (let w = 0; w < 12; w++) {
      const m = parse(addDays(start, w * 7)).getMonth();
      cells += `<span class="mon">${m !== prevMonth ? parse(addDays(start, w * 7)).toLocaleDateString(undefined, { month: 'short' }) : ''}</span>`;
      prevMonth = m;
    }
    const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
    for (let i = 0; i < 7; i++) {
      cells += `<span class="lbl">${dayNames[i]}</span>`;
      for (let w = 0; w < 12; w++) {
        const k = addDays(start, w * 7 + i);
        const d = state.days[k];
        let cls = '', tip = shortDate(k);
        if (k > today) cls = 'future';
        else if (d && d.rest) { cls = 'rest'; tip += ': rest day'; }
        else if (d) {
          const s = stats(d);
          if (s.rate != null) { cls = s.rate === 0 ? 'l0' : s.rate < 0.5 ? 'l1' : s.rate < 0.8 ? 'l2' : s.rate < 1 ? 'l3' : 'l4'; tip += `: ${s.done}/${s.committed} kept`; }
        } else tip += ': nothing recorded';
        if (k === today) cls += ' today';
        cells += `<span class="cell ${cls}" title="${esc(tip)}"></span>`;
      }
    }
    h += `<section class="card"><div class="sec-head"><h2>Last 12 weeks</h2></div>
      <div class="heat-wrap"><div class="heat" role="img" aria-label="Commitments kept per day over the last 12 weeks">${cells}</div></div>
      <div class="legend"><span><i style="background:var(--empty)"></i>None</span><span><i class="cell l0"></i>0%</span><span><i class="cell l1"></i>under 50%</span><span><i class="cell l2"></i>50–79%</span><span><i class="cell l3"></i>80–99%</span><span><i class="cell l4"></i>All kept</span><span><i class="cell rest"></i>Rest</span></div></section>`;

    // blockers
    const tally = {};
    for (let i = 0; i < 30; i++) { const d = state.days[addDays(today, -i)]; (d?.review?.blockers || []).forEach(b => tally[b] = (tally[b] || 0) + 1); }
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? entries[0][1] : 1;
    h += `<section class="card"><div class="sec-head"><h2>What gets in the way</h2><span class="muted">Last 30 days</span></div>
      ${entries.length ? `<div class="bars">${entries.map(([b, n]) => `<div class="bar"><span>${esc(b)}</span><span class="track"><span style="width:${n / max * 100}%"></span></span><span class="num">${n}</span></div>`).join('')}</div>` : '<p class="muted">Blockers you tag when closing a day will add up here.</p>'}</section>`;

    // log
    const keys = Object.keys(state.days).filter(k => k <= today).sort().reverse().filter(k => state.days[k].rest || (state.days[k].tasks || []).length).slice(0, 21);
    h += `<section class="card"><div class="sec-head"><h2>Daily log</h2></div>`;
    if (!keys.length) h += `<div class="empty"><b>No days recorded yet</b><span>Lock in your first commitments on the Today tab and they’ll show up here.</span></div>`;
    else h += `<ul class="log">${keys.map(k => {
      const d = state.days[k], s = stats(d);
      if (d.rest) return `<li><span class="num">${esc(shortDate(k))}</span><span class="muted">Rest day</span></li>`;
      const dropped = d.tasks.filter(t => t.dropped);
      return `<li><span class="num">${esc(shortDate(k))}</span><div>
        <div class="row"><b class="num">${s.done}/${s.committed}</b><span class="muted">kept</span>${d.review?.rating ? `<span class="chip">${d.review.rating}/5</span>` : ''}${s.minutes ? `<span class="chip">${mins(s.minutes)}</span>` : ''}${!d.review?.closed && k < today ? '<span class="chip warn">Not closed</span>' : ''}</div>
        ${d.review?.note ? `<p class="note">${esc(d.review.note)}</p>` : ''}
        ${dropped.length ? `<p class="muted" style="font-size:13px">Dropped: ${dropped.map(t => `${esc(t.text)} (${esc(t.reason || 'no reason')})`).join('; ')}</p>` : ''}
      </div></li>`;
    }).join('')}</ul>`;
    h += '</section>';
    return h;
  }

  function projFacts(p) {
    const today = todayKey();
    let minutes = 0, done = 0, lastDay = null;
    Object.values(state.days).forEach(d => (d.tasks || []).forEach(t => { if (t.project === p.id) { minutes += t.minutes || 0; if (t.done) done++; if (t.done || t.minutes) lastDay = !lastDay || d.date > lastDay ? d.date : lastDay; } }));
    let due = 'No deadline', late = false;
    if (p.deadline) { const n = daysBetween(today, p.deadline); late = n < 0; due = n === 0 ? 'Due today' : n > 0 ? `${n} day${n === 1 ? '' : 's'} left` : `${-n} day${n === -1 ? '' : 's'} overdue`; }
    const idle = lastDay ? daysBetween(lastDay, today) : null;
    return { minutes, done, lastDay, due, late, idle };
  }
  function catSelect(id, selected) {
    return `<select id="${id}" aria-label="Category">${CATS.map(c => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  }
  function modeFields(pre, deadline) {
    return `<select id="${pre}-mode" data-mode-for="${pre}-due" aria-label="Deadline mode">
        <option value="open"${deadline ? '' : ' selected'}>No deadline</option>
        <option value="due"${deadline ? ' selected' : ''}>Has a deadline</option></select>
      <input type="date" id="${pre}-due" aria-label="Deadline" value="${esc(deadline || '')}" ${deadline ? '' : 'disabled'}>`;
  }
  function metricFields(pre, p) {
    const metric = p ? projMetric(p) : 'words';
    return `<select id="${pre}-metric" data-metric-for="${pre}" aria-label="Track progress by">${METRICS.map(m => `<option value="${m.id}"${m.id === metric ? ' selected' : ''}>Track: ${esc(m.name)}</option>`).join('')}</select>
      <input type="number" id="${pre}-target" min="0" step="any" aria-label="Target" placeholder="${esc(targetHint(metric, !!(p && p.deadline)))}" value="${p && p.target ? esc(p.target) : ''}" ${metric === 'other' ? 'hidden' : ''} class="target-input">`;
  }
  function logForm(id, p) {
    const metric = projMetric(p);
    const num = metric === 'words' ? `<input type="number" id="${id}-v" min="0" step="1" placeholder="Words written" aria-label="Words written">`
      : metric === 'time' ? `<input type="number" id="${id}-v" min="0" step="1" placeholder="Minutes" aria-label="Minutes">` : '';
    const ph = metric === 'other' ? 'What did you complete? e.g. “Modeled the roof trusses”' : 'Note (optional)';
    return `<form class="log-form" data-form="plog" data-project="${p.id}" data-id="${id}">${num}
      <input type="text" id="${id}-n" maxlength="200" placeholder="${esc(ph)}" aria-label="Progress note" autocomplete="off">
      <button class="btn small" type="submit">Log</button></form>`;
  }
  function progBlock(p) {
    const g = progressOf(p);
    return `<div class="prog"><div class="head"><span><span class="metric-chip">${esc(metricName(g.metric))}</span></span><span class="num small">${esc(g.head)}</span></div>
      ${g.ratio != null ? `<div class="meter" role="img" aria-label="${Math.round(g.ratio * 100)}% of target"><span style="width:${g.ratio * 100}%"></span></div>` : ''}
      ${g.sub.length ? `<p class="muted small">${g.sub.map(esc).join(' · ')}</p>` : ''}
      ${logForm('lg-' + p.id, p)}</div>`;
  }

  function backlogList(items) {
    if (!items.length) return '';
    const onToday = new Set((getDay(todayKey()).tasks || []).map(t => t.backlogId).filter(Boolean));
    return `<ul class="ptasks">${items.map(b => `<li class="ptask ${b.done ? 'is-done' : ''}">
        <button class="check" data-act="btoggle" data-id="${b.id}" aria-pressed="${!!b.done}" aria-label="${b.done ? 'Mark not done' : 'Mark done'}">${CHECK}</button>
        <span class="t-text">${esc(b.text)}${onToday.has(b.id) && !b.done ? ' <span class="chip on">on today</span>' : ''}</span>
        <span class="t-actions">${!b.done && !onToday.has(b.id) ? `<button class="btn small" data-act="to-today" data-id="${b.id}">To today</button>` : ''}
          <button class="btn quiet small" data-act="bremove" data-id="${b.id}" aria-label="Delete task">Delete</button></span>
      </li>`).join('')}</ul>`;
  }
  function sortTasks(items) { return [...items].sort((a, b) => (a.done - b.done) || ((a.created || '') < (b.created || '') ? -1 : 1)); }

  function viewProjects() {
    const ps = activeProjects();
    const bl = backlog();
    let h = `<section class="card"><div class="sec-head"><h2>New project</h2><span class="muted">Every project belongs to one of three categories</span></div>
      <form class="add-form proj-form" data-form="project">
        <input type="text" id="proj-name" placeholder="e.g. Journal paper, Pavilion 3D model, Strength training" aria-label="Project name" maxlength="80" autocomplete="off" style="grid-column:1 / -1">
        ${catSelect('proj-cat', 'passion')}
        ${modeFields('proj', null)}
        ${metricFields('proj', null)}
        <button class="btn primary" type="submit">Add project</button>
      </form>
      <p class="muted small">Word count suits writing. Time suits workouts and practice. Other tracks components and milestones, with notes on what you finished. Projects with a deadline get a total target and a daily pace; ongoing ones get a weekly target.</p></section>`;

    CATS.forEach(c => {
      const cps = ps.filter(p => projCat(p) === c.id)
        .sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : a.name.localeCompare(b.name));
      const loose = sortTasks(bl.filter(b => b.category === c.id && !b.project));
      const open = bl.filter(b => !b.done && (b.category === c.id || (b.project && projectOf(b.project) && projCat(projectOf(b.project)) === c.id))).length;
      h += `<section class="card cat-card cat-${c.id}"><div class="sec-head"><h2>${esc(c.name)}</h2>
          <span class="muted num">${cps.length} project${cps.length === 1 ? '' : 's'} · ${open} open task${open === 1 ? '' : 's'}</span></div>
        <p class="muted">${esc(c.blurb)}</p><div>`;
      cps.forEach(p => {
        const f = projFacts(p);
        const tasks = sortTasks(bl.filter(b => b.project === p.id));
        const editing = state.ui.editProj === p.id;
        h += `<div class="proj">
          <span class="name">${esc(p.name)}</span>
          <span class="due ${f.late ? 'late' : ''}">${p.deadline ? f.due : '<span class="chip">Ongoing</span>'}</span>
          <div class="facts"><span class="num">${mins(f.minutes)} focused</span><span class="num">${f.done} task${f.done === 1 ? '' : 's'} done</span>
            <span>${f.lastDay ? (f.idle === 0 ? 'Worked on today' : `Last worked ${f.idle} day${f.idle === 1 ? '' : 's'} ago`) : 'Not started'}</span>
            ${f.idle != null && f.idle >= 5 && !f.late ? '<span class="chip warn">Going stale</span>' : ''}
            ${p.deadline ? `<span class="muted">Due ${esc(parse(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}
            <span style="margin-left:auto">${state.ui.confirmDel === p.id
              ? `<button class="btn small" data-act="del-project" data-id="${p.id}">Yes, remove it and its open list (past days are kept)</button> <button class="btn quiet small" data-act="cancel-del">Keep</button>`
              : `<button class="btn quiet small" data-act="edit-proj" data-id="${p.id}">Edit</button><button class="btn quiet small" data-act="ask-del" data-id="${p.id}">Remove</button>`}</span>
          </div>
          ${editing ? `<div class="pedit">${catSelect('edit-cat', projCat(p))}${modeFields('edit', p.deadline)}${metricFields('edit', p)}
              <input type="number" id="edit-start" min="0" step="1" aria-label="Words already written" placeholder="Words already written" value="${p.startWords ? esc(p.startWords) : ''}" ${projMetric(p) === 'words' ? '' : 'hidden'} class="target-input">
              <button class="btn small primary" data-act="save-proj" data-id="${p.id}">Save</button><button class="btn quiet small" data-act="cancel-edit">Cancel</button></div>` : ''}
          ${progBlock(p)}
          ${projMetric(p) === 'other' ? '<span class="label" style="grid-column:1 / -1">Components & milestones</span>' : ''}
          ${backlogList(tasks)}
          <form class="mini-form" data-form="btask" data-project="${p.id}" data-category="${c.id}">
            <input type="text" id="bt-${p.id}" placeholder="${projMetric(p) === 'other' ? 'Add a component or milestone' : 'Add a task to ' + esc(p.name)}" aria-label="New task for ${esc(p.name)}" maxlength="200" autocomplete="off">
            <button class="btn small" type="submit">Add</button></form>
        </div>`;
      });
      if (!cps.length) h += `<p class="muted" style="font-size:13px">No ${esc(c.name.toLowerCase())} projects yet. Add one above, or list loose tasks below.</p>`;
      h += `</div><div class="loose"><span class="label">Tasks without a project</span>
          ${backlogList(loose)}
          <form class="mini-form" data-form="btask" data-project="" data-category="${c.id}">
            <input type="text" id="bt-cat-${c.id}" placeholder="Add a ${esc(c.name.toLowerCase())} task" aria-label="New ${esc(c.name)} task" maxlength="200" autocomplete="off">
            <button class="btn small" type="submit">Add</button></form>
        </div></section>`;
    });
    return h;
  }

  // ---------- events ----------
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600);
  }

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const k = todayKey();
    if (f.dataset.form === 'project') {
      const name = document.getElementById('proj-name').value.trim();
      if (!name) { toast('Give the project a name first.'); return; }
      const category = document.getElementById('proj-cat').value;
      const hasDue = document.getElementById('proj-mode').value === 'due';
      const deadline = hasDue ? (document.getElementById('proj-due').value || null) : null;
      if (hasDue && !deadline) { toast('Pick the deadline date, or choose No deadline.'); return; }
      const metric = document.getElementById('proj-metric').value;
      const target = metric === 'other' ? null : (Number(document.getElementById('proj-target').value) || null);
      mutateProfile(p => p.projects.push({ id: rid(), name, category, deadline, metric, target, startWords: 0 }));
      toast(`Added to ${catName(category)}.`);
      return;
    }
    if (f.dataset.form === 'plog') {
      const p = projectOf(f.dataset.project); if (!p) return;
      const metric = projMetric(p), fid = f.dataset.id;
      const v = Math.round(Number(document.getElementById(fid + '-v')?.value) || 0);
      const note = (document.getElementById(fid + '-n')?.value || '').trim();
      if (metric !== 'other' && v <= 0 && !note) { toast(metric === 'words' ? 'Enter how many words you wrote.' : 'Enter how many minutes.'); return; }
      if (metric === 'other' && !note) { toast('Describe what you completed.'); return; }
      const kind = metric === 'other' || v <= 0 ? 'note' : metric;
      mutateDay(k, d => { if (!d.logs) d.logs = []; d.logs.push({ id: rid(), project: p.id, kind, value: kind === 'note' ? null : v, note, at: new Date().toISOString() }); });
      toast(kind === 'words' ? `Logged ${nf(v)} words.` : kind === 'time' ? `Logged ${mins(v)}.` : 'Progress noted.');
      return;
    }
    if (f.dataset.form === 'btask') {
      const input = f.querySelector('input');
      const text = input.value.trim();
      if (!text) { toast('Write the task first.'); return; }
      const project = f.dataset.project || null, category = f.dataset.category;
      mutateProfile(p => p.backlog.push({ id: rid(), text, category, project, done: false, created: new Date().toISOString() }));
      document.getElementById(input.id)?.focus();
      return;
    }
    const late = f.dataset.form === 'add-late', pre = late ? 'late' : 'new';
    const text = document.getElementById(pre + '-text').value.trim();
    if (!text) { toast('Write the task first.'); return; }
    const pick = document.getElementById(pre + '-project').value || '';
    const project = pick.startsWith('p:') ? pick.slice(2) : null;
    const category = pick.startsWith('c:') ? pick.slice(2) : (project && projectOf(project) ? projCat(projectOf(project)) : null);
    const est = Number(document.getElementById(pre + '-est').value) || 50;
    mutateDay(k, d => d.tasks.push({ id: rid(), text, project, category, est, done: false, dropped: false, reason: '', late, minutes: 0 }));
    const el = document.getElementById(pre + '-text'); if (el) el.focus();
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'log-proj') { state.ui.logProj = e.target.value || null; render(); return; }
    const syncTarget = pre => {
      const met = document.getElementById(pre + '-metric'), tgt = document.getElementById(pre + '-target'), mode = document.getElementById(pre + '-mode');
      if (!met || !tgt) return;
      tgt.hidden = met.value === 'other';
      tgt.placeholder = targetHint(met.value, mode && mode.value === 'due');
      const start = document.getElementById(pre + '-start'); if (start) start.hidden = met.value !== 'words';
    };
    const mt = e.target.closest('[data-metric-for]');
    if (mt) { syncTarget(mt.dataset.metricFor); return; }
    const m = e.target.closest('[data-mode-for]'); if (!m) return;
    const date = document.getElementById(m.dataset.modeFor);
    if (date) { date.disabled = m.value !== 'due'; if (!date.disabled) date.focus(); }
    syncTarget(m.id.replace(/-mode$/, ''));
  });

  function setBacklogDone(bid, done) {
    if (!bid || !backlog().some(b => b.id === bid)) return;
    mutateProfile(p => { const b = p.backlog.find(x => x.id === bid); if (b) { b.done = done; b.doneAt = done ? new Date().toISOString() : null; } });
  }
  // A task deleted from Projects leaves today's list too. Before lock-in the copy is removed;
  // after lock-in it's marked dropped, so a commitment never disappears silently.
  function removeTodayCopies(bids) {
    const k = todayKey(), d = getDay(k);
    if (!bids.size || d.review.closed || !d.tasks.some(t => bids.has(t.backlogId))) return;
    if (timer && timer.day === k && d.tasks.some(t => t.id === timer.taskId && bids.has(t.backlogId))) stopTimer();
    mutateDay(k, day => {
      if (!day.locked) day.tasks = day.tasks.filter(t => !bids.has(t.backlogId));
      else day.tasks.forEach(t => { if (bids.has(t.backlogId) && !t.done && !t.dropped) { t.dropped = true; t.reason = 'Deleted from its project list'; } });
    });
  }

  function sendToToday(bid) {
    const k = todayKey(), d = getDay(k);
    const b = backlog().find(x => x.id === bid); if (!b) return;
    if (d.rest) { toast('Today is a rest day. Undo that first on the Today tab.'); return; }
    if (d.review.closed) { toast('Today is already closed.'); return; }
    if (d.tasks.some(t => t.backlogId === bid)) { toast('Already on today’s list.'); return; }
    const category = b.project && projectOf(b.project) ? projCat(projectOf(b.project)) : b.category;
    mutateDay(k, day => day.tasks.push({ id: rid(), text: b.text, project: b.project || null, category, backlogId: b.id, est: 50, done: false, dropped: false, reason: '', late: !!day.locked, minutes: 0 }));
    toast(d.locked ? 'Added to today as unplanned.' : 'Added to today’s commitments.');
  }

  document.addEventListener('input', e => {
    const el = e.target.closest('[data-field]'); if (!el) return;
    mutateDay(todayKey(), d => { d.review[el.dataset.field] = el.value; }, { quiet: true, debounce: true });
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const k = todayKey(), id = b.dataset.id, act = b.dataset.act;
    const prev = previousDay(k);
    switch (act) {
      case 'remove': mutateDay(k, d => d.tasks = d.tasks.filter(t => t.id !== id)); break;
      case 'lock': mutateDay(k, d => { d.locked = true; d.lockedAt = new Date().toISOString(); }); toast('Locked in. Now go do it.'); break;
      case 'rest': mutateDay(k, d => { d.rest = true; }); break;
      case 'unrest': mutateDay(k, d => { d.rest = false; }); break;
      case 'carry': {
        const t = prev && prev.tasks.find(x => x.id === id); if (!t) break;
        mutateDay(k, d => d.tasks.push({ id: rid(), text: t.text, project: t.project || null, category: t.category || null, backlogId: t.backlogId || null, est: t.est || 50, done: false, dropped: false, reason: '', late: false, minutes: 0, carried: true }));
        break;
      }
      case 'carry-tom': if (prev?.review?.tomorrow) mutateDay(k, d => d.tasks.push({ id: rid(), text: prev.review.tomorrow, project: null, est: 50, done: false, dropped: false, reason: '', late: false, minutes: 0, carried: true })); break;
      case 'toggle':
        if (timer && timer.taskId === id) stopTimer();
        mutateDay(k, d => { const t = d.tasks.find(x => x.id === id); if (t) t.done = !t.done; });
        { const t = getDay(k).tasks.find(x => x.id === id); if (t && t.backlogId) setBacklogDone(t.backlogId, !!t.done); }
        break;
      case 'btoggle': {
        const b = backlog().find(x => x.id === id); if (!b) break;
        const done = !b.done;
        setBacklogDone(id, done);
        const today = getDay(k);
        const copy = today.tasks.find(t => t.backlogId === id && !t.dropped);
        if (copy && !today.review.closed && !!copy.done !== done) {
          if (timer && timer.taskId === copy.id) stopTimer();
          mutateDay(k, d => { const t = d.tasks.find(x => x.id === copy.id); if (t) t.done = done; });
        }
        break;
      }
      case 'bremove': removeTodayCopies(new Set([id])); mutateProfile(p => p.backlog = p.backlog.filter(x => x.id !== id)); break;
      case 'to-today': sendToToday(id); break;
      case 'edit-proj': state.ui.editProj = id; render(); break;
      case 'cancel-edit': state.ui.editProj = null; render(); break;
      case 'save-proj': {
        const category = document.getElementById('edit-cat').value;
        const hasDue = document.getElementById('edit-mode').value === 'due';
        const deadline = hasDue ? (document.getElementById('edit-due').value || null) : null;
        if (hasDue && !deadline) { toast('Pick the deadline date, or choose No deadline.'); break; }
        const metric = document.getElementById('edit-metric').value;
        const target = metric === 'other' ? null : (Number(document.getElementById('edit-target').value) || null);
        const startWords = Number(document.getElementById('edit-start')?.value) || 0;
        state.ui.editProj = null;
        mutateProfile(p => { const x = p.projects.find(q => q.id === id); if (x) { x.category = category; x.deadline = deadline; x.metric = metric; x.target = target; x.startWords = startWords; } });
        break;
      }
      case 'focus': startTimer(k, id); break;
      case 'stop': stopTimer(); break;
      case 'drop': state.ui.dropping = id; render(); document.getElementById('drop-reason')?.focus(); break;
      case 'cancel-drop': state.ui.dropping = null; render(); break;
      case 'confirm-drop': {
        const reason = (document.getElementById('drop-reason')?.value || '').trim();
        if (!reason) { toast('Say why. That’s the point.'); document.getElementById('drop-reason')?.focus(); break; }
        if (timer && timer.taskId === id) stopTimer();
        state.ui.dropping = null;
        mutateDay(k, d => { const t = d.tasks.find(x => x.id === id); if (t) { t.dropped = true; t.reason = reason; t.done = false; } });
        break;
      }
      case 'restore': mutateDay(k, d => { const t = d.tasks.find(x => x.id === id); if (t) { t.dropped = false; t.reason = ''; } }); break;
      case 'rate': mutateDay(k, d => { const v = Number(b.dataset.v); d.review.rating = d.review.rating === v ? 0 : v; }); break;
      case 'blocker': mutateDay(k, d => { const v = b.dataset.v, l = d.review.blockers; d.review.blockers = l.includes(v) ? l.filter(x => x !== v) : [...l, v]; }); break;
      case 'close': {
        if (timer && timer.day === k) stopTimer();
        clearTimeout(mutateDay.t[k]);
        const note = document.getElementById('rev-note')?.value ?? '', tom = document.getElementById('rev-tomorrow')?.value ?? '';
        mutateDay(k, d => { d.review.note = note; d.review.tomorrow = tom; d.review.closed = true; d.review.closedAt = new Date().toISOString(); });
        const s = stats(getDay(k));
        showModal(closedModal(k));
        break;
      }
      case 'reopen': mutateDay(k, d => { d.review.closed = false; }); break;
      case 'ask-del': state.ui.confirmDel = id; render(); break;
      case 'cancel-del': state.ui.confirmDel = null; render(); break;
      case 'del-project':
        state.ui.confirmDel = null;
        removeTodayCopies(new Set(backlog().filter(x => x.project === id).map(x => x.id)));
        // Archive rather than delete, so past days and logs keep the project's name.
        mutateProfile(p => { const x = p.projects.find(q => q.id === id); if (x) { x.archived = true; x.archivedAt = new Date().toISOString(); } p.backlog = p.backlog.filter(x => x.project !== id); });
        break;
      case 'pick': sendToToday(id); break;
      case 'del-log': mutateDay(k, d => { d.logs = (d.logs || []).filter(l => l.id !== id); }); break;
    }
  });

  // ---------- summaries ----------
  function dayNumbers(k) {
    const d = getDay(k), s = stats(d), logs = d.logs || [];
    const words = logs.filter(l => l.kind === 'words').reduce((a, l) => a + (l.value || 0), 0);
    const logged = logs.filter(l => l.kind === 'time').reduce((a, l) => a + (l.value || 0), 0);
    const milestones = backlog().filter(b => b.done && b.doneAt && fmt(new Date(b.doneAt)) === k && b.project && projectOf(b.project) && projMetric(projectOf(b.project)) === "other");
    const notes = logs.filter(l => l.note);
    return { d, s, words, time: s.minutes + logged, milestones, notes };
  }
  function summaryBody(k) {
    const n = dayNumbers(k), r = n.d.review;
    const wk = weekStats(weekStart(k));
    const tile = (label, value) => `<div class="stat"><span class="label">${label}</span><b>${value}</b></div>`;
    let h = `<div class="stats">
      ${tile('Kept', n.s.committed ? `${n.s.done}/${n.s.committed}` : '—')}
      ${tile('Time', mins(n.time))}
      ${tile('Words', nf(n.words))}
      ${tile('Milestones', n.milestones.length)}
    </div>`;
    const open = n.d.tasks.filter(t => !t.done && !t.dropped);
    if (open.length) h += `<div class="field"><span class="label">Still open</span><ul class="plist">${open.map(t => `<li><span>${esc(t.text)}</span><span class="num">${t.minutes ? mins(t.minutes) : ''}</span></li>`).join('')}</ul></div>`;
    if (n.s.extra) h += `<p class="small muted">Plus ${n.s.extra} unplanned task${n.s.extra === 1 ? '' : 's'} done.</p>`;
    if (n.milestones.length || n.notes.length) h += `<div class="field"><span class="label">Finished</span><ul class="feed">${n.milestones.map(b => `<li>Milestone: ${esc(b.text)}</li>`).join('')}${n.notes.map(l => `<li>${esc(projectName(l.project))}: ${esc(l.note)}</li>`).join('')}</ul></div>`;
    if (r.blockers && r.blockers.length) h += `<p class="small"><span class="label">Got in the way</span><br>${esc(r.blockers.join(', '))}</p>`;
    h += `<p class="small muted">This week: ${pct(wk.rate)} of commitments kept · streak ${streak()} day${streak() === 1 ? '' : 's'}</p>`;
    return h;
  }
  function closedModal(k) {
    const n = dayNumbers(k), r = n.d.review;
    const good = n.s.rate != null && n.s.rate >= 0.5;
    return `<div class="modal-card"><span class="label">${esc(longDate(k))}</span>
      <h2 id="modal-title">${good ? 'Day closed. Promise kept.' : 'Day closed.'}</h2>
      ${summaryBody(k)}
      ${r.tomorrow ? `<p><span class="label">Tomorrow starts with</span><br>${esc(r.tomorrow)}</p>` : ''}
      ${!good && n.s.committed ? '<p class="small muted">Under half kept. Look at what got in the way and commit to less tomorrow.</p>' : ''}
      <div class="row end"><button class="btn primary" data-act="modal-close">Done</button></div></div>`;
  }
  function eveningModal(k) {
    const d = getDay(k);
    return `<div class="modal-card"><span class="label">Evening check-in</span>
      <h2 id="modal-title">Here’s where today stands</h2>
      ${d.tasks.length ? summaryBody(k) : '<p class="muted">You haven’t committed to anything today. You can still log what you did and close the day honestly.</p>'}
      <div class="row end"><button class="btn quiet" data-act="modal-close">Not yet</button><button class="btn primary" data-act="goto-close">Close the day</button></div></div>`;
  }
  function briefingModal(k) {
    const prev = previousDay(k);
    const today = todayKey();
    let h = `<div class="modal-card"><span class="label">${esc(longDate(k))}</span><h2 id="modal-title">Morning briefing</h2>`;
    if (prev) {
      const s = stats(prev);
      h += `<div class="field"><span class="label">Last time (${esc(shortDate(prev.date))})</span>
        <p>${prev.rest ? 'Rest day.' : `${s.done} of ${s.committed} kept${prev.review?.closed ? '' : ', and the day was never closed'}.`}${prev.review?.rating ? ` You rated it ${prev.review.rating}/5.` : ''}</p>
        ${prev.review?.tomorrow ? `<p>You said today starts with: <b>${esc(prev.review.tomorrow)}</b></p>` : ''}</div>`;
    } else h += '<p class="muted">First day in the ledger. Pick one to three things you will actually finish today.</p>';
    const ps = activeProjects();
    const due = ps.filter(p => p.deadline && daysBetween(today, p.deadline) <= 7).sort((a, b) => a.deadline < b.deadline ? -1 : 1);
    if (due.length) h += `<div class="field"><span class="label">Deadlines this week</span><ul class="plist">${due.map(p => { const g = progressOf(p), n = daysBetween(today, p.deadline);
        return `<li class="cat-${projCat(p)}"><span><span class="cat-dot"></span>${esc(p.name)}${(() => { const pace = g.sub.find(x => x.startsWith("≈")); return pace ? ` <span class="muted">· ${esc(pace)}</span>` : ""; })()}</span><span class="num ${n < 0 ? 'late' : ''}">${n < 0 ? `${-n}d overdue` : n === 0 ? 'today' : `${n}d`}</span></li>`; }).join('')}</ul></div>`;
    const weekly = ps.filter(p => projMetric(p) === 'time' && !p.deadline && p.target);
    if (weekly.length) h += `<div class="field"><span class="label">Weekly time targets</span><ul class="plist">${weekly.map(p => `<li><span>${esc(p.name)}</span><span class="num">${mins(projMinutes(p.id, weekStart(today)))} / ${p.target}h</span></li>`).join('')}</ul></div>`;
    const stale = ps.filter(p => { const f = projFacts(p); return f.idle != null && f.idle >= 5; });
    if (stale.length) h += `<p class="small"><span class="chip warn">Going stale</span> ${stale.map(p => esc(p.name)).join(', ')}</p>`;
    const passion = ps.filter(p => projCat(p) === 'passion');
    if (passion.length && !passion.some(p => projMinutes(p.id, addDays(today, -6)) > 0)) h += '<p class="small muted">No time on passion-driven work in the last 7 days. Could one task today be one of those?</p>';
    const lb = state.settings.lastBackup;
    if (Object.keys(state.days).length > 2 && (!lb || daysBetween(fmt(new Date(lb)), today) >= 7)) h += `<p class="small"><span class="chip warn">Backup</span> ${lb ? `Last backup ${daysBetween(fmt(new Date(lb)), today)} days ago.` : 'You haven’t backed up yet.'} <a href="#settings" data-act="modal-close">Export in Settings</a></p>`;
    h += `<p class="small muted">Streak: ${streak()} day${streak() === 1 ? '' : 's'}</p>
      <div class="row end"><button class="btn quiet" data-act="modal-close">Later</button><button class="btn primary" data-act="plan-today">Plan today</button></div></div>`;
    return h;
  }

  // ---------- modal ----------
  let lastFocus = null;
  function showModal(html) {
    const m = document.getElementById('modal');
    lastFocus = document.activeElement;
    m.innerHTML = html; m.hidden = false;
    document.body.classList.add('modal-open');
    const b = m.querySelector('.btn.primary'); if (b) b.focus();
  }
  function closeModal() {
    const m = document.getElementById('modal');
    if (m.hidden) return;
    m.hidden = true; m.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ---------- in-app triggers (iOS can't schedule web notifications, so the app checks on open) ----------
  function setSetting(patch) { state.settings = Object.assign({}, state.settings, patch); Store.save(); }
  function triggers() {
    if (!state.ready || document.hidden || !document.getElementById('modal').hidden || focusOpen) return;
    const k = todayKey(), d = getDay(k), hour = new Date().getHours(), st = state.settings;
    if (d.rest || d.review.closed) return;
    if (st.eveningSummary && hour >= st.eveningHour && st.lastEvening !== k) {
      setSetting({ lastEvening: k, lastBriefing: k });
      showModal(eveningModal(k)); return;
    }
    if (st.morningBriefing && hour < st.eveningHour && st.lastBriefing !== k && !d.locked) {
      setSetting({ lastBriefing: k });
      showModal(briefingModal(k));
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); triggers(); } });
  setInterval(triggers, 60000);

  // ---------- backup ----------
  async function exportData() {
    Store.flush();
    const json = JSON.stringify(Store.snapshot(), null, 2);
    const name = `commitment-ledger-${todayKey()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Commitment Ledger backup' });
        setSetting({ lastBackup: new Date().toISOString() }); render(); toast('Backup exported.'); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setSetting({ lastBackup: new Date().toISOString() }); render(); toast('Backup downloaded.');
  }
  async function copyBackup() {
    const json = JSON.stringify(Store.snapshot());
    try { await navigator.clipboard.writeText(json); setSetting({ lastBackup: new Date().toISOString() }); render(); toast('Backup copied. Paste it into Notes or an email to yourself.'); }
    catch (e) { toast('Copy isn’t allowed here. Use Export instead.'); }
  }
  function validBackup(v) { return v && typeof v === 'object' && v.days && typeof v.days === 'object' && v.profile && typeof v.profile === 'object'; }
  function readImport(text) {
    let v; try { v = JSON.parse(text); } catch (e) { toast('That file isn’t valid JSON.'); return; }
    if (!validBackup(v)) { toast('That file isn’t a Commitment Ledger backup.'); return; }
    state.ui.pendingImport = v; render();
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'import-file' && t.files && t.files[0]) {
      const r = new FileReader(); r.onload = () => readImport(String(r.result)); r.onerror = () => toast('Couldn’t read that file.'); r.readAsText(t.files[0]); t.value = '';
    }
    if (t.id === 'set-morning') { setSetting({ morningBriefing: t.checked }); render(); }
    if (t.id === 'set-evening') { setSetting({ eveningSummary: t.checked }); render(); }
    if (t.id === 'set-hour') { setSetting({ eveningHour: Number(t.value) }); render(); }
    if (t.id === 'set-sound') { setSetting({ alarmSound: t.value }); unlockAudio(); playChime(); render(); }
  });

  // ---------- settings view ----------
  function viewSettings() {
    const st = state.settings, nDays = Object.keys(state.days).length, nProj = activeProjects().length, nTasks = backlog().length;
    const lb = st.lastBackup ? new Date(st.lastBackup) : null;
    const pi = state.ui.pendingImport;
    let h = `<section class="card"><div class="sec-head"><h2>Daily check-ins</h2></div>
      <p class="muted small">iPhone web apps can’t send scheduled notifications, so the ledger checks in when you open it.</p>
      <label class="toggle"><input type="checkbox" id="set-morning" ${st.morningBriefing ? 'checked' : ''}><span><b>Morning briefing</b><br><span class="muted small">On your first open of the day: yesterday’s result, deadlines, stale projects.</span></span></label>
      <label class="toggle"><input type="checkbox" id="set-evening" ${st.eveningSummary ? 'checked' : ''}><span><b>Evening summary</b><br><span class="muted small">When you open the app in the evening and haven’t closed the day.</span></span></label>
      <div class="row"><label for="set-hour" class="small">Evening starts at</label>
        <select id="set-hour">${[15, 16, 17, 18, 19, 20, 21, 22].map(x => `<option value="${x}"${x === st.eveningHour ? ' selected' : ''}>${x}:00</option>`).join('')}</select></div>
      <div class="row"><button class="btn small" data-act="show-briefing">Preview briefing</button><button class="btn small" data-act="show-evening">Preview evening summary</button></div>
      <p class="muted small">For a nudge to open the app, add two repeating reminders in the iPhone Reminders or Clock app (for example 9:00 and ${st.eveningHour}:00).</p>
    </section>`;

    const snd = SOUNDS.find(x => x.id === st.alarmSound) || SOUNDS[0];
    h += `<section class="card"><div class="sec-head"><h2>Focus timer sound</h2></div>
      <p class="muted small">Plays when your focus target is reached, and once more 8 seconds later if you haven’t responded. Turn the ringer on (silent switch off) to hear it.</p>
      <div class="row"><select id="set-sound" aria-label="Alarm sound">${SOUNDS.map(x => `<option value="${x.id}"${x.id === snd.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
        <button class="btn" data-act="preview-sound">▶ Preview</button><span class="muted small">${esc(snd.hint)}</span></div></section>`;

    h += `<section class="card"><div class="sec-head"><h2>Backup</h2>${lb ? `<span class="chip ${daysBetween(fmt(lb), todayKey()) >= 7 ? 'warn' : 'on'}">Last backup ${esc(shortDate(fmt(lb)))}</span>` : '<span class="chip warn">Never backed up</span>'}</div>
      <p class="muted small">Your ledger is stored only on this device: <span class="num">${nDays}</span> days, <span class="num">${nProj}</span> projects, <span class="num">${nTasks}</span> listed tasks. Export a backup file every week or so and keep it in iCloud Drive or Files.</p>
      <div class="row"><button class="btn primary" data-act="export">Export data (JSON)</button><button class="btn" data-act="copy-backup">Copy as text</button>
        <label class="btn" for="import-file">Import data (JSON)</label><input type="file" id="import-file" accept="application/json,.json" hidden></div>`;
    if (pi) h += `<div class="pedit"><span>Replace everything on this device with the backup from <b>${esc(pi.exportedAt ? new Date(pi.exportedAt).toLocaleString() : 'an unknown date')}</b> (${Object.keys(pi.days).length} days, ${(pi.profile.projects || []).filter(p => !p.archived).length} projects)?</span>
        <button class="btn small primary" data-act="import-confirm">Replace my data</button><button class="btn quiet small" data-act="import-cancel">Cancel</button></div>`;
    h += '</section>';

    h += `<section class="card"><div class="sec-head"><h2>Install on iPhone</h2>${isStandalone() ? '<span class="chip on">Installed</span>' : ''}</div>
      <ol class="small steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open the ledger from its icon. It runs full screen and keeps your data.</li></ol>
      <p class="muted small">Data saved in Safari and in the Home Screen app are separate. Use the Home Screen app day to day, and if you started in Safari, export there and import in the app.</p></section>`;

    h += `<section class="card"><div class="sec-head"><h2>Erase</h2></div>
      <p class="muted small">Deletes every day, project and setting on this device. Export first if you might want it back.</p>
      <div class="row">${state.ui.confirmErase ? '<button class="btn small" data-act="erase">Yes, erase everything</button><button class="btn quiet small" data-act="cancel-erase">Cancel</button>' : '<button class="btn small" data-act="ask-erase">Erase all data</button>'}</div></section>`;
    return h;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const k = todayKey();
    switch (b.dataset.act) {
      case 'modal-close': closeModal(); break;
      case 'plan-today': closeModal(); if (location.hash !== '#today') location.hash = '#today'; setTimeout(() => document.getElementById('new-text')?.focus(), 50); break;
      case 'goto-close': closeModal(); if (location.hash !== '#today') location.hash = '#today';
        setTimeout(() => { const el = document.getElementById('rev-note'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } else if (!getDay(k).locked) toast('Lock in or add what you did first, then close the day.'); }, 80); break;
      case 'show-briefing': showModal(briefingModal(k)); break;
      case 'show-evening': showModal(eveningModal(k)); break;
      case 'preview-sound': unlockAudio(); playChime(); break;
      case 'export': exportData(); break;
      case 'copy-backup': copyBackup(); break;
      case 'import-cancel': state.ui.pendingImport = null; render(); break;
      case 'import-confirm': {
        const v = state.ui.pendingImport; state.ui.pendingImport = null;
        if (!v) break;
        if (timer) { timer = null; saveTimer(); }
        Store.apply(v); state.settings.lastBriefing = k; Store.flush(); render(); toast('Backup imported.'); break;
      }
      case 'ask-erase': state.ui.confirmErase = true; render(); break;
      case 'cancel-erase': state.ui.confirmErase = false; render(); break;
      case 'erase': state.ui.confirmErase = false; if (timer) { timer = null; saveTimer(); } Store.apply({ days: {}, profile: { projects: [], backlog: [] }, settings: { lastBriefing: k } }); Store.flush(); render(); toast('All data erased.'); break;
      case 'dismiss-install': try { localStorage.setItem('commitment-ledger.install-dismissed', '1'); } catch (err) {} document.getElementById('install').hidden = true; break;
    }
  });

  // ---------- install hint & offline support ----------
  function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  (function installHint() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let dismissed = false; try { dismissed = localStorage.getItem('commitment-ledger.install-dismissed') === '1'; } catch (e) {}
    if (!ios || isStandalone() || dismissed) return;
    const el = document.getElementById('install');
    el.innerHTML = '<span>Install the ledger: tap <b>Share</b>, then <b>Add to Home Screen</b>.</span><button class="btn quiet small" data-act="dismiss-install">Dismiss</button>';
    el.hidden = false;
  })();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- routing ----------
  function route() {
    const h = location.hash.replace('#', '');
    state.view = ['today', 'history', 'projects', 'settings'].includes(h) ? h : 'today';
    state.ui.dropping = null; state.ui.confirmDel = null; state.ui.editProj = null;
    render();
  }
  window.addEventListener('hashchange', route);
  // Re-render when the date rolls over while the page is open.
  let lastKey = todayKey();
  setInterval(() => { if (todayKey() !== lastKey) { lastKey = todayKey(); render(); } }, 60000);

  route();
  Store.init();
  if (timer) openFocus();
})();
