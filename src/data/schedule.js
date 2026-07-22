import { BLOCKS, ALL_PROBLEMS } from './dsa.js';
import { LLD, AI, EVENTS, PHASES } from './tracks.js';
import { ACADEMICS, SUBJECT_ORDER } from './academics.js';
import { DSA_VIDEOS } from './dsavideos.js';
import { CF_POOL } from './codeforces.js';
import { APTITUDE } from './aptitude.js';

// Dedicated revision windows. Without these the plan teaches modules but never
// schedules the consolidation that actually converts into marks.
const SUBJ = ['CE301 Distributed Computing','CE302 Software Engineering','CE303 AI & Soft Computing',
  'CE304 Theory of Computation','CE305 Cryptography & Network Security','M132 UI/UX'];
const EXAM_PREP = [
  { from:'2026-08-31', to:'2026-09-06', label:'Mid-term revision', subjects:SUBJ,
    meta:'~45 min · past papers + your own notes',
    why:'Mid-terms are 7-11 Sep and worth 15-20 marks each. Two focused days per subject beats a week of drifting. Work past papers, not videos — you have already watched the videos.' },
  { from:'2026-10-26', to:'2026-11-01', label:'Practical exam prep', subjects:SUBJ,
    meta:'~40 min · re-run experiments + viva questions',
    why:'Practicals are 2-6 Nov. Re-run each experiment so it works first time, and read the viva questions on the Labs tab the night before. Lab ISE is 25 marks per subject and 26 for CE303.' },
  { from:'2026-11-07', to:'2026-11-22', label:'Theory revision', subjects:SUBJ,
    meta:'~90 min · full module sweep',
    why:'Preparation leave. Every module has been seen three times by now, so this is genuine revision rather than first contact. Prioritise the self-study modules in CE301, CE302, CE303 and CE305 — never lectured, still examinable.' },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const parse = (s) => new Date(s + 'T00:00:00');

const START = '2026-07-27';
const END = '2027-01-04';
// Last day that can carry a NEW module. Set so that the final session's +21 revision
// still lands before the 23 Nov theory exams, and so practical exams (2-6 Nov) are clear.
// After this date it is revision only.
const TEACHING_END = '2026-11-01';

// Spaced revision: revisit each study session after one week, then after three more.
// Studied once + revised twice = every module seen 3x before the 23 Nov theory exams.
export const REVISIT = [7, 21];

const CF_BAND = { 'Foundation':'800-1000', 'Mid Terms':'800-1000', 'Build & Compete':'1000-1200', 'Exams':'1000-1200', 'Open Ground':'1200-1400' };

function phaseFor(dateStr) {
  return PHASES.find((p) => dateStr >= p.start && dateStr <= p.end) || PHASES[PHASES.length - 1];
}

function contestFor(dow) {
  if (dow === 6) return { t: 'Codeforces round (Div 3/4 if available, else virtual)', u: 'https://codeforces.com/contests', why: 'Rating only moves in contests. Register even when you feel unready — that feeling is not information.' };
  if (dow === 0) return { t: 'AtCoder Beginner Contest', u: 'https://atcoder.jp/contests/', why: 'Cleaner and better-calibrated than Div 2 for your level. Optional if Saturday went long.' };
  return null;
}

const mins = (s) => Math.round(s / 60);
export const dur = (s) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m` : `${m} min`;
};

// A session's task title names the actual videos, never "watch the playlist".
function sessionTitle(sess) {
  const it = sess.items;
  if (it.length === 1) {
    const v = it[0];
    return v.seg ? `${v.title} — ${v.seg} (${v.part})` : v.title;
  }
  return `${it[0].title} → ${it[it.length-1].title.length > 44 ? it[it.length-1].title.slice(0,42)+'…' : it[it.length-1].title}`;
}
const sessionBody = (sess) => sess.items.map((v) => ({
  t: v.seg ? `${v.title} (${v.seg})` : v.title, u: v.url, m: mins(v.seconds),
}));

/* ---------------------------------------------------------------------------
   Academic queue.
   Lectures cover all six subjects in the same week, so the queue interleaves
   subjects rather than finishing one before starting the next. Each subject's
   sessions are spread evenly across the whole term by normalised position.
--------------------------------------------------------------------------- */
function buildAcademicQueue() {
  const q = [];
  SUBJECT_ORDER.forEach((code) => {
    const s = ACADEMICS[code];
    const flat = [];
    s.modules.forEach((m) => m.sessions.forEach((sess, i) => {
      flat.push({ code, subject: s.name, color: s.color, channel: s.channel,
        module: m.m, moduleName: m.name, topics: m.topics,
        idx: i + 1, of: m.sessions.length, sess });
    }));
    flat.forEach((f, i) => q.push({ ...f, pos: (i + 0.5) / flat.length }));
  });
  return q.sort((a, b) => a.pos - b.pos)
          .map((x, i) => ({ ...x, sid: `st-${x.code}-${x.module}-${x.idx}`, order: i }));
}

const ACADEMIC_QUEUE = buildAcademicQueue();

function isExamDay(dateStr) {
  return EVENTS.some((e) => e.d === dateStr && e.type === 'exam');
}

// Days that can carry NEW study: Mon-Sat, inside the teaching term, not an exam day.
function teachingDays() {
  const out = [];
  let cur = parse(START);
  const end = parse(TEACHING_END);
  while (cur <= end) {
    const ds = iso(cur), dow = cur.getDay();
    if (dow !== 0 && !isExamDay(ds)) out.push(ds);
    cur = addDays(cur, 1);
  }
  return out;
}

/* Spread the queue across the available teaching days at a constant rate, so the
   last module lands before the exams instead of piling up in November. */
function assignStudy() {
  const days = teachingDays();
  const byDate = {};
  const rate = ACADEMIC_QUEUE.length / days.length;
  let acc = 0, i = 0;
  days.forEach((ds) => {
    acc += rate;
    const take = Math.min(Math.floor(acc), ACADEMIC_QUEUE.length - i);
    if (take > 0) {
      byDate[ds] = ACADEMIC_QUEUE.slice(i, i + take);
      i += take; acc -= take;
    }
  });
  // Anything left over (rounding) goes onto the final teaching days.
  let k = days.length - 1;
  while (i < ACADEMIC_QUEUE.length && k >= 0) {
    const ds = days[k--];
    (byDate[ds] = byDate[ds] || []).push(ACADEMIC_QUEUE[i++]);
  }
  return byDate;
}

const STUDY_BY_DATE = assignStudy();

// date -> one revision task per session, derived from when each session was first studied
const REVISION_BY_DATE = (() => {
  const out = {};
  Object.entries(STUDY_BY_DATE).forEach(([studiedOn, entries]) => {
    REVISIT.forEach((gap) => {
      const target = iso(addDays(parse(studiedOn), gap));
      if (target > END) return;
      out[target] = out[target] || [];
      entries.forEach((e) => out[target].push({ ...e, gap, from: studiedOn }));
    });
  });
  return out;
})();

export function buildSchedule() {
  const days = [];
  let pIdx = 0, lldIdx = 0, aiIdx = 0;
  let cfIdx = { '800-1000': 0, '1000-1200': 0, '1200-1400': 0 };
  const pendingVideos = [];   // block intro videos, drained one per day
  let cur = parse(START);
  const end = parse(END);

  while (cur <= end) {
    const dateStr = iso(cur);
    const dow = cur.getDay();
    const phase = phaseFor(dateStr);
    const evs = EVENTS.filter((e) => e.d === dateStr);
    const isExamWeek = evs.some((e) => e.type === 'exam');
    const tasks = [];

    // --- fixed events first ---
    evs.forEach((e, i) => {
      tasks.push({ id: `ev-${dateStr}-${i}`, track: e.type === 'exam' ? 'college' : 'admin',
        title: e.t, url: e.u, why: e.why, weight: 1, pin: true });
    });

    /* ---------------- COLLEGE: new study ---------------- */
    (STUDY_BY_DATE[dateStr] || []).forEach((e) => {
      const body = sessionBody(e.sess);
      tasks.push({
        id: e.sid,
        track: 'college',
        title: `${e.code} M${e.module} · ${sessionTitle(e.sess)}`,
        url: body[0].u,
        videos: body,
        meta: `${e.subject} · Module ${e.module}: ${e.moduleName} · ${e.idx}/${e.of} · ${dur(e.sess.seconds)}`,
        why: `${e.channel}. ${e.topics ? e.topics + '. ' : ''}Watch these exact videos, take one page of notes, then close the tab. You will see this module twice more — one week from now and three weeks after that — so you do not need to master it today.`,
        weight: 1,
      });
    });

    /* ---------------- COLLEGE: spaced revision ---------------- */
    (REVISION_BY_DATE[dateStr] || []).forEach((e, i) => {
      const body = sessionBody(e.sess);
      const second = e.gap === 21;
      tasks.push({
        id: `rev${e.gap}-${e.sid}`,
        track: 'college',
        title: `Revise ${e.code} M${e.module} · ${e.moduleName}`,
        url: body[0].u,
        videos: body,
        meta: `Revision ${second ? '2 of 2' : '1 of 2'} · ${e.gap} days on · ${dur(e.sess.seconds)} of video`,
        why: second
          ? 'Third and final pass on this module. Do not rewatch first — cover your notes and write down what you remember, then play the videos at 1.5x only to patch what you missed. Whatever survives this pass is what you will still have in November.'
          : 'Second pass, one week on. Re-read your notes first and try to reconstruct the topic from memory. Only replay the parts you could not. This is phone-and-headphones work — do it on the train, not at your desk.',
        weight: 1,
      });
    });

    /* ---------------- DSA problems ---------------- */
    let count = phase.pd;
    if (dow === 0) count = Math.max(1, count - 1);
    for (let i = 0; i < count && pIdx < ALL_PROBLEMS.length; i++) {
      const p = ALL_PROBLEMS[pIdx++];
      tasks.push({ id: `p-${p.n}`, track: 'dsa', title: p.n, url: p.s,
        meta: `${p.d} · ${p.blockName}`, why: p.tag, weight: 1 });
    }

    /* ---------------- DSA: block intro videos ----------------
       Queued rather than dumped: a new block can carry six sessions of video, and
       stacking them all on day one is exactly the "impossible task" that gets skipped. */
    const nextP = ALL_PROBLEMS[pIdx - count];
    if (nextP) {
      const prevP = ALL_PROBLEMS[pIdx - count - 1];
      if (!prevP || prevP.block !== nextP.block) {
        const b = BLOCKS.find((x) => x.id === nextP.block);
        const dv = DSA_VIDEOS[nextP.block];
        if (dv) {
          dv.sessions.forEach((s, i) => pendingVideos.push({ block: nextP.block, b, dv, s, i }));
        } else if (b && b.videos[0]) {
          tasks.push({ id: `v-${b.id}`, track: 'dsa', title: b.videos[0].t, url: b.videos[0].u,
            why: b.videos[0].note || b.why, meta: `New block: ${b.name}`, weight: 1 });
        }
      }
    }
    if (pendingVideos.length && !isExamWeek) {
      const { b, dv, s, i, block } = pendingVideos.shift();
      const body = sessionBody(s);
      tasks.push({
        id: `v-${block}-${i}`,
        track: 'dsa',
        title: `${dv.channel} — ${sessionTitle(s)}`,
        url: body[0].u,
        videos: body,
        meta: `${b ? b.name : ''} · watch ${i+1} of ${dv.sessions.length} · ${dur(s.seconds)}`,
        why: `${dv.playlistTitle} is ${dv.videoCount} videos and ${dur(dv.totalSeconds)} in total — you are not watching that in a day, and being told to would just make you skip it. These are the ones that matter before the problems. ${b ? b.why : ''}`,
        weight: 1,
      });
    }

    /* ---------------- DSA: reinforcement (spaced repetition) ---------------- */
    const reCount = isExamWeek ? 0 : (phase.name === 'Mid Terms' ? 1 : 2);
    const seenRe = new Set();
    for (let k = 0; k < reCount && pIdx > 6; k++) {
      const span = Math.max(1, pIdx - 6);
      const lookback = (days.length * 2 + k * 5) % span;
      const r = ALL_PROBLEMS[lookback];
      if (r && !seenRe.has(r.n)) {
        seenRe.add(r.n);
        tasks.push({ id: `re-${dateStr}-${k}`, track: 'dsa', title: `Re-solve: ${r.n}`, url: r.s,
          meta: `Reinforce · ${r.blockName}`,
          why: 'Already solved once. Do it from blank, no notes. Phone-friendly — this is your train and dead-lecture problem. If it takes over 10 minutes you had not actually learned it, and finding that out now is the whole point.',
          weight: 1 });
      }
    }

    /* ---------------- Codeforces: one named problem, never "pick anything" ---------------- */
    if (!isExamWeek) {
      const band = CF_BAND[phase.name] || '800-1000';
      const pool = CF_POOL[band];
      const prob = pool[cfIdx[band] % pool.length];
      cfIdx[band]++;
      tasks.push({
        id: `cf-${dateStr}`,
        track: 'contest',
        title: `Solve CF ${prob.id} — ${prob.name}`,
        url: prob.url,
        meta: `rated ${prob.rating} · ${prob.solved.toLocaleString()} solvers${prob.tags.length ? ' · ' + prob.tags.join(', ') : ''}`,
        why: 'LeetCode does not move your Codeforces rating. LeetCode names the pattern for you; Codeforces makes you find it, and that gap is exactly what a contest tests. This one is picked for you so there is nothing to decide — open it and start. If you are still stuck after 30 minutes, read the editorial and log it.',
        weight: 1,
      });
    }

    /* ---------------- LeetCode daily ---------------- */
    if (!isExamWeek) {
    // --- Aptitude: rotates topics Mon-Fri. The round that eliminates people
    // before anyone reads their code, and the most trainable thing here. ---
    if (!isExamWeek && dow >= 1 && dow <= 5) {
      const t = APTITUDE.topics[days.length % APTITUDE.topics.length];
      tasks.push({
        id: `apt-${dateStr}`,
        track: 'aptitude',
        title: `Aptitude: ${t.n}`,
        url: 'https://www.indiabix.com/',
        meta: `${t.tag} · ~20 min · then 2 min Zetamac`,
        why: (t.note ? t.note + ' ' : '') + 'One IndiaBIX topic set, then two minutes of Zetamac arithmetic. Doable in a dead lecture.',
        weight: 1,
      });
    }

    // --- Exam preparation: real revision blocks, not a vague "study" line.
    // Grades are lost by meeting a subject for the first time in prep leave. ---
    EXAM_PREP.forEach((w, i) => {
      if (dateStr < w.from || dateStr > w.to) return;
      const subj = w.subjects[(days.length + i) % w.subjects.length];
      tasks.push({
        id: `prep-${dateStr}-${i}`,
        track: 'college',
        title: `${w.label}: ${subj}`,
        meta: w.meta,
        why: w.why,
        weight: 1,
      });
    });

      tasks.push({ id: `daily-${dateStr}`, track: 'dsa', title: 'LeetCode Daily Challenge',
        url: 'https://leetcode.com/problemset/',
        why: 'Ten minutes, keeps the streak on LeetCode itself, and it is random — so it tests recall rather than the topic you just studied. Do it on your phone in a dead lecture.',
        meta: 'Daily · counts toward your streak', weight: 1 });
    }

    /* ---------------- contests ---------------- */
    const c = contestFor(dow);
    if (c && !isExamWeek) tasks.push({ id: `c-${dateStr}`, track: 'contest', title: c.t, url: c.u, why: c.why, weight: 1 });
    if (dow === 0) {
      tasks.push({ id: `up-${dateStr}`, track: 'contest',
        title: 'UPSOLVE yesterday\'s contest — solve what you could not, editorial allowed',
        url: 'https://codeforces.com/contests',
        why: 'The single highest-return habit in CP and the one everyone skips. A contest you upsolve is worth ~5 you do not. If your week collapses, keep only this.',
        weight: 1 });
    }

    /* ---------------- LLD / AI ---------------- */
    if ((dow === 2 || dow === 5) && lldIdx < LLD.units.length && !isExamWeek) {
      const u = LLD.units[lldIdx++];
      tasks.push({ id: `lld-${lldIdx}`, track: 'lld', title: u.t, url: u.u, why: u.note, meta: u.kind, weight: 1 });
    }
    if ((dow === 3 || dow === 6) && aiIdx < AI.units.length && !isExamWeek) {
      const u = AI.units[aiIdx++];
      tasks.push({ id: `ai-${aiIdx}`, track: 'ai', title: u.t, url: u.u, why: u.note, meta: u.kind, weight: 1 });
    }

    /* ---------------- college admin ---------------- */
    if (dow === 6) {
      tasks.push({ id: `col-${dateStr}`, track: 'college',
        title: 'Clear this week\'s lab submissions and write up PR1 progress',
        why: 'Saturday is a working day for you. Lab ISE is 25 marks a subject and 26 for CE303 — the heaviest single component outside the mini project, and the easiest to score full marks on. Clear it now so Sunday is actually free.',
        weight: 0 });
    }

    /* ---------------- content ---------------- */
    if (dow === 4) {
      tasks.push({ id: `content-${dateStr}`, track: 'content',
        title: 'Post to LinkedIn — what you built / learned this week',
        url: 'https://linkedin.com',
        why: 'Same footage as your reels, but LinkedIn monetises as job offers instead of Rs 5,000 brand deals. ~30 min. Cap total content time at 4 hrs/week until January.',
        weight: 0 });
    }

    days.push({ date: dateStr, dow, phase: phase.name, phaseNote: phase.note, tasks });
    cur = addDays(cur, 1);
  }
  return days;
}

export const SCHEDULE = buildSchedule();
export const TOTAL_PROBLEMS = ALL_PROBLEMS.length;
export { BLOCKS, ALL_PROBLEMS, LLD, AI, EVENTS, PHASES, ACADEMICS, SUBJECT_ORDER, STUDY_BY_DATE };
