// Lead Vitality™ site behavior

// Submissions go to the site's own server (server.js), which stores them for the admin page.
const FORM_ENDPOINT = '/api/leads';

// Remember where the visitor came from (UTM tags, referrer) for the first page they landed on.
const ATTRIBUTION = (() => {
  const params = new URLSearchParams(location.search);
  const fresh = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
    if (params.get(k)) fresh[k] = params.get(k);
  });
  if (document.referrer && !document.referrer.startsWith(location.origin)) fresh.referrer = document.referrer;
  try {
    const saved = JSON.parse(sessionStorage.getItem('lv_attribution') || 'null');
    if (saved) return saved;
    sessionStorage.setItem('lv_attribution', JSON.stringify(fresh));
  } catch { /* storage unavailable */ }
  return fresh;
})();

const INDUSTRIES = [
  {
    id: 'attorneys', label: 'Lawyers & Law Firms', short: 'Lawyer', icon: '⚖️', noun: 'an attorney',
    blurb: 'Personal injury, family, estate planning, criminal defense and more, screened by case type and urgency.',
    sample: { name: 'Maria T.', need: 'Car accident last week, seeking a PI attorney', timeline: 'Immediately', budget: 'Contingency OK' },
  },
  {
    id: 'contractors', label: 'General Contractors', short: 'Contractor', icon: '🏗️', noun: 'a general contractor',
    blurb: 'Remodels, additions and new builds from homeowners with a defined scope and a funded budget.',
    sample: { name: 'Derek L.', need: 'Kitchen remodel, plans ready', timeline: 'Within 30 days', budget: '$40k–$60k' },
  },
  {
    id: 'plumbers', label: 'Plumbers', short: 'Plumber', icon: '🔧', noun: 'a plumber',
    blurb: 'Emergency repairs, water heaters, repiping and drain calls from homeowners who need help now.',
    sample: { name: 'Angela W.', need: 'Water heater leaking, needs replacement', timeline: 'Today', budget: 'Confirmed' },
  },
  {
    id: 'roofers', label: 'Roofers', short: 'Roofer', icon: '🏠', noun: 'a roofer',
    blurb: 'Storm damage, insurance claims and full replacements from verified property owners.',
    sample: { name: 'Chris P.', need: 'Hail damage, insurance claim opened', timeline: 'This week', budget: 'Insurance' },
  },
  {
    id: 'advisors', label: 'Financial Advisors', short: 'Financial advisor', icon: '📈', noun: 'a financial advisor',
    blurb: 'Pre-retirees and investors with investable assets, seeking planning, retirement or wealth management.',
    sample: { name: 'Robert K.', need: 'Retiring in 3 years, wants a rollover plan', timeline: 'This month', budget: '$750k+ assets' },
  },
  {
    id: 'insurance', label: 'Insurance Agents', short: 'Insurance agent', icon: '🛡️', noun: 'an insurance agent',
    blurb: 'Life, home, auto, Medicare and commercial shoppers who have requested a quote.',
    sample: { name: 'Tasha M.', need: 'Term life quote for new family', timeline: 'This week', budget: 'Confirmed' },
  },
  {
    id: 'hvac', label: 'HVAC & Electricians', short: 'HVAC / electrician', icon: '❄️', noun: 'an HVAC or electrical pro',
    blurb: 'System replacements, panel upgrades and service calls from homeowners ready to book.',
    sample: { name: 'Luis G.', need: 'AC not cooling, unit is 15 years old', timeline: 'Today', budget: 'Open to replace' },
  },
  {
    id: 'smallbiz', label: 'Small Business Services', short: 'Small business', icon: '💼', noun: 'a local service business',
    blurb: 'Accountants, agencies, cleaners, landscapers, med spas and other local pros. Tell us your niche.',
    sample: { name: 'Priya S.', need: 'Needs monthly bookkeeping for her LLC', timeline: 'Next 2 weeks', budget: '$400/mo' },
  },
];

const $ = (sel, root = document) => root.querySelector(sel);

