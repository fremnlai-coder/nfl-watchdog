import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import { scoreboard } from '../src/espn.js';

const SEASON = 2099;
const WEEK = 99;
const CACHE_FILE = new URL(`../data/cache/scoreboard-${SEASON}-w${WEEK}.json`, import.meta.url);

test('scoreboards verversen standaard en gebruiken de cache alleen expliciet offline', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ revision: ++calls }),
  });

  try {
    await unlink(CACHE_FILE).catch(() => {});
    assert.deepEqual(await scoreboard(SEASON, WEEK), { revision: 1 });
    assert.deepEqual(await scoreboard(SEASON, WEEK), { revision: 2 });
    assert.deepEqual(await scoreboard(SEASON, WEEK, { refresh: false }), { revision: 2 });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await unlink(CACHE_FILE).catch(() => {});
  }
});
