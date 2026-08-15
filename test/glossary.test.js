// The glossary is plain data, so it gets a plain consistency check. The failure
// it guards against is mundane: adding a term and forgetting the order list, so
// the tooltip works but the entry never shows up in the reference section.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY, GLOSSARY_ORDER } from '../web/src/lib/glossary.js';

test('elke term in de volgorde bestaat ook echt', () => {
  for (const id of GLOSSARY_ORDER) {
    assert.ok(GLOSSARY[id], `"${id}" staat in de volgorde maar niet in het glossarium`);
  }
});

test('geen enkele term ontbreekt in de volgorde', () => {
  for (const id of Object.keys(GLOSSARY)) {
    assert.ok(GLOSSARY_ORDER.includes(id), `"${id}" staat niet in de getoonde volgorde`);
  }
});

test('elke term heeft een naam en een uitleg', () => {
  for (const [id, entry] of Object.entries(GLOSSARY)) {
    assert.ok(entry.term?.trim(), `${id} mist een naam`);
    assert.ok(entry.text?.trim().length > 30, `${id} heeft een te dunne uitleg`);
  }
});

test('de begrippen uit de opdracht staan er allemaal in', () => {
  const required = [
    'down', 'drive', 'red_zone', 'turnover', 'two_minute_warning',
    'bye', 'seed', 'wildcard', 'spread',
  ];
  for (const id of required) {
    assert.ok(GLOSSARY[id], `verplicht begrip "${id}" ontbreekt`);
  }
});

test('geen enkele uitleg verwijst naar een seizoen, ploeg of uitslag', () => {
  // Definitions are rules of the game. Anything season-specific in here would
  // put standings into the initial payload through the back door.
  // Years, team names and result words. Not "winnaar": "de winnaar van de
  // divisie plaatst zich" is a rule, not an outcome.
  const suspicious = /\b(20\d\d|chiefs|lions|49ers|packers|ravens|eagles|eindstand|uitslag)\b/i;
  for (const [id, entry] of Object.entries(GLOSSARY)) {
    assert.ok(
      !suspicious.test(entry.text),
      `${id}: uitleg bevat iets seizoensgebondens — "${entry.text}"`,
    );
  }
});
