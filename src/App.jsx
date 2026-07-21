import React, { useState, useEffect, useMemo } from 'react';
import { SCHEDULE, BLOCKS, ALL_PROBLEMS, LLD, AI, EVENTS, PHASES, parse } from './data/schedule.js';
import { COLLEGE } from './data/tracks.js';

const TRACKS = {
  dsa: 'DSA', contest: 'Contest', lld: 'System Design', ai: 'AI/ML',
  college: 'College', admin: 'Admin', content: 'Content',
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const rawToday = () => {
  const d = new Date(); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
};
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
  return (
    <div className={'task' + (done ? ' done' : '')}>
      <button className="cb" onClick={onToggle} aria-label={done ? 'Mark undone' : 'Mark done'}>✓</button>
      <span className={'dot k-' + t.track} />
      <div className="tbody">
        <div className="ttitle">{t.title}</div>
        {t.meta && <div className="tmeta">{t.meta}</div>}
        {t.why && <div className="twhy">{t.why}</div>}
        <div className="tactions">
          {t.url && <a className="btn go" href={t.url} target="_blank" rel="noreferrer">Open →</a>}
          {!done && onPush && <button className="btn" onClick={onPush}>Push to tomorrow</button>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useStore('theme', null);
  const [done, setDone] = useStore('done', {});
  const [pushed, setPushed] = useStore('pushed', {});
  const [view, setView] = useState('today');
  const [cursor, setCursor] = useState(todayISO());

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-t', theme);
    else document.documentElement.removeAttribute('data-t');
  }, [theme]);

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

  const toggle = (id) => setDone(d => ({ ...d, [id]: !d[id] }));
  const push = (id) => {
    const nxt = new Date(parse(cursor)); nxt.setDate(nxt.getDate() + 1);
    setPushed(p => ({ ...p, [id]: nxt.toISOString().slice(0,10) }));
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
      const s = d.toISOString().slice(0, 10);
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
    setCursor(d.toISOString().slice(0,10));
  };

  const weekDays = useMemo(() => {
    const d = parse(cursor); const out = [];
    const start = new Date(d); start.setDate(d.getDate() - d.getDay());
    for (let i = 0; i < 7; i++) { const x = new Date(start); x.setDate(start.getDate()+i); out.push(x.toISOString().slice(0,10)); }
    return out;
  }, [cursor]);

  return (
    <div className="app">
      <div className="top">
        <div className="top-in">
          <span className="brand">Campaign · Sem V</span>
          <button className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">◐</button>
        </div>
        <div className="top-in tabs" style={{ marginTop: 8 }}>
          {['today','week','plan','tracks','grades','deadlines'].map(v => (
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

          {Object.keys(TRACKS).map(k => {
            const ts = tasks.filter(t => t.track === k);
            if (!ts.length) return null;
            return (
              <div className="group" key={k}>
                <div className="group-h"><span className={'dot k-' + k} style={{ marginTop:0 }} />{TRACKS[k]}</div>
                {ts.map(t => (
                  <Task key={t.id} t={t} done={!!done[t.id]} onToggle={() => toggle(t.id)} onPush={() => push(t.id)} />
                ))}
              </div>
            );
          })}
          {!tasks.length && <div className="empty">Nothing scheduled. Rest day.</div>}
        </>
      )}

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
