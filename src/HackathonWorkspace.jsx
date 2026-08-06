import React, { useState } from 'react';
import {
  addHackathonMilestone,
  addHackathonTask,
  addHackathonWorkstream,
  createHackathonPlan,
  projectHackathonPlan,
  removeHackathonItem,
  updateHackathonMetadata,
} from './hackathonMode.js';
import {
  commitReviewedHackathon,
  createReviewEngine,
  exportHackathonPlan,
  extractHackathonCandidate,
  importHackathonPlan,
} from './hackathonImport.js';
import { progressValue } from './progressKeys.js';

const field = form => Object.fromEntries(new FormData(form));

function HackathonSetup({ onCreate, today }) {
  const submit = event => {
    event.preventDefault();
    const values = field(event.currentTarget);
    onCreate(createHackathonPlan({
      title: values.title,
      start: values.start || today,
      deadline: values.deadline,
      demoGoal: values.demoGoal,
    }));
  };
  return (
    <section className="empty-card">
      <p className="eyebrow">Hackathon mode</p>
      <h1>Start with the outcome</h1>
      <p className="lede">Keep workstreams, the demo goal, blockers, and fixed milestones in one portable plan.</p>
      <form className="form-grid" onSubmit={submit}>
        <label>Plan name<input name="title" required placeholder="Build weekend" /></label>
        <label>Start<input name="start" type="date" defaultValue={today} /></label>
        <label>Deadline<input name="deadline" type="date" /></label>
        <label className="wide">Demo goal<input name="demoGoal" placeholder="Show the working core flow" /></label>
        <button className="btn primary" type="submit">Create hackathon plan</button>
      </form>
    </section>
  );
}

