// Cedar Ridge CS Club: presentations.
// Loads presentations from two places and merges them:
//   - the club's presentations Drive folder, listed into a published sheet by tools/presentations-sync.gs
//     (link in data/config.js as presentationsSheetCSV)
//   - data/presentations.js, for anything added by hand
// Renders [data-presentations-grid] as cards with each deck's first slide as the thumbnail.
// Add data-limit="3" to show only the newest few (home page).
(() => {
  const grids = document.querySelectorAll('[data-presentations-grid]');
  if (!grids.length) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };
  const parseDate = s => {
    s = String(s || '').trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
  };
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // A Drive file ID from a Slides, Drive or Docs link.
  const fileIdFrom = u => {
    const m = String(u || '').match(/(?:\/presentation\/d\/|\/file\/d\/|[?&]id=)([\w-]{20,})/);
    return m ? m[1] : '';
  };
  // First-slide thumbnails: Drive's thumbnail for any deck, PowerPoint or PDF, with Slides' own
  // PNG export as a backup for Google Slides. Both need the file shared as "Anyone with the link".
  const thumbs = (id, url) => id ? [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1280`,
    ...(/docs\.google\.com\/presentation/.test(url) || !url ? [`https://docs.google.com/presentation/d/${id}/export/png`] : []),
  ] : [];

  function parseCSV(text){
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  function rowsToItems(rows){
    if (rows.length < 2) return [];
    const h = rows[0].map(x => x.toLowerCase().trim());
    const find = re => h.findIndex(x => re.test(x));
    const col = { title: find(/^title|name/), presenter: find(/present/), date: find(/date/), summary: find(/summary|descr/), slides: find(/slides|link|url/), fileId: find(/file id/) };
    return rows.slice(1).map(r => {
      const get = k => col[k] >= 0 ? (r[col[k]] || '').trim() : '';
      return { title: get('title'), presenter: get('presenter'), date: get('date'), summary: get('summary'), slides: get('slides'), fileId: get('fileId') };
    });
  }

  function normalize(p){
    const slides = safeUrl(p.slides);
    const id = String(p.fileId || '').trim().match(/^[\w-]{20,}$/) ? String(p.fileId).trim() : fileIdFrom(slides);
    return {
      sample: !!p.sample,
      title: String(p.title || '').trim(),
      presenter: String(p.presenter || '').trim(),
      date: parseDate(p.date),
      summary: String(p.summary || p.description || '').trim(),
      slides, id,
      images: thumbs(id, slides),
      key: id || slides || String(p.title || '').toLowerCase(),
    };
  }

  async function load(){
    const local = (window.CLUB_PRESENTATIONS || []).map(normalize);
    let remote = [];
    const url = (window.CLUB_CONFIG || {}).presentationsSheetCSV;
    if (url) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) remote = rowsToItems(parseCSV(await res.text())).map(normalize);
      } catch (e) { console.warn('Could not load the presentations sheet', e); }
    }
    const byKey = new Map();
    [...remote, ...local].forEach(p => { if (p.title) byKey.set(p.key, p); });   // a hand-added entry wins
    return [...byKey.values()].sort((a, b) => (b.date || 0) - (a.date || 0) || a.title.localeCompare(b.title));
  }

  // Generated cover, shown until (or instead of) the first-slide thumbnail.
  function cover(p){
    let h = 7; for (const ch of p.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const glyphs = '{}<>/\\=;()[]#*01';
    let pattern = '';
    for (let i = 0; i < 700; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; pattern += glyphs[(h >>> 24) % glyphs.length]; }
    return `<div class="cover" style="--a:${h % 180}deg;--h:${250 + (h % 24)}" aria-hidden="true">
      <span class="cover-pattern">${esc(pattern)}</span><span class="cover-title">${esc(p.title)}</span></div>`;
  }
  const media = p => `<div class="media-stack">${cover(p)}${p.images.length
    ? `<img class="pimg" src="${esc(p.images[0])}" data-backup="${esc(p.images.slice(1).join(' '))}" alt="First slide of ${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer">`
    : ''}</div>`;

  function card(p){
    const body = `<div class="pcard-media slide-media">${media(p)}</div>
      <div class="pcard-body">
        <h3>${esc(p.title)}${p.sample ? '<span class="chip">Sample</span>' : ''}</h3>
        ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
        <div class="pcard-meta">${esc(p.presenter)}${p.presenter && p.date ? ' · ' : ''}${p.date ? fmt(p.date) : ''}</div>
        ${p.slides ? '<span class="pcard-go">View slides</span>' : ''}
      </div>`;
    return `<li class="pcard">${p.slides
      ? `<a class="pcard-link" href="${esc(p.slides)}" target="_blank" rel="noopener">${body}</a>`
      : `<div class="pcard-link">${body}</div>`}</li>`;
  }

  // Thumbnails stay invisible until they load; a failed one tries its backup, then shows the cover.
  // (projects.js installs the same handlers; installing twice is harmless but avoided.)
  if (!window.__clubImgHandlers) {
    window.__clubImgHandlers = true;
    document.addEventListener('load', e => {
      if (e.target instanceof HTMLImageElement && e.target.classList.contains('pimg')) e.target.classList.add('loaded');
    }, true);
    document.addEventListener('error', e => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('pimg')) return;
      const rest = (img.dataset.backup || '').split(' ').filter(Boolean);
      if (rest.length) { img.dataset.backup = rest.slice(1).join(' '); img.src = rest[0]; } else img.remove();
    }, true);
  }

  load().then(items => {
    grids.forEach(el => {
      const limit = parseInt(el.dataset.limit, 10) || 0;
      const list = limit ? items.slice(0, limit) : items;
      el.innerHTML = list.length ? `<ul class="pgrid">${list.map(card).join('')}</ul>` : '<p class="empty">No slides posted yet.</p>';
    });
    document.querySelectorAll('[data-presentations-sample-note]').forEach(n => { n.hidden = !items.some(p => p.sample); });
  });
})();
