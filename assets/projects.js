// Cedar Ridge CS Club: projects.
// Loads projects from two places and merges them:
//   - data/projects.js (entries added by pull request)
//   - the approved-projects tab of the submission form's Google Sheet, if data/config.js has its link
// Then renders whichever of these the page contains:
//   [data-projects-grid]       all projects as image cards, with tag filter chips   (Projects page)
//   [data-projects-grid][data-limit="3"]   the newest few as cards                  (home page)
//   [data-project-view]        one project's page, from ?id=...                     (projects/view/)
(() => {
  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Only allow normal web links (and site-relative paths) so a submission can't inject a javascript: link.
  const safeUrl = u => {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/[^/]/.test(u)) return u;
    return '';
  };
  // Google Drive share links don't display as images; turn them into Drive's image thumbnail link.
  const imageUrl = u => {
    u = safeUrl(u);
    const m = u.match(/drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : u;
  };
  const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'project';
  const parseDate = s => {
    s = String(s || '').trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);                 // Google Sheets in a US locale
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    return null;
  };
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ext = u => /^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : '';
  const splitTags = v => Array.isArray(v) ? v : String(v || '').split(/[,;]/);
  const cleanTags = v => [...new Set(splitTags(v).map(t => String(t).trim()).filter(Boolean))].slice(0, 6);

  // ---------- CSV (RFC 4180: quoted fields, doubled quotes, newlines inside quotes) ----------
  function parseCSV(text){
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }

  // Match form questions to fields by the words in each column header, so small wording changes don't break it.
  const COLUMNS = [
    ['approved', /approv/],
    ['title', /project (name|title)|^title/],
    ['presenter', /present(er|ed by)|your name|name\(s\)|^names?$/],
    ['date', /date/],
    ['summary', /one[- ]line|short|summary/],
    ['description', /describ|about|details|how it works/],
    ['tags', /tag|categor|language|topic/],
    ['code', /code|github|repo|source/],
    ['demo', /demo|live|try it|website|play/],
    ['slides', /slide/],
    ['image', /screenshot|image|picture|photo/],
  ];
  function rowsToProjects(rows){
    if (rows.length < 2) return [];
    const header = rows[0].map(h => h.toLowerCase().trim());
    const col = {};
    COLUMNS.forEach(([key, re]) => {
      const i = header.findIndex((h, j) => re.test(h) && !Object.values(col).includes(j));
      if (i >= 0) col[key] = i;
    });
    return rows.slice(1).map(r => {
      const get = k => col[k] === undefined ? '' : (r[col[k]] || '').trim();
      // If the sheet has an Approved column, require it; the public tab may already be filtered.
      if (col.approved !== undefined && !/^(y|yes|true|x|approved|✓|✔)$/i.test(get('approved'))) return null;
      return {
        title: get('title'), presenter: get('presenter'), date: get('date'),
        summary: get('summary'), description: get('description'), tags: get('tags'),
        code: get('code'), demo: get('demo'), slides: get('slides'), image: get('image'),
        source: 'form',
      };
    }).filter(Boolean);
  }

  function normalize(p){
    const d = parseDate(p.date);
    const title = String(p.title || '').trim();
    return {
      sample: !!p.sample,
      id: slugify(p.id || (d ? d.toISOString().slice(0, 10) + '-' : '') + title),
      title,
      presenter: String(p.presenter || '').trim(),
      date: d,
      summary: String(p.summary || p.description || '').trim().split('\n')[0].slice(0, 140),
      description: String(p.description || p.summary || '').trim(),
      tags: cleanTags(p.tags),
      image: imageUrl(p.image),
      code: safeUrl(p.code || p.link),
      demo: safeUrl(p.demo),
      slides: safeUrl(p.slides),
    };
  }

  async function loadProjects(){
    const local = (window.CLUB_PROJECTS || []).map(normalize);
    let remote = [];
    const url = (window.CLUB_CONFIG || {}).projectsSheetCSV;
    if (url) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) remote = rowsToProjects(parseCSV(await res.text())).map(normalize);
      } catch (e) { console.warn('Could not load the project submissions sheet', e); }
    }
    // A pull-request entry with the same id wins over a form entry, so an officer can correct one.
    const byId = new Map();
    [...remote, ...local].forEach(p => { if (p.title) byId.set(p.id, p); });
    return [...byId.values()].sort((a, b) => (b.date || 0) - (a.date || 0) || a.title.localeCompare(b.title));
  }

  // ---------- pieces ----------
  // A generated cover for projects without a screenshot: the title set in mono over a pattern
  // seeded by the title, so every project still gets its own look.
  function cover(p){
    let h = 0; for (const ch of p.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const angle = h % 180, hue = 258 + (h % 30);
    const glyphs = '{}<>/\\=;()[]#*01';
    let pattern = '';
    for (let i = 0; i < 700; i++) {                                   // enough to fill the cover
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      pattern += glyphs[(h >>> 24) % glyphs.length];                // high bits: the low bits of this generator repeat quickly
    }
    return `<div class="cover" style="--a:${angle}deg;--h:${hue}" aria-hidden="true">
      <span class="cover-pattern">${esc(pattern)}</span>
      <span class="cover-title">${esc(p.title)}</span>
    </div>`;
  }
  const media = p => p.image
    ? `<img src="${esc(p.image)}" alt="Screenshot of ${esc(p.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover-fallback'}))">`
    : cover(p);
  const viewUrl = p => `/projects/view/?id=${encodeURIComponent(p.id)}`;
  const sampleChip = p => p.sample ? '<span class="chip">Sample</span>' : '';

  function card(p){
    return `<li class="pcard" data-tags="${esc(p.tags.join('|'))}">
      <a class="pcard-link" href="${viewUrl(p)}">
        <div class="pcard-media">${media(p)}</div>
        <div class="pcard-body">
          <h3>${esc(p.title)}${sampleChip(p)}</h3>
          ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
          <div class="pcard-meta">${esc(p.presenter)}${p.presenter && p.date ? ' · ' : ''}${p.date ? fmt(p.date) : ''}</div>
          ${p.tags.length ? `<ul class="tag-list">${p.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        </div>
      </a>
    </li>`;
  }

  // ---------- page renderers ----------
  function renderGrid(el, projects){
    const limit = parseInt(el.dataset.limit, 10) || 0;
    const list = limit ? projects.slice(0, limit) : projects;
    if (!list.length) { el.innerHTML = '<p class="empty">No projects yet. The first demo night will fill this in.</p>'; return; }

    const withFilter = !limit;
    const tags = [...new Set(projects.flatMap(p => p.tags))].sort((a, b) => a.localeCompare(b));
    const want = new URLSearchParams(location.search).get('tag') || '';
    const active = tags.includes(want) ? want : '';

    el.innerHTML = (withFilter && tags.length > 1 ? `<div class="filters" role="group" aria-label="Filter projects by tag">
        <button type="button" class="filter" data-tag="" aria-pressed="${!active}">All</button>
        ${tags.map(t => `<button type="button" class="filter" data-tag="${esc(t)}" aria-pressed="${t === active}">${esc(t)}</button>`).join('')}
      </div>` : '')
      + `<ul class="pgrid">${list.map(card).join('')}</ul>`
      + (withFilter ? '<p class="empty" data-none hidden>No projects with that tag yet.</p>' : '');

    if (!withFilter) return;
    const apply = tag => {
      let shown = 0;
      el.querySelectorAll('.pcard').forEach(li => {
        const on = !tag || li.dataset.tags.split('|').includes(tag);
        li.hidden = !on; if (on) shown++;
      });
      el.querySelectorAll('.filter').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tag === tag)));
      el.querySelector('[data-none]').hidden = shown > 0;
      const u = new URL(location.href);
      tag ? u.searchParams.set('tag', tag) : u.searchParams.delete('tag');
      history.replaceState(null, '', u);
    };
    el.addEventListener('click', e => { const b = e.target.closest('.filter'); if (b) apply(b.dataset.tag); });
    if (active) apply(active);
  }

  function renderView(el, projects){
    const id = new URLSearchParams(location.search).get('id') || '';
    const p = projects.find(x => x.id === id);
    if (!p) {
      el.innerHTML = `<div class="page-head"><h1>Project not found</h1><p class="lede">This link may be out of date. <a href="/projects/">See all projects</a>.</p></div>`;
      document.title = 'Project not found | Cedar Ridge CS Club';
      return;
    }
    document.title = `${p.title} | Cedar Ridge CS Club`;
    const links = [['Code', p.code], ['Try it', p.demo], ['Slides', p.slides]].filter(([, u]) => u);
    const i = projects.indexOf(p), newer = projects[i - 1], older = projects[i + 1];
    el.innerHTML = `
      <header class="page-head project-head">
        <a class="back" href="/projects/">All projects</a>
        <h1>${esc(p.title)}</h1>
        <p class="byline">${p.presenter ? `Presented by ${esc(p.presenter)}` : ''}${p.presenter && p.date ? ' on ' : ''}${p.date ? fmt(p.date) : ''}${sampleChip(p)}</p>
        ${p.tags.length ? `<ul class="tag-list">${p.tags.map(t => `<li><a href="/projects/?tag=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul>` : ''}
      </header>
      <div class="content"><div class="page-body project-body">
        <div class="project-media">${media(p)}</div>
        <div class="project-text">
          ${p.description ? p.description.split(/\n{2,}/).map(par => `<p>${esc(par).replace(/\n/g, '<br>')}</p>`).join('') : `<p class="lede">${esc(p.summary)}</p>`}
          ${links.length ? `<div class="project-links">${links.map(([label, u], k) => `<a class="${k ? 'button-ghost' : 'button'}" href="${esc(u)}"${ext(u)}>${label}</a>`).join('')}</div>` : ''}
        </div>
        <nav class="project-nav" aria-label="More projects">
          ${older ? `<a href="${viewUrl(older)}"><span>Older</span>${esc(older.title)}</a>` : '<span></span>'}
          ${newer ? `<a class="next" href="${viewUrl(newer)}"><span>Newer</span>${esc(newer.title)}</a>` : '<span></span>'}
        </nav>
      </div></div>`;
  }

  const grids = document.querySelectorAll('[data-projects-grid]');
  const view = document.querySelector('[data-project-view]');
  if (!grids.length && !view) return;
  loadProjects().then(projects => {
    grids.forEach(el => renderGrid(el, projects));
    if (view) renderView(view, projects);
    document.querySelectorAll('[data-projects-sample-note]').forEach(n => { n.hidden = !projects.some(p => p.sample); });
  });
})();
