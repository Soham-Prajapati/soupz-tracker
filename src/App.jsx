import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sync from './sync.js';
import { AccountBadge } from './Auth.jsx';
import { Bowl, EmptyStateIllustration, InkDefs } from './soup.jsx';
import { dayProgressLabel } from './progressCopy.js';
import {
  applyStoreChange,
  EMPTY_TRACKER_STATE,
  makeStoreChange,
  trackerStateClient,
  windowStoreSync,
} from './windowStore.js';
import { addDays, createHabitPlan, validatePlan } from '../packages/core/src/index.js';
import {
  previewGenericMove,
  previewGenericPlan,
  projectGenericPlans,
  writeGenericPlan,
} from './genericTracker.js';
import { progressKey, progressValue } from './progressKeys.js';
import {
  HACKATHON_MODE,
  STANDARD_MODE,
  hackathonTasksForDate,
  normalizeTrackerMode,
  projectHackathonPlan,
} from './hackathonMode.js';
import { HackathonWorkspace } from './HackathonWorkspace.jsx';

const FLAVOURS = [
  { id: 'miso', name: 'Miso', light: '#E2963C', light2: '#B96C16', wash: '#F7CE8A', dark: '#F0A94F', dark2: '#FFC680' },
  { id: 'tomato', name: 'Tomato', light: '#D4553A', light2: '#A93A22', wash: '#F5B39F', dark: '#F0795A', dark2: '#FF9E85' },
  { id: 'matcha', name: 'Matcha', light: '#7FA23C', light2: '#5B7A22', wash: '#CBDD9A', dark: '#A8CE63', dark2: '#C6E48C' },
  { id: 'beet', name: 'Beetroot', light: '#B2456F', light2: '#8A2C52', wash: '#EDAFC6', dark: '#E2749F', dark2: '#F5A0C1' },
  { id: 'kombu', name: 'Kombu', light: '#2F8C86', light2: '#196662', wash: '#9BD5D0', dark: '#54C3BE', dark2: '#86DBD6' },
  { id: 'charcoal', name: 'Charcoal', light: '#6A5B4A', light2: '#493D30', wash: '#C9B79E', dark: '#C3B098', dark2: '#DCCDB8' },
];

const EMPTY_PROJECTION = {
  plans: [],
  todayTasks: [],
  overdue: { count: 0, oldest: null },
  streaks: [{ trackId: 'all', name: 'All tracked work', days: 0 }],
  last14: [],
};

export const isoLocal = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayISO = () => isoLocal(new Date());
const runtimeSearch = () => typeof location === 'undefined' ? '' : location.search;
const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function useStore(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });
  const valueRef = useRef(value);

  useEffect(() => windowStoreSync.subscribe(change => {
    if (change.key !== key) return;
    setValue(current => {
      const next = applyStoreChange(current, change);
      valueRef.current = next;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }), [key]);

  const setStored = useCallback(update => {
    const previous = valueRef.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (Object.is(previous, next)) return;
    valueRef.current = next;
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    const change = makeStoreChange(key, previous, next);
    const emptyPatch = change.patch && Object.keys(change.value).length === 0 && change.removed.length === 0;
    if (!emptyPatch) windowStoreSync.publish(change);
  }, [key]);
  return [value, setStored];
}

function readLegacyMap(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function useTrackerProgress() {
  const [browserDone, setBrowserDone] = useStore('done', {});
  const [browserPushed, setBrowserPushed] = useStore('pushed', {});
  const desktop = isDesktop();
  const legacy = useRef(null);
  if (legacy.current === null) legacy.current = { legacyDone: readLegacyMap('done'), legacyPushed: readLegacyMap('pushed') };
  const [state, setState] = useState(EMPTY_TRACKER_STATE);
  const [ready, setReady] = useState(!desktop);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!desktop) return undefined;
    let live = true;
    const unsubscribe = trackerStateClient.subscribe(next => live && setState(next));
    trackerStateClient.start(legacy.current).then(next => {
      if (!live) return;
      setState(next);
      setReady(true);
    }).catch(cause => live && setError(cause));
    return () => { live = false; unsubscribe(); };
  }, [desktop]);

  const updateMap = useCallback((key, browserSetter, update) => {
    if (!desktop) {
      browserSetter(update);
      return Promise.resolve();
    }
    const current = trackerStateClient.getSnapshot()[key];
    const next = typeof update === 'function' ? update(current) : update;
    const changed = {};
    for (const [id, value] of Object.entries(next)) {
      if (!Object.is(current[id], value)) changed[id] = value;
    }
    if (!Object.keys(changed).length) return Promise.resolve();
    return trackerStateClient.applyPatch({ [key]: changed }).catch(cause => {
      setError(cause);
      throw cause;
    });
  }, [desktop]);

  return {
    done: desktop ? state.done : browserDone,
    pushed: desktop ? state.pushed : browserPushed,
    setDone: update => updateMap('done', setBrowserDone, update),
    setPushed: update => updateMap('pushed', setBrowserPushed, update),
    state,
    ready,
    error,
    desktop,
  };
}

