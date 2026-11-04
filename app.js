'use strict';
/* UI wiring for index.html (browser only). Requires zip.js + scraper-core.js. */
(function () {
  if (typeof document === 'undefined') return;
  const $ = (id) => document.getElementById(id);
  let loadedText = '';

  function fmtMB(n) {
    return (n / 1048576).toFixed(1) + ' MB';
  }

  $('loadBtn').addEventListener('click', () => {
    $('errors').textContent = '';
    try {
      const info = ScraperCore.parsePayload($('paste').value);
      loadedText = $('paste').value;
      $('summary').textContent =
        info.name + ': ' + info.fileCount + ' files, about ' + fmtMB(info.totalBytes);
      $('dlBtn').disabled = false;
      $('status').textContent = 'Ready — hit Download.';
    } catch (e) {
      loadedText = '';
      $('summary').textContent = '';
      $('dlBtn').disabled = true;
      $('status').textContent = 'Could not load: ' + e.message;
    }
  });

  $('dlBtn').addEventListener('click', async () => {
    const btn = $('dlBtn');
    btn.disabled = true;
    $('errors').textContent = '';
    const prog = $('prog');
    prog.hidden = false;
    prog.value = 0;
    try {
      const result = await ScraperCore.scrapeToZip(loadedText, {
        concurrency: 6,
        onProgress: (done, total) => {
          prog.value = total ? (done / total) * 100 : 0;
          $('status').textContent = 'Downloading ' + done + ' / ' + total + ' …';
        },
      });
      $('status').textContent = 'Building zip…';
      const blob = new Blob([result.zipBytes], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = result.name + '.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
      $('status').textContent =
        'Done — ' + result.name + '.zip (' + result.fileCount + ' files, ' + fmtMB(result.zipBytes.length) + ').';
    } catch (e) {
      $('status').textContent = e.message;
      if (e.failures && e.failures.length) {
        $('errors').textContent = e.failures
          .map((f) => 'FAIL ' + f.file + ': ' + f.detail)
          .join('\n');
      }
    } finally {
      prog.hidden = true;
      btn.disabled = false;
    }
  });
})();
