// Checks what a home-screen install needs from the build.
//
// This exists because the failure is silent: a missing icon or a manifest whose
// paths do not survive the Pages base gives you a working site with a
// screenshot for an icon, and nothing anywhere says so.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const DIST = new URL('dist/', ROOT);

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

const built = await exists(DIST);

// Reads width and height straight out of the IHDR chunk, so the test measures
// the file rather than trusting the filename.
async function pngSize(url) {
  const buf = await readFile(url);
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', `${url} is geen PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('de manifest en de iconen staan in de build', async (t) => {
  if (!built) return t.skip('geen dist/');

  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', DIST), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
  assert.ok(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'zonder maskable-icoon knipt Android het icoon zelf bij',
  );

  for (const [file, size] of [
    ['icons/apple-touch-icon.png', 180],
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/favicon-32.png', 32],
  ]) {
    assert.deepEqual(await pngSize(new URL(file, DIST)), { width: size, height: size });
  }
});

test('de paden in de manifest zijn relatief, want Pages serveert vanaf /<repo>/', async (t) => {
  if (!built) return t.skip('geen dist/');
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', DIST), 'utf8'));

  // An absolute path here would point at the domain root, which on Pages lands
  // beside the site. Relative resolves against the manifest's own URL.
  for (const path of [manifest.start_url, manifest.scope, ...manifest.icons.map((i) => i.src)]) {
    assert.ok(!path.startsWith('/'), `${path} is absoluut`);
    assert.ok(!/^https?:/.test(path), `${path} wijst naar een andere host`);
  }
});

test('index.html verwijst naar manifest en icoon onder dezelfde base als de bundel', async (t) => {
  if (!built) return t.skip('geen dist/');
  const html = await readFile(new URL('index.html', DIST), 'utf8');

  // The base this was built with, taken from the script tag: whether that is
  // ./ or /nfl-watchdog/, the other references have to follow it.
  const script = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
  assert.ok(script, 'geen scripttag gevonden');
  const base = script.slice(0, script.indexOf('assets/'));

  for (const rel of ['manifest.webmanifest', 'icons/apple-touch-icon.png']) {
    assert.ok(
      html.includes(`href="${base}${rel}"`),
      `verwacht href="${base}${rel}" in index.html`,
    );
  }
});

test('de viewport laat de pagina onder de insets door lopen', async (t) => {
  if (!built) return t.skip('geen dist/');
  const html = await readFile(new URL('index.html', DIST), 'utf8');

  // Without viewport-fit=cover every env(safe-area-inset-*) in the stylesheet
  // reads zero, and landscape gets a bar down either side.
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
});
