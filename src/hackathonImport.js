import { MemoryRepository, TrackerEngine, validatePlan } from '../packages/core/src/index.js';
import {
  addHackathonMilestone,
  addHackathonTask,
  addHackathonWorkstream,
  createHackathonPlan,
} from './hackathonMode.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const clean = value => String(value ?? '').trim();

export class HackathonImportError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'HackathonImportError';
    this.issues = issues;
  }
}

export function validateHackathonCandidate(candidate) {
  const issues = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, issues: [{ path: '$', message: 'must be an object' }] };
  }
  if (!clean(candidate.title)) issues.push({ path: 'title', message: 'is required' });
  if (!ISO_DATE.test(candidate.start || '')) issues.push({ path: 'start', message: 'must be an ISO date' });
  if (!ISO_DATE.test(candidate.deadline || '')) issues.push({ path: 'deadline', message: 'must be an ISO date' });
  if (candidate.start && candidate.deadline && candidate.deadline < candidate.start) issues.push({ path: 'deadline', message: 'must not be before start' });
  if (!Array.isArray(candidate.stages)) issues.push({ path: 'stages', message: 'must be an array' });
  if (!Array.isArray(candidate.deadlines)) issues.push({ path: 'deadlines', message: 'must be an array' });
  const names = new Set();
  (candidate.stages || []).forEach((stage, stageIndex) => {
    const name = clean(stage?.name);
    if (!name) issues.push({ path: `stages[${stageIndex}].name`, message: 'is required' });
    else if (names.has(name.toLowerCase())) issues.push({ path: `stages[${stageIndex}].name`, message: 'must be unique' });
    else names.add(name.toLowerCase());
    if (stage?.color && !HEX.test(stage.color)) issues.push({ path: `stages[${stageIndex}].color`, message: 'must be a six-digit hex colour' });
    if (!Array.isArray(stage?.tasks)) issues.push({ path: `stages[${stageIndex}].tasks`, message: 'must be an array' });
    (stage?.tasks || []).forEach((task, taskIndex) => {
      if (!clean(task?.title)) issues.push({ path: `stages[${stageIndex}].tasks[${taskIndex}].title`, message: 'is required' });
      if (!ISO_DATE.test(task?.date || '')) issues.push({ path: `stages[${stageIndex}].tasks[${taskIndex}].date`, message: 'must be an ISO date' });
    });
  });
  (candidate.deadlines || []).forEach((deadline, index) => {
    if (!clean(deadline?.title)) issues.push({ path: `deadlines[${index}].title`, message: 'is required' });
    if (!ISO_DATE.test(deadline?.date || '')) issues.push({ path: `deadlines[${index}].date`, message: 'must be an ISO date' });
  });
  return { ok: issues.length === 0, issues };
}

function jsonFromModelContent(content) {
  const text = clean(content).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); }
  catch { throw new HackathonImportError('Extractor returned malformed JSON. Nothing was saved.'); }
}

export async function extractHackathonCandidate({ endpoint, apiKey, allowNoKey = false, pageText, sourceUrl = '', fetchImpl = globalThis.fetch }) {
  const target = clean(endpoint);
  const text = clean(pageText);
  if (!target) throw new HackathonImportError('Configure an OpenAI-compatible extraction endpoint.');
  if (!text) throw new HackathonImportError('Paste the hackathon page text. Soupz does not fetch the page URL from the browser.');
  if (!allowNoKey && !clean(apiKey)) throw new HackathonImportError('This endpoint requires a key for this extraction. The key is not saved.');
  if (typeof fetchImpl !== 'function') throw new HackathonImportError('No network client is available.');

  const headers = { 'content-type': 'application/json' };
  if (clean(apiKey)) headers.authorization = `Bearer ${apiKey}`;
  const response = await fetchImpl(target, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'local-extractor',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Extract only facts present in the pasted hackathon text. Return strict JSON: {title,start,deadline,demoGoal,stages:[{name,color?,tasks:[{title,date,why?,demoCritical?,blockedBy?}]}],deadlines:[{title,date,why?}]}. Use YYYY-MM-DD dates. Do not invent stages, dates, people, or requirements.' },
        { role: 'user', content: `Source URL (reference only): ${clean(sourceUrl) || 'not supplied'}\n\nPasted page text:\n${text}` },
      ],
    }),
  });
  if (!response.ok) throw new HackathonImportError(`Extractor request failed with status ${response.status}. Nothing was saved.`);
  const payload = await response.json();
  const candidate = jsonFromModelContent(payload?.choices?.[0]?.message?.content);
  const validation = validateHackathonCandidate(candidate);
  if (!validation.ok) throw new HackathonImportError('Extractor output failed schema validation. Nothing was saved.', validation.issues);
  return { ...candidate, sourceUrl: clean(sourceUrl) };
}

export function candidateToHackathonPlan(candidate, options = {}) {
  const validation = validateHackathonCandidate(candidate);
  if (!validation.ok) throw new HackathonImportError('Candidate is not valid.', validation.issues);
  let plan = createHackathonPlan({
    title: candidate.title,
    start: candidate.start,
    deadline: candidate.deadline,
    demoGoal: candidate.demoGoal,
  }, options);
  const trackByName = new Map();
  for (const stage of candidate.stages) {
    plan = addHackathonWorkstream(plan, { name: stage.name, color: stage.color }, options);
    const track = plan.tracks.at(-1);
    trackByName.set(stage.name, track.id);
    for (const task of stage.tasks) {
      plan = addHackathonTask(plan, { ...task, track: track.id }, options);
    }
  }
  for (const deadline of candidate.deadlines) {
    plan = addHackathonMilestone(plan, { ...deadline, track: trackByName.get(deadline.stage) || null }, options);
  }
  plan.ext = {
    ...plan.ext,
    hackathon: { ...plan.ext.hackathon, sourceUrl: clean(candidate.sourceUrl) },
  };
  const planValidation = validatePlan(plan);
  if (!planValidation.ok) throw new HackathonImportError('Candidate could not produce a valid plan.', planValidation.errors);
  return plan;
}

export async function commitReviewedHackathon({ candidate, confirmed, engine, options }) {
  if (confirmed !== true) throw new HackathonImportError('Review and explicitly confirm the candidate before saving.');
  const plan = candidateToHackathonPlan(candidate, options);
  const write = await engine.writePlan({ plan, mode: 'create', dryRun: false });
  if (!write.validation.ok) throw new HackathonImportError('Plan validation failed before save.', write.validation.errors);
  return plan;
}

export function createReviewEngine(existingPlan = null) {
  return new TrackerEngine(new MemoryRepository({
    schemaVersion: 1,
    plans: existingPlan ? { [existingPlan.id]: existingPlan } : {},
    progress: existingPlan ? { [existingPlan.id]: { schemaVersion: 1, planId: existingPlan.id, entries: {} } } : {},
  }));
}

export function exportHackathonPlan(plan) {
  const validation = validatePlan(plan);
  if (!validation.ok || plan.kind !== 'hackathon') throw new HackathonImportError('Only a valid hackathon plan can be exported.', validation.errors);
  return `${JSON.stringify(plan, null, 2)}\n`;
}

export function importHackathonPlan(text) {
  let plan;
  try { plan = JSON.parse(text); }
  catch { throw new HackathonImportError('The teammate plan is not valid JSON.'); }
  const validation = validatePlan(plan);
  if (!validation.ok || plan.kind !== 'hackathon') throw new HackathonImportError('The teammate file is not a valid hackathon plan.', validation.errors);
  return plan;
}
