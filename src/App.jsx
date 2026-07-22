import React, { useState, useEffect, useMemo } from 'react';
import { SCHEDULE, BLOCKS, ALL_PROBLEMS, LLD, AI, EVENTS, PHASES, parse, ACADEMICS, SUBJECT_ORDER } from './data/schedule.js';
import { COLLEGE } from './data/tracks.js';
import { LABS, LAB_ORDER, LAB_START } from './data/labs.js';
import * as Sync from './sync.js';
import { RESOURCES, CHANNEL_VERDICTS } from './data/resources.js';

const TRACKS = {
  dsa: 'DSA', contest: 'Contest', lld: 'System Design', ai: 'AI/ML',
  college: 'College', admin: 'Admin', content: 'Content',
};
const ACCENTS = [
  { id:'blue',   n:'Blue',   l:'#0F62FE', l2:'#0043CE', lw:'#E3ECFF', d:'#4589FF', d2:'#78A9FF', dw:'#12203D' },
  { id:'violet', n:'Violet', l:'#6929C4', l2:'#491D8B', lw:'#EDE5FF', d:'#A56EFF', d2:'#BE95FF', dw:'#1F1533' },
  { id:'amber',  n:'Amber',  l:'#B26800', l2:'#8A5000', lw:'#FFF3DC', d:'#F1A340', d2:'#FFC46B', dw:'#2E2007' },
  { id:'rose',   n:'Rose',   l:'#C2185B', l2:'#96114A', lw:'#FFE4EE', d:'#FF7EB6', d2:'#FFAFD2', dw:'#33111F' },
  { id:'teal',   n:'Teal',   l:'#00A896', l2:'#007F72', lw:'#DEF3F0', d:'#2DD4C4', d2:'#5EEAD9', dw:'#0F2C29' },
  { id:'slate',  n:'Slate',  l:'#3D4E5C', l2:'#28353F', lw:'#E7EDF2', d:'#93AABF', d2:'#B6C8D8', dw:'#1A222A' },
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

function useStore(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}

function Ring({ pct, size = 64 }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--card2)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ac)" strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </svg>
      <div className="ring-t">{Math.round(pct * 100)}%</div>
    </div>
  );
}