export function HackathonImportPanel({ plan, setPlan }) {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [allowNoKey, setAllowNoKey] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [pageText, setPageText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [teammateText, setTeammateText] = useState('');
  const [teammatePlan, setTeammatePlan] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const extract = async event => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const candidate = await extractHackathonCandidate({ endpoint, apiKey, allowNoKey, sourceUrl, pageText });
      setReviewText(JSON.stringify(candidate, null, 2));
      setMessage('Review the candidate below. Nothing has been saved.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setApiKey('');
      setBusy(false);
    }
  };

  const confirmExtraction = async () => {
    try {
      const candidate = JSON.parse(reviewText);
      const saved = await commitReviewedHackathon({
        candidate,
        confirmed: true,
        engine: createReviewEngine(plan),
      });
      setPlan(saved);
      setMessage('Reviewed plan saved.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const reviewTeammate = () => {
    try {
      const reviewed = importHackathonPlan(teammateText);
      setTeammatePlan(reviewed);
      setMessage('Teammate plan is valid. Review it before the explicit commit.');
    } catch (error) {
      setTeammatePlan(null);
      setMessage(error.message);
    }
  };

  const confirmTeammate = () => {
    if (!teammatePlan) return;
    setPlan(teammatePlan);
    setMessage('Reviewed teammate plan saved.');
  };

  const download = () => {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([exportHackathonPlan(plan)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${plan.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card import-card">
      <div className="section-head">
        <div><p className="eyebrow">Review-first import</p><h2>Bring in a hackathon brief</h2></div>
        {plan && <button className="btn" type="button" onClick={download}>Export current plan</button>}
      </div>
      <p className="muted">The browser never fetches the source page. Paste its text, and only the configured extraction endpoint receives it.</p>
      <form className="form-grid" onSubmit={extract}>
        <label className="wide">OpenAI-compatible endpoint<input value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="http://127.0.0.1:11434/v1/chat/completions" /></label>
        <label>One-use API key<input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Used once, never saved" autoComplete="off" /></label>
        <label className="check"><input type="checkbox" checked={allowNoKey} onChange={event => setAllowNoKey(event.target.checked)} />Local endpoint needs no key</label>
        <label className="wide">Source URL (reference only)<input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} /></label>
        <label className="wide">Pasted page text<textarea value={pageText} onChange={event => setPageText(event.target.value)} rows="6" /></label>
        <button className="btn" disabled={busy}>{busy ? 'Extracting…' : 'Extract candidate'}</button>
      </form>
      {reviewText && <div className="review-box">
        <label>Editable candidate JSON<textarea value={reviewText} onChange={event => setReviewText(event.target.value)} rows="10" /></label>
        <button className="btn primary" type="button" onClick={confirmExtraction}>Confirm and save reviewed plan</button>
      </div>}
      <div className="review-box">
        <label>Portable teammate JSON<textarea value={teammateText} onChange={event => { setTeammateText(event.target.value); setTeammatePlan(null); }} rows="6" /></label>
        <div className="inline-actions">
          <button className="btn" type="button" onClick={reviewTeammate}>Review teammate JSON</button>
          <button className="btn primary" type="button" disabled={!teammatePlan} onClick={confirmTeammate}>Explicit commit</button>
        </div>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
    </section>
  );
}

export function HackathonWorkspace({ plan, setPlan, done, toggle, today }) {
  if (!plan) return <main className="page"><HackathonSetup onCreate={setPlan} today={today} /><HackathonImportPanel plan={null} setPlan={setPlan} /></main>;
  const status = projectHackathonPlan(plan, done, today);
  const tasks = (plan.schedule || []).flatMap(day => day.tasks.map(task => ({ ...task, date: day.date })));
  const submitTrack = event => {
    event.preventDefault();
    setPlan(addHackathonWorkstream(plan, field(event.currentTarget)));
    event.currentTarget.reset();
  };
  const submitTask = event => {
    event.preventDefault();
    const values = field(event.currentTarget);
    setPlan(addHackathonTask(plan, { ...values, demoCritical: values.demoCritical === 'on' }));
    event.currentTarget.reset();
  };
  const submitMilestone = event => {
    event.preventDefault();
    setPlan(addHackathonMilestone(plan, field(event.currentTarget)));
    event.currentTarget.reset();
  };
  return <main className="page">
    <section className="hero compact">
      <div><p className="eyebrow">Hackathon mode · {status.readiness}</p><h1>{plan.title}</h1><p className="lede">{plan.ext?.hackathon?.demoGoal || 'Add the demo goal when it is clear.'}</p></div>
      <div className="hero-stat"><strong>{status.doneCount}/{status.taskCount}</strong><span>tasks complete</span></div>
    </section>
    <section className="metric-row">
      <div><strong>{status.workstreams.length}</strong><span>workstreams</span></div>
      <div><strong>{status.demoCriticalRemaining.length}</strong><span>demo-critical left</span></div>
      <div><strong>{status.blockers.length}</strong><span>active blockers</span></div>
    </section>
    <section className="card">
      <div className="section-head"><div><p className="eyebrow">Plan details</p><h2>Outcome and window</h2></div></div>
      <form className="form-grid" onSubmit={event => {
        event.preventDefault();
        const values = field(event.currentTarget);
        setPlan(updateHackathonMetadata(plan, values));
      }}>
        <label>Plan name<input name="title" defaultValue={plan.title} /></label>
        <label>Start<input type="date" name="start" defaultValue={plan.window?.start || ''} /></label>
        <label>Deadline<input type="date" name="deadline" defaultValue={plan.window?.end || ''} /></label>
        <label className="wide">Demo goal<input name="demoGoal" defaultValue={plan.ext?.hackathon?.demoGoal || ''} /></label>
        <button className="btn" type="submit">Save details</button>
      </form>
    </section>
    <div className="two-col">
      <section className="card"><div className="section-head"><h2>Workstreams</h2></div>
        <form className="inline-form" onSubmit={submitTrack}><input name="name" required placeholder="Product" /><input name="color" type="color" defaultValue="#D4553A" /><button className="btn">Add</button></form>
        <div className="chip-list">{plan.tracks.map(track => <button type="button" className="track-chip" style={{ '--track': track.color }} key={track.id} onClick={() => setPlan(removeHackathonItem(plan, track.id))}>{track.name}<span>×</span></button>)}</div>
      </section>
      <section className="card"><div className="section-head"><h2>Milestones</h2></div>
        <form className="form-grid" onSubmit={submitMilestone}><label>Title<input name="title" required /></label><label>Date<input type="date" name="date" required /></label><button className="btn">Add milestone</button></form>
        <ul className="plain-list">{status.milestones.map(item => <li key={item.id}><span>{item.date} · {item.title}</span><button className="link-button" onClick={() => setPlan(removeHackathonItem(plan, item.id))}>Remove</button></li>)}</ul>
      </section>
    </div>
    <section className="card"><div className="section-head"><div><p className="eyebrow">Execution</p><h2>Tasks</h2></div></div>
      <form className="form-grid" onSubmit={submitTask}>
        <label>Task<input name="title" required /></label><label>Date<input name="date" type="date" required defaultValue={today} /></label>
        <label>Workstream<select name="track"><option value="">Unassigned</option>{plan.tracks.map(track => <option value={track.id} key={track.id}>{track.name}</option>)}</select></label>
        <label>Blocked by<input name="blockedBy" /></label><label className="check"><input type="checkbox" name="demoCritical" />Demo-critical</label>
        <button className="btn primary">Add task</button>
      </form>
      <div className="task-list">{tasks.map(task => {
        const track = plan.tracks.find(item => item.id === task.track);
        const complete = progressValue(done, plan.id, task.id);
        return <article className={`task ${complete ? 'done' : ''}`} style={{ '--track': track?.color || '#6A5B4A' }} key={task.id}>
          <button className="task-check" aria-label={complete ? 'Mark open' : 'Mark done'} onClick={() => toggle(plan.id, task.id)}>{complete ? '✓' : ''}</button>
          <div><strong>{task.title}</strong><span>{task.date} · {track?.name || 'Unassigned'}</span>{task.ext?.hackathon?.blockedBy && <small>Blocked by {task.ext.hackathon.blockedBy}</small>}</div>
          <button className="link-button" onClick={() => setPlan(removeHackathonItem(plan, task.id))}>Remove</button>
        </article>;
      })}</div>
    </section>
    <HackathonImportPanel plan={plan} setPlan={setPlan} />
  </main>;
}
