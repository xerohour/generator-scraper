# Generator Scraper (self-hosted)

A static scrape-to-zip tool for public Perchance generators, hosted on GitHub
Pages. Paste a generator's file list and it downloads every file as raw bytes,
size-checks each one against the manifest, and builds a clean `.zip`.

## Why this exists

Perchance's own Generator Scraper builds its zip by downloading every file —
including PNGs, audio, fonts, and WASM — **as text** (`response.text()`),
which corrupts every binary it touches. This tool fetches everything as
`arrayBuffer` and verifies sizes, so binaries arrive intact. If any file fails
its size check, no zip is built and the offenders are listed.

## Use

1. Drag the **Scrape data** bookmarklet (on the page) to your bookmarks bar.
2. Open the generator's page on perchance.org and click the bookmarklet — it
   copies the generator's file list (same-origin, where Perchance allows it).
3. Paste into the page, Load, then Download the `.zip`.

The extra paste step exists because Perchance doesn't allow other sites to
request a generator's file list directly (no CORS headers); the file CDN
itself is openly fetchable, which is where the downloading happens.

The zip mirrors the classic layout: `main.pjs`, `index.html`, `src/…`.

## Files

- `index.html` — the tool page (bookmarklet included)
- `app.js` — UI wiring
- `scraper-core.js` — the scrape pipeline (parse → fetch → verify → zip); no DOM, also runs under node
- `zip.js` — minimal stored-zip writer (no compression, UTF-8 names, CRC32); no dependencies
- `bookmarklet.js` — readable bookmarklet source (the page embeds the encoded build)

## Scope

Scrape-to-zip only. The original's hunt/gallery tabs need Perchance's API and
can't run from a static host.