function useTrayProgress(done, total) {
  useEffect(() => {
    if (!isDesktop()) return;
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('set_tray_progress', { done, total })).catch(() => {});
  }, [done, total]);
}

async function persistDesktopPlans(previous, next) {
  if (!isDesktop()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const before = new Map(previous.map(plan => [plan.id, plan]));
  const after = new Map(next.map(plan => [plan.id, plan]));
  await Promise.all([
    ...next.filter(plan => JSON.stringify(before.get(plan.id)) !== JSON.stringify(plan))
      .map(plan => invoke('upsert_engine_plan', { plan })),
    ...previous.filter(plan => !after.has(plan.id))
      .map(plan => invoke('remove_engine_plan', { planId: plan.id })),
  ]);
}

export function EmptyState({ line = 'Nothing scheduled here.', hint = 'A clear day is neutral.' }) {
  return <div className="empty-state"><EmptyStateIllustration /><h2>{line}</h2><p>{hint}</p></div>;
}

function HabitForm({ plans, setPlans, today }) {
  const [message, setMessage] = useState('');
  const submit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const date = new Date(`${today}T12:00:00`);
    const plan = createHabitPlan({
      title: values.title,
      from: today,
      frequency: values.cadence,
      byDay: values.cadence === 'weekly' ? [date.getDay()] : undefined,
      color: values.color,
    });
    const result = await writeGenericPlan(plans, plan);
    if (!result.validation.ok) {
      setMessage(result.validation.errors.map(error => error.message).join(' '));
      return;
    }
    setPlans(result.plans);
    event.currentTarget.reset();
    setMessage(`${plan.title} added.`);
  };
  return <form className="habit-form form-grid" onSubmit={submit}>
    <label className="wide">Habit name<input required name="title" placeholder="Read 20 minutes" /></label>
    <label>Cadence<select name="cadence" defaultValue="daily"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
    <label>Track colour<input type="color" name="color" defaultValue="#D4553A" /></label>
    <button className="btn primary" type="submit">Add habit</button>
    {message && <p className="notice wide" role="status">{message}</p>}
  </form>;
}

function GenericImport({ plans, setPlans }) {
  const [text, setText] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState('');
  const review = async () => {
    try {
      const next = JSON.parse(text);
      const validation = validatePlan(next);
      if (!validation.ok) throw new Error(validation.errors.map(error => error.message).join(' '));
      const preview = await previewGenericPlan(plans, next);
      if (!preview.validation.ok) throw new Error(preview.validation.errors.map(error => error.message).join(' '));
      setCandidate(next);
      const diff = preview.write.diff;
      setMessage(`Review before saving: ${diff.tasksAdded} added, ${diff.tasksKept} kept, ${diff.tasksRemoved} removed, ${diff.progressOrphaned.length} progress entries orphaned.`);
    } catch (error) {
      setCandidate(null);
      setMessage(error.message);
    }
  };
  const commit = async () => {
    if (!candidate) return;
    const result = await writeGenericPlan(plans, candidate);
    if (!result.validation.ok) {
      setMessage('Plan validation failed.');
      return;
    }
    setPlans(result.plans);
    setCandidate(null);
    setText('');
    setMessage('Reviewed plan saved.');
  };
  return <section className="card import-card"><p className="eyebrow">Portable plan</p><h2>Import JSON</h2>
    <p className="muted">Nothing is stored until you review and confirm it.</p>
    <textarea rows="8" value={text} onChange={event => { setText(event.target.value); setCandidate(null); }} placeholder="Paste a Soupz Tracker plan" />
    <div className="inline-actions"><button className="btn" onClick={review}>Review plan</button>{candidate && <button className="btn primary" onClick={commit}>Confirm import</button>}</div>
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}

