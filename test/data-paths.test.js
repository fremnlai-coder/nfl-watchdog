import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealPath, weekPath } from '../web/src/lib/data.js';

test('week- en revealpaden blijven binnen de verwachte mappen', () => {
  assert.equal(weekPath(2026, 4), 'data/public/2026/week-4.json');
  assert.equal(
    revealPath(2025, 14, '401772345', 'results'),
    'data/private/2025/week-14/401772345.results.json',
  );
});

test('padsegmenten accepteren geen traversal of onbekend revealtype', () => {
  assert.throws(() => weekPath('../2025', 1), /Ongeldige seizoen/);
  assert.throws(() => weekPath(2025, 19), /Ongeldige week/);
  assert.throws(() => revealPath(2025, 1, '../../score', 'results'), /Ongeldige wedstrijd-id/);
  assert.throws(() => revealPath(2025, 1, '401772345', '../results'), /Ongeldige revealtype/);
});
