import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { dayProgressLabel } from './progressCopy.js';

const VIEWS = ['today', 'plans', 'settings', 'hackathon'];

const FORBIDDEN_UI_COPY = [
  /cold pot/i,
  /streak broken/i,
  /restart today/i,
  /in the pot/i,
  /nothing simmering/i,
  /rest is part of the recipe/i,
  /the whole pot/i,
  /the recipe/i,
  /side dishes/i,
  /marks in the pot/i,
  /on the heat/i,
  /seven small bowls/i,
  /one pantry/i,
  /one drop per day/i,
  /the kitchen/i,
  /warming up/i,
  /filled a spoon/i,
  /separate dishes/i,
  /DSA is the stock/i,
  /going into the pot/i,
  /how soon it burns/i,
  /nothing left on the clock/i,
  /\b(?:well|poorly) served\b/i,
];

const FORBIDDEN_EXACT_LABELS = ['Simmering', 'Served', 'Broth'];

function visibleText(markup) {
  return markup
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#x27|quot|amp|lt|gt);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('day progress uses the four clear, neutral states', () => {
  assert.equal(dayProgressLabel(0, 0), 'Rest day');
  assert.equal(dayProgressLabel(0, 4), 'Ready for today');
  assert.equal(dayProgressLabel(2, 4), 'In progress');
  assert.equal(dayProgressLabel(4, 4), 'Day complete');
});

test('generic empty states use a neutral plan illustration', async () => {
  const [appSource, illustrationSource] = await Promise.all([
    readFile(new URL('./App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./soup.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /function EmptyState\(/);
  assert.match(appSource, /<EmptyStateIllustration\s*\/>/);
  assert.match(illustrationSource, /export function EmptyStateIllustration\(/);
  assert.doesNotMatch(appSource, /\bEmptyPot\b/);
  assert.doesNotMatch(illustrationSource, /\bEmptyPot\b|empty pot/i);
});

test('every rendered app surface avoids metaphor-dependent product copy', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.location = { search: '' };
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const surfaces = [
      ...VIEWS.map(view => `?v=${view}`),
      '?window=panel',
      '?window=settings',
    ];
    const markup = surfaces.map(search => {
      globalThis.location.search = search;
      return renderToStaticMarkup(React.createElement(App));
    }).join(' ');
    const rendered = visibleText(markup);

    assert.match(rendered, /Soupz Tracker/);
    for (const accent of ['Miso', 'Tomato', 'Matcha', 'Beetroot', 'Kombu']) {
      assert.match(rendered, new RegExp(`\\b${accent}\\b`));
    }
    assert.match(rendered, /Rest day/i);
    for (const forbidden of FORBIDDEN_UI_COPY) assert.doesNotMatch(rendered, forbidden);
    for (const label of FORBIDDEN_EXACT_LABELS) {
      assert.doesNotMatch(markup, new RegExp(`>\\s*${label}\\s*<`, 'i'));
    }
  } finally {
    await server.close();
  }

  // Auth and the install prompt are stateful and may render nothing during SSR.
  // Inspect only their JSX text nodes—not CSS variables, component names or comments.
  const auxiliarySource = await Promise.all([
    readFile(new URL('./Auth.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./InstallPrompt.jsx', import.meta.url), 'utf8'),
  ]);
  const auxiliaryText = auxiliarySource
    .flatMap(source => [...source.matchAll(/>([^<>{}]+)</g)].map(match => match[1]))
    .join(' ');
  for (const forbidden of FORBIDDEN_UI_COPY) assert.doesNotMatch(auxiliaryText, forbidden);
  for (const label of FORBIDDEN_EXACT_LABELS) {
    assert.doesNotMatch(auxiliaryText, new RegExp(`\\b${label}\\b`, 'i'));
  }
});
