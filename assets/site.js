// Cedar Ridge CS Club: shared page behavior.
// - mobile menu toggle
// - nav background once content scrolls under it
// - renders the lists from the files in /data into any element with data-list="..."
(() => {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.menu-toggle');

  // ---------- mobile menu ----------
  if (nav && toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });
    nav.querySelectorAll('ul a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Menu';
    }));
  }

  // ---------- nav background ----------
  // Home: turns solid once Meetings reaches the nav. Other pages start solid (set in their HTML).
  const meetings = document.getElementById('meetings');
  if (nav && meetings) {
    const update = () => nav.classList.toggle('solid', meetings.getBoundingClientRect().top < nav.offsetHeight);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  // ---------- scroll reveal (home) ----------
  // Each section animates in as you scroll down to it (styles in site.css, under "scroll reveal").
  // It resets only once it's entirely below the screen again, so scrolling back down replays it,
  // but scrolling up never hides what you're returning to. Cards drawn later by other scripts
  // animate when they're added. Skipped for reduced motion; without IntersectionObserver nothing hides.
  if (document.body.classList.contains('home') && 'IntersectionObserver' in window
      && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const sections = document.querySelectorAll('.content .section');
    document.documentElement.classList.add('reveal');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('in');
    }), { rootMargin: '0px 0px -12% 0px' });
    sections.forEach(s => io.observe(s));
    // Reset sections that are entirely below the screen (checked on scroll, since a jump can skip
    // past a section without it ever crossing the screen edge).
    let queued = false;
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        sections.forEach(s => { if (s.classList.contains('in') && s.getBoundingClientRect().top >= window.innerHeight) s.classList.remove('in'); });
      });
    }, { passive: true });
  }

  // ---------- copy buttons (Join section) ----------
  const status = document.querySelector('[data-copy-status]');
  document.querySelectorAll('[data-copy]').forEach(btn => {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied'; btn.classList.add('done');
        if (status) status.textContent = `Copied ${btn.dataset.copy}`;
      } catch (e) {
        btn.textContent = 'Select the code to copy';
      }
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1800);
    });
  });

  // ---------- arriving with #section in the link ----------
  // The browser jumps to the section before the next meeting, projects and slides have loaded, and
  // they then push it down. Hold it in place while the page settles, until you scroll yourself.
  const hashTarget = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const contentEl = document.querySelector('.content');
  if (hashTarget && contentEl && 'ResizeObserver' in window) {
    let held = true;
    const release = () => { held = false; ro.disconnect(); };
    const ro = new ResizeObserver(() => { if (held) hashTarget.scrollIntoView({ behavior: 'instant', block: 'start' }); });
    ro.observe(contentEl);
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => window.addEventListener(type, release, { once: true, passive: true }));
    setTimeout(release, 4000);
  }

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parseDate = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const fmt = (d, opts) => d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const byDateDesc = (a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0);
  const sampleChip = item => item.sample ? '<span class="chip">Sample</span>' : '';
  const ext = url => /^https?:\/\//.test(url) ? ' target="_blank" rel="noopener"' : '';

  const empty = (el, text) => { el.innerHTML = `<p class="empty">${esc(text)}</p>`; };

  // ---------- renderers ----------
  const renderers = {
    projects(el, limit) {
      const items = (window.CLUB_PROJECTS || []).slice().sort(byDateDesc).slice(0, limit || undefined);
      if (!items.length) return empty(el, 'No projects yet. The first demo night will fill this in.');
      el.innerHTML = '<ul class="rows">' + items.map(p => {
        const d = parseDate(p.date);
        const tags = (p.tags || []).length ? `<span class="tags">${p.tags.map(esc).join(', ')}</span>` : '';
        const link = p.link ? `<a class="go" href="${esc(p.link)}"${ext(p.link)}>${esc(p.linkLabel || 'Open')}</a>` : '<span></span>';
        return `<li>
          <div class="what">${esc(p.title)}${sampleChip(p)}<span>${esc(p.description)}</span>${tags}</div>
          <div class="when"><b>${esc(p.presenter)}</b>${d ? fmt(d) : ''}</div>
          ${link}
        </li>`;
      }).join('') + '</ul>';
    },

    presentations(el, limit) {
      const items = (window.CLUB_PRESENTATIONS || []).slice().sort(byDateDesc).slice(0, limit || undefined);
      if (!items.length) return empty(el, 'No slides posted yet.');
      el.innerHTML = '<ul class="rows">' + items.map(p => {
        const d = parseDate(p.date);
        const link = p.slides ? `<a class="go" href="${esc(p.slides)}"${ext(p.slides)}>Slides</a>` : '<span></span>';
        return `<li>
          <div class="what">${esc(p.title)}${sampleChip(p)}${p.description ? `<span>${esc(p.description)}</span>` : ''}</div>
          <div class="when"><b>${esc(p.presenter)}</b>${d ? fmt(d) : ''}</div>
          ${link}
        </li>`;
      }).join('') + '</ul>';
    },

    resources(el) {
      const groups = window.CLUB_RESOURCES || [];
      if (!groups.length) return empty(el, 'No resources yet.');
      el.innerHTML = groups.map(g => `<section class="group">
        <h2>${esc(g.group)}</h2>
        <ul class="rows">${(g.items || []).map(r => `<li>
          <div class="what"><a href="${esc(r.url)}"${ext(r.url)}>${esc(r.title)}</a><span>${esc(r.note)}</span></div>
          <span></span>
          <a class="go" href="${esc(r.url)}"${ext(r.url)}>Open</a>
        </li>`).join('')}</ul>
      </section>`).join('');
    },

    opportunities(el) {
      const all = window.CLUB_OPPORTUNITIES || [];
      const t = today();
      const upcoming = [], past = [];
      all.forEach(o => {
        const d = parseDate(o.date);
        (d && d < t ? past : upcoming).push(o);
      });
      // dated items soonest first, then undated ones
      upcoming.sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date);
        if (da && db) return da - db;
        return da ? -1 : db ? 1 : 0;
      });
      past.sort(byDateDesc);

      const row = o => {
        const d = parseDate(o.date);
        let dateHtml;
        if (d) {
          const days = Math.round((d - t) / 86400000);
          const left = days < 0 ? '' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days left`;
          const soon = days >= 0 && days <= 14 ? ' soon' : '';
          dateHtml = `<span class="d">${fmt(d, { month: 'short', day: 'numeric' })}</span>`
            + (left ? `<span class="left${soon}">${o.estimated ? 'About ' + left.toLowerCase() : left}</span>` : '');
        } else {
          dateHtml = `<span class="tbd">${esc(o.when || 'Date not announced')}</span>`;
        }
        const label = o.dateLabel ? `${esc(o.dateLabel)}${o.estimated ? ' (estimated)' : ''}` : '';
        return `<li>
          <div class="date-block">${dateHtml}</div>
          <div class="what">${esc(o.title)}<span>${esc(o.organizer)}${label ? '. ' + label : ''}</span><span>${esc(o.note)}</span></div>
          <a class="go" href="${esc(o.url)}"${ext(o.url)}>Details</a>
        </li>`;
      };

      el.innerHTML = (upcoming.length ? `<ul class="rows dated">${upcoming.map(row).join('')}</ul>`
          : '<p class="empty">Nothing coming up right now. Check back soon.</p>')
        + (past.length ? `<details class="past"><summary>Past (${past.length})</summary><ul class="rows dated">${past.map(row).join('')}</ul></details>` : '');
    },

    officers(el) {
      const people = window.CLUB_OFFICERS || [];
      if (!people.length) { el.hidden = true; return; }
      el.innerHTML = '<h3>Officers</h3><ul class="people">' + people.map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.role)}</span></li>`).join('') + '</ul>';
    },
  };

  document.querySelectorAll('[data-list]').forEach(el => {
    const fn = renderers[el.dataset.list];
    if (fn) fn(el, parseInt(el.dataset.limit, 10) || 0);
  });

  // A note under lists that still hold sample entries.
  document.querySelectorAll('[data-sample-note]').forEach(el => {
    const src = window[el.dataset.sampleNote] || [];
    el.hidden = !src.some(x => x.sample);
  });
})();
