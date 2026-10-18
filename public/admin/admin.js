// Lead Vitality™ admin dashboard

const $ = (sel, root = document) => root.querySelector(sel);

const SOURCE_LABELS = {
  'exit-intent-15-free-leads': { text: '15 free leads', cls: 'exit' },
  'territory-check': { text: 'Territory check', cls: 'territory' },
};
const STATUS_LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost' };
const DAY = 864e5;

let leads = [];
let statuses = Object.keys(STATUS_LABELS);
let current = null;

// ---------- Helpers ----------
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const digits = (phone) => String(phone || '').replace(/[^\d+]/g, '');
const fullName = (l) => [l.firstName, l.lastName].filter(Boolean).join(' ') || '(no name)';
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days}d ago` : '';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
  });
  if (res.status === 401 && !path.endsWith('/login')) {
    showLogin();
    throw new Error('Signed out');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- Auth ----------
function showLogin() {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#login-form [name=password]').focus();
}

async function showApp(email) {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#user-email').textContent = email;
  await loadLeads();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('button');
  $('#login-error').textContent = '';
  btn.disabled = true;
  try {
    const { email } = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.email.value, password: form.password.value }),
    });
    form.password.value = '';
    await showApp(email);
  } catch (err) {
    $('#login-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#logout').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  leads = [];
  showLogin();
});

// ---------- Data ----------
async function loadLeads() {
  const data = await api('/api/admin/leads');
  leads = data.leads;
  statuses = data.statuses || statuses;
  fillFilterOptions();
  render();
  $('#last-updated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function fillFilterOptions() {
  const statusSel = $('#f-status');
  if (statusSel.options.length === 1) {
    statuses.forEach((s) => statusSel.add(new Option(STATUS_LABELS[s] || s, s)));
    statuses.forEach((s) => $('#d-status').add(new Option(STATUS_LABELS[s] || s, s)));
  }
  const nicheSel = $('#f-niche');
  const selected = nicheSel.value;
  const niches = [...new Set(leads.map((l) => l.industry).filter(Boolean))].sort();
  nicheSel.length = 1;
  niches.forEach((n) => nicheSel.add(new Option(n, n)));
  nicheSel.value = niches.includes(selected) ? selected : '';
}

function filtered() {
  const q = $('#f-search').value.trim().toLowerCase();
  const source = $('#f-source').value;
  const status = $('#f-status').value;
  const niche = $('#f-niche').value;
  const range = Number($('#f-range').value);
  const since = range ? startOfDay(Date.now() - (range - 1) * DAY) : 0;

  return leads.filter((l) => {
    if (source && l.source !== source) return false;
    if (status && l.status !== status) return false;
    if (niche && l.industry !== niche) return false;
    if (since && new Date(l.createdAt) < since) return false;
    if (q) {
      const hay = [l.firstName, l.lastName, l.business, l.email, l.phone, l.zip, l.industry, l.notes].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- Render ----------
function render() {
  renderKpis();
  renderDaily();
  renderNiches();
  renderTable();
}

function renderKpis() {
  const weekAgo = Date.now() - 7 * DAY;
  const prevWeek = Date.now() - 14 * DAY;
  const thisWeek = leads.filter((l) => new Date(l.createdAt) >= weekAgo).length;
  const lastWeek = leads.filter((l) => { const t = new Date(l.createdAt); return t >= prevWeek && t < weekAgo; }).length;
  const won = leads.filter((l) => l.status === 'won').length;
  const today = leads.filter((l) => new Date(l.createdAt) >= startOfDay(Date.now())).length;

  $('#kpi-total').textContent = leads.length;
  $('#kpi-total-sub').textContent = today ? `${today} today` : 'None today yet';
  $('#kpi-week').textContent = thisWeek;
  $('#kpi-week-sub').textContent = `vs ${lastWeek} the week before`;
  $('#kpi-new').textContent = leads.filter((l) => l.status === 'new').length;
  $('#kpi-exit').textContent = leads.filter((l) => l.source === 'exit-intent-15-free-leads').length;
  $('#kpi-territory').textContent = leads.filter((l) => l.source === 'territory-check').length;
  $('#kpi-won').textContent = won;
  $('#kpi-won-sub').textContent = leads.length ? `${Math.round((won / leads.length) * 100)}% of all sign-ups` : '';
}

function renderDaily() {
  const el = $('#daily-chart');
  const days = 30;
  const start = startOfDay(Date.now() - (days - 1) * DAY);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY);
    return { date: d, key: dayKey(d), count: 0 };
  });
  const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
  leads.forEach((l) => {
    const i = index[dayKey(new Date(l.createdAt))];
    if (i !== undefined) buckets[i].count += 1;
  });

  const max = Math.max(...buckets.map((b) => b.count));
  if (!max) {
    el.innerHTML = '<p class="chart-empty">No sign-ups in the last 30 days yet.</p>';
    return;
  }

  const W = Math.max(280, el.clientWidth || 600), H = 200, padL = 28, padB = 22, padT = 8;
  const plotW = W - padL, plotH = H - padB - padT;
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * Math.ceil(max / step);
  const slot = plotW / days;
  const barW = Math.max(2, slot - 2);
  const y = (v) => padT + plotH - (v / top) * plotH;
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

  let grid = '';
  for (let v = 0; v <= top; v += step) {
    grid += `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`;
    grid += `<text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }

  const bars = buckets.map((b, i) => {
    const x = padL + i * slot + 1;
    const h = Math.max(0, plotH - (y(b.count) - padT));
    const r = Math.min(4, barW / 2, h);
    const yTop = y(b.count);
    // rounded top corners, square at the baseline
    const path = h > 0
      ? `M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yTop + h} Z`
      : '';
    const label = `${fmt.format(b.date)}: ${b.count} sign-up${b.count === 1 ? '' : 's'}`;
    return `<rect class="hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}" data-tip="${esc(label)}"/>`
      + (path ? `<path class="bar" d="${path}"/>` : '<path class="bar" d=""/>');
  }).join('');

  const tickDays = W < 420 ? [0, 14, 29] : [0, 7, 14, 21, 29];
  const ticks = tickDays.map((i) => {
    const x = padL + i * slot + slot / 2;
    return `<text x="${x}" y="${H - 4}" text-anchor="middle">${fmt.format(buckets[i].date)}</text>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Sign-ups per day for the last 30 days">
    <g class="grid axis">${grid}</g><g>${bars}</g><g class="axis">${ticks}</g></svg>`;
}

function renderNiches() {
  const el = $('#niche-chart');
  const counts = {};
  leads.forEach((l) => { const k = l.industry || 'Unknown'; counts[k] = (counts[k] || 0) + 1; });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    el.innerHTML = '<p class="chart-empty">No sign-ups yet.</p>';
    return;
  }
  const max = rows[0][1];
  el.innerHTML = rows.map(([name, n]) => `
    <div class="niche-row" data-tip="${esc(`${name}: ${n}`)}">
      <span>${esc(name)}</span>
      <span class="track"><span class="fill" style="width:${(n / max) * 100}%"></span></span>
      <span class="val">${n}</span>
    </div>`).join('');
}