export function HabitPanel({ plans, setPlans, today }) {
  return <section className="card habit-panel">
    <div className="section-head"><div><p className="eyebrow">Plain setup</p><h2>Add a habit directly</h2></div><span>{plans.length} plan{plans.length === 1 ? '' : 's'}</span></div>
    <p className="muted">A name and cadence are enough. No account or AI setup is required.</p>
    <HabitForm plans={plans} setPlans={setPlans} today={today} />
    {plans.length > 0 && <div className="plan-list">{plans.map(plan => <article key={plan.id} style={{ '--track': plan.tracks[0]?.color || '#6A5B4A' }}><span className="track-dot" /><div><strong>{plan.title}</strong><small>{plan.kind} · revision {plan.revision}</small></div></article>)}</div>}
  </section>;
}

function TaskRow({ task, done, onToggle, onMove, onUndo }) {
  const [target, setTarget] = useState(task.date);
  return <article className={`task ${done ? 'done' : ''}`} style={{ '--track': task.trackColor }}>
    <button className="task-check" aria-label={done ? 'Mark open' : 'Mark done'} onClick={() => onToggle(task.planId, task.id)}>{done ? '✓' : ''}</button>
    <div className="task-copy"><strong>{task.title}</strong><span>{task.planTitle} · {task.trackName}</span>{task.why && <small>{task.why}</small>}{task.moved && <small>Moved from {task.homeDate}</small>}</div>
    <div className="task-actions"><input aria-label={`Move ${task.title} to date`} type="date" value={target} onChange={event => setTarget(event.target.value)} /><button className="link-button" onClick={() => onMove(task, target)}>Move</button>{task.moved && <button className="link-button" onClick={() => onUndo(task)}>Undo</button>}</div>
  </article>;
}

function TodayView({ plans, setPlans, projection, date, setDate, done, onToggle, onMove, onUndo, loading }) {
  const complete = projection.todayTasks.filter(task => progressValue(done, task.planId, task.id)).length;
  const total = projection.todayTasks.length;
  const streak = projection.streaks[0]?.days || 0;
  return <main className="page">
    <section className="hero">
      <div><p className="eyebrow">{date === todayISO() ? 'Today' : date}</p><h1>{dayProgressLabel(complete, total)}</h1><p className="lede">{total ? `${complete} of ${total} complete across ${new Set(projection.todayTasks.map(task => task.planId)).size} plans.` : 'No scheduled work. A clear day does not erase prior progress.'}</p>
        <div className="date-nav"><button className="btn" onClick={() => setDate(addDays(date, -1))}>Previous</button><input aria-label="Selected date" type="date" value={date} onChange={event => event.target.value && setDate(event.target.value)} /><button className="btn" onClick={() => setDate(addDays(date, 1))}>Next</button><button className="link-button" onClick={() => setDate(todayISO())}>Today</button></div>
      </div>
      <Bowl pct={total ? complete / total : 0} size={210} heat={complete > 0} caption={`${complete}/${total}`} sub="complete" />
    </section>
    <section className="metric-row"><div><strong>{plans.length}</strong><span>active plans</span></div><div><strong>{streak}</strong><span>day streak</span></div><div><strong>{projection.overdue.count}</strong><span>open before today</span></div></section>
    {loading ? <section className="card"><p>Loading plans…</p></section> : projection.todayTasks.length ? <section className="card"><div className="section-head"><h2>Scheduled work</h2><span>Track colours come from plan data</span></div><div className="task-list">{projection.todayTasks.map(task => <TaskRow key={`${task.planId}:${task.id}`} task={task} done={Boolean(progressValue(done, task.planId, task.id))} onToggle={onToggle} onMove={onMove} onUndo={onUndo} />)}</div></section> : <EmptyState line="Rest day" hint="Nothing is due on this date. Add a habit or import a plan when you want structure." />}
    {plans.length === 0 && <div className="setup-grid"><HabitPanel plans={plans} setPlans={setPlans} today={date} /><GenericImport plans={plans} setPlans={setPlans} /></div>}
  </main>;
}