// ---------- Industry content ----------
function renderIndustries() {
  const chips = $('#hero-chips');
  const grid = $('#industry-grid');
  const footer = $('#footer-industries');
  const selects = [$('#form-industry'), $('#exit-industry')];

  INDUSTRIES.forEach((ind, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = ind.short;
    chip.dataset.id = ind.id;
    chip.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    chip.addEventListener('click', () => selectIndustry(ind.id));
    chips.appendChild(chip);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'industry-card';
    card.innerHTML = `<span class="industry-icon" aria-hidden="true">${ind.icon}</span>
      <h3>${ind.label}</h3><p>${ind.blurb}</p><span class="industry-link">Check availability →</span>`;
    card.addEventListener('click', () => {
      selectIndustry(ind.id);
      $('#get-started').scrollIntoView({ behavior: 'smooth' });
    });
    grid.appendChild(card);

    const link = document.createElement('a');
    link.href = '#get-started';
    link.textContent = ind.label;
    link.addEventListener('click', () => selectIndustry(ind.id));
    footer.appendChild(link);

    selects.forEach((select) => {
      const opt = document.createElement('option');
      opt.value = ind.label;
      opt.textContent = ind.label;
      select.appendChild(opt);
    });
  });

  selectIndustry(INDUSTRIES[0].id, { updateForm: false });
}

function selectIndustry(id, { updateForm = true } = {}) {
  const ind = INDUSTRIES.find((x) => x.id === id);
  if (!ind) return;

  document.querySelectorAll('#hero-chips .chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.id === id));
  });
  $('[data-industry-noun]').textContent = ind.noun;

  const card = $('.lead-card');
  card.classList.remove('refresh');
  void card.offsetWidth; // restart animation
  card.classList.add('refresh');
  Object.entries(ind.sample).forEach(([key, val]) => {
    const el = $(`[data-sample="${key}"]`);
    if (el) el.textContent = val;
  });

  if (updateForm) {
    $('#form-industry').value = ind.label;
    $('#exit-industry').value = ind.label;
    $('[data-exit-niche]').textContent = ind.label.toLowerCase();
  }
}

// ---------- ROI calculator ----------
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function updateROI() {
  const value = Math.max(0, parseFloat($('#roi-value').value) || 0);
  const leads = parseInt($('#roi-leads').value, 10);
  const close = parseInt($('#roi-close').value, 10);
  const cpl = Math.max(0, parseFloat($('#roi-cpl').value) || 0);

  const clients = (leads * close) / 100;
  const revenue = clients * value;
  const spend = leads * cpl;

  $('#roi-leads-out').textContent = leads;
  $('#roi-close-out').textContent = `${close}%`;
  $('#roi-clients').textContent = Number.isInteger(clients) ? clients : clients.toFixed(1);
  $('#roi-revenue').textContent = money.format(revenue);
  $('#roi-spend').textContent = money.format(spend);
  $('#roi-multiple').textContent = spend > 0 ? `${(revenue / spend).toFixed(1)}×` : '—';
}

function initROI() {
  ['#roi-value', '#roi-leads', '#roi-close', '#roi-cpl'].forEach((sel) => {
    $(sel).addEventListener('input', updateROI);
  });
  updateROI();
}

// ---------- Navigation ----------
function initNav() {
  const toggle = $('.nav-toggle');
  const menu = $('#nav-menu');
  const header = $('.site-header');

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    menu.classList.toggle('open', !open);
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('open');
  }));

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () => { $('#form-plan').value = btn.dataset.plan; });
  });
}

