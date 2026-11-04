(async () => {
  try {
    const slug = location.pathname.slice(1).split(/[?#]/)[0].split('/')[0];
    if (!slug) throw new Error('open a generator page first');
    const d = await fetch('/api/getGeneratorPageData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generatorName: slug }),
    }).then((r) => {
      if (!r.ok) throw new Error('page data HTTP ' + r.status);
      return r.json();
    });
    const g = d.generator || {};
    const out = {
      name: slug,
      main: g.modelText || '',
      page: g.outputTemplate || '',
      imports: g.imports || [],
      manifest: g.srcManifest || {},
    };
    const text = JSON.stringify(out);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) { /* fall through to manual copy */ }
    if (!copied) {
      const w = window.open('', '_blank', 'width=640,height=640');
      if (!w) throw new Error('clipboard blocked and popups blocked — allow one of them and retry');
      w.document.title = 'Copy scrape data';
      const ta = w.document.createElement('textarea');
      ta.style.cssText = 'width:98%;height:94vh;font:12px monospace';
      ta.value = text;
      w.document.body.appendChild(ta);
      ta.focus();
      ta.select();
      alert('Clipboard was blocked — copy the text from the new tab, then paste it into the scraper.');
      return;
    }
    alert('Scrape data copied (' + Object.keys(out.manifest).length + ' files). Paste it into the scraper page.');
  } catch (e) {
    alert('Scraper bookmarklet failed: ' + e.message);
  }
})();