function PlansView({ plans, setPlans, today }) {
  const remove = planId => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this plan? Progress remains separate.')) return;
    setPlans(plans.filter(plan => plan.id !== planId));
  };
  const download = plan => {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(plan, null, 2)}\n`], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${plan.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <main className="page"><section className="hero compact"><div><p className="eyebrow">User-owned data</p><h1>Plans</h1><p className="lede">Soupz stores only plans you create or explicitly import.</p></div></section>
    <div className="setup-grid"><HabitPanel plans={plans} setPlans={setPlans} today={today} /><GenericImport plans={plans} setPlans={setPlans} /></div>
    {plans.length > 0 && <section className="card"><div className="section-head"><h2>Saved plans</h2></div><div className="plan-list detailed">{plans.map(plan => <article key={plan.id} style={{ '--track': plan.tracks[0]?.color || '#6A5B4A' }}><span className="track-dot" /><div><strong>{plan.title}</strong><small>{plan.kind} · starts {plan.window.start} · {plan.tracks.length} tracks</small></div><div className="inline-actions"><button className="link-button" onClick={() => download(plan)}>Export</button><button className="link-button danger" onClick={() => remove(plan.id)}>Remove</button></div></article>)}</div></section>}
  </main>;
}

function Settings({ theme, setTheme, accent, setAccent, sync }) {
  return <main className="page settings-page"><section className="hero compact"><div><p className="eyebrow">Preferences</p><h1>Settings</h1><p className="lede">Visual preferences stay separate from plan data.</p></div></section>
    <section className="card"><h2>Appearance</h2><div className="setting-row"><div><strong>Theme</strong><span>Follow the system or choose a fixed surface.</span></div><div className="segmented">{[['', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([value, label]) => <button className={(theme || '') === value ? 'active' : ''} onClick={() => setTheme(value || null)} key={label}>{label}</button>)}</div></div>
      <div className="setting-row"><div><strong>Ingredient accent</strong><span>Labels remain human-readable; the value is only a colour preference.</span></div><div className="flavour-list">{FLAVOURS.map(flavour => <button className={accent === flavour.id ? 'active' : ''} onClick={() => setAccent(flavour.id)} key={flavour.id}><i style={{ background: flavour.light }} />{flavour.name}</button>)}</div></div>
      <div className="setting-row"><div><strong>Sync</strong><span>{sync === 'ok' ? 'Connected' : sync === 'offline' ? 'Local changes are safe; cloud sync is unavailable.' : 'Local-first mode'}</span></div><AccountBadge /></div>
    </section>
  </main>;
}

function CompactPanel({ title, tasks, done, onToggle, date }) {
  const complete = tasks.filter(task => progressValue(done, task.planId, task.id)).length;
  return <main className="panel-page"><div className="panel-head"><div><p className="eyebrow">{date}</p><h1>{title}</h1></div><strong>{complete}/{tasks.length}</strong></div>{tasks.length ? <div className="task-list compact-list">{tasks.map(task => <article className={`task ${progressValue(done, task.planId, task.id) ? 'done' : ''}`} style={{ '--track': task.trackColor || '#6A5B4A' }} key={`${task.planId}:${task.id}`}><button className="task-check" onClick={() => onToggle(task.planId, task.id)}>{progressValue(done, task.planId, task.id) ? '✓' : ''}</button><div><strong>{task.title}</strong><span>{task.planTitle || task.trackName}</span></div></article>)}</div> : <EmptyState line="Rest day" hint="No work is scheduled for today." />}</main>;
}

export default function App() {
  const [theme, setTheme] = useStore('theme', null);
  const [accent, setAccent] = useStore('accent', 'miso');
  const [mode, setMode] = useStore('trackerMode', STANDARD_MODE);
  const [plans, setPlans] = useStore('genericPlans:v1', []);
  const [hackathonPlan, setHackathonPlan] = useStore('hackathonPlan', null);
  const tracker = useTrackerProgress();
  const { done, pushed, setDone, setPushed } = tracker;
  const [view, setView] = useState(() => {
    const requested = new URLSearchParams(runtimeSearch()).get('v');
    return ['today', 'plans', 'settings'].includes(requested) ? requested : 'today';
  });
  const [date, setDate] = useState(todayISO());
  const [projection, setProjection] = useState(EMPTY_PROJECTION);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState('local');
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [flushEpoch, setFlushEpoch] = useState(0);
  const flushInFlight = useRef(false);
  const browserSyncQueue = useRef(new Map());
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const setUserPlans = useCallback(update => {
    setPlans(current => {
      const next = typeof update === 'function' ? update(current) : update;
      persistDesktopPlans(current, next).catch(() => setSync('offline'));
      return next;
    });
  }, [setPlans]);

  useEffect(() => {
    if (!isDesktop()) return undefined;
    let live = true;
    const hydrate = async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const enginePlans = await invoke('get_engine_plans');
      if (!live) return;
      if (!enginePlans.length && plansRef.current.length) await persistDesktopPlans([], plansRef.current);
      else if (JSON.stringify(enginePlans) !== JSON.stringify(plansRef.current)) setPlans(enginePlans);
    };
    hydrate().catch(() => setSync('offline'));
    const timer = window.setInterval(() => hydrate().catch(() => setSync('offline')), 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, [setPlans]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    projectGenericPlans({ plans, date, done, pushed }).then(next => {
      if (live) { setProjection(next); setLoading(false); }
    }).catch(() => live && setLoading(false));
    return () => { live = false; };
  }, [plans, date, done, pushed]);

  useEffect(() => {
    const subscription = Sync.onAuthChange(() => setSyncEpoch(value => value + 1));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!tracker.ready) return undefined;
    let live = true;
    let unsubscribeRemote = () => {};
    (async () => {
      try {
        const [remote, user] = await Promise.all([Sync.pullAll(), Sync.getUser()]);
        if (!live) return;
        const ownerKey = 'syncOwnerId:v1';
        const previousOwner = user ? localStorage.getItem(ownerKey) : null;
        const accountChanged = Boolean(user && previousOwner && previousOwner !== user.id);
        if (accountChanged && tracker.desktop) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('replace_tracker_account', { done: remote.done, pushed: remote.pushed });
        } else if (accountChanged) {
          setDone(remote.done);
          setPushed(remote.pushed);
        } else if (tracker.desktop) {
          await trackerStateClient.mergeRemote({ done: remote.done, pushed: remote.pushed });
        } else {
          const hasLocal = Object.keys(done).length > 0 || Object.keys(pushed).length > 0;
          if (hasLocal) await Sync.pushLocal(done, pushed);
          setDone(current => ({ ...remote.done, ...current }));
          setPushed(current => ({ ...remote.pushed, ...current }));
        }
        if (user) localStorage.setItem(ownerKey, user.id);
        unsubscribeRemote = await Sync.subscribeTrackerState(remotePatch => {
          if (!live) return;
          if (tracker.desktop) trackerStateClient.mergeRemote({ ...remotePatch, complete: false }).catch(() => setSync('offline'));
          else {
            if (remotePatch.done) setDone(current => ({ ...current, ...remotePatch.done }));
            if (remotePatch.pushed) setPushed(current => ({ ...current, ...remotePatch.pushed }));
          }
        });
        setSync(Sync.isConfigured() ? 'ok' : 'local');
      } catch {
        if (live) setSync('offline');
      }
    })();
    return () => { live = false; unsubscribeRemote(); };
  }, [tracker.ready, tracker.desktop, syncEpoch]);

  useEffect(() => {
    if (!tracker.desktop || !tracker.ready || flushInFlight.current) return;
    const pending = { done: tracker.state.pendingDone, pushed: tracker.state.pendingPushed };
    if (!Object.keys(pending.done).length && !Object.keys(pending.pushed).length) return;
    flushInFlight.current = true;
    Sync.pushPending(pending.done, pending.pushed)
      .then(uploaded => uploaded && trackerStateClient.acknowledgeSync(pending))
      .then(() => setSync('ok'))
      .catch(() => setSync('offline'))
      .finally(() => {
        flushInFlight.current = false;
        setFlushEpoch(value => value + 1);
      });
  }, [tracker.desktop, tracker.ready, tracker.state.revision, syncEpoch, flushEpoch]);

  useEffect(() => { if (tracker.error) setSync('offline'); }, [tracker.error]);
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-t', theme);
    else document.documentElement.removeAttribute('data-t');
  }, [theme]);
  useEffect(() => {
    const flavour = FLAVOURS.find(item => item.id === accent) || FLAVOURS[0];
    const dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement.style;
    root.setProperty('--accent-c', dark ? flavour.dark : flavour.light);
    root.setProperty('--accent-c2', dark ? flavour.dark2 : flavour.light2);
    root.setProperty('--accent-cw', flavour.wash);
  }, [accent, theme]);

  const hackathonState = useMemo(() => projectHackathonPlan(hackathonPlan, done, date), [hackathonPlan, done, date]);
  const activeTasks = normalizeTrackerMode(mode) === HACKATHON_MODE
    ? hackathonState.todayTasks.map(task => ({ ...task, planId: hackathonPlan?.id }))
    : projection.todayTasks;
  useTrayProgress(activeTasks.filter(task => progressValue(done, task.planId, task.id)).length, activeTasks.length);

  const queueBrowserSync = (key, operation) => {
    const pending = browserSyncQueue.current.get(key) || Promise.resolve();
    const next = pending.catch(() => {}).then(operation);
    browserSyncQueue.current.set(key, next);
    next.finally(() => {
      if (browserSyncQueue.current.get(key) === next) browserSyncQueue.current.delete(key);
    });
  };
  const toggle = (planId, taskId) => {
    const key = progressKey(planId, taskId);
    const next = !progressValue(done, planId, taskId);
    setDone(current => ({ ...current, [key]: next }));
    if (!tracker.desktop) queueBrowserSync(key, () => Sync.setDone(key, next).catch(() => setSync('offline')));
  };
  const move = async (task, target) => {
    if (!target) return;
    const preview = await previewGenericMove({ plans, done, pushed, planId: task.planId, taskId: task.id, homeDate: task.homeDate, toDate: target });
    if (preview.skipped.length) return;
    const key = progressKey(task.planId, task.id);
    setPushed(current => ({ ...current, [key]: target }));
    if (!tracker.desktop) queueBrowserSync(key, () => Sync.setPushed(key, target).catch(() => setSync('offline')));
  };
  const undo = task => move(task, task.homeDate);

  const windowMode = new URLSearchParams(runtimeSearch()).get('window');
  if (windowMode === 'settings') return <><InkDefs /><Settings theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} sync={sync} /></>;
  if (windowMode === 'panel') {
    const tasks = normalizeTrackerMode(mode) === HACKATHON_MODE
      ? hackathonTasksForDate(hackathonPlan, todayISO()).map(task => ({ ...task, planId: hackathonPlan?.id, planTitle: hackathonPlan?.title }))
      : projection.todayTasks;
    return <><InkDefs /><CompactPanel title={normalizeTrackerMode(mode) === HACKATHON_MODE ? hackathonPlan?.title || 'Hackathon' : 'Soupz Tracker'} tasks={tasks} done={done} onToggle={toggle} date={todayISO()} /></>;
  }

  const standard = normalizeTrackerMode(mode) === STANDARD_MODE;
  return <div className="app"><InkDefs />
    <header className="topbar"><button className="brand" onClick={() => { setMode(STANDARD_MODE); setView('today'); }}><Bowl pct={activeTasks.length ? activeTasks.filter(task => progressValue(done, task.planId, task.id)).length / activeTasks.length : 0} size={38} heat={false} flat /><span>Soupz <i>Tracker</i></span></button>
      <nav aria-label="Primary">{standard && <><button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today</button><button className={view === 'plans' ? 'active' : ''} onClick={() => setView('plans')}>Plans</button><button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Settings</button></>}<button className={!standard ? 'active' : ''} onClick={() => { setMode(HACKATHON_MODE); setView('hackathon'); }}>Hackathon</button></nav>
      {!standard && <button className="btn" onClick={() => { setMode(STANDARD_MODE); setView('today'); }}>Back to plans</button>}
    </header>
    {standard && view === 'today' && <TodayView plans={plans} setPlans={setUserPlans} projection={projection} date={date} setDate={setDate} done={done} onToggle={toggle} onMove={move} onUndo={undo} loading={loading} />}
    {standard && view === 'plans' && <PlansView plans={plans} setPlans={setUserPlans} today={date} />}
    {standard && view === 'settings' && <Settings theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} sync={sync} />}
    {!standard && <HackathonWorkspace plan={hackathonPlan} setPlan={setHackathonPlan} done={done} toggle={toggle} today={date} />}
  </div>;
}