// ---------- Lead forms ----------
async function sendLead(data) {
  if (!FORM_ENDPOINT) return;
  const res = await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

function attachLeadForm(form, { source, successMessage, onSuccess }) {
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');
  const submitLabel = submit.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status';

    let firstInvalid = null;
    form.querySelectorAll('[required]').forEach((field) => {
      const ok = field.type === 'checkbox' ? field.checked : field.checkValidity() && field.value.trim() !== '';
      field.closest('label').classList.toggle('invalid', !ok);
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      status.textContent = 'Please complete the highlighted fields.';
      status.classList.add('error');
      firstInvalid.focus();
      return;
    }

    const data = { ...ATTRIBUTION, ...Object.fromEntries(new FormData(form)), source, page: location.pathname };
    submit.disabled = true;
    submit.textContent = 'Sending…';

    try {
      await sendLead(data);
      form.reset();
      status.textContent = successMessage(data);
      status.classList.add('success');
      markCaptured();
      if (onSuccess) onSuccess();
    } catch (err) {
      status.textContent = 'Something went wrong sending your request. Please try again in a moment.';
      status.classList.add('error');
    } finally {
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });

  form.addEventListener('input', (e) => {
    const label = e.target.closest('label');
    if (label) label.classList.remove('invalid');
  });
}

function initForms() {
  attachLeadForm($('#lead-form'), {
    source: 'territory-check',
    successMessage: (d) => `Thanks, ${d.first_name}! We're pulling the lead-volume report for ${d.industry} in ${d.zip} and will be in touch within one business day.`,
  });
  attachLeadForm($('#exit-form'), {
    source: 'exit-intent-15-free-leads',
    successMessage: (d) => `You're in, ${d.first_name}! We'll reach out within one business day to start delivering your 15 free leads in ${d.zip}.`,
    onSuccess: () => {
      $('#exit-form .exit-decline').textContent = 'Close';
    },
  });
}

// ---------- Exit-intent offer ----------
const EXIT_KEY = 'lv_exit_offer';

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* storage unavailable */ }
}
function markCaptured() { storageSet(EXIT_KEY, 'captured'); }

function initExitIntent() {
  const modal = $('#exit-modal');
  if (!modal || typeof modal.showModal !== 'function') return;

  const DISMISS_DAYS = 3;
  const MIN_TIME_ON_PAGE = 5000;
  const loadedAt = Date.now();
  let shown = false;

  const eligible = () => {
    if (shown || Date.now() - loadedAt < MIN_TIME_ON_PAGE) return false;
    const saved = storageGet(EXIT_KEY);
    if (saved === 'captured') return false;
    if (saved && Date.now() - Number(saved) < DISMISS_DAYS * 864e5) return false;
    return true;
  };

  const open = () => {
    if (!eligible()) return;
    shown = true;
    modal.showModal();
    document.body.classList.add('modal-open');
  };

  const close = () => modal.close();
  modal.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (storageGet(EXIT_KEY) !== 'captured') storageSet(EXIT_KEY, String(Date.now()));
  });
  $('#exit-industry').addEventListener('change', (e) => {
    $('[data-exit-niche]').textContent = e.target.value ? e.target.value.toLowerCase() : 'your niche';
  });
  modal.querySelectorAll('[data-exit-close]').forEach((btn) => btn.addEventListener('click', close));
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // Desktop: cursor leaves through the top of the window, toward the tabs / close button.
  // Fast movements can report a Y well below the edge, so allow some slack.
  document.documentElement.addEventListener('mouseleave', (e) => {
    if (e.clientY < 50) open();
  });

  // Touch devices: a quick scroll back up after reading part of the page.
  if (matchMedia('(hover: none)').matches) {
    let lastY = window.scrollY;
    let lastT = performance.now();
    let maxY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      const t = performance.now();
      maxY = Math.max(maxY, y);
      const speed = (lastY - y) / Math.max(t - lastT, 1); // px per ms, upward
      const readEnough = maxY > document.documentElement.scrollHeight * 0.35;
      if (readEnough && speed > 2.5 && y < maxY - 400) open();
      lastY = y;
      lastT = t;
    }, { passive: true });
  }

  // Leaving the tab: show the offer when they come back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - loadedAt > 30000) open();
  });
}

// ---------- Reveal on scroll ----------
function initReveal() {
  const items = document.querySelectorAll('.section-head, .step, .feature, .industry-card, .plan, .compare-col');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  items.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  renderIndustries();
  initROI();
  initNav();
  initForms();
  initExitIntent();
  initReveal();
});
