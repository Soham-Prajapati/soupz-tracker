import React, { useState, useEffect, useMemo } from 'react';
import { SCHEDULE, BLOCKS, ALL_PROBLEMS, LLD, AI, EVENTS, PHASES, parse, ACADEMICS, SUBJECT_ORDER } from './data/schedule.js';
import { COLLEGE } from './data/tracks.js';
import { LABS, LAB_ORDER, LAB_START } from './data/labs.js';
import * as Sync from './sync.js';
import { enable as autoOn, disable as autoOff, isEnabled as autoIs } from '@tauri-apps/plugin-autostart';
import { InkDefs, Bowl, Cup, Noodle, Tick, Rule, EmptyPot, GARNISH } from './soup.jsx';

// Keep the menu bar count in sync with today's progress.
function useTrayProgress(done, total) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('set_tray_progress', { done, total }))
      .catch(() => {});
  }, [done, total]);
}

const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
import { RESOURCES } from './data/resources.js';

// Tracks are ingredients. The label is what goes in the bowl, not what the data calls it.
const TRACKS = {
  dsa: 'DSA', contest: 'Contest', lld: 'System Design', ai: 'AI/ML',
  college: 'College', aptitude: 'Aptitude', admin: 'Admin', content: 'Content',
};

// The broth you are cooking in. Every accent is something you would actually taste.
const FLAVOURS = [
  { id:'miso',     n:'Miso',     l:'#E2963C', l2:'#B96C16', w:'#F7CE8A', d:'#F0A94F', d2:'#FFC680' },
  { id:'tomato',   n:'Tomato',   l:'#D4553A', l2:'#A93A22', w:'#F5B39F', d:'#F0795A', d2:'#FF9E85' },
  { id:'matcha',   n:'Matcha',   l:'#7FA23C', l2:'#5B7A22', w:'#CBDD9A', d:'#A8CE63', d2:'#C6E48C' },
  { id:'beet',     n:'Beetroot', l:'#B2456F', l2:'#8A2C52', w:'#EDAFC6', d:'#E2749F', d2:'#F5A0C1' },
  { id:'kombu',    n:'Kombu',    l:'#2F8C86', l2:'#196662', w:'#9BD5D0', d:'#54C3BE', d2:'#86DBD6' },
  { id:'charcoal', n:'Charcoal', l:'#6A5B4A', l2:'#493D30', w:'#C9B79E', d:'#C3B098', d2:'#DCCDB8' },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const rawToday = () => { const d = new Date(); d.setHours(0,0,0,0); return isoLocal(d); };
// Clamp into the plan window so the app still renders before the plan starts / after it ends.
const FIRST = SCHEDULE[0].date;
const LAST = SCHEDULE[SCHEDULE.length - 1].date;
const todayISO = () => {
  const t = rawToday();
  if (t < FIRST) return FIRST;
  if (t > LAST) return LAST;
  return t;
};
const fmt = (s) => { const d = parse(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const hm = (sec) => { const m = Math.round(sec/60); return m>=60 ? `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m` : `${m} min`; };
const pc = (n, d) => d ? n / d : 0;

function useStore(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}

/* ---------------------------------------------------------------- pieces */

// The block at the top of every view. Words on the left, the bowl on the right.
function Counter({ eyebrow, title, lede, tally, right, children }) {
  return (
    <div className="counter">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {lede && <div className="lede">{lede}</div>}
        {tally && (
          <div className="tally">
            {tally.filter(Boolean).map((t, i) => (
              <div className="tally-i" key={i}>
                <b>{t.v}{t.of && <s> / {t.of}</s>}</b>
                <span>{t.k}</span>
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
      {right && <div className="counter-r">{right}</div>}
    </div>
  );
}

function Slip({ title, value, big, children, tape }) {
  return (
    <div className="slip">
      {tape && <i className="tape" />}
      {(title || value) && (
        <div className="slip-h">
          {title && <span className={'slip-t' + (big ? ' big' : '')}>{title}</span>}
          {value && <span className="slip-v">{value}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// Every "x of y" in the app is a noodle with a label over it.
function Ladder({ name, done, total, c }) {
  return (
    <div className="ladder">
      <div className="ladder-h">
        <span className="ladder-n">{name}</span>
        <span className="ladder-v">{done}/{total}</span>
      </div>
      <Noodle pct={pc(done, total)} c={c} />
    </div>
  );
}

// One task = one order ticket, colour-coded by the ingredient it belongs to.
function Ticket({ t, done, onToggle, onPush }) {
  const [open, setOpen] = useState(false);
  const vids = t.videos || [];
  const mins = vids.reduce((a, v) => a + v.m, 0);
  return (
    <div className={'chit t-' + t.track + (done ? ' done' : '')}>
      <button className="chit-cb" onClick={onToggle} aria-label={done ? 'Not done yet' : 'Mark done'}>
        <Tick on={done} />
      </button>
      <div className="chit-m">
        <div className="chit-t">{t.title}</div>
        {(t.meta || mins > 0) && (
          <div className="chit-s">
            {t.meta && <span>{t.meta}</span>}
            {/* only add the running time if the task's own line does not already carry it */}
            {mins > 0 && !/\bmin\b|\bm\b/.test(t.meta || '') && <span className="dur">{mins} min</span>}
          </div>
        )}

        {vids.length > 0 && (
          <div className="vids">
            <button className={'vids-h' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}>
              <span className="chev">›</span>
              {vids.length === 1 ? '1 video' : `${vids.length} videos`}
            </button>
            {open && (
              <ol className="vlist">
                {vids.map((v, i) => (
                  <li key={i}>
                    <a href={v.u} target="_blank" rel="noreferrer">
                      <span className="mv-n">{i + 1}</span>
                      <span className="mv-t">{v.t}</span>
                      <span className="mv-m">{v.m}m</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {t.why && <div className="chit-why">{t.why}</div>}
        <div className="chit-a">
          {t.url && <a className="btn go" href={t.url} target="_blank" rel="noreferrer">
            {vids.length ? 'Start watching' : 'Open'} →
          </a>}
          {!done && onPush && <button className="btn" onClick={onPush}>Push to tomorrow</button>}
        </div>
      </div>
    </div>
  );
}

function Empty({ line }) {
  return <div className="empty"><EmptyPot /><p>{line}</p></div>;
}

/* ---------------------------------------------------------------- settings */

function Settings({ theme, setTheme, accent, setAccent, sync, done }) {
  const solved = ALL_PROBLEMS.filter(p => done['p-' + p.n]).length;
  const [launch, setLaunch] = useState(null);
  const desktop = isDesktop();

  useEffect(() => {
    if (!desktop) return;
    autoIs().then(setLaunch).catch(() => setLaunch(false));
  }, [desktop]);

  const toggleLaunch = async () => {
    try {
      if (launch) { await autoOff(); setLaunch(false); }
      else { await autoOn(); setLaunch(true); }
    } catch {}
  };

  return (
    <div className="app" style={{ maxWidth: 580, paddingTop: 26 }}>
      <InkDefs />
      <Counter
        eyebrow="The kitchen"
        title="Settings"
        right={<Bowl pct={.55} size={150} heat garnish={[{kind:'leaf',c:'var(--lld)'}]} />}
      />

      <Slip title="Broth" big>
        <div className="lede" style={{ marginTop: 0, marginBottom: 14 }}>
          Everything that fills, glows or drips takes its colour from here.
        </div>
        <div className="flavours">
          {FLAVOURS.map(f => (
            <button key={f.id} className="flavour" onClick={() => setAccent(f.id)}
              aria-pressed={accent === f.id}>
              <i style={{ background: f.l }} />{f.n}
            </button>
          ))}
        </div>
        <Rule />
        <div className="slip-t" style={{ margin: '4px 0 10px' }}>Light</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['light','Daylight'],['dark','Evening'],[null,'Follow the Mac']].map(([v, n]) => (
            <button key={n} className={'btn' + (theme === v ? ' on' : '')} onClick={() => setTheme(v)}>{n}</button>
          ))}
        </div>
      </Slip>

      {desktop && (
        <Slip title="Startup" big>
          <div className="sw-row">
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Open at login</div>
              <div className="lede" style={{ marginTop: 4, fontSize: 13 }}>
                Soupz starts with your Mac and sits in the menu bar, so the first thing
                you see each morning is what is on today.
              </div>
            </div>
            <button className={'sw' + (launch ? ' on' : '')} onClick={toggleLaunch}
              role="switch" aria-checked={!!launch} disabled={launch === null}><i /></button>
          </div>
        </Slip>
      )}

      <Slip title="Sync" big>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={'pot-dot s-' + sync} />
          <b style={{ fontSize: 14 }}>{sync === 'ok' ? 'Connected' : sync === 'offline' ? 'Offline' : 'Connecting'}</b>
        </div>
        <div className="lede" style={{ marginTop: 0, fontSize: 13.5 }}>
          {sync === 'ok'
            ? 'Progress is shared between this Mac app, your browser and your phone. Tick something in one place and it appears everywhere.'
            : sync === 'offline'
            ? 'Changes are being saved on this device only. They will upload once you are back online.'
            : 'Checking the connection.'}
        </div>
      </Slip>

      {desktop && (
        <Slip title="Shortcuts" big>
          <div className="kb-row"><span>Settings</span><kbd>⌘ ,</kbd></div>
          <div className="kb-row"><span>Hide window</span><kbd>⌘ H</kbd></div>
          <div className="kb-row"><span>Quit</span><kbd>⌘ Q</kbd></div>
          <div className="lede" style={{ fontSize: 13 }}>
            Closing the window keeps Soupz simmering in the menu bar. Click the icon there
            for today's tasks, or Quit to close it fully.
          </div>
        </Slip>
      )}

      <Slip title="In the pot so far" big>
        <Ladder name="DSA problems" done={solved} total={ALL_PROBLEMS.length} c="var(--dsa)" />
        <Ladder name="System design" done={LLD.units.filter((u,i)=>done['lld-'+(i+1)]).length} total={LLD.units.length} c="var(--lld)" />
        <Ladder name="AI / ML" done={AI.units.filter((u,i)=>done['ai-'+(i+1)]).length} total={AI.units.length} c="var(--ai)" />
      </Slip>
    </div>
  );
}

/* ---------------------------------------------------------------- tray popover */

function Panel({ day, tasks, done, toggle, today }) {
  useEffect(() => {
    document.body.classList.add('panel-mode');
    return () => document.body.classList.remove('panel-mode');
  }, []);
  const dn = tasks.filter(t => done[t.id]).length;
  const byTrack = {};
  tasks.forEach(t => { (byTrack[t.track] = byTrack[t.track] || []).push(t); });
  return (
    <div className="pnl">
      <InkDefs />
      <div className="pnl-top">
        <Bowl pct={pc(dn, tasks.length)} size={78} heat={dn > 0} />
        <div style={{ minWidth: 0 }}>
          <div className="pnl-date">{fmt(today)} · {day.phase}</div>
          <div className="pnl-h1">{dn}<s> / {tasks.length}</s> done</div>
        </div>
      </div>
      <div className="pnl-scroll">
        {Object.entries(byTrack).map(([k, ts]) => (
          <div className="pnl-g" key={k}>
            <div className="pnl-gh"><i style={{ background: 'var(--' + k + ')' }} />{TRACKS[k]}</div>
            {ts.map(t => (
              <div className={'pnl-r' + (done[t.id] ? ' on' : '')} key={t.id}>
                <button onClick={() => toggle(t.id)} aria-label="Toggle" style={{ padding: 0, marginTop: 1 }}>
                  <Tick on={!!done[t.id]} size={15} />
                </button>
                <div className="pnl-t">{t.title}</div>
                {t.url && <a className="pnl-go" href={t.url} target="_blank" rel="noreferrer">OPEN</a>}
              </div>
            ))}
          </div>
        ))}
        {!tasks.length && <Empty line="Nothing simmering today." />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- app */

const VIEWS = ['today','academics','overview','calendar','week','plan','tracks','labs','subjects','grades','deadlines'];

export default function App() {
  const [theme, setTheme] = useStore('theme', null);
  const [done, setDone] = useStore('done', {});
  const [pushed, setPushed] = useStore('pushed', {});
  // ?v=academics opens straight onto a view — handy for links and for the tray.
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(location.search).get('v');
    return VIEWS.includes(v) ? v : 'today';
  });
  const [accent, setAccent] = useStore('accent', 'miso');
  const [sync, setSync] = useState('connecting');
  const [openMod, setOpenMod] = useState(null);

  // Every scheduled task id for one module's pass, so a click marks the whole pass.
  const modTaskIds = (code, m, pass) => {
    const learn = `${code} M${m} ·`;
    const rev = `Revise ${code} M${m} ·`;
    const out = [];
    SCHEDULE.forEach(d => d.tasks.forEach(t => {
      if (t.track !== 'college') return;
      if (pass === 1 && t.title.startsWith(learn)) out.push(t.id);
      else if (pass === 2 && t.id.startsWith('rev7-') && t.title.startsWith(rev)) out.push(t.id);
      else if (pass === 3 && t.id.startsWith('rev21-') && t.title.startsWith(rev)) out.push(t.id);
    }));
    return out;
  };

  // Pull shared state on load; seed the cloud from local on first run.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await Sync.pullAll();
        if (!live) return;
        const localCount = Object.values(done).filter(Boolean).length;
        if (localCount && !Object.keys(r.done).length) {
          await Sync.pushLocal(done, pushed);
        } else {
          setDone(d => ({ ...d, ...r.done }));
          setPushed(p => ({ ...p, ...r.pushed }));
        }
        setSync('ok');
      } catch { if (live) setSync('offline'); }
    })();
    return () => { live = false; };
  }, []);

  const [cursor, setCursor] = useState(todayISO());

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-t', theme);
    else document.documentElement.removeAttribute('data-t');
  }, [theme]);

  useEffect(() => {
    const F = FLAVOURS.find(a => a.id === accent) || FLAVOURS[0];
    const dark = (theme === 'dark') || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const r = document.documentElement.style;
    r.setProperty('--accent-c', dark ? F.d : F.l);
    r.setProperty('--accent-c2', dark ? F.d2 : F.l2);
    r.setProperty('--accent-cw', F.w);           // the surface highlight stays pale in both modes
  }, [accent, theme]);

  const today = todayISO();
  const byDate = useMemo(() => Object.fromEntries(SCHEDULE.map(d => [d.date, d])), []);

  // tasks for a date = its own + anything pushed onto it
  const tasksFor = (date) => {
    const base = (byDate[date]?.tasks || []).filter(t => !pushed[t.id] || pushed[t.id] === date);
    const moved = [];
    Object.entries(pushed).forEach(([id, dt]) => {
      if (dt !== date) return;
      if (base.some(b => b.id === id)) return;
      for (const d of SCHEDULE) { const f = d.tasks.find(x => x.id === id); if (f) { moved.push(f); break; } }
    });
    return [...base, ...moved];
  };

  const day = byDate[cursor] || SCHEDULE[0];
  const tasks = tasksFor(cursor);
  const doneCount = tasks.filter(t => done[t.id]).length;
  const pct = pc(doneCount, tasks.length);

  const toggle = (id) => {
    const next = !done[id];
    setDone(d => ({ ...d, [id]: next }));
    Sync.setDone(id, next).catch(() => setSync('offline'));
  };
  const push = (id) => {
    const nxt = new Date(parse(cursor)); nxt.setDate(nxt.getDate() + 1);
    setPushed(p => ({ ...p, [id]: isoLocal(nxt) }));
  };

  // progress
  const solved = ALL_PROBLEMS.filter(p => done['p-' + p.n]).length;
  const lldDone = LLD.units.filter((u,i) => done['lld-' + (i+1)]).length;
  const aiDone = AI.units.filter((u,i) => done['ai-' + (i+1)]).length;
  const contestsDone = Object.keys(done).filter(k => done[k] && k.startsWith('c-')).length;
  const totalTasks = useMemo(() => SCHEDULE.reduce((a,d) => a + d.tasks.length, 0), []);
  const doneTasks = Object.values(done).filter(Boolean).length;
  const elapsed = SCHEDULE.filter(d => d.date <= today).length;

  // streak
  const streak = useMemo(() => {
    let n = 0;
    const d = new Date(parse(today));
    for (let guard = 0; guard < 400; guard++) {
      const s = isoLocal(d);
      const ts = (byDate[s]?.tasks || []).filter(t => t.track === 'dsa');
      if (ts.length && !ts.some(t => done[t.id])) break;
      if (ts.length) n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [done, today, byDate]);

  useTrayProgress(doneCount, tasks.length);

  const upcoming = EVENTS.filter(e => e.d >= today).slice(0, 8);
  const nextDeadline = EVENTS.find(e => e.d >= today && e.type === 'deadline');

  // A finished track drops its garnish into today's bowl.
  const garnishToday = useMemo(() => {
    const by = {};
    tasks.forEach(t => { (by[t.track] = by[t.track] || []).push(t); });
    return Object.entries(by)
      .filter(([, ts]) => ts.every(t => done[t.id]))
      .map(([k]) => ({ kind: GARNISH[k] || 'leaf', c: `var(--${k})` }));
  }, [tasks, done]);

  // Clamp to the plan window. Walking off either end lands you on an empty day
  // that reads as "0 of 0 done", which looks like the schedule is broken.
  const shift = (n) => {
    const d = new Date(parse(cursor)); d.setDate(d.getDate() + n);
    const next = isoLocal(d);
    if (next < FIRST || next > LAST) return;
    setCursor(next);
  };

  const weekDays = useMemo(() => {
    const d = parse(cursor); const out = [];
    const start = new Date(d); start.setDate(d.getDate() - d.getDay());
    for (let i = 0; i < 7; i++) { const x = new Date(start); x.setDate(start.getDate()+i); out.push(isoLocal(x)); }
    return out;
  }, [cursor]);

  const winMode = new URLSearchParams(location.search).get('window');
  if (winMode === 'settings') {
    return <Settings theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} sync={sync} done={done} />;
  }
  if (winMode === 'panel') {
    return <Panel day={byDate[today] || SCHEDULE[0]} tasks={tasksFor(today)} done={done} toggle={toggle} today={today} />;
  }

  return (
    <div className="app">
      <InkDefs />

      {/* ---------------- masthead ---------------- */}
      <div className="menu">
        <div className="menu-in">
          <div className="mark">
            <div className="pot"><Bowl pct={pc(doneTasks, totalTasks)} size={34} heat={doneCount > 0} flat /></div>
            <div className="mark-n">Soup<i>z</i></div>
            <div className="mark-s">Semester V · Day {elapsed} of {SCHEDULE.length}</div>
          </div>
          <span className={'pot-dot s-' + sync} title={
            sync === 'ok' ? 'Synced across app, browser and phone'
            : sync === 'offline' ? 'Offline — saving locally' : 'Connecting'} />
        </div>
        <div className="nav">
          {VIEWS.map(v => (
            <button key={v} className={'nav-i' + (view === v ? ' on' : '')}
              onClick={() => { setView(v); if (v === 'today') setCursor(today); }}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- today ---------------- */}
      {view === 'today' && day && (
        <>
          <Counter
            eyebrow={<>{cursor === today ? 'Today' : fmt(cursor)} · {day.phase}</>}
            title={<><em>{doneCount}</em> of {tasks.length} done</>}
            lede={day.phaseNote}
            tally={[
              { v: streak, k: streak === 1 ? 'day streak' : 'day streak' },
              { v: solved, of: ALL_PROBLEMS.length, k: 'problems solved' },
              { v: contestsDone, k: 'contests entered' },
              nextDeadline && { v: daysBetween(today, nextDeadline.d), k: 'days to next deadline' },
            ]}
            right={
              <Bowl pct={pct} size={280} heat={doneCount > 0} garnish={garnishToday}
                caption={doneCount === 0 ? 'Cold pot' : pct === 1 ? 'Served' : 'Simmering'}
                sub={streak > 0 ? `${streak}-day streak` : 'streak broken — restart today'} />
            }
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => shift(-1)}>← Yesterday</button>
            <button className="btn" onClick={() => shift(1)}>Tomorrow →</button>
            {cursor !== today && <button className="btn on" onClick={() => setCursor(today)}>Back to today</button>}
            {cursor !== today && <span className="mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>viewing {fmt(cursor)}</span>}
          </div>

          <div className="board">
            <div>
              {Object.keys(TRACKS).map(k => {
                const ts = tasks.filter(t => t.track === k);
                if (!ts.length) return null;
                const dn = ts.filter(t => done[t.id]).length;
                return (
                  <div className="course" key={k}>
                    <div className="course-h">
                      <span className="course-g"><Cup pct={pc(dn, ts.length)} size={22} c={`var(--${k})`} /></span>
                      <span className="course-n">{TRACKS[k]}</span>
                      <span className="course-c">{dn}/{ts.length}</span>
                    </div>
                    <div className="chits two">
                      {ts.map(t => (
                        <Ticket key={t.id} t={t} done={!!done[t.id]}
                          onToggle={() => toggle(t.id)} onPush={() => push(t.id)} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {!tasks.length && <Empty line="Nothing on the pass today. Rest is part of the recipe." />}
            </div>

            <div className="board-side">
              <Slip title="In the pot" tape>
                <div style={{ display: 'flex', justifyContent: 'space-around', gap: 10 }}>
                  <Cup pct={pc(solved, ALL_PROBLEMS.length)} size={66} c="var(--dsa)"
                    value={`${Math.round(pc(solved, ALL_PROBLEMS.length)*100)}%`} label="DSA" />
                  <Cup pct={pc(lldDone, LLD.units.length)} size={66} c="var(--lld)"
                    value={`${Math.round(pc(lldDone, LLD.units.length)*100)}%`} label="Design" />
                  <Cup pct={pc(aiDone, AI.units.length)} size={66} c="var(--ai)"
                    value={`${Math.round(pc(aiDone, AI.units.length)*100)}%`} label="AI/ML" />
                </div>
              </Slip>

              <Slip title="On next">
                <div className="rail">
                  {upcoming.slice(0,5).map((e,i) => {
                    const dd = daysBetween(today, e.d);
                    return (
                      <div className={'rail-i' + (dd <= 7 ? ' on' : '')} key={i}>
                        <span className="rail-d" />
                        <div className="rail-m">
                          <div className="rail-t">{e.t.length > 48 ? e.t.slice(0,46)+'…' : e.t}</div>
                          <div className={'rail-s' + (dd <= 7 ? ' hot' : '')}>{dd === 0 ? 'today' : `${dd} days`} · {fmt(e.d)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Slip>

              <Slip title="The floor">
                <div className="lede" style={{ marginTop: 0, fontSize: 13.5 }}>
                  One problem is a day that counts. The whole plan is built so that a bad
                  day still leaves something in the pot.
                </div>
              </Slip>
            </div>
          </div>
        </>
      )}

      {/* ---------------- overview ---------------- */}
      {view === 'overview' && (() => {
        const heat = SCHEDULE.map(d => {
          const ts = d.tasks.filter(t => t.track === 'dsa');
          const dn = ts.filter(t => done[t.id]).length;
          return { date: d.date, p: pc(dn, ts.length), past: d.date < today };
        });
        const allGarnish = [
          solved > 0 && { kind:'noodle', c:'var(--dsa)' },
          contestsDone > 0 && { kind:'chili', c:'var(--contest)' },
          lldDone > 0 && { kind:'sprout', c:'var(--lld)' },
          aiDone > 0 && { kind:'star', c:'var(--ai)' },
        ].filter(Boolean);
        return (
        <>
          <Counter
            eyebrow="Everything at once"
            title="The whole pot"
            lede="22 July 2026 to 4 January 2027. One bowl, filled a spoon at a time. This is what is actually in it so far."
            tally={[
              { v: doneTasks, of: totalTasks, k: 'tasks done' },
              { v: elapsed, of: SCHEDULE.length, k: 'days elapsed' },
              { v: streak, k: 'day streak' },
            ]}
            right={<Bowl pct={pc(doneTasks, totalTasks)} size={280} heat={doneTasks > 0} garnish={allGarnish}
              caption={`${Math.round(pc(doneTasks, totalTasks)*100)}% full`} sub="the semester" />}
          />

          <div className="shelf">
            <div className="shelf-i"><dt>Problems solved</dt><dd>{solved}<s>/ {ALL_PROBLEMS.length}</s></dd></div>
            <div className="shelf-i"><dt>Contests</dt><dd>{contestsDone}</dd></div>
            <div className="shelf-i"><dt>Design units</dt><dd>{lldDone}<s>/ {LLD.units.length}</s></dd></div>
            <div className="shelf-i"><dt>AI units</dt><dd>{aiDone}<s>/ {AI.units.length}</s></dd></div>
            <div className="shelf-i"><dt>Days left</dt><dd className={SCHEDULE.length - elapsed < 20 ? 'warn' : ''}>{SCHEDULE.length - elapsed}</dd></div>
          </div>

          <div className="board">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Slip title="DSA blocks" big
                value={`${BLOCKS.filter(b => b.problems.every(p => done['p-'+p.n])).length}/${BLOCKS.length} finished`}>
                {BLOCKS.map(b => (
                  <Ladder key={b.id} name={b.name}
                    done={b.problems.filter(p => done['p-'+p.n]).length}
                    total={b.problems.length} c="var(--dsa)" />
                ))}
              </Slip>

              <Slip title="Every day of the plan" big value="one drop per day">
                <div className="heat">
                  {heat.map(h => (
                    <div key={h.date} className={'heat-c' + (h.past && !h.p ? ' past' : '')}
                      title={`${h.date} — ${Math.round(h.p*100)}%`}
                      style={h.p > 0 ? {
                        background: `color-mix(in srgb, var(--dsa) ${25 + h.p*75}%, var(--paper2))`,
                        borderColor: 'var(--ink)',
                      } : undefined} />
                  ))}
                </div>
                <div className="heat-k">
                  <span><i />ahead of you</span>
                  <span><i style={{ borderStyle: 'dashed', opacity: .55 }} />missed</span>
                  <span><i style={{ background: 'var(--dsa)', borderColor: 'var(--ink)' }} />done</span>
                </div>
              </Slip>
            </div>

            <div className="board-side">
              <Slip title="Other tracks">
                <Ladder name="System design" done={lldDone} total={LLD.units.length} c="var(--lld)" />
                <Ladder name="AI / ML" done={aiDone} total={AI.units.length} c="var(--ai)" />
                <Ladder name="Contests entered" done={contestsDone} total={40} c="var(--contest)" />
              </Slip>

              <Slip title="What this is for">
                <div className="lede" style={{ marginTop: 0, fontSize: 13.5 }}>
                  <b>December 2026:</b> Codeforces Specialist, 1400.<br />
                  <b>January 2027:</b> Expert, 1600, if December goes well.<br />
                  <b>Graduation:</b> Candidate Master, 1900 — the rating where quant firms
                  read a resume that does not say IIT.<br /><br />
                  <b>This semester:</b> a 9-plus pointer, PR1 and M132 maxed, Adobe and SIH
                  entered, Optiver applied for.
                </div>
              </Slip>

              <Slip title="Phases">
                <div className="rail">
                  {PHASES.map((p,i) => (
                    <div className={'rail-i' + (today >= p.start ? ' on' : '')} key={i}>
                      <span className="rail-d" />
                      <div className="rail-m">
                        <div className="rail-t">{p.name}</div>
                        <div className="rail-s">{fmt(p.start)} → {fmt(p.end)} · {p.pd}/day</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Slip>
            </div>
          </div>
        </>);
      })()}

      {/* ---------------- calendar ---------------- */}
      {view === 'calendar' && (() => {
        const cd = parse(cursor);
        const y = cd.getFullYear(), m = cd.getMonth();
        const first = new Date(y, m, 1), startPad = first.getDay();
        const cells = [];
        for (let i = 0; i < startPad; i++) cells.push(null);
        const dim = new Date(y, m+1, 0).getDate();
        for (let i = 1; i <= dim; i++) cells.push(new Date(y, m, i));
        const jump = (n) => { const d = new Date(y, m+n, 1); setCursor(isoLocal(d)); };
        const monthTasks = cells.filter(Boolean).flatMap(d => tasksFor(isoLocal(d)));
        const monthDone = monthTasks.filter(t => done[t.id]).length;
        return (
        <>
          <Counter
            eyebrow="Month by month"
            title={`${MON[m]} ${y}`}
            lede="Every square is a day, and every day fills up as you tick it off. Click one to open it."
            tally={[{ v: monthDone, of: monthTasks.length, k: 'tasks this month' }]}
            right={<Bowl pct={pc(monthDone, monthTasks.length)} size={210} heat={monthDone > 0}
              caption={`${MON[m]}`} sub={`${Math.round(pc(monthDone, monthTasks.length)*100)}% done`} />}
          />

          <div className="cal-nav">
            <span className="cal-m">{MON[m]} {y}</span>
            <button className="btn" onClick={() => jump(-1)}>←</button>
            <button className="btn on" onClick={() => setCursor(today)}>Today</button>
            <button className="btn" onClick={() => jump(1)}>→</button>
          </div>

          <div className="cal" style={{ marginBottom: 8 }}>
            {DOW.map(d => <div className="cal-hd" key={d}>{d}</div>)}
          </div>
          <div className="cal">
            {cells.map((d,i) => {
              if (!d) return <div key={i} className="cd out" />;
              const ds = isoLocal(d);
              const ts = tasksFor(ds);
              const dn = ts.filter(t => done[t.id]).length;
              const ev = EVENTS.some(e => e.d === ds && (e.type === 'deadline' || e.type === 'exam'));
              const trks = [...new Set(ts.map(t => t.track))];
              return (
                <div key={i} className={'cd' + (ds === today ? ' today' : '') + (ev ? ' ev' : '')}
                  onClick={() => { setCursor(ds); setView('today'); }}>
                  {dn > 0 && <div className="cd-fill" style={{ height: `${pc(dn, ts.length)*100}%` }} />}
                  <div className="cd-hd">
                    <span className="cd-n">{d.getDate()}</span>
                    {ds === today && <span className="cd-now">now</span>}
                  </div>
                  {ts.length > 0 && <div className="cd-c">{dn}/{ts.length}</div>}
                  <div className="cd-b">
                    {trks.slice(0,6).map(t => <i key={t} style={{ background: `var(--${t})` }} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="leg">
            {Object.entries(TRACKS).map(([k,v]) => (
              <span key={k}><i style={{ background: `var(--${k})` }} />{v}</span>
            ))}
            <span><i style={{ background: 'var(--hot)' }} />deadline or exam</span>
          </div>

          <Slip title="Fixed dates this month" big>
            {EVENTS.filter(e => e.d.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).map((e,i) => (
              <div className="row" key={i}>
                <span className="pill">{fmt(e.d)}</span>
                <div className="row-m">
                  <div className="row-t">{e.t}</div>
                  {e.why && <div className="row-s">{e.why}</div>}
                </div>
                {e.u && <a className="btn go row-a" href={e.u} target="_blank" rel="noreferrer">Open</a>}
              </div>
            ))}
            {!EVENTS.some(e => e.d.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)) &&
              <div className="lede" style={{ marginTop: 0 }}>Nothing fixed this month. The month is yours.</div>}
          </Slip>
        </>);
      })()}

      {/* ---------------- week ---------------- */}
      {view === 'week' && (() => {
        const wt = weekDays.flatMap(d => tasksFor(d));
        const wd = wt.filter(t => done[t.id]).length;
        return (
        <>
          <Counter
            eyebrow="Seven days"
            title="This week"
            lede="A week is the unit that actually decides whether this works. Seven small bowls, not one big one."
            tally={[{ v: wd, of: wt.length, k: 'tasks this week' }]}
            right={<Bowl pct={pc(wd, wt.length)} size={220} heat={wd > 0} caption="This week" sub={`${wd} of ${wt.length}`} />}
          />

          <div className="weekrail">
            {weekDays.map(d => {
              const ts = tasksFor(d);
              const dn = ts.filter(t => done[t.id]).length;
              return (
                <button key={d} className={'wday' + (d === today ? ' today' : '')}
                  onClick={() => { setCursor(d); setView('today'); }}>
                  <div className="wday-n">{DOW[parse(d).getDay()]}</div>
                  <div className="wday-d">{parse(d).getDate()}</div>
                  <Cup pct={pc(dn, ts.length)} size={38} c="var(--broth)" />
                  <div className="wday-p">{dn}/{ts.length}</div>
                </button>
              );
            })}
          </div>

          {weekDays.map(d => {
            const ts = tasksFor(d).filter(t => t.track === 'dsa' || t.track === 'contest');
            if (!ts.length) return null;
            return (
              <Slip key={d} title={fmt(d)} big value={d === today ? 'today' : undefined}>
                <div className="chits">
                  {ts.map(t => (
                    <Ticket key={t.id} t={t} done={!!done[t.id]} onToggle={() => toggle(t.id)} />
                  ))}
                </div>
              </Slip>
            );
          })}
        </>);
      })()}

      {/* ---------------- plan ---------------- */}
      {view === 'plan' && (
        <>
          <Counter
            eyebrow="The recipe"
            title="Five phases"
            lede="The plan is not one long grind. It is five separate dishes, each with its own heat and its own point."
            right={<Bowl pct={pc(elapsed, SCHEDULE.length)} size={210} heat
              caption={`Phase ${Math.max(1, PHASES.filter(p => today >= p.start).length)}`} sub="of five" />}
          />

          <div className="spread">
            {PHASES.map((p, i) => {
              const on = today >= p.start && today <= p.end;
              const past = today > p.end;
              return (
                <div className="slip" key={p.name} style={{ opacity: past ? .62 : 1 }}>
                  <div className="slip-h">
                    <span className="slip-t">Phase {i+1}</span>
                    {on && <span className="pill now" style={{ marginLeft: 'auto' }}>simmering now</span>}
                    {past && <span className="pill" style={{ marginLeft: 'auto' }}>served</span>}
                  </div>
                  <div className="recipe-n" style={{ fontSize: 20, marginBottom: 6 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
                    {fmt(p.start)} → {fmt(p.end)} · {p.pd} problems a day
                  </div>
                  <div className="lede" style={{ marginTop: 0, fontSize: 13.5 }}>{p.note}</div>
                </div>
              );
            })}
          </div>

          <div className="note good">
            <b>If you protect nothing else, protect December.</b> Five weeks with nothing else scheduled,
            roughly 150 free hours, arriving exactly when you have four months of foundation behind you.
            That is where the rating actually moves.
          </div>

          <h2 style={{ fontSize: 26, margin: '28px 0 4px' }}>DSA blocks, in order</h2>
          <Rule />
          <div className="spread" style={{ marginTop: 14 }}>
            {BLOCKS.map(b => {
              const s = b.problems.filter(p => done['p-' + p.n]).length;
              return (
                <div className="slip" key={b.id}>
                  <div className="recipe-n" style={{ fontSize: 19, marginBottom: 6 }}>{b.name}</div>
                  <div className="lede" style={{ marginTop: 0, fontSize: 13.5, marginBottom: 12 }}>{b.why}</div>
                  <Ladder name="solved" done={s} total={b.problems.length} c="var(--dsa)" />
                  {b.videos.map((v,i) => (
                    <div className="row" key={i}>
                      <div className="row-m">
                        <div className="row-t">{v.t}</div>
                        {v.note && <div className="row-s">{v.note}</div>}
                      </div>
                      <a className="btn go row-a" href={v.u} target="_blank" rel="noreferrer">Watch</a>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------- tracks ---------------- */}
      {view === 'tracks' && (
        <>
          <Counter
            eyebrow="Side dishes"
            title="All tracks"
            lede="DSA is the stock. These are everything else going into the pot alongside it."
            tally={[
              { v: solved, of: ALL_PROBLEMS.length, k: 'problems' },
              { v: contestsDone, k: 'contests' },
              { v: lldDone, of: LLD.units.length, k: 'design units' },
              { v: aiDone, of: AI.units.length, k: 'AI units' },
            ]}
            right={
              <div style={{ display: 'flex', gap: 12 }}>
                <Cup pct={pc(solved, ALL_PROBLEMS.length)} size={78} c="var(--dsa)" label="DSA"
                  value={`${solved}`} />
                <Cup pct={pc(lldDone, LLD.units.length)} size={78} c="var(--lld)" label="Design"
                  value={`${lldDone}`} />
                <Cup pct={pc(aiDone, AI.units.length)} size={78} c="var(--ai)" label="AI/ML"
                  value={`${aiDone}`} />
              </div>
            }
          />

          {[{ k:'lld', d:LLD, n:'System design', c:'var(--lld)' }, { k:'ai', d:AI, n:'AI / ML', c:'var(--ai)' }].map(({k,d,n,c}) => {
            const dn = d.units.filter((u,i) => done[`${k}-${i+1}`]).length;
            return (
              <div className="recipe" key={k} style={{ '--sc': c }}>
                <div className="recipe-h">
                  <div className="recipe-id">{k === 'lld' ? 'LLD' : 'AI'}</div>
                  <div className="recipe-m">
                    <div className="recipe-n">{n}</div>
                    <div className="recipe-s">{dn} of {d.units.length} units done</div>
                  </div>
                  <Cup pct={pc(dn, d.units.length)} size={54} c={c} />
                </div>
                <div className="lede" style={{ marginTop: 0, marginBottom: 12 }}>{d.why}</div>
                {d.coursera && <div className="note"><b>Coursera financial aid:</b> {d.coursera}</div>}
                <Noodle pct={pc(dn, d.units.length)} c={c} />
                <div style={{ marginTop: 10 }}>
                  {d.units.map((u,i) => {
                    const id = `${k}-${i+1}`;
                    return (
                      <div className="row" key={i}>
                        <button onClick={() => toggle(id)} style={{ padding: 0, marginTop: 1 }}
                          aria-label={done[id] ? 'Not done yet' : 'Mark done'}>
                          <Tick on={!!done[id]} c={c} />
                        </button>
                        <div className="row-m">
                          <div className="row-t" style={{ opacity: done[id] ? .55 : 1 }}>{u.t}</div>
                          {u.note && <div className="row-s">{u.note}</div>}
                        </div>
                        <a className="btn row-a" href={u.u} target="_blank" rel="noreferrer">{u.kind}</a>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ---------------- labs ---------------- */}
      {view === 'labs' && (() => {
        const weekOf = (i) => { const d = parse(LAB_START); d.setDate(d.getDate() + i*7); return d; };
        const maxExp = Math.max(...LAB_ORDER.map(k => LABS[k].exps.length));
        const curWeek = Math.max(0, Math.floor((parse(today) - parse(LAB_START)) / (7*86400000)));
        const labDone = LAB_ORDER.reduce((a,k) => a + LABS[k].exps.filter((_,i) => done[`lab-${k}-${i}`]).length, 0);
        const labTotal = LAB_ORDER.reduce((a,k) => a + LABS[k].exps.length, 0);
        return (
        <>
          <Counter
            eyebrow="One experiment per subject per week"
            title="Labs & viva"
            lede={`Labs start ${fmt(LAB_START)}. Viva is asked in the lab itself and carries ISE marks — the questions listed here are the ones they actually ask.`}
            tally={[
              { v: labDone, of: labTotal, k: 'experiments done' },
              { v: curWeek + 1, k: 'current week' },
            ]}
            right={<Bowl pct={pc(labDone, labTotal)} size={210} heat={labDone > 0}
              garnish={LAB_ORDER.filter(k => LABS[k].exps.some((_,i) => done[`lab-${k}-${i}`])).map(k => ({ kind:'dice', c:LABS[k].color }))}
              caption="Lab marks" sub={`${labDone} of ${labTotal}`} />}
          />

          <div className="note good">
            <b>Why this matters more than it looks.</b> Lab ISE is 25 marks per subject and 26 for CE303 —
            the heaviest single component outside the mini project, and the easiest to score full marks on.
            Turn up, submit a working experiment, answer three viva questions. Prepare the viva answers the
            night before and this is very nearly free marks toward a 9-plus pointer.
          </div>

          <Slip title="Progress by subject" big value={`Week ${curWeek+1}`}>
            {LAB_ORDER.map(k => {
              const L = LABS[k];
              return <Ladder key={k} name={`${k} — ${L.name}`}
                done={L.exps.filter((_,i) => done[`lab-${k}-${i}`]).length}
                total={L.exps.length} c={L.color} />;
            })}
          </Slip>

          {Array.from({length: maxExp}).map((_,w) => {
            const isNow = w === curWeek;
            return (
              <div className="slip" key={w} style={isNow ? { borderWidth: 3 } : { opacity: w < curWeek ? .75 : 1 }}>
                {isNow && <i className="tape r" />}
                <div className="slip-h">
                  <span className="slip-t big">Week {w+1}</span>
                  <span className="slip-t">from {fmt(isoLocal(weekOf(w)))}</span>
                  {isNow && <span className="pill now" style={{ marginLeft: 'auto' }}>this week</span>}
                </div>
                {LAB_ORDER.map(k => {
                  const L = LABS[k]; const e = L.exps[w]; if (!e) return null;
                  const id = `lab-${k}-${w}`; const dn = !!done[id];
                  return (
                    <div className="row" key={k}>
                      <button onClick={() => toggle(id)} style={{ padding: 0, marginTop: 1 }}
                        aria-label={dn ? 'Not done yet' : 'Mark done'}>
                        <Tick on={dn} c={L.color} />
                      </button>
                      <div className="row-m">
                        <div className="row-t" style={{ opacity: dn ? .55 : 1 }}>
                          <span className="pill" style={{ marginRight: 8, borderColor: L.color, color: L.color }}>{k}</span>
                          {e.t}
                        </div>
                        <div className="row-s" style={{ marginTop: 6 }}>
                          <b style={{ color: 'var(--ink)' }}>Viva:</b> {e.viva}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>);
      })()}

      {/* ---------------- subjects ---------------- */}
      {view === 'subjects' && (
        <>
          <Counter
            eyebrow="Where the material actually comes from"
            title="Subject resources"
            lede="Verified channels per subject. The links are channel searches rather than playlist ids, so they will not rot halfway through the semester."
            right={<Bowl pct={.7} size={200} heat garnish={[{kind:'leaf',c:'var(--ai)'},{kind:'ring',c:'var(--college)'}]}
              caption="Six subjects" sub="one pantry" />}
          />

          <div className="note hot">
            <b>Read this before you start.</b> Two things are badly served by free video and you should plan
            around them now rather than in November. <b>Distributed Computing</b> has no channel that covers it
            well, so start it earliest. And four specific topics have no good video anywhere — <b>GRASP, ANFIS,
            ECC and MPI</b>. For those four, go to the textbook directly rather than losing an evening hunting
            for something that does not exist.
          </div>

          {RESOURCES.map(r => (
            <div className="recipe" key={r.code} style={{ '--sc': r.color }}>
              <div className="recipe-h">
                <div className="recipe-id">{r.code}</div>
                <div className="recipe-m">
                  <div className="recipe-n">{r.name}</div>
                  {r.summary && <div className="recipe-s" style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink2)' }}>{r.summary}</div>}
                </div>
                {r.verdict === 'solved' && <span className="pill ok">solved</span>}
                {r.verdict === 'hard' && <span className="pill hot">hardest</span>}
              </div>
              {r.picks.map((p,i) => (
                <div className="row" key={i}>
                  <span className="pill">{p.tag}</span>
                  <div className="row-m">
                    <div className="row-t">{p.t}</div>
                    <div className="row-s">{p.note}</div>
                  </div>
                  <a className="btn go row-a" href={p.u} target="_blank" rel="noreferrer">Open</a>
                </div>
              ))}
              {r.gaps && <div className="note hot" style={{ marginTop: 14, marginBottom: 0 }}><b>Gap:</b> {r.gaps}</div>}
            </div>
          ))}
        </>
      )}

      {/* ---------------- academics ---------------- */}
      {view === 'academics' && (() => {
        // Three passes per module: studied once, revised at +7 and +21 days.
        const passOf = (id) => id.startsWith('rev21-') ? 3 : id.startsWith('rev7-') ? 2 : 1;
        const stat = {};
        SCHEDULE.forEach(d => d.tasks.forEach(t => {
          const m = t.id.match(/^(?:rev\d+-)?st-([A-Z0-9]+)-(\d+)-\d+$/);
          if (!m) return;
          const k = `${m[1]}-${m[2]}`;
          stat[k] = stat[k] || { 1:[0,0], 2:[0,0], 3:[0,0] };
          const p = passOf(t.id);
          stat[k][p][1]++;
          if (done[t.id]) stat[k][p][0]++;
        }));
        const totalSec = SUBJECT_ORDER.reduce((a,c) => a + ACADEMICS[c].seconds, 0);
        const allDone = Object.values(stat).reduce((a,s) => a + s[1][0]+s[2][0]+s[3][0], 0);
        const allTot  = Object.values(stat).reduce((a,s) => a + s[1][1]+s[2][1]+s[3][1], 0);
        return (
        <>
          <Counter
            eyebrow="Target: ten pointer"
            title="Academics"
            lede={`Six subjects, ${Object.keys(stat).length} modules, ${hm(totalSec)} of verified lecture video. Every module is scheduled three times — studied once, then revised after one week and again after three.`}
            tally={[
              { v: allDone, of: allTot, k: 'study sessions done' },
              { v: `${Math.round(pc(allDone, allTot)*100)}%`, k: 'of the semester' },
            ]}
            right={<Bowl pct={pc(allDone, allTot)} size={260} heat={allDone > 0}
              garnish={SUBJECT_ORDER.filter(c => {
                const mods = ACADEMICS[c].modules;
                return mods.some(m => (stat[`${c}-${m.m}`] || {1:[0,0]})[1][0] > 0);
              }).map(c => ({ kind:'ring', c: ACADEMICS[c].color }))}
              caption="Marks in the pot" sub={`${allDone} of ${allTot}`} />}
          />

          <div className="note good">
            <b>Why this replaced speedrunning YouTube the night before.</b> Cramming works for recall the next
            morning and fails at everything after that, which is why your grades never matched how quickly you
            actually pick things up. Spacing the same material across three passes three weeks apart is the
            single best-evidenced study intervention there is. The passes are already on the calendar, so the
            decision is never "what should I revise today" — it is only whether you open the app.
          </div>

          {SUBJECT_ORDER.map(code => {
            const s = ACADEMICS[code];
            const mods = s.modules;
            const EMPTY = { 1:[0,0], 2:[0,0], 3:[0,0] };
            const dn = mods.reduce((a,m) => { const x = stat[`${code}-${m.m}`] || EMPTY; return a + x[1][0]+x[2][0]+x[3][0]; }, 0);
            const tt = mods.reduce((a,m) => { const x = stat[`${code}-${m.m}`] || EMPTY; return a + x[1][1]+x[2][1]+x[3][1]; }, 0);
            return (
              <div className="recipe" key={code} style={{ '--sc': s.color }}>
                <div className="recipe-h">
                  <div className="recipe-id">{code}</div>
                  <div className="recipe-m">
                    <div className="recipe-n">{s.name}</div>
                    <div className="recipe-s">{mods.length} modules · {hm(s.seconds)} of video · {s.channel}</div>
                  </div>
                  <Cup pct={pc(dn, tt)} size={58} c={s.color} value={`${Math.round(pc(dn,tt)*100)}%`} />
                </div>
                {s.gap && <div className="note hot"><b>Source gap:</b> {s.gap}</div>}
                {s.note && <div className="note">{s.note}</div>}
                <div className="mods">
                  {mods.map(m => {
                    const key = code + '-' + m.m;
                    const st = stat[key] || { 1:[0,0], 2:[0,0], 3:[0,0] };
                    const isOpen = openMod === key;
                    return (
                      <div className={'mod' + (isOpen ? ' open' : '')} key={m.m}>
                        <button className="mod-h" onClick={() => setOpenMod(o => o === key ? null : key)}>
                          <span className="mod-n">M{m.m}</span>
                          <span className="mod-t">{m.name}</span>
                          <span className="mod-d">{hm(m.seconds)}</span>
                          <span className="mod-cv">{isOpen ? '–' : '+'}</span>
                        </button>
                        {m.topics && <div className="mod-tp">{m.topics}</div>}
                        <div className="passes">
                          {[1,2,3].map(p => {
                            const [d0,t0] = st[p];
                            const full = t0 && d0 === t0;
                            const ids = modTaskIds(code, m.m, p);
                            return (
                              <button key={p} className={'pass' + (full ? ' full' : '')}
                                onClick={() => { const mark = !full; ids.forEach(id => { if (!!done[id] !== mark) toggle(id); }); }}
                                title={full ? 'Click to unmark this pass' : `Mark pass ${p} done (${d0}/${t0} sessions)`}>
                                <span className="pass-l">{p === 1 ? 'Learn' : p === 2 ? '+1 wk' : '+3 wk'}</span>
                                <Noodle pct={pc(d0, t0)} c={s.color} thick={4} h={9} w={120} />
                              </button>
                            );
                          })}
                        </div>
                        {isOpen && (
                          <ol className="mod-vids">
                            {(m.sessions || []).flatMap(ss => ss.items || []).map((v, i) => (
                              <li key={i}>
                                <a href={v.url} target="_blank" rel="noreferrer">
                                  <span className="mv-n">{i + 1}</span>
                                  <span className="mv-t">{v.title}</span>
                                  <span className="mv-m">{v.m}m</span>
                                </a>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>);
      })()}

      {/* ---------------- grades ---------------- */}
      {view === 'grades' && (
        <>
          <Counter
            eyebrow="Target: 9.0 or better"
            title="Grades"
            lede="Where the marks actually are this semester, and the order to go after them in."
            right={<Bowl pct={.4} size={210} heat garnish={[{kind:'corn',c:'var(--college)'}]}
              caption="900 marks" sub="400 of them continuous" />}
          />

          <div className="note good">
            <b>The good news: 9-plus is very winnable this semester</b> — because 400 of your roughly 900 marks
            are continuous assessment through PR1 and M132 rather than exams. Those are the easiest marks on the
            board to score high on, and they are decided between August and October, not in November.
          </div>
          <div className="note hot">
            <b>The tension you need to know about.</b> A 9-plus pointer and heavy bunking are in direct conflict.
            ISE marks, 15 to 26 per subject, are partly driven by attendance and participation, and lab ISE is
            graded by people who notice who shows up. The bunk budget still exists — but spend it almost entirely
            on CE304 theory, and treat every lab and every studio as non-negotiable.
          </div>

          <div className="spread">
            {COLLEGE.subjects.map(s => (
              <div className="slip" key={s.code}>
                <div className="slip-h">
                  <span className="slip-t big">{s.code}</span>
                  <span className="pill ok" style={{ marginLeft: 'auto' }}>{s.marks} marks</span>
                </div>
                <div className="recipe-n" style={{ fontSize: 17, marginBottom: 8 }}>{s.name}</div>
                <div className="lede" style={{ marginTop: 0, fontSize: 13.5 }}>{s.note}</div>
              </div>
            ))}
          </div>

          <Slip title="How to actually get 9-plus" big tape>
            {[
              ['Max out PR1 and M132 first', '400 marks, continuous, no exam. Consistent submission beats brilliance here. This alone moves your pointer more than any exam performance will.'],
              ['Never miss a lab', 'CE303 lab ISE is 26 marks, the heaviest single component. Labs are near-free marks for turning up plus a working submission.'],
              ['Treat mid-terms as 15 to 20 marks each', '7 to 11 September. Worth two focused days per subject beforehand, not a week. The returns fall off sharply past that.'],
              ['Hunt the self-study modules early', 'CE301, CE302, CE303 and CE305 each have a module excluded from lectures but still examinable. Find them in week 10, not week 16.'],
              ['CE304 is pure exam', 'No lab and no ISE cushion — it is 100% theory. Sipser plus two focused weekends. This is the one subject where cramming genuinely works.'],
            ].map(([t, s], i) => (
              <div className="row" key={i}>
                <span className="pill">{i+1}</span>
                <div className="row-m">
                  <div className="row-t">{t}</div>
                  <div className="row-s">{s}</div>
                </div>
              </div>
            ))}
          </Slip>
        </>
      )}

      {/* ---------------- deadlines ---------------- */}
      {view === 'deadlines' && (
        <>
          <Counter
            eyebrow="Time-critical"
            title="Deadlines"
            lede="Everything with a date attached that you cannot move. Sorted by how soon it burns."
            tally={[
              nextDeadline && { v: daysBetween(today, nextDeadline.d), k: 'days to the next one' },
              { v: upcoming.length, k: 'coming up' },
            ]}
            right={<Bowl pct={.85} size={200} heat caption="On the heat" sub="do not walk away" />}
          />

          <div className="spread">
            {upcoming.map((e,i) => {
              const dd = daysBetween(today, e.d);
              const hot = dd <= 14 && e.type === 'deadline';
              return (
                <div className="slip" key={i} style={hot ? { borderWidth: 3 } : undefined}>
                  {hot && <i className="tape" />}
                  <div className="slip-h">
                    <span className={'pill' + (hot ? ' hot' : '')}>{dd === 0 ? 'today' : `${dd} days`}</span>
                    <span className="slip-t">{fmt(e.d)}</span>
                  </div>
                  <div className="recipe-n" style={{ fontSize: 19, marginBottom: 8 }}>{e.t}</div>
                  {e.why && <div className="lede" style={{ marginTop: 0, fontSize: 13.5 }}>{e.why}</div>}
                  {e.u && <div style={{ marginTop: 12 }}>
                    <a className="btn go" href={e.u} target="_blank" rel="noreferrer">Open →</a>
                  </div>}
                </div>
              );
            })}
          </div>
          {!upcoming.length && <Empty line="Nothing left on the clock." />}
        </>
      )}
    </div>
  );
}