function Task({ t, done, onToggle, onPush }) {
  const [open, setOpen] = useState(false);
  const vids = t.videos || [];
  const total = vids.reduce((a, v) => a + v.m, 0);
  return (
    <div className={'task k-edge-' + t.track + (done ? ' done' : '')}>
      <button className="cb" onClick={onToggle} aria-label={done ? 'Mark undone' : 'Mark done'}>✓</button>
      <div className="tbody">
        <div className="ttitle">{t.title}</div>
        {t.meta && <div className="tmeta">{t.meta}</div>}

        {vids.length > 0 && (
          <div className="vids">
            <button className={'vids-h' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)}>
              <span className="chev">›</span>
              {vids.length === 1 ? '1 video' : `${vids.length} videos`} · {total} min total
            </button>
            {open && (
              <ol className="vlist">
                {vids.map((v, i) => (
                  <li key={i}>
                    <a href={v.u} target="_blank" rel="noreferrer">
                      <span className="vn">{i + 1}</span>
                      <span className="vt">{v.t}</span>
                      <span className="vm">{v.m}m</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {t.why && <div className="twhy">{t.why}</div>}
        <div className="tactions">
          {t.url && <a className="btn go" href={t.url} target="_blank" rel="noreferrer">
            {vids.length ? 'Start watching →' : 'Open →'}
          </a>}
          {!done && onPush && <button className="btn" onClick={onPush}>Push to tomorrow</button>}
        </div>
      </div>
    </div>
  );
}


function Donut({ pct, label, color, size = 74 }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  return (
    <div className="donut">
      <div className="donut-w" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--card2)" strokeWidth="6" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)' }} />
        </svg>
        <div className="donut-c">{Math.round(pct * 100)}%</div>
      </div>
      <div className="donut-l">{label}</div>
    </div>
  );
}

function SBar({ name, done, total, color }) {
  const p = total ? done / total : 0;
  return (
    <div className="sbar">
      <div className="sbar-h"><span className="sbar-n">{name}</span><span className="sbar-v">{done}/{total}</span></div>
      <div className="sbar-t"><i style={{ width: `${p*100}%`, background: color }} /></div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useStore('theme', null);
  const [done, setDone] = useStore('done', {});
  const [pushed, setPushed] = useStore('pushed', {});
  const [view, setView] = useState('today');
  const [accent, setAccent] = useStore('accent', 'blue');
  const [sync, setSync] = useState('connecting');
  const [opps, setOpps] = useState([]);
  const [openRow, setOpenRow] = useState(null);

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
        setOpps(r.opportunities || []);
        setSync('ok');
      } catch { if (live) setSync('offline'); }
    })();
    return () => { live = false; };
  }, []);
  const [popOpen, setPopOpen] = useState(false);
  const [cursor, setCursor] = useState(todayISO());

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-t', theme);
    else document.documentElement.removeAttribute('data-t');
  }, [theme]);

  useEffect(() => {
    const A = ACCENTS.find(a => a.id === accent) || ACCENTS[0];
    const dark = (theme === 'dark') || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const r = document.documentElement.style;
    r.setProperty('--accent-c', dark ? A.d : A.l);
    r.setProperty('--accent-c2', dark ? A.d2 : A.l2);
    r.setProperty('--accent-cw', dark ? A.dw : A.lw);
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
  const active = tasks.filter(t => t.weight !== 0 || true);
  const doneCount = active.filter(t => done[t.id]).length;
  const pct = active.length ? doneCount / active.length : 0;

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

  const upcoming = EVENTS.filter(e => e.d >= today).slice(0, 8);
  const nextDeadline = EVENTS.find(e => e.d >= today && e.type === 'deadline');

  const shift = (n) => {
    const d = new Date(parse(cursor)); d.setDate(d.getDate() + n);
    setCursor(isoLocal(d));
  };

  const weekDays = useMemo(() => {
    const d = parse(cursor); const out = [];
    const start = new Date(d); start.setDate(d.getDate() - d.getDay());
    for (let i = 0; i < 7; i++) { const x = new Date(start); x.setDate(start.getDate()+i); out.push(isoLocal(x)); }
    return out;
  }, [cursor]);

  return (
    <div className="app">
      <div className="top">
        <div className="top-in">
          <span className="brand">Campaign · Sem V</span>
          <span className={'synced s-' + sync} title={
            sync==='ok' ? 'Synced — progress shared across laptop, phone and the Mac app'
            : sync==='offline' ? 'Offline — changes saved locally, will not sync until reconnected'
            : 'Connecting…'} />
          <button className="icon-btn" onClick={() => setPopOpen(o => !o)} title="Appearance">◍</button>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">◐</button>
          {popOpen && (
            <div className="pop">
              <h4>Accent</h4>
              <div className="acc" style={{marginBottom:14}}>
                {ACCENTS.map(a => (
                  <button key={a.id} onClick={() => setAccent(a.id)} aria-pressed={accent===a.id}
                    title={a.n} style={{ background: a.l }} />
                ))}
              </div>
              <h4>Theme</h4>
              <div style={{display:'flex',gap:6}}>
                {[['light','Light'],['dark','Dark'],[null,'System']].map(([v,n]) => (
                  <button key={n} className="btn" onClick={() => setTheme(v)}
                    style={{background: theme===v ? 'var(--ac)' : '', color: theme===v ? '#fff' : ''}}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="top-in tabs" style={{ marginTop: 8 }}>
          {['today','academics','overview','calendar','week','plan','tracks','labs','subjects','grades','deadlines'].map(v => (
            <button key={v} className={'tab' + (view === v ? ' on' : '')} onClick={() => { setView(v); if (v==='today') setCursor(today); }}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === 'today' && day && (
        <>
          <div className="hero">
            <div className="hero-date">{cursor === today ? 'Today' : fmt(cursor)} · {day.phase}</div>
            <h1>{doneCount} of {active.length} done</h1>
            <div className="hero-sub">{day.phaseNote}</div>
          </div>

          <div className="ringwrap">
            <Ring pct={pct} />
            <div className="ringinfo">
              <b>{streak > 0 ? `${streak}-day DSA streak` : 'Streak broken — restart today'}</b>
              <span>{solved} of {ALL_PROBLEMS.length} problems · {contestsDone} contests
                {nextDeadline && ` · ${daysBetween(today, nextDeadline.d)}d to next deadline`}</span>
            </div>
          </div>

          {cursor !== today && (
            <div className="note w" style={{ marginBottom: 12 }}>
              Viewing {fmt(cursor)}. <button className="btn" style={{ marginLeft: 6 }} onClick={() => setCursor(today)}>Back to today</button>
            </div>
          )}

          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            <button className="btn" onClick={() => shift(-1)}>← Prev</button>
            <button className="btn" onClick={() => shift(1)}>Next →</button>
          </div>

          <div className="shell">
            <div>
              {Object.keys(TRACKS).map(k => {
                const ts = tasks.filter(t => t.track === k);
                if (!ts.length) return null;
                return (
                  <div className="group" key={k}>
                    <div className="group-h"><span className={'dot k-' + k} style={{ marginTop:0 }} />{TRACKS[k]}</div>
                    <div className="taskgrid">
                      {ts.map(t => (
                        <Task key={t.id} t={t} done={!!done[t.id]} onToggle={() => toggle(t.id)} onPush={() => push(t.id)} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {!tasks.length && <div className="empty">Nothing scheduled. Rest day.</div>}
            </div>
            <div className="side">
              <div className="panel">
                <div className="panel-h"><span className="panel-t">Tracks</span></div>
                <div className="donuts">
                  <Donut pct={solved/ALL_PROBLEMS.length} label="DSA" color="var(--dsa)" />
                  <Donut pct={lldDone/LLD.units.length} label="Sys Design" color="var(--lld)" />
                  <Donut pct={aiDone/AI.units.length} label="AI/ML" color="var(--ai)" />
                </div>
              </div>
              <div className="panel">
                <div className="panel-h"><span className="panel-t">Next up</span></div>
                <div className="rail">
                  {upcoming.slice(0,5).map((e,i) => (
                    <div className="rl" key={i}>
                      <span className={'rl-d' + (daysBetween(today, e.d) <= 7 ? ' on' : '')} />
                      <div className="rl-m">
                        <div className="rl-t">{e.t.length > 46 ? e.t.slice(0,44)+'…' : e.t}</div>
                        <div className="rl-s">{daysBetween(today, e.d)}d · {fmt(e.d)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}


      {view === 'overview' && (() => {
        const totalTasks = SCHEDULE.reduce((a,d)=>a+d.tasks.length,0);
        const doneTasks = Object.values(done).filter(Boolean).length;
        const elapsed = SCHEDULE.filter(d=>d.date<=today).length;
        const heat = SCHEDULE.map(d=>{
          const ts=d.tasks.filter(t=>t.track==='dsa');
          const dn=ts.filter(t=>done[t.id]).length;
          return {date:d.date,p:ts.length?dn/ts.length:0,past:d.date<today};
        });
        return (
        <>
          <div className="hero"><div className="hero-date">Everything at once</div><h1>Overview</h1>
            <div className="hero-sub">What you are preparing for, and how far along it is.</div></div>

          <div className="ovgrid">
            <div className="panel"><div className="panel-t">Problems solved</div>
              <div className="big" style={{marginTop:8}}>{solved}<small> / {ALL_PROBLEMS.length}</small></div>
              <div className="sbar-t" style={{marginTop:10}}><i style={{width:`${(solved/ALL_PROBLEMS.length)*100}%`,background:'var(--dsa)'}}/></div>
              <div className="sub">Target ~300 by January, solved properly and logged. You started at 33.</div></div>
            <div className="panel"><div className="panel-t">Day</div>
              <div className="big" style={{marginTop:8}}>{elapsed}<small> / {SCHEDULE.length}</small></div>
              <div className="sbar-t" style={{marginTop:10}}><i style={{width:`${(elapsed/SCHEDULE.length)*100}%`,background:'var(--ac)'}}/></div>
              <div className="sub">22 Jul 2026 → 4 Jan 2027. Ends right before even semester starts.</div></div>
            <div className="panel"><div className="panel-t">Streak</div>
              <div className="big" style={{marginTop:8}}>{streak}<small> days</small></div>
              <div className="sub" style={{marginTop:12}}>{streak>0?'Keep it alive. One problem counts.':'The floor is one problem a day. That is the whole rule.'}</div></div>
            <div className="panel"><div className="panel-t">All tasks</div>
              <div className="big" style={{marginTop:8}}>{doneTasks}<small> / {totalTasks}</small></div>
              <div className="sbar-t" style={{marginTop:10}}><i style={{width:`${(doneTasks/totalTasks)*100}%`,background:'var(--contest)'}}/></div>
              <div className="sub">Across DSA, contests, system design, AI, college and admin.</div></div>
          </div>

          <div className="shell">
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="panel">
                <div className="panel-h"><span className="panel-t">DSA blocks</span><span className="panel-v">{BLOCKS.filter(b=>b.problems.every(p=>done['p-'+p.n])).length}/{BLOCKS.length} complete</span></div>
                {BLOCKS.map(b=>(<SBar key={b.id} name={b.name} done={b.problems.filter(p=>done['p-'+p.n]).length} total={b.problems.length} color="var(--dsa)" />))}
              </div>
              <div className="panel">
                <div className="panel-h"><span className="panel-t">Consistency — every day of the plan</span></div>
                <div className="heat">
                  {heat.map(h=>(<div key={h.date} className="hc" title={`${h.date} — ${Math.round(h.p*100)}%`}
                    style={{background:h.p>0?`color-mix(in srgb, var(--dsa) ${20+h.p*80}%, var(--card2))`:(h.past?'var(--wnw)':'var(--card2)')}} />))}
                </div>
                <div className="heat-k"><i style={{background:'var(--card2)'}}/>upcoming<i style={{background:'var(--wnw)'}}/>missed<i style={{background:'var(--dsa)'}}/>done</div>
              </div>
            </div>
            <div className="side">
              <div className="panel">
                <div className="panel-h"><span className="panel-t">Other tracks</span></div>
                <SBar name="System Design (LLD)" done={lldDone} total={LLD.units.length} color="var(--lld)" />
                <SBar name="AI / ML" done={aiDone} total={AI.units.length} color="var(--ai)" />
                <SBar name="Contests entered" done={contestsDone} total={40} color="var(--contest)" />
              </div>
              <div className="panel">
                <div className="panel-h"><span className="panel-t">What this is for</span></div>
                <div className="sub" style={{marginTop:0}}>
                  <b style={{color:'var(--tx)'}}>Dec 2026:</b> Codeforces Specialist (1400).<br/>
                  <b style={{color:'var(--tx)'}}>Jan 2027:</b> Expert (1600) if December goes well.<br/>
                  <b style={{color:'var(--tx)'}}>Graduation:</b> Candidate Master (1900) — top 2.7%, and the rating where quant firms read a non-IIT resume.<br/><br/>
                  <b style={{color:'var(--tx)'}}>This sem:</b> 9+ pointer, PR1 + M132 maxed, Adobe + SIH entered, Optiver applied.
                </div>
              </div>
              <div className="panel">
                <div className="panel-h"><span className="panel-t">Phases</span></div>
                <div className="rail">
                  {PHASES.map((p,i)=>{
                    const on = today >= p.start;
                    return (<div className="rl" key={i}><span className={'rl-d'+(on?' on':'')}/>
                      <div className="rl-m"><div className="rl-t">{p.name}</div><div className="rl-s">{fmt(p.start)} → {fmt(p.end)} · {p.pd}/day</div></div></div>);
                  })}
                </div>
              </div>
            </div>
          </div>
        </>);
      })()}

      {view === 'calendar' && (() => {
        const cd = parse(cursor);
        const y = cd.getFullYear(), m = cd.getMonth();
        const first = new Date(y, m, 1), startPad = first.getDay();
        const cells = [];
        for (let i=0;i<startPad;i++) cells.push(null);
        const dim = new Date(y, m+1, 0).getDate();
        for (let i=1;i<=dim;i++) cells.push(new Date(y,m,i));
        const jump = (n)=>{ const d=new Date(y,m+n,1); setCursor(isoLocal(d)); };
        return (
        <>
          <div className="hero"><div className="hero-date">Month view</div><h1>Calendar</h1></div>
          <div className="cal-nav">
            <span className="cal-m">{MON[m]} {y}</span>
            <button className="btn" onClick={()=>jump(-1)}>←</button>
            <button className="btn" onClick={()=>setCursor(today)}>Today</button>
            <button className="btn" onClick={()=>jump(1)}>→</button>
          </div>
          <div className="cal" style={{marginBottom:6}}>
            {DOW.map(d=><div className="cal-hd" key={d}>{d}</div>)}
          </div>
          <div className="cal">
            {cells.map((d,i)=>{
              if(!d) return <div key={i} className="cd out" />;
              const ds = isoLocal(d);
              const ts = tasksFor(ds);
              const dn = ts.filter(t=>done[t.id]).length;
              const ev = EVENTS.some(e=>e.d===ds && (e.type==='deadline'||e.type==='exam'));
              const tracks=[...new Set(ts.map(t=>t.track))];
              return (
                <div key={i} className={'cd'+(ds===today?' today':'')+(ev?' ev':'')}
                     onClick={()=>{setCursor(ds);setView('today');}}>
                  <div className="cd-n">{d.getDate()}</div>
                  <div className="cd-b">{tracks.slice(0,6).map(t=><i key={t} className={'k-'+t} />)}</div>
                  {ts.length>0 && <div className="cd-f" style={{width:`${(dn/ts.length)*100}%`}} />}
                </div>
              );
            })}
          </div>
          <div className="leg">
            {Object.entries(TRACKS).map(([k,v])=>(<span key={k}><i className={'k-'+k}/>{v}</span>))}
            <span><i style={{background:'var(--wn)'}}/>deadline / exam</span>
          </div>
          <div className="panel" style={{marginTop:16}}>
            <div className="panel-h"><span className="panel-t">This month's fixed dates</span></div>
            {EVENTS.filter(e=>e.d.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).map((e,i)=>(
              <div className="row" key={i}>
                <span className="pill">{fmt(e.d)}</span>
                <div className="row-m"><div className="row-t">{e.t}</div>{e.why && <div className="row-s">{e.why}</div>}</div>
                {e.u && <a className="pill ok" href={e.u} target="_blank" rel="noreferrer">Open</a>}
              </div>
            ))}
          </div>
        </>);
      })()}
      {view === 'week' && (
        <>
          <div className="hero"><div className="hero-date">This week</div><h1>Week view</h1></div>
          <div className="week">
            {weekDays.map(d => {
              const ts = tasksFor(d);
              const dn = ts.filter(t => done[t.id]).length;
              return (
                <button key={d} className={'wd' + (d === today ? ' today' : '')} onClick={() => { setCursor(d); setView('today'); }}>
                  <div className="wd-n">{DOW[parse(d).getDay()]}</div>
                  <div className="wd-d">{parse(d).getDate()}</div>
                  <div className="wd-p">{dn}/{ts.length}</div>
                </button>
              );
            })}
          </div>
          {weekDays.map(d => {
            const ts = tasksFor(d).filter(t => t.track === 'dsa' || t.track === 'contest');
            if (!ts.length) return null;
            return (
              <div className="card" key={d}>
                <h3>{fmt(d)}</h3>
                {ts.map(t => (
                  <div className="row" key={t.id}>
                    <span className={'dot k-' + t.track} />
                    <div className="row-m">
                      <div className="row-t" style={{ textDecoration: done[t.id] ? 'line-through' : 'none', opacity: done[t.id] ? .5 : 1 }}>{t.title}</div>
                      {t.meta && <div className="row-s mono" style={{fontSize:11}}>{t.meta}</div>}
                    </div>
                    {t.url && <a className="pill ok" href={t.url} target="_blank" rel="noreferrer">Open</a>}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {view === 'plan' && (
        <>
          <div className="hero"><div className="hero-date">The whole thing</div><h1>Five phases</h1></div>
          {PHASES.map(p => (
            <div className="card" key={p.name}>
              <h3>{p.name}</h3>
              <div className="mono sm" style={{ marginBottom: 6 }}>{fmt(p.start)} → {fmt(p.end)} · {p.pd} problems/day</div>
              <p>{p.note}</p>
            </div>
          ))}
          <div className="note g">
            <b>If you protect nothing else, protect December.</b> Five weeks with nothing scheduled, ~150 free hours,
            arriving exactly when you have four months of foundation. That is where the rating actually moves.
          </div>
          <hr />
          <h3 style={{ marginBottom: 10 }}>DSA blocks in order</h3>
          {BLOCKS.map(b => {
            const s = b.problems.filter(p => done['p-' + p.n]).length;
            return (
              <div className="card" key={b.id}>
                <h3>{b.name}</h3>
                <p style={{ marginBottom: 8 }}>{b.why}</p>
                <div className="bar"><i style={{ width: `${(s/b.problems.length)*100}%`, background: 'var(--dsa)' }} /></div>
                <div className="mono sm" style={{ marginTop: 5 }}>{s}/{b.problems.length} solved</div>
                {b.videos.map((v,i) => (
                  <div className="row" key={i}>
                    <div className="row-m"><div className="row-t">{v.t}</div>{v.note && <div className="row-s">{v.note}</div>}</div>
                    <a className="pill ok" href={v.u} target="_blank" rel="noreferrer">Watch</a>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {view === 'tracks' && (
        <>
          <div className="hero"><div className="hero-date">Progress</div><h1>All tracks</h1></div>
          <div className="stats">
            <div className="stat"><dt>Problems</dt><dd>{solved}<small>/{ALL_PROBLEMS.length}</small></dd></div>
            <div className="stat"><dt>Contests</dt><dd>{contestsDone}</dd></div>
            <div className="stat"><dt>Streak</dt><dd>{streak}<small>d</small></dd></div>
            <div className="stat"><dt>System Design</dt><dd>{lldDone}<small>/{LLD.units.length}</small></dd></div>
            <div className="stat"><dt>AI/ML</dt><dd>{aiDone}<small>/{AI.units.length}</small></dd></div>
          </div>

          <div className="card">
            <h3>System Design</h3>
            <p style={{ marginBottom: 10 }}>{LLD.why}</p>
            <div className="bar"><i style={{ width: `${(lldDone/LLD.units.length)*100}%`, background:'var(--lld)' }} /></div>
            <hr />
            {LLD.units.map((u,i) => (
              <div className="row" key={i}>
                <button className="cb" style={{ background: done['lld-'+(i+1)] ? 'var(--ac)' : '', borderColor: done['lld-'+(i+1)] ? 'var(--ac)' : '', color: done['lld-'+(i+1)] ? '#fff' : 'transparent' }} onClick={() => toggle('lld-'+(i+1))}>✓</button>
                <div className="row-m"><div className="row-t">{u.t}</div>{u.note && <div className="row-s">{u.note}</div>}</div>
                <a className="pill ok" href={u.u} target="_blank" rel="noreferrer">{u.kind}</a>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>AI / ML</h3>
            <p style={{ marginBottom: 10 }}>{AI.why}</p>
            <div className="note" style={{ marginBottom: 10 }}><b>Coursera financial aid:</b> {AI.coursera}</div>
            <div className="bar"><i style={{ width: `${(aiDone/AI.units.length)*100}%`, background:'var(--ai)' }} /></div>
            <hr />
            {AI.units.map((u,i) => (
              <div className="row" key={i}>
                <button className="cb" style={{ background: done['ai-'+(i+1)] ? 'var(--ac)' : '', borderColor: done['ai-'+(i+1)] ? 'var(--ac)' : '', color: done['ai-'+(i+1)] ? '#fff' : 'transparent' }} onClick={() => toggle('ai-'+(i+1))}>✓</button>
                <div className="row-m"><div className="row-t">{u.t}</div>{u.note && <div className="row-s">{u.note}</div>}</div>
                <a className="pill ok" href={u.u} target="_blank" rel="noreferrer">{u.kind}</a>
              </div>
            ))}
          </div>
        </>
      )}


      {view === 'labs' && (() => {
        const weekOf = (i) => { const d = parse(LAB_START); d.setDate(d.getDate() + i*7); return d; };
        const maxExp = Math.max(...LAB_ORDER.map(k=>LABS[k].exps.length));
        const curWeek = Math.max(0, Math.floor((parse(today) - parse(LAB_START)) / (7*86400000)));
        return (
        <>
          <div className="hero"><div className="hero-date">One experiment per subject per week</div><h1>Labs &amp; Viva</h1>
            <div className="hero-sub">Labs start {fmt(LAB_START)}. Viva is asked in-lab and carries ISE marks — the questions below are what they actually ask.</div></div>

          <div className="note g" style={{marginBottom:14}}>
            <b>Why this matters more than it looks.</b> Lab ISE is 25 marks per subject and <b>26 for CE303</b> — the heaviest single
            component outside the mini project. It is also the easiest to score full marks on: turn up, submit a working
            experiment, answer three viva questions. Prep the viva line the night before and this is nearly free marks toward 9+.
          </div>

          <div className="panel" style={{marginBottom:14}}>
            <div className="panel-h"><span className="panel-t">Progress by subject</span><span className="panel-v">Week {curWeek+1}</span></div>
            {LAB_ORDER.map(k=>{
              const L=LABS[k];
              const dn=L.exps.filter((_,i)=>done[`lab-${k}-${i}`]).length;
              return <SBar key={k} name={`${k} — ${L.name}`} done={dn} total={L.exps.length} color={L.color} />;
            })}
          </div>

          {Array.from({length:maxExp}).map((_,w)=>{
            const wd = weekOf(w);
            const isNow = w === curWeek;
            return (
              <div className="panel" key={w} style={{marginBottom:12, borderColor: isNow?'var(--ac)':'var(--line)'}}>
                <div className="panel-h">
                  <span className="panel-t">Week {w+1} · from {fmt(isoLocal(wd))}</span>
                  {isNow && <span className="pill ok">This week</span>}
                </div>
                {LAB_ORDER.map(k=>{
                  const L=LABS[k]; const e=L.exps[w]; if(!e) return null;
                  const id=`lab-${k}-${w}`; const dn=!!done[id];
                  return (
                    <div className="row" key={k}>
                      <button className="cb" onClick={()=>toggle(id)}
                        style={{background:dn?'var(--ac)':'',borderColor:dn?'var(--ac)':'',color:dn?'#fff':'transparent'}}>✓</button>
                      <div className="row-m">
                        <div className="row-t" style={{textDecoration:dn?'line-through':'none',opacity:dn?.5:1}}>
                          <span className="pill" style={{marginRight:7,background:L.color,color:'#08100F'}}>{k}</span>{e.t}
                        </div>
                        <div className="row-s" style={{marginTop:5}}><b style={{color:'var(--tx)'}}>Viva:</b> {e.viva}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>);
      })()}

      {view === 'subjects' && (
        <>
          <div className="hero"><div className="hero-date">Faculty is bad — here is the fix</div><h1>Subject Resources</h1>
            <div className="hero-sub">Verified channels per subject. Links are channel-search URLs, not playlist IDs, so they will not rot.</div></div>

          <div className="note w" style={{marginBottom:14}}>
            <b>Read this before you start.</b> Two subjects are badly served by free video and you should plan around it now,
            not in November: <b>Distributed Computing</b> (no channel covers it well — start it earliest) and four specific
            topics with no good video anywhere — <b>GRASP, ANFIS, ECC, and MPI</b>. For those four, go to the textbook directly
            rather than losing an evening hunting for a video that does not exist.
          </div>

          {RESOURCES.map(r => (
            <div className="panel" key={r.code} style={{marginBottom:12, borderLeft:`3px solid ${r.color}`}}>
              <div className="panel-h">
                <span className="panel-t" style={{color:r.color}}>{r.code} · {r.name}</span>
                {r.verdict==='solved' && <span className="pill ok">solved</span>}
                {r.verdict==='hard' && <span className="pill hot">hardest</span>}
              </div>
              {r.summary && <div className="sub" style={{marginTop:0,marginBottom:12}}>{r.summary}</div>}
              {r.picks.map((p,i)=>(
                <div className="row" key={i}>
                  <div className="row-m">
                    <div className="row-t">
                      <span className="pill" style={{marginRight:7}}>{p.tag}</span>{p.t}
                    </div>
                    <div className="row-s" style={{marginTop:4}}>{p.note}</div>
                  </div>
                  <a className="pill ok" href={p.u} target="_blank" rel="noreferrer">Open</a>
                </div>
              ))}
              {r.gaps && <div className="note w" style={{marginTop:10,fontSize:12.5}}><b>Gap:</b> {r.gaps}</div>}
            </div>
          ))}

                  </>
      )}
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
          <div className="hero grad">
            <div className="hero-date">Target: 10 pointer</div>
            <h1>Academics</h1>
            <div className="hero-sub">
              Six subjects, {Object.keys(stat).length} modules, {hm(totalSec)} of verified lecture video.
              Every module is scheduled three times — studied once, then revised after one week and again after three.
            </div>
            <div className="hero-stats">
              <span><b>{allDone}</b> of {allTot} study tasks done</span>
              <span><b>{Math.round((allDone/allTot)*100)}%</b> of the semester's material</span>
            </div>
          </div>

          <div className="note g" style={{marginBottom:16}}>
            <b>Why this replaced "speedrun YouTube the night before".</b> Cramming works for recall the next
            morning and fails at everything after that, which is why your grades did not match how fast you
            actually pick things up. Spacing the same material across three passes three weeks apart is the
            single best-evidenced study intervention there is. The passes are already on your calendar, so
            the decision is not "what should I revise today" — it is just whether you open the app.
          </div>

          {SUBJECT_ORDER.map(code => {
            const s = ACADEMICS[code];
            const mods = s.modules;
            const EMPTY = { 1:[0,0], 2:[0,0], 3:[0,0] };
            const dn = mods.reduce((a,m) => { const x = stat[`${code}-${m.m}`] || EMPTY; return a + x[1][0]+x[2][0]+x[3][0]; }, 0);
            const tt = mods.reduce((a,m) => { const x = stat[`${code}-${m.m}`] || EMPTY; return a + x[1][1]+x[2][1]+x[3][1]; }, 0);
            return (
              <div className="subj" key={code} style={{ '--sc': s.color }}>
                <div className="subj-h">
                  <div className="subj-id">{code}</div>
                  <div className="subj-m">
                    <div className="subj-n">{s.name}</div>
                    <div className="subj-s">{mods.length} modules · {hm(s.seconds)} of video · {s.channel}</div>
                  </div>
                  <div className="subj-p">
                    <Donut pct={tt ? dn/tt : 0} label="" color={s.color} size={54} />
                  </div>
                </div>
                {s.gap && <div className="note w subj-gap"><b>Source gap:</b> {s.gap}</div>}
                {s.note && <div className="note subj-gap">{s.note}</div>}
                <div className="mods">
                  {mods.map(m => {
                    const st = stat[`${code}-${m.m}`] || { 1:[0,0], 2:[0,0], 3:[0,0] };
                    return (
                      <div className="mod" key={m.m}>
                        <div className="mod-h">
                          <span className="mod-n">M{m.m}</span>
                          <span className="mod-t">{m.name}</span>
                          <span className="mod-d">{hm(m.seconds)}</span>
                        </div>
                        {m.topics && <div className="mod-tp">{m.topics}</div>}
                        <div className="passes">
                          {[1,2,3].map(p => {
                            const [d0,t0] = st[p];
                            const full = t0 && d0 === t0;
                            return (
                              <div key={p} className={'pass' + (full ? ' full' : d0 ? ' part' : '')}
                                   title={`Pass ${p}: ${d0}/${t0} sessions done`}>
                                <span className="pass-l">{p === 1 ? 'Learn' : p === 2 ? '+1 wk' : '+3 wk'}</span>
                                <div className="pass-b"><i style={{ width: `${t0 ? (d0/t0)*100 : 0}%` }} /></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>);
      })()}

      {view === 'grades' && (
        <>
          <div className="hero"><div className="hero-date">Target: 9.0+ pointer</div><h1>Grades</h1></div>
          <div className="note g" style={{ marginBottom: 14 }}>
            <b>The good news: 9+ is very winnable this semester</b> — because 400 of your ~900 marks are
            continuous assessment (PR1 and M132), not exams. Those are the easiest marks on the board to
            score high on, and they are decided between August and October, not in November.
          </div>
          <div className="note w" style={{ marginBottom: 14 }}>
            <b>The tension you need to know about.</b> A 9+ pointer and heavy bunking are in direct conflict.
            ISE marks (15–26 per subject) are partly attendance and participation driven, and lab ISE is
            graded by people who notice who shows up. The bunk budget still exists — but spend it almost
            entirely on CE304 theory, and treat every lab and studio as non-negotiable.
          </div>
          {COLLEGE.subjects.map(s => (
            <div className="card" key={s.code}>
              <h3>{s.code} — {s.name} <span className="pill" style={{ marginLeft: 6 }}>{s.marks} marks</span></h3>
              <p>{s.note}</p>
            </div>
          ))}
          <div className="card">
            <h3>How to actually get 9+</h3>
            <div className="row"><div className="row-m"><div className="row-t">1. Max out PR1 and M132 first</div><div className="row-s">400 marks, continuous, no exam. Consistent submission beats brilliance. This alone moves your pointer more than any exam performance.</div></div></div>
            <div className="row"><div className="row-m"><div className="row-t">2. Never miss a lab</div><div className="row-s">CE303 lab ISE is 26 marks — the heaviest. Labs are near-free marks for attendance plus a working submission.</div></div></div>
            <div className="row"><div className="row-m"><div className="row-t">3. Mid-terms are 15–20 marks each</div><div className="row-s">7–11 Sep. Worth 2 focused days per subject beforehand, not a week. Diminishing returns past that.</div></div></div>
            <div className="row"><div className="row-m"><div className="row-t">4. Hunt the self-study modules</div><div className="row-s">CE301, CE302, CE303 and CE305 each have a module excluded from lectures but still examinable. Find them in week 10, not week 16.</div></div></div>
            <div className="row"><div className="row-m"><div className="row-t">5. CE304 is pure exam</div><div className="row-s">No lab, no ISE cushion — 100% theory. Sipser plus two focused weekends. This is the one subject where cramming genuinely works.</div></div></div>
          </div>
        </>
      )}

      {view === 'deadlines' && (
        <>
          <div className="hero"><div className="hero-date">Time-critical</div><h1>Deadlines</h1></div>
          {upcoming.map((e,i) => {
            const dd = daysBetween(today, e.d);
            return (
              <div className="card" key={i}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                  <span className={'pill ' + (dd <= 14 && e.type === 'deadline' ? 'hot' : '')}>{dd === 0 ? 'TODAY' : dd + ' days'}</span>
                  <span className="mono sm">{fmt(e.d)}</span>
                </div>
                <h3>{e.t}</h3>
                {e.why && <p style={{ marginTop: 4 }}>{e.why}</p>}
                {e.u && <div style={{ marginTop: 8 }}><a className="btn go" href={e.u} target="_blank" rel="noreferrer">Open →</a></div>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
