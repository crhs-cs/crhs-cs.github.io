// Cedar Ridge CS Club: presentations.
// Loads presentations from two places and merges them:
//   - data/presentations.json, built automatically from the files in presentations/slides/
//     (see tools/build-presentations.py)
//   - data/presentations.js, for slides that live somewhere else (a Google Slides link, say)
// Renders [data-presentations-grid] as cards with each deck's first slide as the thumbnail.
// Add data-limit="3" to show only the newest few (home page).
(() => {
  const grids = document.querySelectorAll('[data-presentations-grid]');
  if (!grids.length) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => { u = String(u || '').trim(); return /^https?:\/\//i.test(u) || /^\/(?!\/)/.test(u) ? u : ''; };
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
  // For hand-added Google Slides or Drive links: Drive's first-slide thumbnail, with Slides' own
  // PNG export as a backup. Both need the file shared as "Anyone with the link".
  const thumbs = (id, url) => id ? [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1280`,
    ...(/docs\.google\.com\/presentation/.test(url) || !url ? [`https://docs.google.com/presentation/d/${id}/export/png`] : []),
  ] : [];

  function normalize(p){
    const slides = safeUrl(p.slides);
    const thumb = safeUrl(p.thumb);
    const id = thumb ? '' : fileIdFrom(slides);
    return {
      sample: !!p.sample,
      title: String(p.title || '').trim(),
      presenter: String(p.presenter || '').trim(),
      date: parseDate(p.date),
      summary: String(p.summary || p.description || '').trim(),
      slides, id,
      images: thumb ? [thumb] : thumbs(id, slides),
      key: slides || String(p.title || '').toLowerCase(),
    };
  }

  async function load(){
    const local = (window.CLUB_PRESENTATIONS || []).map(normalize);
    let uploaded = [];
    try {
      const res = await fetch('/data/presentations.json', { cache: 'no-store' });
      if (res.ok) uploaded = (await res.json()).map(normalize);
    } catch (e) { console.warn('Could not load data/presentations.json', e); }
    const byKey = new Map();
    [...uploaded, ...local].forEach(p => { if (p.title) byKey.set(p.key, p); });
    let all = [...byKey.values()];
    if (all.some(p => !p.sample)) all = all.filter(p => !p.sample);   // the sample disappears once real slides exist
    return all.sort((a, b) => (b.date || 0) - (a.date || 0) || a.title.localeCompare(b.title));
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