function renderTable() {
  const rows = filtered();
  const body = $('#lead-rows');
  body.innerHTML = rows.map((l) => {
    const src = SOURCE_LABELS[l.source] || { text: l.source || 'Other', cls: 'other' };
    const options = statuses.map((s) => `<option value="${s}"${s === l.status ? ' selected' : ''}>${STATUS_LABELS[s] || s}</option>`).join('');
    return `<tr data-id="${esc(l.id)}" class="${l.status === 'new' ? 'is-new' : ''}">
      <td class="nowrap">${esc(dateFmt.format(new Date(l.createdAt)))}<div class="sub">${esc(timeAgo(l.createdAt))}</div></td>
      <td><div class="name">${esc(fullName(l))}</div>${l.business ? `<div class="sub">${esc(l.business)}</div>` : ''}</td>
      <td><a href="mailto:${esc(l.email)}">${esc(l.email)}</a><div class="sub"><a href="tel:${esc(digits(l.phone))}">${esc(l.phone)}</a></div></td>
      <td>${esc(l.industry)}</td>
      <td>${esc(l.zip)}</td>
      <td><span class="badge ${src.cls}">${esc(src.text)}</span></td>
      <td><select class="row-status" aria-label="Status for ${esc(fullName(l))}">${options}</select></td>
    </tr>`;
  }).join('');

  const empty = $('#empty');
  empty.hidden = rows.length > 0;
  empty.textContent = leads.length
    ? 'No prospects match these filters.'
    : 'No sign-ups yet. New prospects from the website will appear here.';
  $('#count').textContent = leads.length ? `Showing ${rows.length} of ${leads.length}` : '';
}

