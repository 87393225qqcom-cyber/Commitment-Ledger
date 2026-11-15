(() => {
  // UI language. Stored data keeps English/canonical values; only what's shown on screen is translated.
  function _t(en, zh, vars) {
    let s = (state.settings && state.settings.lang === 'en') ? en : zh;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }
  const BLOCKERS = ['Meetings', 'Distraction', 'Underestimated', 'Low energy', 'Unclear next step', 'Interruptions'];
  const BLOCKER_ZH = { Meetings: '会议', Distraction: '分心', Underestimated: '低估了工作量', 'Low energy': '精力不足', 'Unclear next step': '下一步不明确', Interruptions: '被打断' };
  const blockerName = b => _t(b, BLOCKER_ZH[b] || b);
  const ESTS = [15, 25, 50, 90, 120, 180];
  const estOptions = sel => ESTS.map(e => `<option value="${e}"${e === sel ? ' selected' : ''}>${_t('Est.', '预计')} ${mins(e)}</option>`).join('');
  const CATS = [
    { id: 'passion', name: 'Passion-driven', zh: '热爱驱动', blurb: 'Work you want to do. Protect time for it before it gets crowded out.', blurbZh: '你想做的事。在它被挤掉之前，先为它留出时间。' },
    { id: 'must', name: 'Must-do', zh: '必须完成', blurb: 'Obligations with real consequences if they slip.', blurbZh: '一旦拖延会有实际后果的责任。' },
    { id: 'baseline', name: 'Baseline', zh: '日常基础', blurb: 'Routine upkeep that keeps everything else running.', blurbZh: '维持其他一切运转的日常维护。' }
  ];
  const catName = id => { const c = CATS.find(x => x.id === id) || CATS[1]; return _t(c.name, c.zh); };
  const catBlurb = id => { const c = CATS.find(x => x.id === id) || CATS[1]; return _t(c.blurb, c.blurbZh); };
  const METRICS = [
    { id: 'words', name: 'Word count', zh: '字数', hint: 'Papers, manuscripts, chapters', hintZh: '论文、手稿、章节' },
    { id: 'time', name: 'Time', zh: '时间', hint: 'Workouts, practice, study', hintZh: '锻炼、练习、学习' },
    { id: 'other', name: 'Other', zh: '其他', hint: 'Components, milestones, notes', hintZh: '组件、里程碑、备注' }
  ];
  const metricName = id => { const m = METRICS.find(x => x.id === id) || METRICS[1]; return _t(m.name, m.zh); };
  const projMetric = p => METRICS.some(m => m.id === p.metric) ? p.metric : 'time';
  const nf = n => Math.round(n).toLocaleString('en-US');
  const targetHint = (metric, hasDue) => metric === 'words' ? _t('Target words (optional)', '目标字数（可选）') : metric === 'time' ? (hasDue ? _t('Total hours (optional)', '总小时数（可选）') : _t('Hours per week (optional)', '每周小时数（可选）')) : '';

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
      out.head = p.target ? _t('{a} / {b} words', '{a} / {b} 字', { a: nf(total), b: nf(p.target) }) : _t('{a} words', '{a} 字', { a: nf(total) });
      if (p.target) out.ratio = Math.min(1, total / p.target);
      out.sub.push(_t('{a} this week', '本周 {a}', { a: nf(week) }));
      if (p.target && total < p.target && left != null) out.sub.push(left > 0 ? _t('≈ {a} words/day to finish on time', '≈ 每天 {a} 字可按时完成', { a: nf(Math.ceil((p.target - total) / left)) }) : _t('{a} words short of the target', '距目标还差 {a} 字', { a: nf(p.target - total) }));
      if (p.target && total >= p.target) out.sub.push(_t('Target reached', '已达目标'));
    } else if (metric === 'time') {
      if (p.deadline) {
        const total = projMinutes(p.id);
        out.head = p.target ? `${mins(total)} / ${p.target}h` : _t('{a} total', '共 {a}', { a: mins(total) });
        if (p.target) { out.ratio = Math.min(1, total / (p.target * 60)); if (total < p.target * 60 && left > 0) out.sub.push(_t('≈ {a}/day to finish on time', '≈ 每天 {a} 可按时完成', { a: mins(Math.ceil((p.target * 60 - total) / left)) })); }
        out.sub.push(_t('{a} this week', '本周 {a}', { a: mins(projMinutes(p.id, ws)) }));
      } else {
        const week = projMinutes(p.id, ws);
        out.head = p.target ? _t('{a} / {b}h this week', '本周 {a} / {b} 小时', { a: mins(week), b: p.target }) : _t('{a} this week', '本周 {a}', { a: mins(week) });
        if (p.target) out.ratio = Math.min(1, week / (p.target * 60));
        out.sub.push(_t('{a} all time', '累计 {a}', { a: mins(projMinutes(p.id)) }));
      }
    } else {
      const items = backlog().filter(b => b.project === p.id);
      const done = items.filter(b => b.done).length;
      out.head = items.length ? _t('{a} of {b} milestones', '{b} 个里程碑已完成 {a} 个', { a: done, b: items.length }) : _t('No milestones yet', '还没有里程碑');
      if (items.length) out.ratio = done / items.length;
      const notes = allLogs().filter(l => l.project === p.id && l.note).sort((a, b) => (a.at || '') < (b.at || '') ? 1 : -1);
      if (notes[0]) out.sub.push(_t('Latest: “{a}” ({b})', '最新：「{a}」（{b}）', { a: notes[0].note, b: shortDate(notes[0].date) }));
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
  // The ledger day starts at settings.dayStart (0–6 h), so work after midnight still counts for the evening before.
  const dayStartH = () => (state.settings && Number.isFinite(state.settings.dayStart)) ? state.settings.dayStart : 0;
  const dayKeyOf = when => fmt(new Date(new Date(when).getTime() - dayStartH() * 3600000));
  const todayKey = () => dayKeyOf(Date.now());
  const weekStart = k => { const d = parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); };
  const LOC = () => (state.settings && state.settings.lang === 'en') ? 'en-US' : 'zh-CN';
  const longDate = k => parse(k).toLocaleDateString(LOC(), { weekday: 'long', month: 'short', day: 'numeric' }); // e.g. Saturday, Nov 14
  const shortDate = k => parse(k).toLocaleDateString(LOC(), { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString(LOC(), { hour: 'numeric', minute: '2-digit' }) : '';
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
  const DEFAULT_SETTINGS = { lang: 'zh', balanceLimit: 65, appearance: 'time', dayFrom: 7, nightFrom: 19, dayStart: 0, alarmSound: 'celebration', morningBriefing: true, eveningSummary: true, eveningHour: 18, breakMinutes: 5, lastBriefing: null, lastEvening: null, lastBackup: null };
  const Store = {
    backend: 'local', saveTimer: null, failed: false,
    init() {
      try {
        const raw = localStorage.getItem(LOCAL);
        if (raw) this.apply(JSON.parse(raw));
      } catch (e) { state.note = _t('Saved data couldn’t be read. Import a backup from Settings.', '无法读取已保存的数据。请在「设置」中导入备份。'); }
      state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
      document.documentElement.lang = state.settings.lang === 'en' ? 'en' : 'zh-CN';
      applyTheme();
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
      catch (e) { if (!this.failed) toast(_t('Couldn’t save on this device. Export a backup from Settings now.', '无法在此设备上保存。请立即在「设置」中导出备份。')); this.failed = true; }
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
      toast(_t('Logged {a} of focus.', '已记录 {a} 专注。', { a: mins(m) }));
    } else { toast(_t('Under a minute, so nothing was logged.', '不到一分钟，未记录。')); render(); }
  }

  // Full-screen view
  function openFocus() {
    if (!timer) return;
    focusOpen = true;
    const el = document.getElementById('focus');
    renderFocus(); el.hidden = false;
    // Hide the home screen underneath and pause the miner: on iPhone an animating canvas can paint through a fixed overlay.
    document.body.classList.add('modal-open', 'focus-open');
    requestWakeLock();
    try { if (el.requestFullscreen && !document.fullscreenElement && !isStandalone()) el.requestFullscreen().catch(() => {}); } catch (e) {}
    tick();
  }
  function closeFocus() {
    focusOpen = false; wrapUp = null;
    const el = document.getElementById('focus');
    el.hidden = true; el.innerHTML = '';
    document.body.classList.remove('focus-open');
    if (document.getElementById('modal').hidden) document.body.classList.remove('modal-open');
    setTimeout(startMiner, 0);
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
  // One tracked ring of irregular ticks that wears away clockwise as the session runs.
  function dialSVG(seed) {
    const rnd = seededRandom(seed || 'focus');
    const ring = ringTicks(rnd, { n: 200, waves: 7, gap: 0.1, gapWave: 0.4, thin: 0.72, mid: 0.22, wThin: [2, 2.2], wMid: [6, 6], wBig: [16, 12], len: [22, 50], top: 104, topJitter: 24, track: true });
    const lap = `A${TR},${TR} 0 1,1 500,${500 + TR} A${TR},${TR} 0 1,1 500,${500 - TR}`;
    return `<svg class="dial-svg ring-spin" viewBox="0 0 1000 1000" aria-hidden="true"><g class="dial-ticks">${ring}</g></svg>
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
    const catCls = c === 'passion' || c === 'must' || c === 'baseline' ? 'cat-' + c : '';
    const meta = [c ? catName(c) : null, t && t.project ? projectName(t.project) : null].filter(Boolean).join(' · ');
    el.innerHTML = `<div class="dial">${dialSVG(timer.taskId + ':' + timer.start)}</div>
      <div class="f-layer">
        <div class="f-top"><span id="wake-status" class="f-small"></span>
          <span class="f-links"><button class="f-link" data-act="focus-test">${_t('Test sound', '测试声音')}</button><button class="f-link" data-act="focus-min">${_t('Minimize', '最小化')}</button></span></div>
        <div class="f-title">${meta ? `<span class="f-small">${esc(meta)}</span>` : ''}<h2>${esc(t ? t.text : _t('Focus session', '专注时段'))}</h2>${t && (t.steps || []).length && !wrapUp ? `<ul class="f-steps">${t.steps.map(st => `<li><button class="f-step${st.done ? ' done' : ''}" data-act="step-toggle" data-id="${t.id}" data-step="${st.id}" aria-pressed="${!!st.done}"><span class="f-box">${st.done ? '✓' : ''}</span>${esc(st.text)}</button></li>`).join('')}</ul>` : ''}</div>
        <div class="f-center"><div id="focus-time" class="${catCls}">--:--</div><div id="focus-sub" class="f-small"></div></div>
        <div class="f-bottom">${wrapUp ? wrapPanel() : `
          <div id="focus-alert" class="f-alert" role="alert" ${timer.alerted && !timer.ack ? '' : 'hidden'}>
            <p class="f-alert-head">● ${_t('Time’s up', '时间到')}</p><p>${_t('You reached your {a} target. End the session, or keep going.', '你已完成 {a} 的目标。可以结束，也可以继续。', { a: mins(timer.target) })}</p>
            <div class="f-row"><button class="f-btn inv" data-act="focus-add10">+10 ${_t('min', '分钟')}</button><button class="f-btn inv" data-act="focus-keep">${_t('Keep going', '继续')}</button><button class="f-btn inv solid" data-act="stop">${_t('End session', '结束本次')}</button></div></div>
          <div class="f-targets"><span class="f-small">${_t('Target', '目标')}</span>
            ${[...new Set([...TARGETS, timer.target])].sort((a, b) => a - b).map(v => `<button class="f-chip" data-act="focus-target" data-v="${v}" aria-pressed="${v === timer.target}">${mins(v)}</button>`).join('')}</div>
          <div class="f-row"><button class="f-btn solid" data-act="stop">${_t('End session', '结束本次')}</button></div>`}
        </div>
      </div>`;
    el.classList.toggle('wrapping', !!wrapUp);
    dialTicks = [...el.querySelectorAll('.tk')].map(g => ({ g, f: Number(g.dataset.f), gone: false }));
    updateWake();
  }
  const clockText = s => s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  function endsAt() { return new Date(timer.start + timer.target * 60000).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }); }
  function tick() {
    if (!timer) return;
    const s = Math.floor((Date.now() - timer.start) / 1000), targetS = timer.target * 60;
    const card = document.getElementById('clock'); if (card) card.textContent = clockText(s);
    updateBalance();
    const we = document.getElementById('wr-elapsed'); if (we) we.textContent = mins(Math.max(1, Math.round(s / 60)));
    const over = s >= targetS;
    document.title = over ? `+${clockText(s - targetS)} · ${_t('Focus', '专注')}` : `${clockText(targetS - s)} · ${_t('Focus', '专注')}`;
    if (focusOpen) {
      const time = document.getElementById('focus-time'), sub = document.getElementById('focus-sub');
      if (time) time.textContent = over ? `+${clockText(s - targetS)}` : clockText(targetS - s);
      if (sub) sub.textContent = over ? _t('over your {a} target', '已超过 {a} 目标', { a: mins(timer.target) }) : _t('left of {a}', '剩余 {a}', { a: mins(timer.target) });
      const p = over ? 1 : s / targetS;
      dialTicks.forEach(tk => { const gone = !over && tk.f < p; if (gone !== tk.gone) { tk.gone = gone; tk.g.classList.toggle('gone', gone); } });
      const ang = 2 * Math.PI * (over ? 0 : p);
      const dot = document.getElementById('dial-dot');
      if (dot) { dot.setAttribute('cx', (500 + TR * Math.sin(ang)).toFixed(1)); dot.setAttribute('cy', (500 - TR * Math.cos(ang)).toFixed(1)); }
      const pos = over ? 0 : p, label = document.getElementById('dial-label'), metaEl = document.getElementById('dial-meta');
      if (label) { label.setAttribute('startOffset', ((pos * C330 + 26) / (2 * C330) * 100).toFixed(3) + '%'); { const tt = timerTask(); const name = tt ? (tt.text.length > 42 ? tt.text.slice(0, 40) + "…" : tt.text) : _t('Focus', '专注'); label.textContent = over ? _t('Over by {a}', '超出 {a}', { a: clockText(s - targetS) }) : name; } }
      if (metaEl) { metaEl.setAttribute('startOffset', (((pos + 0.5) % 1) * C330 / (2 * C330) * 100).toFixed(3) + '%'); metaEl.textContent = _t('Ends {a} · {b} session', '结束于 {a} · 时长 {b}', { a: endsAt(), b: mins(timer.target) }); }
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
    s.textContent = wakeLock ? _t('● Screen stays on', '● 屏幕保持常亮') : _t('Screen may sleep. Keep the app open for the alert.', '屏幕可能休眠。请保持 app 打开以接收提醒。');
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
    { id: 'celebration', name: 'Celebration', zh: '庆祝', hint: 'Bright bell fanfare with a sparkle finish', hintZh: '明亮的钟声号角，带闪亮收尾' },
    { id: 'marimba', name: 'Marimba', zh: '马林巴', hint: 'Bouncy wooden riff', hintZh: '轻快跳跃的木琴段落' },
    { id: 'musicbox', name: 'Music box', zh: '八音盒', hint: 'Soft little tune', hintZh: '柔和的小曲' }
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
      case 'wrap-back': wrapUp = null; renderFocus(); tick(); break;
      case 'wrap-skip': saveWrap(true); break;
      case 'wrap-save': saveWrap(false); break;
    }
  });

  // Static bits in index.html (tab labels, note-to-self) that need re-translating on language change.
  function applyStaticI18n() {
    const nav = document.getElementById('tabs');
    if (nav) nav.setAttribute('aria-label', _t('Views', '视图'));
    const tabs = { today: _t('Today', '今天'), history: _t('History', '历史'), projects: _t('Projects', '项目'), settings: _t('Settings', '设置') };
    document.querySelectorAll('nav.tabs a').forEach(a => {
      const v = a.dataset.view; if (!v || !tabs[v]) return;
      const node = a.lastChild; if (node && node.nodeType === 3) node.textContent = tabs[v];
    });
    const al = document.getElementById('affirm-label');
    if (al) al.textContent = _t('Note to self', '写给自己的话');
    const ta = document.getElementById('affirm-text');
    if (ta) ta.placeholder = _t('Type a few encouraging words for today…', '写下几句鼓励自己的话…');
  }

  // ---------- render ----------
  function render() {
    document.getElementById('today-date').textContent = longDate(todayKey());
    const wk = weekStats(weekStart(todayKey()));
    document.getElementById('pills').innerHTML = state.ready ? `
      <div class="pill" title="${_t('Closed days where you kept at least half your commitments. Rest days don’t break it.', '守住至少一半承诺的收尾日。休息日不计入。')}"><b>${streak()}</b><span>${_t('day streak', '连续天数')}</span></div>
      <div class="pill" title="${_t('Commitments kept this week (Monday to today)', '本周守诺（周一到今天）')}"><b>${pct(wk.rate)}</b><span>${_t('kept this week', '本周守诺')}</span></div>` : '';
    document.querySelectorAll('nav.tabs a').forEach(a => a.setAttribute('aria-current', a.dataset.view === state.view ? 'page' : 'false'));
    document.getElementById('note').textContent = state.note;
    if (!state.ready) return;

    const ae = document.activeElement;
    const focusId = ae && ae.id ? ae.id : null;
    const sel = focusId && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;

    const v = document.getElementById('view');
    syncAffirm();
    applyStaticI18n();
    v.innerHTML = state.view === 'history' ? viewHistory() : state.view === 'projects' ? viewProjects() : state.view === 'settings' ? viewSettings() : viewToday();
    tick();
    updateBalance(); startMiner();

    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  }

  function projectOptions(id, selected) {
    const ps = activeProjects();
    return `<select id="${id}" aria-label="${_t('Category or project', '分类或项目')}"><option value="">${_t('Category: none', '分类：无')}</option>${CATS.map(c => `<optgroup label="${esc(catName(c.id))}">
      <option value="c:${c.id}">${esc(catName(c.id))} ${_t('(no project)', '（无项目）')}</option>
      ${ps.filter(p => projCat(p) === c.id).map(p => `<option value="p:${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  }
  function addForm(late) {
    return `<form class="add-form" data-form="${late ? 'add-late' : 'add'}">
      <input type="text" id="${late ? 'late' : 'new'}-text" placeholder="${late ? _t('Something that came up…', '临时冒出来的事…') : _t('A concrete outcome, e.g. “Draft section 3 of the paper”', '一个具体成果，例如「写完论文第 3 节」')}" aria-label="${_t('Task', '任务')}" maxlength="200" autocomplete="off">
      ${projectOptions(late ? 'late-project' : 'new-project', '')}
      <select id="${late ? 'late' : 'new'}-est" aria-label="${_t('Time estimate', '预计时间')}" title="${_t('How long you expect this to take', '你预计要花多久')}">${estOptions(50)}</select>
      <button class="btn ${late ? '' : 'primary'}" type="submit">${late ? _t('Add unplanned', '添加临时项') : _t('Add', '添加')}</button>
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
    const tw = (d.logs || []).filter(l => l.taskId === t.id && l.kind === 'words').reduce((a, l) => a + (l.value || 0), 0);
    if (tw) meta.push(`<span class="num">${_t('{a} words', '{a} 字', { a: nf(tw) })}</span>`);
    const steps = t.steps || [], sDone = steps.filter(x => x.done).length;
    if (steps.length) meta.push(`<span class="num">${_t('{a}/{b} steps', '{a}/{b} 步', { a: sDone, b: steps.length })}</span>`);
    const stepsEditable = !d.review.closed && !t.dropped;
    if (t.late) meta.push(`<span class="unplanned">${_t('unplanned', '临时')}</span>`);
    if (t.dropped) meta.push(`<span>${_t('Dropped: {a}', '已放弃：{a}', { a: t.reason || _t('no reason given', '未说明原因') })}</span>`);
    if (t.carried) meta.push(`<span>${_t('carried over', '昨日顺延')}</span>`);
    if (t.edited) meta.push(`<span>${_t('edited after lock-in', '锁定后编辑过')}</span>`);
    const running = timer && timer.day === k && timer.taskId === t.id;
    let actions = '';
    const editBtn = `<button class="btn quiet small" data-act="edit-task" data-id="${t.id}">${_t('Edit', '编辑')}</button>`;
    if (!d.locked) actions = `${editBtn}<button class="btn quiet small" data-act="remove" data-id="${t.id}" aria-label="${_t('Remove task', '删除任务')}">${_t('Remove', '删除')}</button>`;
    else if (!d.review.closed) {
      if (t.dropped) actions = `<button class="btn quiet small" data-act="restore" data-id="${t.id}">${_t('Restore', '恢复')}</button>`;
      else if (!t.done) actions = `${running ? `<button class="btn small primary" data-act="focus-open">${_t('Timer', '计时器')}</button>` : timer ? '' : `<button class="btn small" data-act="focus" data-id="${t.id}">${_t('Focus', '专注')}</button>`}
        <button class="btn quiet small" data-act="steps-open" data-id="${t.id}">+ ${_t('Step', '步骤')}</button>${editBtn}<button class="btn quiet small" data-act="drop" data-id="${t.id}">${_t('Drop', '放弃')}</button>`;
    }
    const dropping = state.ui.dropping === t.id ? `<div class="drop-box">
        <input type="text" id="drop-reason" placeholder="${_t('Why are you dropping this?', '为什么放弃这项？')}" aria-label="${_t('Reason for dropping', '放弃原因')}" maxlength="160">
        <button class="btn small" data-act="confirm-drop" data-id="${t.id}">${_t('Drop it', '确认放弃')}</button>
        <button class="btn quiet small" data-act="cancel-drop">${_t('Cancel', '取消')}</button></div>` : '';
    const editing = state.ui.editTask === t.id ? `<div class="drop-box">
        <input type="text" id="et-text" value="${esc(t.text)}" aria-label="${_t('Task', '任务')}" maxlength="200">
        <select id="et-est" aria-label="${_t('Time estimate', '预计时间')}">${estOptions(t.est || 50)}${ESTS.includes(t.est) ? '' : `<option value="${t.est}" selected>${_t('Est.', '预计')} ${mins(t.est || 0)}</option>`}</select>
        <button class="btn small primary" data-act="save-task" data-id="${t.id}">${_t('Save', '保存')}</button>
        <button class="btn quiet small" data-act="cancel-edit-task">${_t('Cancel', '取消')}</button></div>` : '';
    const checkable = d.locked && !t.dropped && !d.review.closed;
    return `<li class="task ${t.done ? 'is-done' : ''} ${t.dropped ? 'is-dropped' : ''}">
      ${d.locked ? `<button class="check" ${checkable ? `data-act="toggle" data-id="${t.id}"` : 'disabled'} aria-pressed="${!!t.done}" aria-label="${t.done ? _t('Mark not done', '标记为未完成') : _t('Mark done', '标记完成')}">${CHECK}</button>` : '<span class="step" aria-hidden="true">•</span>'}
      <div class="t-body"><div class="t-text">${esc(t.text)}</div><div class="t-meta">${meta.join('')}</div>${stepsList(t, stepsEditable)}${state.ui.stepsFor === t.id && stepsEditable ? stepForm(t) : ''}</div>
      <div class="t-actions">${actions}</div>
      ${dropping}${editing}
    </li>`;
  }

  // Steps: one level of checklist items under a task. They show progress but don't count as commitments.
  function stepsList(t, editable) {
    const steps = t.steps || []; if (!steps.length) return '';
    const done = steps.filter(x => x.done).length;
    return `<div class="step-bar" role="img" aria-label="${_t('{a} of {b} steps done', '{b} 步已完成 {a} 步', { a: done, b: steps.length })}"><span style="width:${(done / steps.length * 100).toFixed(1)}%"></span></div>
      <ul class="steps">${steps.map(st => `<li class="${st.done ? 'done' : ''}">
        <button class="step-check" data-act="step-toggle" data-id="${t.id}" data-step="${st.id}" aria-pressed="${!!st.done}" aria-label="${st.done ? _t('Mark step not done', '标记此步未完成') : _t('Mark step done', '标记此步完成')}" ${editable ? '' : 'disabled'}>${st.done ? '✓' : ''}</button>
        <span class="step-text">${esc(st.text)}</span>
        ${editable ? `<button class="step-del" data-act="step-del" data-id="${t.id}" data-step="${st.id}" aria-label="${_t('Delete step', '删除步骤')}">×</button>` : ''}</li>`).join('')}</ul>`;
  }
  function stepForm(t) {
    return `<form class="mini-form step-form" data-form="step" data-task="${t.id}">
      <input type="text" id="st-${t.id}" maxlength="120" autocomplete="off" placeholder="${(t.steps || []).length ? _t('Next step', '下一步') : _t('First step, e.g. Outline', '第一步，例如：大纲')}" aria-label="${_t('New step', '新步骤')}">
      <button class="btn small" type="submit">${_t('Add', '添加')}</button><button class="btn quiet small" type="button" data-act="steps-close">${_t('Done', '完成')}</button></form>`;
  }
  function toggleStep(taskId, stepId, forceDone) {
    const k = todayKey();
    mutateDay(k, d => { const t = d.tasks.find(x => x.id === taskId), st = t && (t.steps || []).find(x => x.id === stepId); if (st) st.done = forceDone === undefined ? !st.done : forceDone; });
    if (focusOpen) { renderFocus(); tick(); }
    const d = getDay(k), t = d.tasks.find(x => x.id === taskId);
    if (forceDone === undefined && t && !t.done && d.locked && !d.review.closed && (t.steps || []).length && t.steps.every(x => x.done))
      toast(_t('All steps done for “{a}”.', '「{a}」的所有步骤已完成。', { a: t.text }), { label: _t('Mark task done', '标记任务完成'), fn: () => markTaskDone(taskId) });
  }
  function markTaskDone(taskId) {
    const k = todayKey(), t = getDay(k).tasks.find(x => x.id === taskId); if (!t || t.done) return;
    mutateDay(k, d => { const x = d.tasks.find(y => y.id === taskId); if (x) x.done = true; });
    if (t.backlogId) setBacklogDone(t.backlogId, true);
    if (focusOpen) { renderFocus(); tick(); }
    toast(goalAchieved() ? _t('★ All commitments done. Goal achieved!', '★ 所有承诺已完成，目标达成！') : _t('Task done.', '任务完成。'));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'steps-open': state.ui.stepsFor = id; render(); setTimeout(() => document.getElementById('st-' + id)?.focus(), 0); break;
      case 'steps-close': state.ui.stepsFor = null; render(); break;
      case 'step-toggle': toggleStep(id, b.dataset.step); break;
      case 'step-del': mutateDay(todayKey(), d => { const t = d.tasks.find(x => x.id === id); if (t) t.steps = (t.steps || []).filter(x => x.id !== b.dataset.step); }); if (focusOpen) renderFocus(); break;
    }
  });

  function logLine(l) {
    const p = projectOf(l.project);
    const task = l.taskId ? Object.values(state.days).flatMap(d => d.tasks || []).find(t => t.id === l.taskId) : null;
    const what = l.kind === 'words' ? _t('{a} words', '{a} 字', { a: nf(l.value) }) : l.kind === 'time' ? mins(l.value) : _t('Done', '完成');
    const where = p ? p.name : task ? task.text : _t('Removed project', '已删除的项目');
    return `<b class="num">${esc(what)}</b> · ${esc(where)}${l.note ? ` · ${esc(l.note)}` : ''}`;
  }
  function logPanel(k, d) {
    const ps = activeProjects();
    const logs = d.logs || [];
    let h = `<div class="field" style="border-top:1px solid var(--line);padding-top:14px"><span class="label">${_t('Log progress', '记录进展')}</span>`;
    if (!ps.length) return h + `<p class="muted small">${_t('Add a project on the Projects tab to log words, time or milestones.', '先在「项目」页添加项目，才能记录字数、时间或里程碑。')}</p></div>`;
    const sel = projectOf(state.ui.logProj) || null;
    h += `<select id="log-proj" aria-label="${_t('Project to log', '要记录的项目')}"><option value="">${_t('Choose a project…', '选择项目…')}</option>${CATS.map(c => {
      const cps = ps.filter(p => projCat(p) === c.id); if (!cps.length) return '';
      return `<optgroup label="${esc(catName(c.id))}">${cps.map(p => `<option value="${esc(p.id)}"${sel && sel.id === p.id ? ' selected' : ''}>${esc(p.name)} (${esc(metricName(projMetric(p)))})</option>`).join('')}</optgroup>`;
    }).join('')}</select>`;
    if (sel) h += logForm('lg-today', sel);
    if (logs.length) h += `<ul class="todaylogs">${logs.map(l => `<li><span>${logLine(l)}</span><button class="btn quiet small" data-act="del-log" data-id="${l.id}">${_t('Remove', '删除')}</button></li>`).join('')}</ul>`;
    return h + '</div>';
  }

  function pickerPanel(d, carry = '') {
    const used = new Set(d.tasks.map(t => t.backlogId).filter(Boolean));
    const open = backlog().filter(b => !b.done && !used.has(b.id));
    if (!open.length && !carry) return '';
    const catOf = b => b.project && projectOf(b.project) ? projCat(projectOf(b.project)) : b.category;
    const groups = CATS.map(c => {
      const items = open.filter(b => catOf(b) === c.id);
      if (!items.length) return '';
      const shown = items.slice(0, 6);
      return `<div class="grp cat-${c.id}"><span class="cat-label"><span class="cat-dot"></span>${esc(catName(c.id))}</span>
        ${shown.map(b => `<div class="carry-item"><span>${esc(b.text)}${b.project && projectName(b.project) ? ` <span class="tag">${esc(projectName(b.project))}</span>` : ''}</span><button class="btn small" data-act="pick" data-id="${b.id}">${_t('Add', '添加')}</button></div>`).join('')}
        ${items.length > shown.length ? `<a class="muted" href="#projects" style="font-size:13px">${_t('{a} more in Projects', '项目页还有 {a} 项', { a: items.length - shown.length })}</a>` : ''}</div>`;
    }).join('');
    return `<div class="picker"><span class="label">${_t('Suggestions', '建议')}</span>${carry}${groups}</div>`;
  }

  function viewToday() {
    const k = todayKey(), d = getDay(k), s = stats(d);
    let h = '';

    h += balanceCard();
    h += `<section class="card active-proj" id="active-proj" hidden></section>`;

    // 1 — commit
    h += `<section class="card"><div class="sec-head"><h2><span class="step">1</span>${_t('Commit', '承诺')}</h2>
      ${d.rest ? `<span class="chip">${_t('Rest day', '休息日')}</span>` : d.locked ? `<span class="chip on">${_t('Locked at {a}', '已于 {a} 锁定', { a: fmtTime(d.lockedAt) })}</span>` : `<span class="chip warn">${_t('Not locked yet', '尚未锁定')}</span>`}</div>`;
    if (d.rest) {
      h += `<p class="muted">${_t('Today is marked as a rest day. It won’t count for or against your streak.', '今天是休息日，不计入连续纪录。')}</p>
        <div class="row"><button class="btn" data-act="unrest">${_t('Undo rest day', '取消休息日')}</button></div></section>`;
      h += `<section class="card">${logPanel(k, d)}</section>`;
      return h;
    }
    if (!d.locked) {
      h += `<p class="muted">${_t('Write down what you will finish today. Pick outcomes you can check off, not activities. Three is usually plenty.', '写下你今天要完成的事。选能勾掉的具体成果，而不是活动。三件通常就够了。')}</p>`;
      const prev = previousDay(k);
      let carry = '';
      if (prev && !d.tasks.length) {
        // Leftovers that also sit in a project list are offered once, under that list.
        const open = (prev.tasks || []).filter(t => !t.done && !t.dropped && !(t.backlogId && backlog().some(b => b.id === t.backlogId && !b.done)));
        const tom = prev.review?.tomorrow;
        if (open.length || tom) carry = `<div class="grp"><span class="cat-label">${_t('From {a}', '来自 {a}', { a: shortDate(prev.date) })}</span>
            ${tom ? `<div class="carry-item"><span>“${esc(tom)}” <span class="muted">${_t('(your planned first task)', '（你计划先做的事）')}</span></span><button class="btn small" data-act="carry-tom">${_t('Add', '添加')}</button></div>` : ''}
            ${open.map(t => `<div class="carry-item"><span>${esc(t.text)}</span><button class="btn small" data-act="carry" data-id="${t.id}">${_t('Add', '添加')}</button></div>`).join('')}</div>`;
      }
      if (d.tasks.length) h += `<ul class="tasks">${d.tasks.map(t => taskRow(k, d, t)).join('')}</ul>`;
      h += pickerPanel(d, carry);
      h += addForm(false);
      h += `<div class="row" style="justify-content:space-between">
        <button class="btn quiet small" data-act="rest">${_t('Mark today as a rest day', '把今天标记为休息日')}</button>
        <button class="btn primary" data-act="lock" ${d.tasks.length ? '' : 'disabled'}>${_t('Lock in {a} commitment{s}', '锁定 {a} 项承诺', { a: d.tasks.length || '', s: d.tasks.length === 1 ? '' : 's' })}</button></div>
        <p class="muted" style="font-size:13px">${_t('After you lock in, tasks can be finished or dropped with a reason. They can’t be quietly deleted.', '锁定后，任务可以完成，或写明原因后放弃；不能悄悄删除。')}</p>`;
      h += '</section>';
      h += `<section class="card">${logPanel(k, d)}</section>`;
      return h;
    }

    // locked
    h += `<div class="meter-row"><div class="row" style="justify-content:space-between"><span><b class="num">${s.done}</b> ${_t('of', '中的')} <b class="num">${s.committed}</b> ${_t('commitments kept', '项承诺已守住')}${s.extra ? ` · ${_t('{a} unplanned done', '{a} 项临时完成', { a: s.extra })}` : ''}</span><span class="num muted">${pct(s.rate)}</span></div>
      <div class="meter" role="img" aria-label="${_t('{a} kept', '守诺 {a}', { a: pct(s.rate) })}"><span style="width:${(s.rate || 0) * 100}%"></span></div></div>`;
    h += `<ul class="tasks">${d.tasks.map(t => taskRow(k, d, t)).join('')}</ul>`;
    if (!d.review.closed) h += addForm(true);
    h += '</section>';

    // 2 — focus
    const tt = timer ? getDay(timer.day).tasks.find(x => x.id === timer.taskId) : null;
    h += `<section class="card"><div class="sec-head"><h2><span class="step">2</span>${_t('Work', '专注')}</h2></div>
      ${timer ? `<div class="session-strip"><span><span class="label">${_t('In session', '进行中')}</span><br>${esc(tt ? tt.text : _t('Focus', '专注'))} · <b class="num" id="clock"></b></span>
          <button class="btn primary" data-act="focus-open">${_t('Open timer', '打开计时器')}</button></div>`
        : `<p class="muted small">${_t('Press Focus on a task to start the timer. When you end the session you can log words, milestones or a note in the same step. Use the box below only for work you didn’t time.', '点击任务上的「专注」开始计时。结束时可在同一环节记录字数、里程碑或备注。下面的框只用于没有计时的成果。')}</p>`}
      ${logPanel(k, d)}</section>`;

    // 3 — close
    const r = d.review;
    h += `<section class="card"><div class="sec-head"><h2><span class="step">3</span>${_t('Close the day', '结束今天')}</h2>${r.closed ? `<span class="chip on">${_t('Closed', '已结束')}</span>` : ''}</div>`;
    if (r.closed) {
      h += `<p>${r.rating ? _t('Rated {a}/5. ', '评分 {a}/5。', { a: r.rating }) : ''}${_t('{a} of {b} kept', '{b} 项承诺守住 {a} 项', { a: s.done, b: s.committed })}${r.blockers.length ? _t(' · Got in the way: {a}', ' · 阻碍：{a}', { a: r.blockers.map(blockerName).join(', ') }) : ''}。</p>
        ${r.note ? `<p class="muted">${esc(r.note)}</p>` : ''}
        ${r.tomorrow ? `<p><span class="label">${_t('Tomorrow starts with', '明天从这开始')}</span><br>${esc(r.tomorrow)}</p>` : ''}
        <div class="row"><button class="btn" data-act="reopen">${_t('Reopen today', '重新打开今天')}</button></div>`;
    } else {
      h += `<div class="field"><span class="label">${_t('How did today go?', '今天过得怎么样？')}</span><div class="choices rating">
          ${[1, 2, 3, 4, 5].map(n => `<button class="choice" data-act="rate" data-v="${n}" aria-pressed="${r.rating === n}">${n}</button>`).join('')}</div></div>
        <div class="field"><span class="label">${_t('What got in the way?', '什么造成了阻碍？')}</span><div class="choices">
          ${BLOCKERS.map(b => `<button class="choice" data-act="blocker" data-v="${esc(b)}" aria-pressed="${r.blockers.includes(b)}">${esc(blockerName(b))}</button>`).join('')}</div></div>
        <div class="field"><label class="label" for="rev-note">${_t('Honest note to yourself', '写给自己的诚实记录')}</label>
          <textarea id="rev-note" data-field="note" maxlength="1200" placeholder="${_t('What worked, what didn’t, what you’ll change.', '哪些奏效、哪些没有、你打算怎么改。')}">${esc(r.note)}</textarea></div>
        <div class="field"><label class="label" for="rev-tomorrow">${_t('First task tomorrow', '明天第一件事')}</label>
          <input type="text" id="rev-tomorrow" data-field="tomorrow" maxlength="200" value="${esc(r.tomorrow)}" placeholder="${_t('The one thing you’ll start with', '你明天开始要做的第一件事')}"></div>
        <div class="row"><button class="btn primary" data-act="close">${_t('Close the day', '结束今天')}</button></div>`;
    }
    h += '</section>';
    return h;
  }

  function projectDailyWords(pid, days = 14) {
    const today = todayKey(), logs = allLogs(), out = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = addDays(today, -i);
      out.push({ k, v: logs.filter(l => l.kind === 'words' && l.project === pid && l.date === k).reduce((a, l) => a + (l.value || 0), 0) });
    }
    return out;
  }
  function wordsMini(pid) {
    const items = projectDailyWords(pid, 14);
    const max = Math.max(1, ...items.map(x => x.v));
    if (!items.some(x => x.v > 0)) return `<p class="muted small">${_t('No words logged in the last 14 days.', '最近 14 天没有记录字数。')}</p>`;
    return `<div class="cols mini" role="img" aria-label="${_t('Words per day, last 14 days', '最近 14 天每天字数')}">${items.map(x => `<span class="${x.v ? '' : 'zero'}" style="height:${Math.max(4, x.v / max * 100)}%" title="${esc(shortDate(x.k))}: ${nf(x.v)} ${_t('words', '字')}"></span>`).join('')}</div>`;
  }

  function viewHistory() {
    const today = todayKey();
    const ws = weekStart(today);
    const cur = weekStats(ws), last = weekStats(addDays(ws, -7));
    const delta = (a, b, f) => (a == null || b == null) ? '' : `<span class="delta">${a >= b ? '+' : '−'}${f(Math.abs(a - b))}${_t(' vs last week', ' 对比上周')}</span>`;
    let h = `<section class="card"><div class="sec-head"><h2>${_t('This week', '本周')}</h2><span class="muted">${_t('Since {a}', '自 {a} 起', { a: shortDate(ws) })}</span></div>
      <div class="stats">
        <div class="stat"><span class="label">${_t('Kept', '守诺')}</span><b>${pct(cur.rate)}</b>${delta(cur.rate, last.rate, x => Math.round(x * 100) + _t(' pts', ' 个百分点'))}</div>
        <div class="stat"><span class="label">${_t('Commitments', '承诺')}</span><b>${cur.done}/${cur.committed}</b><span class="delta">${_t('last week {a}/{b}', '上周 {a}/{b}', { a: last.done, b: last.committed })}</span></div>
        <div class="stat"><span class="label">${_t('Focus', '专注')}</span><b>${(cur.minutes / 60).toFixed(1)}h</b><span class="delta">${_t('last week {a}h', '上周 {a} 小时', { a: (last.minutes / 60).toFixed(1) })}</span></div>
        <div class="stat"><span class="label">${_t('Days closed', '已结束天数')}</span><b>${cur.closed}</b><span class="delta">${_t('last week {a}', '上周 {a}', { a: last.closed })}</span></div>
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
      backlog().filter(b => oid.has(b.project) && b.done && b.doneAt && dayKeyOf(b.doneAt) >= from14).forEach(b => feed.push({ at: b.doneAt, date: dayKeyOf(b.doneAt), text: `Milestone: ${b.text}`, p: b.project }));
      feed.sort((a, b) => a.at < b.at ? 1 : -1);
      const msDone = backlog().filter(b => oid.has(b.project) && b.done && b.doneAt && dayKeyOf(b.doneAt) >= ws).length;
      const plist = (items, val) => items.length ? `<ul class="plist">${items.map(p => `<li class="cat-${projCat(p)}"><span><span class="cat-dot"></span>${esc(p.name)}</span><span class="num">${val(p)}</span></li>`).join('')}</ul>` : '';
      h += `<section class="card"><div class="sec-head"><h2>${_t('Progress', '进展')}</h2><span class="muted">${_t('This week, by how you track it', '本周，按你的度量方式')}</span></div><div class="tri">
        <div><span class="label">${_t('Word count', '字数')}</span><span class="big">${nf(wordsWeek)}</span><span class="delta">${_t('words this week · last week {a}', '本周字数 · 上周 {a}', { a: nf(wordsLast) })}</span>
          <div class="cols" role="img" aria-label="${_t('Words written per day, last 14 days', '最近 14 天每天写作字数')}">${daily.map(v => `<span class="${v ? '' : 'zero'}" style="height:${Math.max(4, v / dMax * 100)}%" title="${nf(v)} ${_t('words', '字')}"></span>`).join('')}</div>
          <span class="delta">${_t('Last 14 days', '最近 14 天')}</span>
          ${wps.length ? `<ul class="projcharts">${wps.map(p => `<li><div class="projchart-head"><span class="cat-dot"></span><span class="projchart-name">${esc(p.name)}</span><span class="num">${_t('{a} this week', '本周 {a}', { a: nf(projWords(p.id, ws)) })}</span></div>${wordsMini(p.id)}</li>`).join('')}</ul>` : `<p class="muted small">${_t('No word-count projects yet.', '还没有按字数计量的项目。')}</p>`}</div>
        <div><span class="label">${_t('Time', '时间')}</span><span class="big">${mins(timeWeek)}</span><span class="delta">${_t('this week · last week {a}', '本周 · 上周 {a}', { a: mins(timeLast) })}</span>
          ${plist(tps, p => { const w = projMinutes(p.id, ws); return !p.deadline && p.target ? `${mins(w)} / ${p.target}h` : mins(w); }) || `<p class="muted small">${_t('No time-tracked projects yet.', '还没有按时间计量的项目。')}</p>`}</div>
        <div><span class="label">${_t('Other', '其他')}</span><span class="big">${msDone}</span><span class="delta">${_t('milestones finished this week', '本周完成的里程碑')}</span>
          ${feed.length ? `<ul class="feed">${feed.slice(0, 8).map(f => `<li><span class="num muted">${esc(shortDate(f.date))}</span> · ${esc(projectName(f.p))}<br>${esc(f.text)}</li>`).join('')}</ul>` : `<p class="muted small">${ops.length ? _t('Notes and finished milestones from the last 14 days will show here.', '最近 14 天的备注和完成的里程碑会显示在这里。') : _t('No milestone projects yet.', '还没有里程碑项目。')}</p>`}</div>
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
    h += `<section class="card"><div class="sec-head"><h2>${_t('Where your time goes', '你的时间花在哪')}</h2><span class="muted">${_t('Last 14 days, by category', '最近 14 天，按分类')}</span></div>
      ${anyBal ? `<div class="cat-sum">${CATS.map(c => `<div class="bar cat-${c.id}"><span class="cat-label"><span class="cat-dot"></span>${esc(catName(c.id))}</span>
          <span class="track"><span style="width:${bal[c.id].m / balMax * 100}%"></span></span><span class="num" style="white-space:nowrap">${mins(bal[c.id].m)}</span></div>
          <span class="muted" style="font-size:12px;margin-top:-6px">${_t('{a} task{s} done', '{a} 项任务完成', { a: bal[c.id].n, s: bal[c.id].n === 1 ? '' : 's' })}</span>`).join('')}</div>
        ${bal.passion.m === 0 && (bal.must.m + bal.baseline.m) > 0 ? `<p class="muted" style="font-size:13px">${_t('No focused time on passion-driven work in two weeks.', '两周内没有投入时间给热爱驱动的工作。')}</p>` : ''}`
      : `<p class="muted">${_t('Tag today’s tasks with a category or project and the time you focus will add up here.', '给今天的任务标上分类或项目，你的专注时间就会汇总到这里。')}</p>`}</section>`;

    // heatmap
    const start = addDays(ws, -77);
    let cells = '<span></span>';
    let prevMonth = null;
    for (let w = 0; w < 12; w++) {
      const m = parse(addDays(start, w * 7)).getMonth();
      cells += `<span class="mon">${m !== prevMonth ? parse(addDays(start, w * 7)).toLocaleDateString(LOC(), { month: 'short' }) : ''}</span>`;
      prevMonth = m;
    }
    const dayNames = [_t('Mon', '一'), '', _t('Wed', '三'), '', _t('Fri', '五'), '', _t('Sun', '日')];
    for (let i = 0; i < 7; i++) {
      cells += `<span class="lbl">${dayNames[i]}</span>`;
      for (let w = 0; w < 12; w++) {
        const k = addDays(start, w * 7 + i);
        const d = state.days[k];
        let cls = '', tip = shortDate(k);
        if (k > today) cls = 'future';
        else if (d && d.rest) { cls = 'rest'; tip += _t(': rest day', '：休息日'); }
        else if (d) {
          const s = stats(d);
          if (s.rate != null) { cls = s.rate === 0 ? 'l0' : s.rate < 0.5 ? 'l1' : s.rate < 0.8 ? 'l2' : s.rate < 1 ? 'l3' : 'l4'; tip += _t(': {a}/{b} kept', '：{b} 项守住 {a} 项', { a: s.done, b: s.committed }); }
        } else tip += _t(': nothing recorded', '：无记录');
        if (k === today) cls += ' today';
        const clickable = k <= today && d && (d.rest || (d.tasks || []).length > 0);
        cells += clickable
          ? `<button type="button" class="cell ${cls}" data-act="day" data-day="${k}" title="${esc(tip + _t(' · tap to review', ' · 点击查看'))}" aria-label="${esc(tip + _t(' · tap to review', ' · 点击查看'))}"></button>`
          : `<span class="cell ${cls}" title="${esc(tip)}"></span>`;
      }
    }
    h += `<section class="card"><div class="sec-head"><h2>${_t('Last 12 weeks', '最近 12 周')}</h2></div>
      <div class="heat-wrap"><div class="heat">${cells}</div></div>
      <div class="legend"><span><i style="background:var(--empty)"></i>${_t('None', '无')}</span><span><i class="cell l0"></i>0%</span><span><i class="cell l1"></i>${_t('under 50%', '低于 50%')}</span><span><i class="cell l2"></i>50–79%</span><span><i class="cell l3"></i>80–99%</span><span><i class="cell l4"></i>${_t('All kept', '全部守住')}</span><span><i class="cell rest"></i>${_t('Rest', '休息')}</span></div>
      <p class="muted small">${_t('Tap a day to review it.', '点击某天可查看回顾。')}</p></section>`;

    // blockers
    const tally = {};
    for (let i = 0; i < 30; i++) { const d = state.days[addDays(today, -i)]; (d?.review?.blockers || []).forEach(b => tally[b] = (tally[b] || 0) + 1); }
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? entries[0][1] : 1;
    h += `<section class="card"><div class="sec-head"><h2>${_t('What gets in the way', '什么在阻碍你')}</h2><span class="muted">${_t('Last 30 days', '最近 30 天')}</span></div>
      ${entries.length ? `<div class="bars">${entries.map(([b, n]) => `<div class="bar"><span>${esc(blockerName(b))}</span><span class="track"><span style="width:${n / max * 100}%"></span></span><span class="num">${n}</span></div>`).join('')}</div>` : `<p class="muted">${_t('Blockers you tag when closing a day will add up here.', '结束一天时标记的阻碍会汇总到这里。')}</p>`}</section>`;

    // log
    const keys = Object.keys(state.days).filter(k => k <= today).sort().reverse().filter(k => state.days[k].rest || (state.days[k].tasks || []).length).slice(0, 21);
    h += `<section class="card"><div class="sec-head"><h2>${_t('Daily log', '每日日志')}</h2></div>`;
    if (!keys.length) h += `<div class="empty"><b>${_t('No days recorded yet', '还没有记录任何一天')}</b><span>${_t('Lock in your first commitments on the Today tab and they’ll show up here.', '在「今天」页锁定你的第一项承诺，之后会显示在这里。')}</span></div>`;
    else h += `<ul class="log">${keys.map(k => {
      const d = state.days[k], s = stats(d);
      if (d.rest) return `<li><span class="num">${esc(shortDate(k))}</span><span class="muted">${_t('Rest day', '休息日')}</span></li>`;
      const dropped = d.tasks.filter(t => t.dropped);
      return `<li><span class="num">${esc(shortDate(k))}</span><div>
        <div class="row"><b class="num">${s.done}/${s.committed}</b><span class="muted">${_t('kept', '守诺')}</span>${d.review?.rating ? `<span class="chip">${d.review.rating}/5</span>` : ''}${s.minutes ? `<span class="chip">${mins(s.minutes)}</span>` : ''}${!d.review?.closed && k < today ? `<span class="chip warn">${_t('Not closed', '未结束')}</span>` : ''}</div>
        ${d.review?.note ? `<p class="note">${esc(d.review.note)}</p>` : ''}
        ${dropped.length ? `<p class="muted" style="font-size:13px">${_t('Dropped: {a}', '已放弃：{a}', { a: dropped.map(t => `${esc(t.text)} (${esc(t.reason || _t('no reason', '无原因'))})`).join('; ') })}</p>` : ''}
      </div></li>`;
    }).join('')}</ul>`;
    h += '</section>';
    return h;
  }

  function projFacts(p) {
    const today = todayKey();
    let minutes = 0, done = 0, lastDay = null;
    Object.values(state.days).forEach(d => (d.tasks || []).forEach(t => { if (t.project === p.id) { minutes += t.minutes || 0; if (t.done) done++; if (t.done || t.minutes) lastDay = !lastDay || d.date > lastDay ? d.date : lastDay; } }));
    let due = _t('No deadline', '无截止日期'), late = false;
    if (p.deadline) { const n = daysBetween(today, p.deadline); late = n < 0; due = n === 0 ? _t('Due today', '今天到期') : n > 0 ? _t('{a} day{s} left', '还剩 {a} 天', { a: n, s: n === 1 ? '' : 's' }) : _t('{a} day{s} overdue', '已逾期 {a} 天', { a: -n, s: n === -1 ? '' : 's' }); }
    const idle = lastDay ? daysBetween(lastDay, today) : null;
    return { minutes, done, lastDay, due, late, idle };
  }
  function catSelect(id, selected) {
    return `<select id="${id}" aria-label="${_t('Category', '分类')}">${CATS.map(c => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(catName(c.id))}</option>`).join('')}</select>`;
  }
  function modeFields(pre, deadline) {
    return `<select id="${pre}-mode" data-mode-for="${pre}-due" aria-label="${_t('Deadline mode', '截止方式')}">
        <option value="open"${deadline ? '' : ' selected'}>${_t('No deadline', '无截止日期')}</option>
        <option value="due"${deadline ? ' selected' : ''}>${_t('Has a deadline', '有截止日期')}</option></select>
      <input type="date" id="${pre}-due" aria-label="${_t('Deadline', '截止日期')}" value="${esc(deadline || '')}" ${deadline ? '' : 'disabled'}>`;
  }
  function metricFields(pre, p) {
    const metric = p ? projMetric(p) : 'words';
    return `<select id="${pre}-metric" data-metric-for="${pre}" aria-label="${_t('Track progress by', '按什么度量进展')}">${METRICS.map(m => `<option value="${m.id}"${m.id === metric ? ' selected' : ''}>${_t('Track: {a}', '度量：{a}', { a: metricName(m.id) })}</option>`).join('')}</select>
      <input type="number" id="${pre}-target" min="0" step="any" aria-label="${_t('Target', '目标')}" placeholder="${esc(targetHint(metric, !!(p && p.deadline)))}" value="${p && p.target ? esc(p.target) : ''}" ${metric === 'other' ? 'hidden' : ''} class="target-input">`;
  }
  function logForm(id, p) {
    const metric = projMetric(p);
    const num = metric === 'words' ? `<input type="number" id="${id}-v" min="0" step="1" placeholder="${_t('Words written', '已写字数')}" aria-label="${_t('Words written', '已写字数')}">`
      : metric === 'time' ? `<input type="number" id="${id}-v" min="0" step="1" placeholder="${_t('Minutes', '分钟数')}" aria-label="${_t('Minutes', '分钟数')}">` : '';
    const ph = metric === 'other' ? _t('What did you complete? e.g. “Modeled the roof trusses”', '你完成了什么？例如「建好了屋顶桁架模型」') : _t('Note (optional)', '备注（可选）');
    return `<form class="log-form" data-form="plog" data-project="${p.id}" data-id="${id}">${num}
      <input type="text" id="${id}-n" maxlength="200" placeholder="${esc(ph)}" aria-label="${_t('Progress note', '进展备注')}" autocomplete="off">
      <button class="btn small" type="submit">${_t('Log', '记录')}</button></form>`;
  }
  function progBlock(p) {
    const g = progressOf(p);
    return `<div class="prog"><div class="head"><span><span class="metric-chip">${esc(metricName(g.metric))}</span></span><span class="num small">${esc(g.head)}</span></div>
      ${g.ratio != null ? `<div class="meter" role="img" aria-label="${_t('{a}% of target', '完成目标 {a}%', { a: Math.round(g.ratio * 100) })}"><span style="width:${g.ratio * 100}%"></span></div>` : ''}
      ${g.sub.length || g.metric !== 'time' ? `<p class="muted small">${[...g.sub, ...(g.metric !== 'time' ? [_t('{a} focused', '专注 {a}', { a: mins(projMinutes(p.id)) })] : [])].map(esc).join(' · ')}</p>` : ''}</div>`;
  }

  function backlogList(items) {
    if (!items.length) return '';
    const onToday = new Set((getDay(todayKey()).tasks || []).map(t => t.backlogId).filter(Boolean));
    return `<ul class="ptasks">${items.map(b => `<li class="ptask ${b.done ? 'is-done' : ''}">
        <button class="check" data-act="btoggle" data-id="${b.id}" aria-pressed="${!!b.done}" aria-label="${b.done ? _t('Mark not done', '标记为未完成') : _t('Mark done', '标记完成')}">${CHECK}</button>
        ${state.ui.editB === b.id ? `<span class="mini-form"><input type="text" id="eb-text" value="${esc(b.text)}" aria-label="${_t('Task', '任务')}" maxlength="200"><button class="btn small primary" data-act="save-btask" data-id="${b.id}">${_t('Save', '保存')}</button><button class="btn quiet small" data-act="cancel-edit-b">${_t('Cancel', '取消')}</button></span>`
          : `<span class="t-text">${esc(b.text)}${onToday.has(b.id) && !b.done ? ` <span class="chip on">${_t('on today', '今天')}</span>` : ''}</span>`}
        <span class="t-actions">${!b.done && !onToday.has(b.id) ? `<button class="btn small" data-act="to-today" data-id="${b.id}">${_t('To today', '加到今天')}</button>` : ''}
          ${state.ui.editB === b.id ? '' : `<button class="btn quiet small" data-act="edit-b" data-id="${b.id}">${_t('Edit', '编辑')}</button>`}<button class="btn quiet small" data-act="bremove" data-id="${b.id}" aria-label="${_t('Delete task', '删除任务')}">${_t('Delete', '删除')}</button></span>
      </li>`).join('')}</ul>`;
  }
  function sortTasks(items) { return [...items].sort((a, b) => (a.done - b.done) || ((a.created || '') < (b.created || '') ? -1 : 1)); }

  function viewProjects() {
    const ps = activeProjects();
    const bl = backlog();
    let h = `<section class="card"><div class="sec-head"><h2>${_t('New project', '新建项目')}</h2><span class="muted">${_t('Every project belongs to one of three categories', '每个项目都属于三类之一')}</span></div>
      <form class="add-form proj-form" data-form="project">
        <input type="text" id="proj-name" placeholder="${_t('e.g. Journal paper, Pavilion 3D model, Strength training', '例如：期刊论文、展亭 3D 模型、力量训练')}" aria-label="${_t('Project name', '项目名称')}" maxlength="80" autocomplete="off" style="grid-column:1 / -1">
        ${catSelect('proj-cat', 'passion')}
        ${modeFields('proj', null)}
        ${metricFields('proj', null)}
        <button class="btn primary" type="submit">${_t('Add project', '添加项目')}</button>
      </form>
      <p class="muted small">${_t('Word count suits writing. Time suits workouts and practice. Other tracks components and milestones, with notes on what you finished. Projects with a deadline get a total target and a daily pace; ongoing ones get a weekly target.', '字数适合写作；时间适合锻炼和练习；其他用于追踪组件和里程碑，并记录你完成了什么。有截止日期的项目设总目标和每日进度；进行中的项目设每周目标。')}</p></section>`;

    CATS.forEach(c => {
      const cps = ps.filter(p => projCat(p) === c.id)
        .sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : a.name.localeCompare(b.name));
      const loose = sortTasks(bl.filter(b => b.category === c.id && !b.project));
      const open = bl.filter(b => !b.done && (b.category === c.id || (b.project && projectOf(b.project) && projCat(projectOf(b.project)) === c.id))).length;
      h += `<section class="card cat-card cat-${c.id}"><div class="sec-head"><h2>${esc(catName(c.id))}</h2>
          <span class="muted num">${_t('{a} project{s} · {b} open task{t}', '{a} 个项目 · {b} 个未完成任务', { a: cps.length, s: cps.length === 1 ? '' : 's', b: open, t: open === 1 ? '' : 's' })}</span></div>
        <p class="muted">${esc(catBlurb(c.id))}</p><div>`;
      cps.forEach(p => {
        const f = projFacts(p);
        const tasks = sortTasks(bl.filter(b => b.project === p.id));
        const editing = state.ui.editProj === p.id;
        h += `<div class="proj">
          <span class="name">${esc(p.name)}</span>
          <span class="due ${f.late ? 'late' : ''}">${p.deadline ? f.due : `<span class="chip">${_t('Ongoing', '进行中')}</span>`}</span>
          <div class="facts"><span>${f.lastDay ? (f.idle === 0 ? _t('Worked on today', '今天有推进') : _t('Last worked {a} day{s} ago', '{a} 天前有推进', { a: f.idle, s: f.idle === 1 ? '' : 's' })) : _t('Not started', '尚未开始')}</span>
            ${f.idle != null && f.idle >= 5 && !f.late ? `<span class="chip warn">${_t('Going stale', '即将荒废')}</span>` : ''}
            ${p.deadline ? `<span class="muted">${_t('Due {a}', '截止 {a}', { a: parse(p.deadline).toLocaleDateString(LOC(), { month: 'short', day: 'numeric', year: 'numeric' }) })}</span>` : ''}
            <span style="margin-left:auto">${state.ui.confirmDel === p.id
              ? `<button class="btn small" data-act="del-project" data-id="${p.id}">${_t('Yes, remove it and its open list (past days are kept)', '是的，删除它及其未完成清单（历史记录保留）')}</button> <button class="btn quiet small" data-act="cancel-del">${_t('Keep', '保留')}</button>`
              : `<button class="btn quiet small" data-act="edit-proj" data-id="${p.id}">${_t('Edit', '编辑')}</button><button class="btn quiet small" data-act="ask-del" data-id="${p.id}">${_t('Remove', '删除')}</button>`}</span>
          </div>
          ${editing ? `<div class="pedit"><input type="text" id="edit-name" value="${esc(p.name)}" aria-label="${_t('Project name', '项目名称')}" maxlength="80" style="flex:1 1 200px">${catSelect('edit-cat', projCat(p))}${modeFields('edit', p.deadline)}${metricFields('edit', p)}
              <input type="number" id="edit-start" min="0" step="1" aria-label="${_t('Words already written', '已写字数')}" placeholder="${_t('Words already written', '已写字数')}" value="${p.startWords ? esc(p.startWords) : ''}" ${projMetric(p) === 'words' ? '' : 'hidden'} class="target-input">
              <button class="btn small primary" data-act="save-proj" data-id="${p.id}">${_t('Save', '保存')}</button><button class="btn quiet small" data-act="cancel-edit">${_t('Cancel', '取消')}</button></div>` : ''}
          ${progBlock(p)}
          ${projMetric(p) === 'other' ? `<span class="label" style="grid-column:1 / -1">${_t('Components & milestones', '组件与里程碑')}</span>` : ''}
          ${backlogList(tasks)}
          <form class="mini-form" data-form="btask" data-project="${p.id}" data-category="${c.id}">
            <input type="text" id="bt-${p.id}" placeholder="${projMetric(p) === 'other' ? _t('Add a component or milestone', '添加组件或里程碑') : _t('Add a task to {a}', '给「{a}」添加任务', { a: p.name })}" aria-label="${_t('New task for {a}', '「{a}」的新任务', { a: p.name })}" maxlength="200" autocomplete="off">
            <button class="btn small" type="submit">${_t('Add', '添加')}</button></form>
        </div>`;
      });
      if (!cps.length) h += `<p class="muted" style="font-size:13px">${_t('No {a} projects yet. Add one above, or list loose tasks below.', '还没有「{a}」项目。可在上方添加，或在下面列出零散任务。', { a: catName(c.id) })}</p>`;
      h += `</div><div class="loose"><span class="label">${_t('Tasks without a project', '无项目的任务')}</span>
          ${backlogList(loose)}
          <form class="mini-form" data-form="btask" data-project="" data-category="${c.id}">
            <input type="text" id="bt-cat-${c.id}" placeholder="${_t('Add a {a} task', '添加一个{a}任务', { a: catName(c.id) })}" aria-label="${_t('New {a} task', '新的{a}任务', { a: catName(c.id) })}" maxlength="200" autocomplete="off">
            <button class="btn small" type="submit">${_t('Add', '添加')}</button></form>
        </div></section>`;
    });
    return h;
  }

  // ---------- events ----------
  // A short message; with `action` it also shows a button (e.g. Undo) and stays up longer.
  function toast(msg, action) {
    const t = document.getElementById('toast');
    t.textContent = '';
    const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
    if (action) {
      const b = document.createElement('button'); b.className = 'toast-btn'; b.type = 'button'; b.textContent = action.label;
      b.addEventListener('click', ev => { ev.stopPropagation(); t.hidden = true; action.fn(); });
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, action ? 6000 : 2600);
  }

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const k = todayKey();
    if (f.dataset.form === 'step') {
      const tid = f.dataset.task, input = document.getElementById('st-' + tid), text = (input?.value || '').trim();
      if (!text) { toast(_t('Write the step first.', '先写下步骤。')); return; }
      mutateDay(k, d => { const t = d.tasks.find(x => x.id === tid); if (t) t.steps = [...(t.steps || []), { id: rid(), text, done: false }]; });
      setTimeout(() => document.getElementById('st-' + tid)?.focus(), 0);
      return;
    }
    if (f.dataset.form === 'project') {
      const name = document.getElementById('proj-name').value.trim();
      if (!name) { toast(_t('Give the project a name first.', '先给项目起个名字。')); return; }
      const category = document.getElementById('proj-cat').value;
      const hasDue = document.getElementById('proj-mode').value === 'due';
      const deadline = hasDue ? (document.getElementById('proj-due').value || null) : null;
      if (hasDue && !deadline) { toast(_t('Pick the deadline date, or choose No deadline.', '请选择截止日期，或选择「无截止日期」。')); return; }
      const metric = document.getElementById('proj-metric').value;
      const target = metric === 'other' ? null : (Number(document.getElementById('proj-target').value) || null);
      mutateProfile(p => p.projects.push({ id: rid(), name, category, deadline, metric, target, startWords: 0 }));
      toast(_t('Added to {a}.', '已添加到「{a}」。', { a: catName(category) }));
      return;
    }
    if (f.dataset.form === 'plog') {
      const p = projectOf(f.dataset.project); if (!p) return;
      const metric = projMetric(p), fid = f.dataset.id;
      const v = Math.round(Number(document.getElementById(fid + '-v')?.value) || 0);
      const note = (document.getElementById(fid + '-n')?.value || '').trim();
      if (metric !== 'other' && v <= 0 && !note) { toast(metric === 'words' ? _t('Enter how many words you wrote.', '请输入你写了多少字。') : _t('Enter how many minutes.', '请输入多少分钟。')); return; }
      if (metric === 'other' && !note) { toast(_t('Describe what you completed.', '描述你完成了什么。')); return; }
      const kind = metric === 'other' || v <= 0 ? 'note' : metric;
      mutateDay(k, d => { if (!d.logs) d.logs = []; d.logs.push({ id: rid(), project: p.id, kind, value: kind === 'note' ? null : v, note, at: new Date().toISOString() }); });
      toast(kind === 'words' ? _t('Logged {a} words.', '已记录 {a} 字。', { a: nf(v) }) : kind === 'time' ? _t('Logged {a}.', '已记录 {a}。', { a: mins(v) }) : _t('Progress noted.', '已记录进展。'));
      return;
    }
    if (f.dataset.form === 'btask') {
      const input = f.querySelector('input');
      const text = input.value.trim();
      if (!text) { toast(_t('Write the task first.', '先写下任务。')); return; }
      const project = f.dataset.project || null, category = f.dataset.category;
      mutateProfile(p => p.backlog.push({ id: rid(), text, category, project, done: false, created: new Date().toISOString() }));
      document.getElementById(input.id)?.focus();
      return;
    }
    const late = f.dataset.form === 'add-late', pre = late ? 'late' : 'new';
    const text = document.getElementById(pre + '-text').value.trim();
    if (!text) { toast(_t('Write the task first.', '先写下任务。')); return; }
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
    if (d.rest) { toast(_t('Today is a rest day. Undo that first on the Today tab.', '今天是休息日，请先在「今天」页取消。')); return; }
    if (d.review.closed) { toast(_t('Today is already closed.', '今天已经结束了。')); return; }
    if (d.tasks.some(t => t.backlogId === bid)) { toast(_t('Already on today’s list.', '已经在今天的清单里。')); return; }
    const category = b.project && projectOf(b.project) ? projCat(projectOf(b.project)) : b.category;
    mutateDay(k, day => day.tasks.push({ id: rid(), text: b.text, project: b.project || null, category, backlogId: b.id, est: 50, done: false, dropped: false, reason: '', late: !!day.locked, minutes: 0 }));
    toast(d.locked ? _t('Added to today as unplanned.', '已作为临时项加入今天。') : _t('Added to today’s commitments.', '已加入今天的承诺。'));
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
      case 'lock': mutateDay(k, d => { d.locked = true; d.lockedAt = new Date().toISOString(); }); toast(_t('Locked in. Now go do it.', '已锁定。现在去做吧。')); break;
      case 'rest': mutateDay(k, d => { d.rest = true; }); break;
      case 'unrest': mutateDay(k, d => { d.rest = false; }); break;
      case 'carry': {
        const t = prev && prev.tasks.find(x => x.id === id); if (!t) break;
        mutateDay(k, d => d.tasks.push({ id: rid(), text: t.text, project: t.project || null, category: t.category || null, backlogId: t.backlogId || null, est: t.est || 50, done: false, dropped: false, reason: '', late: false, minutes: 0, carried: true, steps: (t.steps || []).filter(x => !x.done).map(x => ({ id: rid(), text: x.text, done: false })) }));
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
        if (hasDue && !deadline) { toast(_t('Pick the deadline date, or choose No deadline.', '请选择截止日期，或选择「无截止日期」。')); break; }
        const metric = document.getElementById('edit-metric').value;
        const target = metric === 'other' ? null : (Number(document.getElementById('edit-target').value) || null);
        const startWords = Number(document.getElementById('edit-start')?.value) || 0;
        state.ui.editProj = null;
        const newName = (document.getElementById('edit-name')?.value || '').trim();
        mutateProfile(p => { const x = p.projects.find(q => q.id === id); if (x) { if (newName) x.name = newName; x.category = category; x.deadline = deadline; x.metric = metric; x.target = target; x.startWords = startWords; } });
        break;
      }
      case 'focus': startTimer(k, id); break;
      case 'stop': openWrapUp(false); break;
      case 'drop': state.ui.dropping = id; render(); document.getElementById('drop-reason')?.focus(); break;
      case 'cancel-drop': state.ui.dropping = null; render(); break;
      case 'confirm-drop': {
        const reason = (document.getElementById('drop-reason')?.value || '').trim();
        if (!reason) { toast(_t('Say why. That’s the point.', '说说为什么。这正是重点。')); document.getElementById('drop-reason')?.focus(); break; }
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
    const milestones = backlog().filter(b => b.done && b.doneAt && dayKeyOf(b.doneAt) === k && b.project && projectOf(b.project) && projMetric(projectOf(b.project)) === "other");
    const notes = logs.filter(l => l.note);
    return { d, s, words, time: s.minutes + logged, milestones, notes };
  }
  function summaryBody(k) {
    const n = dayNumbers(k), r = n.d.review;
    const wk = weekStats(weekStart(k));
    const tile = (label, value) => `<div class="stat"><span class="label">${label}</span><b>${value}</b></div>`;
    let h = `<div class="stats">
      ${tile(_t('Kept', '守诺'), n.s.committed ? `${n.s.done}/${n.s.committed}` : '—')}
      ${tile(_t('Time', '时间'), mins(n.time))}
      ${tile(_t('Words', '字数'), nf(n.words))}
      ${tile(_t('Milestones', '里程碑'), n.milestones.length)}
    </div>`;
    const open = n.d.tasks.filter(t => !t.done && !t.dropped);
    if (open.length) h += `<div class="field"><span class="label">${_t('Still open', '仍未完成')}</span><ul class="plist">${open.map(t => `<li><span>${esc(t.text)}</span><span class="num">${t.minutes ? mins(t.minutes) : ''}</span></li>`).join('')}</ul></div>`;
    if (n.s.extra) h += `<p class="small muted">${_t('Plus {a} unplanned task{s} done.', '另完成 {a} 项临时任务。', { a: n.s.extra, s: n.s.extra === 1 ? '' : 's' })}</p>`;
    if (n.milestones.length || n.notes.length) h += `<div class="field"><span class="label">${_t('Finished', '已完成')}</span><ul class="feed">${n.milestones.map(b => `<li>${_t('Milestone: {a}', '里程碑：{a}', { a: b.text })}</li>`).join('')}${n.notes.map(l => `<li>${esc(projectName(l.project))}: ${esc(l.note)}</li>`).join('')}</ul></div>`;
    if (r.blockers && r.blockers.length) h += `<p class="small"><span class="label">${_t('Got in the way', '阻碍')}</span><br>${esc(r.blockers.map(blockerName).join(', '))}</p>`;
    h += `<p class="small muted">${_t('This week: {a} of commitments kept · streak {b} day{s}', '本周：守住 {a} 的承诺 · 连续 {b} 天', { a: pct(wk.rate), b: streak(), s: streak() === 1 ? '' : 's' })}</p>`;
    return h;
  }
  function dayModal(k) {
    const d = getDay(k);
    return `<div class="modal-card"><span class="label">${esc(longDate(k))}</span>
      <h2 id="modal-title">${d.rest ? _t('Rest day', '休息日') : _t('Day review', '当日回顾')}</h2>
      ${d.rest ? `<p class="muted">${_t('You marked this as a rest day. It didn’t count for or against your streak.', '你把这天标记为休息日，不计入连续纪录。')}</p>` : summaryBody(k)}
      <div class="row end"><button class="btn primary" data-act="modal-close">${_t('Done', '完成')}</button></div></div>`;
  }
  function closedModal(k) {
    const n = dayNumbers(k), r = n.d.review;
    const good = n.s.rate != null && n.s.rate >= 0.5;
    return `<div class="modal-card"><span class="label">${esc(longDate(k))}</span>
      <h2 id="modal-title">${good ? _t('Day closed. Promise kept.', '一天结束，承诺守住。') : _t('Day closed.', '一天结束。')}</h2>
      ${summaryBody(k)}
      ${r.tomorrow ? `<p><span class="label">${_t('Tomorrow starts with', '明天从这开始')}</span><br>${esc(r.tomorrow)}</p>` : ''}
      ${!good && n.s.committed ? `<p class="small muted">${_t('Under half kept. Look at what got in the way and commit to less tomorrow.', '守住的不足一半。看看是什么阻碍了你，明天少承诺一点。')}</p>` : ''}
      <div class="row end"><button class="btn primary" data-act="modal-close">${_t('Done', '完成')}</button></div></div>`;
  }
  function eveningModal(k) {
    const d = getDay(k);
    return `<div class="modal-card"><span class="label">${_t('Evening check-in', '晚间回顾')}</span>
      <h2 id="modal-title">${_t('Here’s where today stands', '今天目前的情况')}</h2>
      ${d.tasks.length ? summaryBody(k) : `<p class="muted">${_t('You haven’t committed to anything today. You can still log what you did and close the day honestly.', '你今天还没有任何承诺。你仍可以记录做了什么，并诚实地结束这一天。')}</p>`}
      <div class="row end"><button class="btn quiet" data-act="modal-close">${_t('Not yet', '还没有')}</button><button class="btn primary" data-act="goto-close">${_t('Close the day', '结束今天')}</button></div></div>`;
  }
  function briefingModal(k) {
    const prev = previousDay(k);
    const today = todayKey();
    let h = `<div class="modal-card"><span class="label">${esc(longDate(k))}</span><h2 id="modal-title">${_t('Morning briefing', '晨间简报')}</h2>`;
    if (prev) {
      const s = stats(prev);
      h += `<div class="field"><span class="label">${_t('Last time ({a})', '上次（{a}）', { a: shortDate(prev.date) })}</span>
        <p>${prev.rest ? _t('Rest day.', '休息日。') : _t('{a} of {b} kept', '{b} 项守住 {a} 项', { a: s.done, b: s.committed }) + (prev.review?.closed ? '' : _t(', and the day was never closed', '，而且那天没有结束')) + '.'}${prev.review?.rating ? _t(' You rated it {a}/5.', ' 你给它打了 {a}/5 分。', { a: prev.review.rating }) : ''}</p>
        ${prev.review?.tomorrow ? `<p>${_t('You said today starts with: {a}', '你说今天从这开始：{a}', { a: esc(prev.review.tomorrow) })}</p>` : ''}</div>`;
    } else h += `<p class="muted">${_t('First day in the ledger. Pick one to three things you will actually finish today.', '这是账本的第一天。挑一到三件你今天真正能完成的事。')}</p>`;
    const ps = activeProjects();
    const due = ps.filter(p => p.deadline && daysBetween(today, p.deadline) <= 7).sort((a, b) => a.deadline < b.deadline ? -1 : 1);
    if (due.length) h += `<div class="field"><span class="label">${_t('Deadlines this week', '本周截止')}</span><ul class="plist">${due.map(p => { const g = progressOf(p), n = daysBetween(today, p.deadline);
        return `<li class="cat-${projCat(p)}"><span><span class="cat-dot"></span>${esc(p.name)}${(() => { const pace = g.sub.find(x => x.startsWith("≈")); return pace ? ` <span class="muted">· ${esc(pace)}</span>` : ""; })()}</span><span class="num ${n < 0 ? 'late' : ''}">${n < 0 ? _t('{a}d overdue', '逾期 {a} 天', { a: -n }) : n === 0 ? _t('today', '今天') : `${n}d`}</span></li>`; }).join('')}</ul></div>`;
    const weekly = ps.filter(p => projMetric(p) === 'time' && !p.deadline && p.target);
    if (weekly.length) h += `<div class="field"><span class="label">${_t('Weekly time targets', '每周时间目标')}</span><ul class="plist">${weekly.map(p => `<li><span>${esc(p.name)}</span><span class="num">${mins(projMinutes(p.id, weekStart(today)))} / ${p.target}h</span></li>`).join('')}</ul></div>`;
    const stale = ps.filter(p => { const f = projFacts(p); return f.idle != null && f.idle >= 5; });
    if (stale.length) h += `<p class="small"><span class="chip warn">${_t('Going stale', '即将荒废')}</span> ${stale.map(p => esc(p.name)).join(', ')}</p>`;
    const passion = ps.filter(p => projCat(p) === 'passion');
    if (passion.length && !passion.some(p => projMinutes(p.id, addDays(today, -6)) > 0)) h += `<p class="small muted">${_t('No time on passion-driven work in the last 7 days. Could one task today be one of those?', '过去 7 天没有投入时间给热爱驱动的工作。今天能不能做一件？')}</p>`;
    const lb = state.settings.lastBackup;
    if (Object.keys(state.days).length > 2 && (!lb || daysBetween(fmt(new Date(lb)), today) >= 7)) h += `<p class="small"><span class="chip warn">${_t('Backup', '备份')}</span> ${lb ? _t('Last backup {a} days ago.', '上次备份在 {a} 天前。', { a: daysBetween(fmt(new Date(lb)), today) }) : _t('You haven’t backed up yet.', '你还没有备份过。')} <a href="#settings" data-act="modal-close">${_t('Export in Settings', '在「设置」中导出')}</a></p>`;
    h += `<p class="small muted">${_t('Streak: {a} day{s}', '连续：{a} 天', { a: streak(), s: streak() === 1 ? '' : 's' })}</p>
      <div class="row end"><button class="btn quiet" data-act="modal-close">${_t('Later', '稍后')}</button><button class="btn primary" data-act="plan-today">${_t('Plan today', '规划今天')}</button></div></div>`;
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

  // ---------- appearance: light by day, dark by night ----------
  // 'time' = light between dayFrom and nightFrom, dark otherwise; 'system' = follow the phone; or always light / dark.
  function themeNow() {
    const st = state.settings || {}, a = st.appearance || 'time';
    if (a === 'light' || a === 'dark') return a;
    if (a === 'system') return null;
    const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
    const day = Number.isFinite(st.dayFrom) ? st.dayFrom : 7, night = Number.isFinite(st.nightFrom) ? st.nightFrom : 19;
    return h >= day && h < night ? 'light' : 'dark';
  }
  function applyTheme() {
    const t = themeNow(), root = document.documentElement;
    if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
      const darkMeta = (m.getAttribute('media') || '').includes('dark');
      m.setAttribute('content', (t ? t === 'dark' : darkMeta) ? '#111110' : '#ebeae6');
    });
  }
  setInterval(applyTheme, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyTheme(); });

  // ---------- ending a session: log output in the same step ----------
  let wrapUp = null; // { done: bool } while the wrap-up panel is open
  function openWrapUp(done) {
    if (!timer) return;
    wrapUp = { done: !!done };
    if (!focusOpen) { unlockAudio(); openFocus(); } else { renderFocus(); tick(); }
    setTimeout(() => { const el = document.getElementById('wr-words') || document.getElementById('wr-note'); if (el) el.focus(); }, 60);
  }
  function wrapPanel() {
    const t = timerTask(), p = t && t.project ? projectOf(t.project) : null, metric = p ? projMetric(p) : null;
    const open = metric === 'other' ? backlog().filter(b => b.project === p.id && !b.done && b.id !== (t && t.backlogId)) : [];
    const timeNote = metric === 'time' ? _t(' It counts toward <b>{a}</b>.', ' 会计入<b>{a}</b>。', { a: esc(p.name) }) : '';
    return `<div class="f-wrap" role="dialog" aria-label="${_t('End session', '结束专注')}">
      <p class="f-alert-head">${_t('Session:', '本次：')} <span id="wr-elapsed">—</span></p>
      <p class="f-small">${_t('Focus time is logged automatically.', '专注时间会自动记录。')}${timeNote}</p>
      ${metric === 'words' ? `<label class="f-field"><span class="f-small">${_t('Words written this session · {a}', '本次写了多少字 · {a}', { a: esc(p.name) })}</span>
        <input type="number" id="wr-words" min="0" step="1" inputmode="numeric" placeholder="${_t('e.g. 650', '例如：650')}"></label>` : ''}
      ${open.length ? `<div class="f-field"><span class="f-small">${_t('Milestones finished · {a}', '已完成的里程碑 · {a}', { a: esc(p.name) })}</span>
        ${open.map(b => `<label class="f-check"><input type="checkbox" data-wr-ms="${b.id}"><span>${esc(b.text)}</span></label>`).join('')}</div>` : ''}
      <label class="f-field"><span class="f-small">${metric === 'other' ? _t('What did you complete?', '你完成了什么？') : _t('Note (optional)', '备注（可选）')}</span>
        <input type="text" id="wr-note" maxlength="200" autocomplete="off" placeholder="${metric === 'other' ? _t('e.g. Modeled the roof trusses', '例如：建好了屋顶桁架模型') : metric === 'words' ? _t('e.g. Finished the methods draft', '例如：写完了方法部分初稿') : _t('e.g. 5 km run, felt strong', '例如：跑步 5 公里，状态不错')}"></label>
      ${t && (t.steps || []).some(x => !x.done) ? `<div class="f-field"><span class="f-small">${_t('Steps finished', '已完成的步骤')}</span>
        ${t.steps.filter(x => !x.done).map(st => `<label class="f-check"><input type="checkbox" data-wr-step="${st.id}"><span>${esc(st.text)}</span></label>`).join('')}</div>` : ''}
      <label class="f-check"><input type="checkbox" id="wr-done" ${wrapUp && wrapUp.done ? 'checked' : ''}><span><b>${_t('This task is finished', '这项任务已完成')}</b></span></label>
      <div class="f-row"><button class="f-btn" data-act="wrap-back">${_t('Back to timer', '返回计时器')}</button><button class="f-btn" data-act="wrap-skip">${_t('Just stop', '直接停止')}</button><button class="f-btn solid" data-act="wrap-save">${_t('Save and stop', '保存并停止')}</button></div>
    </div>`;
  }
  function saveWrap(skip) {
    if (!timer) return;
    const day = timer.day, tid = timer.taskId, t = timerTask(), p = t && t.project ? projectOf(t.project) : null;
    const m = Math.round((Date.now() - timer.start) / 60000);
    let words = 0, note = '', ms = [], done = false, stepIds = [];
    if (!skip) {
      words = Math.max(0, Math.round(Number(document.getElementById('wr-words')?.value) || 0));
      note = (document.getElementById('wr-note')?.value || '').trim();
      ms = [...document.querySelectorAll('[data-wr-ms]:checked')].map(x => x.dataset.wrMs);
      stepIds = [...document.querySelectorAll('[data-wr-step]:checked')].map(x => x.dataset.wrStep);
      done = !!document.getElementById('wr-done')?.checked;
    }
    wrapUp = null;
    stopTimer(); // logs the minutes to the task and closes the timer
    if (skip) { maybeOfferBreak(); return; }
    const at = new Date().toISOString(), entries = [];
    if (words > 0) entries.push({ id: rid(), project: p ? p.id : null, taskId: tid, kind: 'words', value: words, note, at });
    else if (note) entries.push({ id: rid(), project: p ? p.id : null, taskId: tid, kind: 'note', value: null, note, at });
    const closed = getDay(day).review.closed;
    if (entries.length || stepIds.length || (done && !closed)) mutateDay(day, d => {
      d.logs = (d.logs || []).concat(entries);
      const tk = d.tasks.find(y => y.id === tid); if (tk) (tk.steps || []).forEach(st => { if (stepIds.includes(st.id)) st.done = true; });
      if (done && !d.review.closed) { const x = d.tasks.find(y => y.id === tid); if (x) x.done = true; }
    });
    ms.forEach(id => setBacklogDone(id, true));
    if (done && !closed && t && t.backlogId) setBacklogDone(t.backlogId, true);
    const parts = [m >= 1 ? _t('Logged {a}', '已记录 {a}', { a: mins(m) }) : _t('Under a minute, no time logged', '不到一分钟，未记录时间')];
    if (words) parts.push(_t('{a} words', '{a} 字', { a: nf(words) }));
    if (stepIds.length) parts.push(_t('{a} step{s}', '{a} 个步骤', { a: stepIds.length, s: stepIds.length === 1 ? '' : 's' }));
    if (ms.length) parts.push(_t('{a} milestone{s}', '{a} 个里程碑', { a: ms.length, s: ms.length === 1 ? '' : 's' }));
    if (note && !words) parts.push(_t('note saved', '已保存备注'));
    if (done && !closed) parts.push(_t('task done', '任务完成'));
    toast(parts.join(' · ') + '.');
    maybeOfferBreak();
  }

  // ---------- break timer after a focus session ----------
  const BREAK_OPTS = [5, 10, 15];
  let breakTimer = null; // { end, alerted }

  function breakLeft() { return breakTimer ? Math.max(0, Math.ceil((breakTimer.end - Date.now()) / 1000)) : 0; }

  function breakModal() {
    const over = !!breakTimer && breakLeft() <= 0;
    const mins = state.settings && Number.isFinite(state.settings.breakMinutes) ? state.settings.breakMinutes : 0;
    return `<div class="modal-card break-card"><span class="label">${over ? _t('Break’s over', '休息结束') : _t('Break', '休息')}</span>
      <h2 id="modal-title">${over ? _t('Ready to come back?', '准备好回来继续了吗？') : _t('Step away for a bit', '离开休息一下')}</h2>
      <div class="break-time${over ? ' done' : ''}" id="break-time">${clockText(breakLeft())}</div>
      <p class="muted small">${over ? _t('Time’s up — a sound played. Get back to it when you’re ready.', '时间到——已播放提示音。准备好就回来吧。') : _t('A {a} minute pause after your focus session. A sound plays when it ends.', '专注结束后休息 {a} 分钟。结束时会有提示音。', { a: mins })}</p>
      ${over ? '' : `<div class="break-extend"><span class="label">${_t('Extend', '延长')}</span>${BREAK_OPTS.map(v => `<button class="choice" data-act="break-add" data-v="${v}">+${v}${_t('m', '分钟')}</button>`).join('')}</div>`}
      <div class="row end"><button class="btn primary" data-act="break-end">${over ? _t('Back to work', '回去继续') : _t('Skip break', '跳过休息')}</button></div></div>`;
  }

  function startBreak(mins) {
    breakTimer = { end: Date.now() + mins * 60000, alerted: false };
    showModal(breakModal());
    breakTick();
  }

  function breakTick() {
    if (!breakTimer || document.getElementById('modal').hidden) return;
    const time = document.getElementById('break-time');
    if (time) time.textContent = clockText(breakLeft());
    if (breakLeft() <= 0 && !breakTimer.alerted) {
      breakTimer.alerted = true;
      playChime();
      const m = document.getElementById('modal');
      m.innerHTML = breakModal();
      const b = m.querySelector('.btn.primary'); if (b) b.focus();
    }
  }

  function endBreak(notify) {
    breakTimer = null;
    closeModal();
    if (notify) toast(_t('Break ended.', '休息结束。'));
  }

  function maybeOfferBreak() {
    if (breakTimer) return;
    const mins = state.settings && Number.isFinite(state.settings.breakMinutes) ? state.settings.breakMinutes : 0;
    if (!(mins > 0)) return;
    startBreak(mins);
  }
  setInterval(breakTick, 1000);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'break-add') { if (breakTimer) { breakTimer.end += Number(b.dataset.v) * 60000; breakTick(); } }
    else if (b.dataset.act === 'break-end') endBreak(true);
  });

  // ---------- today's balance: live donut by category + pixel miner ----------
  const BAL_CATS = [
    { id: 'passion', color: 'var(--passion)' }, { id: 'must', color: 'var(--must)' },
    { id: 'baseline', color: 'var(--baseline)' }, { id: 'none', color: 'var(--muted)' }
  ];
  const BAL_MIN_TOTAL = 30; // minutes before the balance check starts, so one early session doesn't trigger it
  function catMinutes(k) {
    const d = getDay(k), out = { passion: 0, must: 0, baseline: 0, none: 0 };
    (d.tasks || []).forEach(t => { out[taskCat(t) || 'none'] += t.minutes || 0; });
    (d.logs || []).forEach(l => { if (l.kind === 'time') { const p = projectOf(l.project); out[p ? projCat(p) : 'none'] += l.value || 0; } });
    if (timer && timer.day === k) { const t = timerTask(); out[(t && taskCat(t)) || 'none'] += (Date.now() - timer.start) / 60000; }
    return out;
  }
  function balanceCard() {
    return `<section class="card balance"><div class="sec-head"><h2>${_t('Today’s balance', '今日平衡')}</h2><span class="chip" id="bal-total">0m</span></div>
      <div class="bal-wrap">
        <div class="donut">
          <svg id="donut" viewBox="0 0 200 200" role="img" aria-label="${_t("Today's time by category", '按分类的今日时间')}"><circle class="donut-bg" cx="100" cy="100" r="80"/><circle class="donut-well" cx="100" cy="100" r="66"/><g id="donut-arcs" transform="rotate(-90 100 100)"></g></svg>
          <canvas id="miner" width="96" height="88" aria-hidden="true"></canvas>
          <span id="miner-state" class="miner-state"></span>
        </div>
        <ul class="bal-legend" id="bal-legend"></ul>
      </div>
      <p id="bal-nudge" class="bal-nudge" role="status" hidden></p></section>`;
  }
  const nudged = {};
  function updateBalance() {
    const svg = document.getElementById('donut-arcs'); if (!svg) return;
    const k = todayKey(), m = catMinutes(k), total = m.passion + m.must + m.baseline + m.none;
    const limit = (state.settings.balanceLimit || 65) / 100, C = 2 * Math.PI * 80;
    let over = null, at = 0, arcs = '';
    if (total > 0) BAL_CATS.forEach(c => {
      const f = m[c.id] / total; if (f <= 0) return;
      const isOver = c.id !== 'none' && total >= BAL_MIN_TOTAL && f > limit;
      if (isOver) over = { id: c.id, f };
      const len = Math.max(0, f * C - (f < 1 ? 2.5 : 0));
      arcs += `<circle class="donut-seg${isOver ? ' over' : ''}" cx="100" cy="100" r="80" stroke="${c.color}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-at * C).toFixed(2)}"/>`;
      at += f;
    });
    svg.innerHTML = arcs;
    document.getElementById('bal-total').textContent = _t('{a} today', '今日 {a}', { a: mins(Math.round(total)) });
    const name = id => id === 'none' ? _t('No category', '无分类') : catName(id);
    document.getElementById('bal-legend').innerHTML = BAL_CATS.filter(c => c.id !== 'none' || m.none >= 1).map(c => {
      const f = total ? m[c.id] / total : 0, isOver = over && over.id === c.id;
      return `<li class="${c.id === 'none' ? '' : 'cat-' + c.id}"><span class="cat-dot" style="background:${c.color}"></span><span class="bal-name">${esc(name(c.id))}</span>
        <span class="num">${mins(Math.round(m[c.id]))}</span><span class="num bal-pct ${isOver ? 'late' : ''}">${total ? Math.round(f * 100) + '%' : '—'}</span></li>`;
    }).join('');
    const n = document.getElementById('bal-nudge');
    if (over) {
      const pct = Math.round(over.f * 100), lim = Math.round(limit * 100);
      const tip = { passion: _t('Great energy. Check that today’s Must-do items don’t slip.', '状态很好。留意别让今天的「必须完成」项被落下。'), must: _t('Leave room for something you love, or take a Baseline break.', '给热爱的事留点空间，或者休息一下做点日常。'), baseline: _t('Upkeep is crowding out the real work. Guard time for Must-do and Passion projects.', '日常维护挤占了真正的工作。为「必须完成」和「热爱」项目留出时间。') }[over.id];
      n.innerHTML = `<span class="chip warn">${_t('Over {a}%', '超过 {a}%', { a: lim })}</span> ${_t('<b>{a}</b> is {b}% of today’s time. {c}', '<b>{a}</b>占今日时间的 {b}%。{c}', { a: esc(catName(over.id)), b: pct, c: tip })}`;
      n.hidden = false;
      const key = k + ':' + over.id;
      if (!nudged[key]) { nudged[key] = true; toast(_t('{a} has passed {b}% of today’s time.', '「{a}」已超过今日时间的 {b}%。', { a: catName(over.id), b: lim })); }
    } else n.hidden = true;
    const ms = document.getElementById('miner-state');
    if (ms) { const mode = minerMode(); ms.textContent = mode === 'mine' ? _t('Mining…', '挖矿中…') : mode === 'win' ? _t('★ Goal achieved!', '★ 目标达成！') : _t('Zzz… idle', 'Zzz… 休息'); ms.classList.toggle('win', mode === 'win'); }
    if (goalAchieved() && !nudged['win:' + todayKey()]) { nudged['win:' + todayKey()] = true; if (state.ready && state.view === 'today') toast(_t('All of today’s commitments are done. Goal achieved!', '今天所有承诺都完成了，目标达成！')); }
    updateActiveProject();
  }

  // The project you're working on: the running session's, else the last one you worked on today,
  // else the nearest deadline.
  function activeProject() {
    const k = todayKey(), d = getDay(k), live = activeProjects();
    const ok = id => id && live.some(p => p.id === id);
    const tt = timer ? timerTask() : null;
    if (tt && ok(tt.project)) return { p: projectOf(tt.project), why: _t('In session', '进行中') };
    const logs = (d.logs || []).filter(l => ok(l.project)).sort((a, b) => (a.at || '') < (b.at || '') ? 1 : -1);
    if (logs[0]) return { p: projectOf(logs[0].project), why: _t('Worked on today', '今天有推进') };
    const worked = (d.tasks || []).filter(t => ok(t.project) && (t.minutes || t.done));
    if (worked.length) return { p: projectOf(worked[worked.length - 1].project), why: _t('Worked on today', '今天有推进') };
    const due = live.filter(p => p.deadline).sort((a, b) => a.deadline < b.deadline ? -1 : 1)[0];
    return due ? { p: due, why: _t('Next deadline', '最近的截止日期') } : null;
  }
  function updateActiveProject() {
    const el = document.getElementById('active-proj'); if (!el) return;
    const a = activeProject(); if (!a) { el.hidden = true; return; }
    const p = a.p, g = progressOf(p);
    let head = g.head, ratio = g.ratio;
    // Add the running session live for time-tracked projects.
    const tt = timer ? timerTask() : null;
    if (tt && tt.project === p.id && g.metric === 'time') {
      const live = (Date.now() - timer.start) / 60000, ws = weekStart(todayKey());
      const base = p.deadline ? projMinutes(p.id) : projMinutes(p.id, ws), tot = base + live;
      head = p.target ? `${mins(Math.round(tot))} / ${p.target}h${p.deadline ? '' : _t(' this week', ' 本周')}` : `${mins(Math.round(tot))}${p.deadline ? _t(' total', ' 总计') : _t(' this week', ' 本周')}`;
      if (p.target) ratio = Math.min(1, tot / (p.target * 60));
    }
    const c = projCat(p);
    el.className = `card active-proj cat-${c}`;
    el.innerHTML = `<div class="sec-head"><h2><span class="cat-dot"></span>${esc(p.name)}</h2><span class="chip${a.why === 'In session' ? ' on' : ''}">${esc(a.why)}</span></div>
      <div class="ap-row"><span class="metric-chip">${esc(metricName(g.metric))}</span><b class="num ap-frac">${esc(head)}</b>${ratio != null ? `<span class="num ap-pct">${Math.round(ratio * 100)}%</span>` : ''}</div>
      ${ratio != null ? `<div class="meter ap-meter" role="img" aria-label="${_t('{a}% of target', '完成目标 {a}%', { a: Math.round(ratio * 100) })}"><span style="width:${(ratio * 100).toFixed(1)}%"></span></div>` : `<p class="muted small">${_t('No target set. Add one under Projects → Edit to see a progress bar.', '未设置目标。在「项目」→「编辑」里添加目标即可显示进度条。')}</p>`}
      ${g.sub.length ? `<p class="muted small">${g.sub.map(esc).join(' · ')}</p>` : ''}`;
    el.hidden = false;
  }

  // Pixel miner, drawn on a 24×18 grid (4 px cells). Original sprite, coloured by fixed palette.
  const PAL = { helmet: '#f2c230', lamp: '#fff3a0', lampOff: '#8f7f3c', skin: '#f0c08a', eye: '#1b1b1b', shirt: '#2f6f9f', pants: '#3a3a46', boot: '#2a2016', handle: '#8a5a2b', metal: '#b9bec6', rock: '#77736c', rockHi: '#a39f96', ore: '#e0b020', spark: '#ffe066', z: '#8d8c87' };
  let minerRAF = null, minerLast = 0, minerFrame = 0;
  // Standing miner. The arm and pickaxe are one piece that rotates at the shoulder, so they swing together.
  // Simplified miner for tiny icons (18-pixel grid).
  function drawSimpleMiner(px, rect, dip, angle) {
    const body = () => {
      rect(5, 14 + dip, 2, 3 - dip, PAL.pants); rect(9, 14 + dip, 2, 3 - dip, PAL.pants); rect(5, 14 + dip, 6, 1, PAL.pants);
      rect(4, 17, 3, 1, PAL.boot); rect(9, 17, 3, 1, PAL.boot);
      rect(5, 9 + dip, 6, 5, PAL.shirt);
      rect(6, 5 + dip, 5, 4, PAL.skin); px(9, 6 + dip, PAL.eye);
      rect(5, 4 + dip, 7, 1, PAL.helmet); rect(6, 3 + dip, 5, 1, PAL.helmet); px(11, 3 + dip, PAL.lamp);
    };
    const tool = () => {
      const a = angle * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a), sx = 10, sy = 10 + dip, ARM = 3, HANDLE = 6;
      const hx = sx + cx * ARM, hy = sy + cy * ARM;
      for (let i = 1; i <= HANDLE; i++) px(hx + cx * i, hy + cy * i, PAL.handle);
      const ex = hx + cx * HANDLE, ey = hy + cy * HANDLE, nx = -cy, ny = cx;
      for (let i = -2; i <= 2; i++) px(ex + nx * i, ey + ny * i, PAL.metal);
      for (let i = 0; i <= ARM; i++) px(sx + cx * i, sy + cy * i, i === 0 ? PAL.shirt : PAL.skin); // sleeve, forearm, hand on the handle
    };
    // Raised overhead the arm passes behind the head; on the downswing it's in front of the body.
    if (angle < -60) { tool(); body(); } else { body(); tool(); }
  }
  function minerPainter(g, S, ox = 0, oy = 0) {
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect((Math.round(x) + ox) * S, (Math.round(y) + oy) * S, S, S); };
    const rect = (x, y, w, h, c) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px(x + i, y + j, c); };
    return { px, rect };
  }
  // ---- Detailed miner: 48×44 pixel grid (2 px cells on a 96×88 canvas) ----
  // SPRITE-START (also used by the icon generator)
  const PX = {
    helmet: '#f2c230', helmetHi: '#ffe27a', helmetSh: '#c4951b', lampRim: '#4a4a4a', lamp: '#fff3a0', lampOff: '#8f7f3c', beam: 'rgba(255,243,160,0.28)',
    skin: '#f0c08a', skinSh: '#d39b68', eye: '#1b1b1b', brow: '#5a3a22', mouth: '#a5603f',
    shirt: '#2f6f9f', shirtSh: '#245a82', strap: '#7a4a22', belt: '#4a3018', buckle: '#e0b020',
    pants: '#3a3a46', pantsSh: '#2a2a34', boot: '#2a2016', sole: '#120e09', glove: '#6b4423',
    handle: '#8a5a2b', handleHi: '#a8743c', metal: '#b9bec6', metalSh: '#7c8290',
    rock: '#77736c', rockHi: '#a39f96', rockSh: '#5a5751', crack: '#43403b', ore: '#e0b020', oreHi: '#ffe066', oreSh: '#b07f10', spark: '#ffe066', z: '#8d8c87'
  };
  // Standing body: boots to helmet. d = how far the upper body dips (impact / hop).
  function drawMinerBody(px, rect, d, lampOn) {
    rect(9, 39, 7, 4, PX.boot); rect(9, 43, 8, 1, PX.sole); rect(19, 39, 7, 4, PX.boot); rect(19, 43, 8, 1, PX.sole);
    rect(11, 30 + d, 4, 9 - d, PX.pants); rect(20, 30 + d, 4, 9 - d, PX.pants); rect(14, 30 + d, 1, 9 - d, PX.pantsSh); rect(23, 30 + d, 1, 9 - d, PX.pantsSh);
    rect(11, 28 + d, 13, 3, PX.pants);
    rect(10, 27 + d, 15, 2, PX.belt); rect(16, 27 + d, 3, 2, PX.buckle);
    rect(10, 17 + d, 15, 10, PX.shirt); rect(23, 17 + d, 2, 10, PX.shirtSh);
    rect(12, 17 + d, 2, 10, PX.strap); rect(20, 17 + d, 2, 10, PX.strap);
    rect(15, 15 + d, 5, 2, PX.skinSh);
    rect(12, 7 + d, 11, 9, PX.skin); rect(12, 7 + d, 2, 9, PX.skinSh); rect(14, 10 + d, 2, 3, PX.skinSh);
    rect(18, 9 + d, 3, 1, PX.brow); rect(19, 10 + d, 2, 2, PX.eye); rect(23, 11 + d, 1, 2, PX.skin); rect(18, 14 + d, 3, 1, PX.mouth);
    rect(12, 2 + d, 10, 4, PX.helmet); rect(13, 1 + d, 8, 1, PX.helmet); rect(14, 2 + d, 4, 1, PX.helmetHi); rect(13, 3 + d, 1, 2, PX.helmetHi);
    rect(10, 6 + d, 15, 2, PX.helmetSh);
    rect(22, 3 + d, 2, 3, PX.lampRim); rect(24, 3 + d, 2, 3, lampOn ? PX.lamp : PX.lampOff);
    if (lampOn) for (let k = 0; k < 12; k++) for (let y = Math.floor(3 - k / 3); y <= Math.ceil(5 + k / 3); y++) px(26 + k, y + d, PX.beam);
  }
  // Standing miner. Arm and pickaxe are one piece rotating at the front shoulder (24, 19), drawn in front of the body for the whole swing.
  function drawDetailedMiner(px, rect, dip, angle, lampOn) {
    const d = dip;
    const body = () => drawMinerBody(px, rect, d, lampOn);
    const tool = () => {
      const a = angle * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a), nx = -cy, ny = cx, sx = 24, sy = 19 + d, ARM = 7, HANDLE = 10;
      const thick = (x, y, w, c) => { for (let o = -(w - 1) / 2; o <= (w - 1) / 2 + 0.01; o += 1) px(x + nx * o, y + ny * o, c); };
      const hx = sx + cx * ARM, hy = sy + cy * ARM;
      for (let i = -1; i <= HANDLE; i += 0.5) { thick(hx + cx * i, hy + cy * i, 2, PX.handle); px(hx + cx * i - nx * 0.5, hy + cy * i - ny * 0.5, PX.handleHi); }
      const ex = hx + cx * HANDLE, ey = hy + cy * HANDLE;
      for (let i = -6; i <= 6; i += 0.5) { // curved pick head, two cells deep, darker at the points
        const back = -Math.abs(i) * 0.25, x = ex + nx * i + cx * back, y = ey + ny * i + cy * back, tip = Math.abs(i) > 4.5;
        px(x, y, tip ? PX.metalSh : PX.metal); px(x - cx, y - cy, PX.metalSh);
      }
      for (let i = 0; i <= ARM; i += 0.5) thick(sx + cx * i, sy + cy * i, 3, i < 3 ? PX.shirt : PX.skin); // sleeve, then forearm
      for (let i = ARM - 1; i <= ARM + 1; i += 0.5) thick(sx + cx * i, sy + cy * i, 3, PX.glove);       // gloved hand on the handle
    };
    body(); tool();
  }
  function drawRock(px, rect) {
    rect(34, 31, 12, 12, PX.rock); rect(35, 29, 9, 2, PX.rock); rect(33, 34, 1, 8, PX.rock);
    rect(45, 32, 1, 11, PX.rockSh); rect(34, 42, 12, 1, PX.rockSh); rect(36, 30, 4, 1, PX.rockHi); rect(34, 32, 2, 4, PX.rockHi);
    rect(39, 34, 2, 2, PX.ore); px(39, 34, PX.oreHi); rect(43, 31, 2, 1, PX.ore); rect(37, 39, 2, 2, PX.ore); px(42, 38, PX.ore);
    px(41, 33, PX.crack); px(42, 34, PX.crack); px(42, 35, PX.crack); px(43, 36, PX.crack);
  }
  // Goal achieved: he hops and spins (faces right, then left) holding a gold nugget overhead, with sparkles.
  function drawCelebratingMiner(px, rect, fr) {
    const f = fr % 8, hop = [0, -1, -1, 0, 0, -1, -1, 0][f], flip = f >= 4;
    const P = (x, y, c) => px(flip ? 34 - x : x, y + hop, c);
    const R = (x, y, w, h, c) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) P(x + i, y + j, c); };
    drawMinerBody(P, R, 0, false);
    R(19, 10, 2, 2, PX.skin); P(19, 11, PX.eye); P(20, 10, PX.eye);                   // happy squint
    R(18, 14, 3, 1, PX.skin); R(18, 15, 3, 1, PX.mouth); P(17, 14, PX.mouth); P(21, 14, PX.mouth); // grin
    const a = -60 * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a), nx = -cy, ny = cx, sx = 24, sy = 19;
    for (let i = 0; i <= 7; i += 0.5) for (let o = -1; o <= 1; o++) P(sx + cx * i + nx * o, sy + cy * i + ny * o, i < 3 ? PX.shirt : PX.skin);
    for (let i = 6; i <= 8; i += 0.5) for (let o = -1; o <= 1; o++) P(sx + cx * i + nx * o, sy + cy * i + ny * o, PX.glove);
    R(27, 6, 5, 5, PX.ore); R(26, 7, 7, 3, PX.ore); R(27, 6, 2, 1, PX.oreHi); P(26, 7, PX.oreHi); R(30, 9, 2, 1, PX.oreSh); P(29, 10, PX.oreSh); // nugget above the glove
    const tw = [[27, 2], [33, 5], [33, 13], [24, 9]];
    tw.forEach(([x, y], i) => { if ((f + i) % 2) { P(x, y - 1, PX.spark); R(x - 1, y, 3, 1, PX.spark); P(x, y + 1, PX.spark); } else P(x, y, PX.oreHi); });
  }
  function drawSleepingMiner(px, rect, breath, fr) {
    const b = breath;
    rect(3, 42, 22, 1, PX.handle); rect(24, 38, 2, 5, PX.metal); px(24, 38, PX.metalSh); px(25, 42, PX.metalSh);
    rect(13, 37, 13, 4, PX.pants); rect(13, 40, 13, 1, PX.pantsSh); rect(26, 34, 4, 7, PX.boot); rect(30, 34, 1, 7, PX.sole);
    rect(8, 25 + b, 12, 12 - b, PX.shirt); rect(18, 25 + b, 2, 12 - b, PX.shirtSh); rect(10, 25 + b, 2, 12 - b, PX.strap); rect(15, 25 + b, 2, 12 - b, PX.strap);
    rect(8, 36, 12, 2, PX.belt); rect(13, 36, 2, 2, PX.buckle);
    rect(9, 31, 3, 4, PX.shirt); rect(11, 32, 8, 2, PX.skin); rect(18, 32, 2, 2, PX.glove); // folded arms
    rect(9, 16 + b, 10, 9, PX.skin); rect(9, 16 + b, 2, 9, PX.skinSh); rect(14, 21 + b, 3, 1, PX.eye); rect(15, 23 + b, 2, 1, PX.mouth);
    rect(9, 12 + b, 9, 4, PX.helmet); rect(10, 11 + b, 7, 1, PX.helmet); rect(11, 12 + b, 3, 1, PX.helmetHi); rect(7, 16 + b, 13, 2, PX.helmetSh);
    rect(18, 13 + b, 2, 3, PX.lampRim); rect(20, 13 + b, 2, 3, PX.lampOff);
    const z = (x, y, c) => { rect(x, y, 5, 1, c); px(x + 3, y + 1, c); px(x + 2, y + 2, c); px(x + 1, y + 3, c); rect(x, y + 4, 5, 1, c); };
    const t = fr % 6;
    z(22 + t, 10 - t, PX.z);
    if (t >= 3) z(30 + (t - 3), 2, PX.z);
  }
  // SPRITE-END
  function drawMiner(cv, mode, fr) {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const { px, rect } = minerPainter(g, 2);
    drawRock(px, rect);
    if (mode === 'win') drawCelebratingMiner(px, rect, fr);
    else if (mode === 'mine') {
      const swing = [-80, -70, -55, -30, 0, 16, 16, -45];
      const f = fr % swing.length, hit = f === 5 || f === 6;
      drawDetailedMiner(px, rect, hit ? 1 : 0, swing[f], true);
      if (hit) {
        const sp = f === 5 ? [[35, 26], [33, 23], [38, 24], [31, 27], [36, 21]] : [[37, 22], [33, 20], [40, 21], [30, 25], [35, 18]];
        sp.forEach(([x, y]) => rect(x, y, 2, 2, PX.spark));
        rect(32 - (f - 4) * 2, 30 - (f - 4) * 2, 2, 2, PX.rockHi);
      }
    } else drawSleepingMiner(px, rect, (fr % 4) < 2 ? 0 : 1, fr);
  }
  // Simplified icon: the miner with his pickaxe raised, no rock, on an 18×18 grid.
  function drawMinerIcon(cv) {
    const g = cv.getContext('2d'), S = Math.floor(cv.width / 18);
    g.clearRect(0, 0, cv.width, cv.height);
    const { px, rect } = minerPainter(g, S, -2, 0);
    drawSimpleMiner(px, rect, 0, -55);
  }
  (function minerIcons() {
    document.querySelectorAll('canvas.tab-icon').forEach(drawMinerIcon);
    try { // browser-tab icon
      const c = document.createElement('canvas'); c.width = c.height = 72; drawMinerIcon(c);
      let link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.type = 'image/png'; link.removeAttribute('sizes'); link.href = c.toDataURL('image/png');
    } catch (e) {}
  })();
  // Every commitment for today is checked off (and nothing is running).
  function goalAchieved() {
    const d = getDay(todayKey()), s = stats(d);
    return !d.rest && d.locked && s.committed > 0 && s.done === s.committed;
  }
  const minerMode = () => timer ? 'mine' : goalAchieved() ? 'win' : 'sleep';
  function minerLoop(ts) {
    const cv = document.getElementById('miner');
    if (!cv || document.hidden || focusOpen) { minerRAF = null; return; }
    const mode = minerMode();
    if (ts - minerLast > 1000 / (mode === 'mine' ? 8 : mode === 'win' ? 6 : 3)) { minerLast = ts; minerFrame++; drawMiner(cv, mode, minerFrame); }
    minerRAF = requestAnimationFrame(minerLoop);
  }
  function startMiner() {
    const cv = document.getElementById('miner'); if (!cv) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { drawMiner(cv, minerMode(), 0); return; }
    drawMiner(cv, minerMode(), minerFrame);
    if (!minerRAF) minerRAF = requestAnimationFrame(minerLoop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startMiner(); });
  setInterval(() => { if (!timer) updateBalance(); }, 60000);

  // ---------- note to self (top of Today; saved on this device with the rest of your data) ----------
  function affirmMeta() {
    const a = state.settings.affirmation;
    if (!a || !a.text) return '';
    if (a.date === todayKey()) return _t('saved today', '今天已保存');
    return _t('from {a} · edit it for today', '来自 {a} · 点击编辑今天', { a: shortDate(a.date) });
  }
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  function syncAffirm() {
    const box = document.getElementById('affirm'), ta = document.getElementById('affirm-text'); if (!box || !ta) return;
    box.hidden = !state.ready || state.view !== 'today';
    if (box.hidden) return;
    const a = state.settings.affirmation || {};
    if (document.activeElement !== ta) ta.value = a.text || '';
    document.getElementById('affirm-meta').textContent = affirmMeta();
    autosize(ta);
  }
  let affirmTimer = null;
  document.addEventListener('input', e => {
    if (e.target.id !== 'affirm-text') return;
    const ta = e.target; autosize(ta);
    document.getElementById('affirm-meta').textContent = _t('saving…', '保存中…');
    clearTimeout(affirmTimer);
    affirmTimer = setTimeout(() => {
      setSetting({ affirmation: { text: ta.value.trim() ? ta.value : '', date: todayKey() } });
      Store.flush();
      document.getElementById('affirm-meta').textContent = ta.value.trim() ? _t('saved ✓', '已保存 ✓') : '';
    }, 500);
  });
  document.addEventListener('keydown', e => { if (e.target.id === 'affirm-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.blur(); } });

  // ---------- in-app triggers (iOS can't schedule web notifications, so the app checks on open) ----------
  function setSetting(patch) { state.settings = Object.assign({}, state.settings, patch); Store.save(); }
  function triggers() {
    if (!state.ready || document.hidden || !document.getElementById('modal').hidden || focusOpen) return;
    const k = todayKey(), d = getDay(k), st = state.settings;
    // Hours since the ledger day began, so 1 AM with a 4 AM start counts as late evening (hour 21+).
    const hour = (new Date().getHours() - dayStartH() + 24) % 24 + dayStartH();
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
        setSetting({ lastBackup: new Date().toISOString() }); render(); toast(_t('Backup exported.', '已导出备份。')); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setSetting({ lastBackup: new Date().toISOString() }); render(); toast(_t('Backup downloaded.', '已下载备份。'));
  }
  async function copyBackup() {
    const json = JSON.stringify(Store.snapshot());
    try { await navigator.clipboard.writeText(json); setSetting({ lastBackup: new Date().toISOString() }); render(); toast(_t('Backup copied. Paste it into Notes or an email to yourself.', '已复制备份。粘贴到备忘录或邮件里保存。')); }
    catch (e) { toast(_t('Copy isn’t allowed here. Use Export instead.', '此处不允许复制，请改用「导出」。')); }
  }
  function validBackup(v) { return v && typeof v === 'object' && v.days && typeof v.days === 'object' && v.profile && typeof v.profile === 'object'; }
  function readImport(text) {
    let v; try { v = JSON.parse(text); } catch (e) { toast(_t('That file isn’t valid JSON.', '该文件不是有效的 JSON。')); return; }
    if (!validBackup(v)) { toast(_t('That file isn’t a Commitment Ledger backup.', '该文件不是 Commitment Ledger 的备份。')); return; }
    state.ui.pendingImport = v; render();
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'import-file' && t.files && t.files[0]) {
      const r = new FileReader(); r.onload = () => readImport(String(r.result)); r.onerror = () => toast(_t('Couldn’t read that file.', '无法读取该文件。')); r.readAsText(t.files[0]); t.value = '';
    }
    if (t.id === 'set-morning') { setSetting({ morningBriefing: t.checked }); render(); }
    if (t.id === 'set-evening') { setSetting({ eveningSummary: t.checked }); render(); }
    if (t.id === 'set-hour') { setSetting({ eveningHour: Number(t.value) }); render(); }
    if (t.id === 'set-balance') { setSetting({ balanceLimit: Number(t.value) }); render(); }
    if (t.id === 'set-appearance') { setSetting({ appearance: t.value }); applyTheme(); render(); }
    if (t.id === 'set-dayfrom') { setSetting({ dayFrom: Number(t.value) }); applyTheme(); render(); }
    if (t.id === 'set-nightfrom') { setSetting({ nightFrom: Number(t.value) }); applyTheme(); render(); }
    if (t.id === 'set-daystart') { setSetting({ dayStart: Number(t.value) }); lastKey = todayKey(); render(); toast(Number(t.value) ? _t('Your day now changes at {a}:00.', '你的一天现在从 {a}:00 开始。', { a: t.value }) : _t('Your day now changes at midnight.', '你的一天现在从午夜开始。')); }
    if (t.id === 'set-sound') { setSetting({ alarmSound: t.value }); unlockAudio(); playChime(); render(); }
    if (t.id === 'set-break') { setSetting({ breakMinutes: Number(t.value) }); render(); }
    if (t.id === 'set-lang') { setSetting({ lang: t.value }); document.documentElement.lang = t.value === 'en' ? 'en' : 'zh-CN'; render(); }
  });

  // ---------- settings view ----------
  function viewSettings() {
    const st = state.settings, nDays = Object.keys(state.days).length, nProj = activeProjects().length, nTasks = backlog().length;
    const lb = st.lastBackup ? new Date(st.lastBackup) : null;
    const pi = state.ui.pendingImport;
    const ap = st.appearance || 'time';
    const hourOpts = (list, sel) => list.map(x => `<option value="${x}"${x === sel ? ' selected' : ''}>${x}:00</option>`).join('');
    let h = `<section class="card"><div class="sec-head"><h2>${_t('Language', '语言')}</h2></div>
      <div class="row"><select id="set-lang" aria-label="${_t('Language', '语言')}">
        <option value="zh"${st.lang !== 'en' ? ' selected' : ''}>中文</option>
        <option value="en"${st.lang === 'en' ? ' selected' : ''}>English</option></select></div>
      <p class="muted small">${_t('Choose the language for buttons, labels and messages. Your data is not changed.', '选择按钮、标签和提示的语言，不会改变你的数据。')}</p></section>`;
    h += `<section class="card"><div class="sec-head"><h2>${_t('Appearance', '外观')}</h2><span class="chip">${document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches) ? _t('Night: light text on dark', '夜间：深底浅字') : _t('Day: dark text on light', '白天：浅底深字')}</span></div>
      <div class="row"><select id="set-appearance" aria-label="${_t('Appearance', '外观')}">
        <option value="time"${ap === 'time' ? ' selected' : ''}>${_t('Day and night by time', '按时间切换白天/夜间')}</option>
        <option value="system"${ap === 'system' ? ' selected' : ''}>${_t('Follow phone (Light/Dark Mode)', '跟随手机（浅色/深色模式）')}</option>
        <option value="light"${ap === 'light' ? ' selected' : ''}>${_t('Always day (light)', '始终白天（浅色）')}</option>
        <option value="dark"${ap === 'dark' ? ' selected' : ''}>${_t('Always night (dark)', '始终夜间（深色）')}</option></select></div>
      ${ap === 'time' ? `<div class="row"><label for="set-dayfrom" class="small">${_t('Day from', '白天从')}</label><select id="set-dayfrom">${hourOpts([5, 6, 7, 8, 9, 10], st.dayFrom ?? 7)}</select>
        <label for="set-nightfrom" class="small">${_t('Night from', '夜间从')}</label><select id="set-nightfrom">${hourOpts([16, 17, 18, 19, 20, 21, 22], st.nightFrom ?? 19)}</select></div>` : ''}
      <p class="muted small">${ap === 'system' ? _t('Matches your phone. On iPhone, Settings → Display & Brightness → Automatic switches at sunset.', '跟随手机设置。iPhone 上：设置 → 显示与亮度 → 自动（日落后切换）。') : ap === 'time' ? _t('The whole app, focus timer included, switches automatically at these times.', '整个 app（包括专注计时器）会在这些时间自动切换。') : _t('Stays this way all day.', '全天保持这种外观。')}</p></section>`;
    h += `<section class="card"><div class="sec-head"><h2>${_t('Balance warning', '平衡提醒')}</h2></div>
      <div class="row"><label for="set-balance" class="small">${_t('Warn when one category passes', '当某一分类占比超过')}</label>
        <select id="set-balance">${[60, 65, 70, 75, 80].map(x => `<option value="${x}"${x === (st.balanceLimit || 65) ? ' selected' : ''}>${x}%</option>`).join('')}</select></div>
      <p class="muted small">${_t('Checked once you have {a} minutes logged today. The ring segment pulses and a note suggests how to rebalance.', '今天记录满 {a} 分钟后开始检查。圆环片段会闪烁，并给出调整建议。', { a: BAL_MIN_TOTAL })}</p></section>`;
    h += `<section class="card"><div class="sec-head"><h2>${_t('Daily check-ins', '每日提醒')}</h2></div>
      <p class="muted small">${_t('iPhone web apps can’t send scheduled notifications, so the ledger checks in when you open it.', 'iPhone 网页应用无法发送定时通知，所以账本会在你打开时提醒。')}</p>
      <label class="toggle"><input type="checkbox" id="set-morning" ${st.morningBriefing ? 'checked' : ''}><span><b>${_t('Morning briefing', '晨间简报')}</b><br><span class="muted small">${_t('On your first open of the day: yesterday’s result, deadlines, stale projects.', '每天第一次打开时：昨天的结果、即将到期、快荒废的项目。')}</span></span></label>
      <label class="toggle"><input type="checkbox" id="set-evening" ${st.eveningSummary ? 'checked' : ''}><span><b>${_t('Evening summary', '晚间回顾')}</b><br><span class="muted small">${_t('When you open the app in the evening and haven’t closed the day.', '晚间打开 app 且还没结束当天时。')}</span></span></label>
      <div class="row"><label for="set-daystart" class="small">${_t('New day starts at', '新的一天从')}</label>
        <select id="set-daystart">${[0, 1, 2, 3, 4, 5, 6].map(x => `<option value="${x}"${x === (st.dayStart || 0) ? " selected" : ""}>${x === 0 ? _t("Midnight (0:00)", "午夜（0:00）") : x + ":00"}</option>`).join("")}</select>
        <span class="muted small">${_t('Work done before this hour counts for the previous day.', '这个时间之前做的事计入前一天。')}</span></div>
      <div class="row"><label for="set-hour" class="small">${_t('Evening starts at', '晚间从')}</label>
        <select id="set-hour">${[15, 16, 17, 18, 19, 20, 21, 22].map(x => `<option value="${x}"${x === st.eveningHour ? ' selected' : ''}>${x}:00</option>`).join('')}</select></div>
      <div class="row"><button class="btn small" data-act="show-briefing">${_t('Preview briefing', '预览晨间简报')}</button><button class="btn small" data-act="show-evening">${_t('Preview evening summary', '预览晚间回顾')}</button></div>
      <p class="muted small">${_t('For a nudge to open the app, add two repeating reminders in the iPhone Reminders or Clock app (for example 9:00 and {a}:00).', '想收到打开 app 的提醒，可在 iPhone「提醒事项」或「时钟」里加两条重复提醒（例如 9:00 和 {a}:00）。', { a: st.eveningHour })}</p>
    </section>`;

    const snd = SOUNDS.find(x => x.id === st.alarmSound) || SOUNDS[0];
    h += `<section class="card"><div class="sec-head"><h2>${_t('Focus timer sound', '专注计时提示音')}</h2></div>
      <p class="muted small">${_t('Plays when your focus target is reached, and once more 8 seconds later if you haven’t responded. Turn the ringer on (silent switch off) to hear it.', '达到专注目标时播放；8 秒后若未响应再播一次。请打开响铃（关闭静音开关）才能听到。')}</p>
      <div class="row"><select id="set-sound" aria-label="${_t('Alarm sound', '提示音')}">${SOUNDS.map(x => `<option value="${x.id}"${x.id === snd.id ? " selected" : ""}>${esc(_t(x.name, x.zh))}</option>`).join("")}</select>
        <button class="btn" data-act="preview-sound">▶ ${_t('Preview', '预览')}</button><span class="muted small">${esc(_t(snd.hint, snd.hintZh))}</span></div></section>`;

    h += `<section class="card"><div class="sec-head"><h2>${_t('Break timer', '休息计时')}</h2></div>
      <div class="row"><label for="set-break" class="small">${_t('After a focus session', '专注结束后')}</label>
        <select id="set-break" aria-label="${_t('Break timer', '休息计时')}">${[0, 5, 10, 15].map(x => `<option value="${x}"${x === (st.breakMinutes ?? 5) ? ' selected' : ''}>${x === 0 ? _t('Off', '关闭') : x + _t(' min break', ' 分钟休息')}</option>`).join('')}</select></div>
      <p class="muted small">${_t('Offers a short countdown when you end a session, with a sound when it’s over.', '结束专注后提供短暂倒计时，结束时有提示音。')}</p></section>`;

    h += `<section class="card"><div class="sec-head"><h2>${_t('Backup', '备份')}</h2>${lb ? `<span class="chip ${daysBetween(fmt(lb), todayKey()) >= 7 ? 'warn' : 'on'}">${_t('Last backup {a}', '上次备份 {a}', { a: shortDate(fmt(lb)) })}</span>` : `<span class="chip warn">${_t('Never backed up', '从未备份')}</span>`}</div>
      <p class="muted small">${_t('Your ledger is stored only on this device: {a} days, {b} projects, {c} listed tasks. Export a backup file every week or so and keep it in iCloud Drive or Files. Safari and the Home Screen app keep separate data, so use the Home Screen app day to day.', '你的账本只存在本设备上：{a} 天、{b} 个项目、{c} 项任务。建议每周左右导出一份备份，存在 iCloud 云盘或「文件」里。Safari 和主屏幕 app 的数据相互独立，日常请用主屏幕 app。', { a: nDays, b: nProj, c: nTasks })}</p>
      <div class="row"><button class="btn primary" data-act="export">${_t('Export data (JSON)', '导出数据（JSON）')}</button><button class="btn" data-act="copy-backup">${_t('Copy as text', '复制为文本')}</button>
        <label class="btn" for="import-file">${_t('Import data (JSON)', '导入数据（JSON）')}</label><input type="file" id="import-file" accept="application/json,.json" hidden></div>`;
    if (pi) h += `<div class="pedit"><span>${_t('Replace everything on this device with the backup from {a} ({b} days, {c} projects)?', '用来自 {a} 的备份替换本设备上的所有数据（{b} 天、{c} 个项目）？', { a: `<b>${esc(pi.exportedAt ? new Date(pi.exportedAt).toLocaleString(LOC()) : _t('an unknown date', '未知日期'))}</b>`, b: Object.keys(pi.days).length, c: (pi.profile.projects || []).filter(p => !p.archived).length })}</span>
        <button class="btn small primary" data-act="import-confirm">${_t('Replace my data', '替换我的数据')}</button><button class="btn quiet small" data-act="import-cancel">${_t('Cancel', '取消')}</button></div>`;
    h += '</section>';

    h += `<section class="card"><div class="sec-head"><h2>${_t('User manual', '使用手册')}</h2></div>
      <p class="muted small">${_t('A short guide in English and Chinese.', '中英文简明使用指南。')}</p>
      <div class="row"><a class="btn" href="manual.html">${_t('Open manual', '打开手册')}</a></div></section>`;

    h += `<section class="card"><div class="sec-head"><h2>${_t('Erase', '清除数据')}</h2></div>
      <p class="muted small">${_t('Deletes every day, project and setting on this device. Export first if you might want it back.', '删除本设备上的所有天数、项目和设置。若可能还想找回，请先导出。')}</p>
      <div class="row">${state.ui.confirmErase ? `<button class="btn small" data-act="erase">${_t('Yes, erase everything', '是的，全部清除')}</button><button class="btn quiet small" data-act="cancel-erase">${_t('Cancel', '取消')}</button>` : `<button class="btn small" data-act="ask-erase">${_t('Erase all data', '清除所有数据')}</button>`}</div></section>`;
    return h;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const k = todayKey();
    switch (b.dataset.act) {
      case 'modal-close': closeModal(); break;
      case 'day': showModal(dayModal(b.dataset.day)); break;
      case 'plan-today': closeModal(); if (location.hash !== '#today') location.hash = '#today'; setTimeout(() => document.getElementById('new-text')?.focus(), 50); break;
      case 'goto-close': closeModal(); if (location.hash !== '#today') location.hash = '#today';
        setTimeout(() => { const el = document.getElementById('rev-note'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } else if (!getDay(k).locked) toast(_t('Lock in or add what you did first, then close the day.', '先锁定或添加你今天做的事，再结束这一天。')); }, 80); break;
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
        Store.apply(v); state.settings.lastBriefing = k; Store.flush(); render(); toast(_t('Backup imported.', '已导入备份。')); break;
      }
      case 'ask-erase': state.ui.confirmErase = true; render(); break;
      case 'cancel-erase': state.ui.confirmErase = false; render(); break;
      case 'erase': state.ui.confirmErase = false; if (timer) { timer = null; saveTimer(); } Store.apply({ days: {}, profile: { projects: [], backlog: [] }, settings: { lastBriefing: k } }); Store.flush(); render(); toast(_t('All data erased.', '所有数据已清除。')); break;
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
    el.innerHTML = `<span>${_t('Install the ledger: tap <b>Share</b>, then <b>Add to Home Screen</b>.', '安装账本：点击<b>分享</b>，再点<b>添加到主屏幕</b>。')}</span><button class="btn quiet small" data-act="dismiss-install">${_t('Dismiss', '忽略')}</button>`;
    el.hidden = false;
  })();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- editing, undo ----------
  const UNDOABLE = { toggle: 1, btoggle: 1, 'confirm-drop': 1, remove: 1, bremove: 1, 'del-project': 1, 'del-log': 1 };
  const snapshot = () => JSON.stringify({ days: state.days, profile: state.profile });
  // Runs before the action handlers (capture phase): remember the data, then offer Undo if it changed.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || !UNDOABLE[b.dataset.act]) return;
    const act = b.dataset.act, id = b.dataset.id, snap = snapshot();
    setTimeout(() => {
      if (snapshot() === snap) return;
      let label = _t('Change saved.', '已保存更改。');
      if (act === 'toggle') { const t = getDay(todayKey()).tasks.find(x => x.id === id); label = t && t.done ? (goalAchieved() ? _t('★ All commitments done. Goal achieved!', '★ 所有承诺已完成，目标达成！') : _t('Marked done.', '已标记完成。')) : _t('Marked not done.', '已标记未完成。'); }
      else if (act === 'btoggle') { const x = backlog().find(y => y.id === id); label = x && x.done ? _t('Marked done.', '已标记完成。') : _t('Marked not done.', '已标记未完成。'); }
      else label = { 'confirm-drop': _t('Task dropped.', '任务已放弃。'), remove: _t('Task removed.', '任务已删除。'), bremove: _t('Task deleted.', '任务已删除。'), 'del-project': _t('Project removed.', '项目已删除。'), 'del-log': _t('Entry removed.', '记录已删除。') }[act];
      toast(label, { label: _t('Undo', '撤销'), fn: () => { const v = JSON.parse(snap); state.days = v.days; state.profile = v.profile; Store.save(); render(); toast(_t('Undone.', '已撤销。')); } });
    }, 0);
  }, true);

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const k = todayKey(), id = b.dataset.id;
    const focusSoon = elId => setTimeout(() => { const el = document.getElementById(elId); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) {} } }, 0);
    switch (b.dataset.act) {
      case 'edit-task': state.ui.editTask = id; state.ui.dropping = null; render(); focusSoon('et-text'); break;
      case 'cancel-edit-task': state.ui.editTask = null; render(); break;
      case 'save-task': {
        const text = (document.getElementById('et-text')?.value || '').trim(), est = Number(document.getElementById('et-est')?.value) || 50;
        if (!text) { toast(_t('The task needs a name.', '任务需要一个名字。')); break; }
        const t0 = getDay(k).tasks.find(x => x.id === id), changed = !!t0 && t0.text !== text;
        state.ui.editTask = null;
        mutateDay(k, d => { const t = d.tasks.find(x => x.id === id); if (t) { if (d.locked && changed) t.edited = true; t.text = text; t.est = est; } });
        if (t0 && t0.backlogId && changed) mutateProfile(p => { const x = p.backlog.find(y => y.id === t0.backlogId); if (x) x.text = text; });
        toast(_t('Saved.', '已保存。')); break;
      }
      case 'edit-b': state.ui.editB = id; render(); focusSoon('eb-text'); break;
      case 'cancel-edit-b': state.ui.editB = null; render(); break;
      case 'save-btask': {
        const text = (document.getElementById('eb-text')?.value || '').trim();
        if (!text) { toast(_t('The task needs a name.', '任务需要一个名字。')); break; }
        state.ui.editB = null;
        mutateProfile(p => { const x = p.backlog.find(y => y.id === id); if (x) x.text = text; });
        const d = getDay(k), copy = d.tasks.find(t => t.backlogId === id);
        if (copy && !d.locked) mutateDay(k, dd => { const t = dd.tasks.find(x => x.id === copy.id); if (t) t.text = text; });
        toast(_t('Saved.', '已保存。')); break;
      }
    }
  });
  // Enter saves inline editors.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const act = { 'et-text': 'save-task', 'eb-text': 'save-btask', 'drop-reason': 'confirm-drop' }[e.target.id]; if (!act) return;
    e.preventDefault(); document.querySelector(`[data-act="${act}"]`)?.click();
  });

  // ---------- routing ----------
  function route() {
    const h = location.hash.replace('#', '');
    state.view = ['today', 'history', 'projects', 'settings'].includes(h) ? h : 'today';
    state.ui.dropping = null; state.ui.confirmDel = null; state.ui.editProj = null; state.ui.editTask = null; state.ui.editB = null; state.ui.stepsFor = null;
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
