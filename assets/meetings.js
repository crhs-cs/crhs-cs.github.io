// Cedar Ridge CS Club: the "Next meeting" block on the home page.
// Reads data/meetings.json, which a GitHub Action copies from the club's Google Calendar every hour
// (tools/build-meetings.py). If there's nothing upcoming, the block stays hidden and the calendar
// below it does the job on its own.
(() => {
  const el = document.querySelector('[data-next-meeting]');
  if (!el) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TZ = 'America/Chicago';
  const part = (d, opts) => d.toLocaleString('en-US', { timeZone: TZ, ...opts });
  // Calendar day in Chicago as a number, so "tomorrow" is right wherever the visitor is.
  const dayNum = d => { const [m, day, y] = part(d, { year: 'numeric', month: 'numeric', day: 'numeric' }).split('/'); return Date.UTC(+y, +m - 1, +day) / 86400000; };
  const time = d => part(d, { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' AM', ' am').replace(' PM', ' pm');
  const span = (a, b) => {
    const s = time(a), e = time(b);
    return s.slice(-2) === e.slice(-2) ? `${s.slice(0, -3)}–${e}` : `${s}–${e}`;   // 4:15–5:15 pm
  };

  function when(m, now){
    if (m.start <= now) return 'Happening now';
    const days = dayNum(m.start) - dayNum(now);
    return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  }

  function render(list){
    const now = new Date();
    const upcoming = list
      .map(m => ({ ...m, start: new Date(m.start), end: new Date(m.end) }))
      .filter(m => !isNaN(m.start) && m.end > now)
      .sort((a, b) => a.start - b.start);
    if (!upcoming.length) return;
    const [next, ...later] = upcoming;
    const detail = [next.allDay ? '' : span(next.start, next.end), next.location].filter(Boolean).join(', ');
    el.innerHTML = `
      <div class="next-main">
        <p class="next-label">Next meeting <span>${when(next, now)}</span></p>
        <p class="next-date"><span class="next-dow">${part(next.start, { weekday: 'long' })}</span>${part(next.start, { month: 'short', day: 'numeric' })}</p>
        <h3 class="next-title">${esc(next.title)}</h3>
        ${detail ? `<p class="next-detail">${esc(detail)}</p>` : ''}
      </div>
      ${later.length ? `<div class="next-after">
        <h3>After that</h3>
        <ol>${later.slice(0, 3).map(m => `<li><time datetime="${m.start.toISOString()}">${part(m.start, { month: 'short', day: 'numeric' })}</time><span>${esc(m.title)}</span></li>`).join('')}</ol>
      </div>` : ''}`;
    el.hidden = false;
  }

  fetch('/data/meetings.json', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : []))
    .then(list => Array.isArray(list) && render(list))
    .catch(() => {});
})();