// ---------- Updates ----------
async function updateLead(id, changes) {
  const updated = await api(`/api/admin/leads/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  const i = leads.findIndex((l) => l.id === id);
  if (i >= 0) leads[i] = updated;
  return updated;
}

$('#lead-rows').addEventListener('change', async (e) => {
  if (!e.target.matches('.row-status')) return;
  const id = e.target.closest('tr').dataset.id;
  try {
    await updateLead(id, { status: e.target.value });
    render();
  } catch (err) {
    alert(err.message);
  }
});

$('#lead-rows').addEventListener('click', (e) => {
  if (e.target.closest('a, select')) return;
  const tr = e.target.closest('tr');
  if (tr) openDrawer(tr.dataset.id);
});

// ---------- Drawer ----------
function openDrawer(id) {
  current = leads.find((l) => l.id === id);
  if (!current) return;
  const l = current;
  const src = SOURCE_LABELS[l.source]?.text || l.source;
  $('#d-name').textContent = fullName(l);
  $('#d-business').textContent = l.business || '';
  $('#d-call').href = `tel:${digits(l.phone)}`;
  $('#d-text').href = `sms:${digits(l.phone)}`;
  $('#d-email').href = `mailto:${l.email}`;

  const utm = Object.entries(l.utm || {}).map(([k, v]) => `${k.replace('utm_', '')}: ${v}`).join(', ');
  const rows = [
    ['Received', new Date(l.createdAt).toLocaleString()],
    ['Source', src],
    ['Email', l.email],
    ['Phone', l.phone],
    ['Niche', l.industry],
    ['ZIP', l.zip],
    ['Plan', l.plan],
    ['Consent', l.consent ? 'Yes' : 'No'],
    ['Came from', l.referrer],
    ['Campaign', utm],
    ['Updated', l.updatedAt ? new Date(l.updatedAt).toLocaleString() : ''],
  ].filter(([, v]) => v);
  $('#d-details').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');

  $('#d-status').value = l.status;
  $('#d-notes').value = l.notes || '';
  $('#d-saved').textContent = '';
  $('#drawer').showModal();
}

$('#drawer').addEventListener('click', (e) => {
  if (e.target === e.currentTarget || e.target.closest('[data-close]')) $('#drawer').close();
});

$('#d-save').addEventListener('click', async () => {
  if (!current) return;
  const btn = $('#d-save');
  btn.disabled = true;
  try {
    current = await updateLead(current.id, { status: $('#d-status').value, notes: $('#d-notes').value });
    $('#d-saved').textContent = 'Saved';
    render();
  } catch (err) {
    $('#d-saved').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#d-delete').addEventListener('click', async () => {
  if (!current || !confirm(`Delete ${fullName(current)}? This can't be undone.`)) return;
  try {
    await api(`/api/admin/leads/${current.id}`, { method: 'DELETE' });
    leads = leads.filter((l) => l.id !== current.id);
    $('#drawer').close();
    fillFilterOptions();
    render();
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Tooltip ----------
const tip = $('#tooltip');
document.addEventListener('mousemove', (e) => {
  const target = e.target.closest?.('[data-tip]');
  if (!target) { tip.hidden = true; return; }
  tip.textContent = target.dataset.tip;
  tip.style.left = `${e.clientX}px`;
  tip.style.top = `${e.clientY - 8}px`;
  tip.hidden = false;
  document.querySelectorAll('.bar.active').forEach((b) => b.classList.remove('active'));
  if (target.classList.contains('hit')) target.nextElementSibling?.classList.add('active');
});

// ---------- Filters & refresh ----------
['#f-search', '#f-source', '#f-status', '#f-niche', '#f-range'].forEach((sel) => {
  $(sel).addEventListener('input', renderTable);
});
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!$('#app-view').hidden) renderDaily(); }, 150);
});
$('#refresh').addEventListener('click', () => loadLeads().catch(() => {}));
setInterval(() => {
  if (!$('#app-view').hidden && !$('#drawer').open && document.visibilityState === 'visible') loadLeads().catch(() => {});
}, 60000);

// ---------- Boot ----------
api('/api/admin/me').then(({ email }) => showApp(email)).catch(() => {});
