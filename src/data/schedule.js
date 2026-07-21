import { BLOCKS, ALL_PROBLEMS } from './dsa.js';
import { LLD, AI, EVENTS, PHASES } from './tracks.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const parse = (s) => new Date(s + 'T00:00:00');

const START = '2026-07-22';
const END = '2027-01-04';

const CF_BAND = { 'Foundation':'800-1000', 'Mid Terms':'800-1000', 'Build & Compete':'1000-1200', 'Exams':'1000-1200', 'Open Ground':'1200-1400' };

function phaseFor(dateStr) {
  return PHASES.find((p) => dateStr >= p.start && dateStr <= p.end) || PHASES[PHASES.length - 1];
}

// Contest days: Saturday night CF, Sunday morning upsolve, Sunday ABC
function contestFor(dow, dateStr, phase) {
  if (dow === 6) return { t: 'Codeforces round (Div 3/4 if available, else virtual)', u: 'https://codeforces.com/contests', why: 'Rating only moves in contests. Register even when you feel unready — that feeling is not information.' };
  if (dow === 0) return { t: 'AtCoder Beginner Contest', u: 'https://atcoder.jp/contests/', why: 'Cleaner and better-calibrated than Div 2 for your level. Optional if Saturday went long.' };
  return null;
}

export function buildSchedule() {
  const days = [];
  let pIdx = 0;      // pointer into ALL_PROBLEMS
  let lldIdx = 0;
  let aiIdx = 0;
  let cur = parse(START);
  const end = parse(END);

  while (cur <= end) {
    const dateStr = iso(cur);
    const dow = cur.getDay(); // 0 Sun .. 6 Sat
    const phase = phaseFor(dateStr);
    const evs = EVENTS.filter((e) => e.d === dateStr);
    const isExamWeek = evs.some((e) => e.type === 'exam');

    const tasks = [];

    // --- fixed events first ---
    evs.forEach((e, i) => {
      tasks.push({
        id: `ev-${dateStr}-${i}`,
        track: e.type === 'exam' ? 'college' : 'admin',
        title: e.t,
        url: e.u,
        why: e.why,
        weight: 1,
        pin: true,
      });
    });

    // --- DSA problems ---
    let count = phase.pd;
    if (dow === 0) count = Math.max(1, count - 1); // Sunday is upsolve day
    for (let i = 0; i < count && pIdx < ALL_PROBLEMS.length; i++) {
      const p = ALL_PROBLEMS[pIdx++];
      tasks.push({
        id: `p-${p.n}`,
        track: 'dsa',
        title: p.n,
        url: p.s,
        meta: `${p.d} · ${p.blockName}`,
        why: p.tag,
        weight: 1,
      });
    }

    // --- block intro video when a new block starts ---
    const nextP = ALL_PROBLEMS[pIdx - count];
    if (nextP) {
      const prevP = ALL_PROBLEMS[pIdx - count - 1];
      if (!prevP || prevP.block !== nextP.block) {
        const b = BLOCKS.find((x) => x.id === nextP.block);
        if (b && b.videos[0]) {
          tasks.unshift({
            id: `v-${b.id}`,
            track: 'dsa',
            title: `WATCH FIRST: ${b.videos[0].t}`,
            url: b.videos[0].u,
            why: b.videos[0].note || b.why,
            meta: `New block: ${b.name}`,
            weight: 1,
          });
        }
      }
    }

    // --- Reinforcement: a problem from a block started 10+ days ago (spaced repetition) ---
    const reCount = isExamWeek ? 0 : (phase.name === 'Mid Terms' ? 1 : 2);
    for (let k = 0; k < reCount && pIdx > 6; k++) {
      const lookback = Math.max(0, pIdx - 10 - (days.length % 7) - k * 4);
      const r = ALL_PROBLEMS[lookback];
      if (r) {
        tasks.push({
          id: `re-${dateStr}-${k}`,
          track: 'dsa',
          title: `Re-solve: ${r.n}`,
          url: r.s,
          meta: `Reinforce · ${r.blockName}`,
          why: 'Already solved once. Do it from blank, no notes. Phone-friendly — this is your train and dead-lecture problem. If it takes over 10 minutes you had not actually learned it, and finding that out now is the whole point.',
          weight: 1,
        });
      }
    }

    // --- Codeforces practice: rating band scales with the phase ---
    if (!isExamWeek) {
      const band = CF_BAND[phase.name] || '800-1000';
      tasks.push({
        id: `cf-${dateStr}`,
        track: 'contest',
        title: `Codeforces practice — one problem rated ${band}`,
        url: `https://codeforces.com/problemset?tags=${band}`,
        meta: 'Sort by solve count, pick anything unsolved',
        why: 'LeetCode does not move your Codeforces rating. LeetCode names the pattern for you; Codeforces makes you find it, and that gap is exactly what a contest tests. One a day at this band is what turns into Specialist.',
        weight: 1,
      });
    }

    // --- LeetCode daily challenge (every day, free extra rep) ---
    if (!isExamWeek) {
      tasks.push({
        id: `daily-${dateStr}`,
        track: 'dsa',
        title: 'LeetCode Daily Challenge',
        url: 'https://leetcode.com/problemset/',
        why: 'Ten minutes, keeps the streak on LeetCode itself, and it is random — so it tests recall rather than the topic you just studied. Do it on your phone in a dead lecture.',
        meta: 'Daily · counts toward your streak',
        weight: 1,
      });
    }

    // --- contest ---
    const c = contestFor(dow, dateStr, phase);
    if (c && !isExamWeek) {
      tasks.push({ id: `c-${dateStr}`, track: 'contest', title: c.t, url: c.u, why: c.why, weight: 1 });
    }
    if (dow === 0) {
      tasks.push({
        id: `up-${dateStr}`,
        track: 'contest',
        title: 'UPSOLVE yesterday\'s contest — solve what you could not, editorial allowed',
        url: 'https://codeforces.com/contests',
        why: 'The single highest-return habit in CP and the one everyone skips. A contest you upsolve is worth ~5 you do not. If your week collapses, keep only this.',
        weight: 1,
      });
    }

    // --- LLD: Tue + Fri ---
    if ((dow === 2 || dow === 5) && lldIdx < LLD.units.length && !isExamWeek) {
      const u = LLD.units[lldIdx++];
      tasks.push({ id: `lld-${lldIdx}`, track: 'lld', title: u.t, url: u.u, why: u.note, meta: u.kind, weight: 1 });
    }

    // --- AI: Wed + Sat ---
    if ((dow === 3 || dow === 6) && aiIdx < AI.units.length && !isExamWeek) {
      const u = AI.units[aiIdx++];
      tasks.push({ id: `ai-${aiIdx}`, track: 'ai', title: u.t, url: u.u, why: u.note, meta: u.kind, weight: 1 });
    }

    // --- college: weekdays ---
    if (dow >= 1 && dow <= 6) {
      tasks.push({
        id: `col-${dateStr}`,
        track: 'college',
        title: dow === 6 ? 'College catch-up: labs, submissions, PR1' : 'Attend college + lab work',
        why: dow === 6 ? 'Saturday is a working day for you. Clear submissions so Sunday is free.' : 'Phone-drill easy problems during dead lectures. Never skip labs — CE303 lab ISE is 26 marks.',
        weight: 0,
      });
    }

    // --- content: Thu ---
    if (dow === 4) {
      tasks.push({
        id: `content-${dateStr}`,
        track: 'content',
        title: 'Post to LinkedIn — what you built / learned this week',
        url: 'https://linkedin.com',
        why: 'Same footage as your reels, but LinkedIn monetises as job offers instead of Rs 5,000 brand deals. ~30 min. Cap total content time at 4 hrs/week until January.',
        weight: 0,
      });
    }

    days.push({ date: dateStr, dow, phase: phase.name, phaseNote: phase.note, tasks });
    cur = addDays(cur, 1);
  }
  return days;
}

export const SCHEDULE = buildSchedule();
export const TOTAL_PROBLEMS = ALL_PROBLEMS.length;
export { BLOCKS, ALL_PROBLEMS, LLD, AI, EVENTS, PHASES };
