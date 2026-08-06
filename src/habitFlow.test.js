import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createHabitPlan } from '../packages/core/src/index.js';

test('plain habit surface needs only a name and cadence, with no account or AI setup', async t => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  t.after(() => vite.close());
  const { HabitPanel } = await vite.ssrLoadModule('/src/App.jsx');
  const props = { setPlans() {}, done: {}, toggle() {}, today: '2026-07-31' };
  const empty = renderToStaticMarkup(React.createElement(HabitPanel, { ...props, plans: [] }));
  assert.match(empty, /Add a habit directly/);
  assert.match(empty, /name="title"/);
  assert.match(empty, /name="cadence"/);
  assert.doesNotMatch(empty, /API key|sign in|generate/i);

  const plan = createHabitPlan({ title: 'Read 20 minutes', from: '2026-07-31', timezone: 'Asia/Kolkata' });
  const populated = renderToStaticMarkup(React.createElement(HabitPanel, { ...props, plans: [plan] }));
  assert.match(populated, /Read 20 minutes/);
  assert.match(populated, /revision 1/);
});
