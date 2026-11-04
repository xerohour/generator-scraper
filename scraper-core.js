'use strict';
/* Scrape pipeline (no DOM): parse the bookmarklet JSON, download every file
 * from the CDN as raw bytes, size-verify each against the manifest, and build
 * a clean zip. Binaries are NEVER decoded as text. Works in browser + node. */
(function (root) {
  const zipNs = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./zip.js')
    : (root.ScraperZip || {});
  const buildZip = zipNs.buildZip;

  const CDN_BASE = 'https://user.uploads.dev/file/';

  function looksLikeManifest(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
    const vals = Object.values(d);
    return vals.length > 0 && vals.every(
      (v) => v && typeof v === 'object' && typeof v.key === 'string' && typeof v.size === 'number'
    );
  }

  function cleanName(n) {
    return String(n || 'scrape').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'scrape';
  }

  // Returns {name, entries, totalBytes, fileCount}.
  // entries: [{zipName, data: Uint8Array} | {zipName, key, size}]
  function parsePayload(text) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      throw new Error('That is not valid JSON — paste the data copied by the bookmarklet.');
    }
    let name = 'scrape', main = '', page = '', manifest = null;
    if (d && typeof d === 'object' && d.manifest && looksLikeManifest(d.manifest)) {
      name = cleanName(d.name);
      main = String(d.main || '');
      page = String(d.page || '');
      manifest = d.manifest;
    } else if (looksLikeManifest(d)) {
      manifest = d; // bare srcManifest also accepted
    } else {
      throw new Error('Unrecognized data — paste the JSON copied by the bookmarklet (or a bare srcManifest).');
    }
    const enc = new TextEncoder();
    const entries = [];
    if (main) entries.push({ zipName: 'main.pjs', data: enc.encode(main) });
    if (page) entries.push({ zipName: 'index.html', data: enc.encode(page) });
    for (const p of Object.keys(manifest)) {
      entries.push({ zipName: 'src/' + p, key: manifest[p].key, size: manifest[p].size });
    }
    const totalBytes = entries.reduce((a, e) => a + (e.data ? e.data.length : e.size), 0);
    return { name, entries, totalBytes, fileCount: Object.keys(manifest).length };
  }

  async function fetchBinary(key, fetchImpl) {
    const res = await fetchImpl(CDN_BASE + key);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for file ' + key);
    return new Uint8Array(await res.arrayBuffer());
  }

  // opts: {fetchImpl, concurrency, onProgress(done, total)}
  // Resolves {name, zipBytes, fileCount, totalBytes}.
  // Rejects with err.failures = [{file, detail}] when any file fails to verify.
  async function scrapeToZip(payloadText, opts) {
    if (typeof buildZip !== 'function') throw new Error('zip engine missing');
    const o = opts || {};
    const f = o.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!f) throw new Error('no fetch available');
    const concurrency = o.concurrency || 6;
    const onProgress = o.onProgress || null;

    const parsed = parsePayload(payloadText);
    const entries = parsed.entries;
    const out = new Array(entries.length);
    const failures = [];
    let done = 0;
    const tick = () => { if (onProgress) onProgress(done, entries.length); };

    entries.forEach((e, i) => { if (e.data) { out[i] = e; done++; } });
    tick();

    const queue = [];
    entries.forEach((e, i) => { if (!e.data) queue.push({ e, i }); });

    async function worker() {
      while (queue.length) {
        const item = queue.shift();
        const e = item.e, i = item.i;
        try {
          const buf = await fetchBinary(e.key, f);
          if (buf.length !== e.size) {
            failures.push({ file: e.zipName, detail: 'size mismatch: got ' + buf.length + ', manifest wants ' + e.size });
          } else {
            out[i] = { zipName: e.zipName, data: buf };
          }
        } catch (err) {
          failures.push({ file: e.zipName, detail: String((err && err.message) || err) });
        }
        done++;
        tick();
      }
    }
    const nWorkers = Math.max(1, Math.min(concurrency, queue.length));
    const workers = [];
    for (let w = 0; w < nWorkers; w++) workers.push(worker());
    await Promise.all(workers);

    if (failures.length) {
      const err = new Error('VERIFY FAILED: ' + failures.length + ' file(s) did not verify — no zip was built.');
      err.failures = failures;
      throw err;
    }
    const zipBytes = buildZip(out.map((e) => ({ name: e.zipName, data: e.data })));
    return { name: parsed.name, zipBytes, fileCount: entries.length, totalBytes: parsed.totalBytes };
  }

  const api = { CDN_BASE, parsePayload, scrapeToZip };
  root.ScraperCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
