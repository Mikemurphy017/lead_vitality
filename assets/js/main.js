// Lead Vitality™ site behavior

// Set this to a form backend URL (Formspree, Netlify, Zapier webhook, your CRM, etc.)
// to receive submissions. When empty, submissions are only confirmed on-screen.
const FORM_ENDPOINT = '';

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
  const select = $('#form-industry');

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

    const opt = document.createElement('option');
    opt.value = ind.label;
    opt.textContent = ind.label;
    select.appendChild(opt);
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

  if (updateForm) $('#form-industry').value = ind.label;
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

// ---------- Lead form ----------
function initForm() {
  const form = $('#lead-form');
  const status = $('#form-status');

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

    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Checking…';

    try {
      if (FORM_ENDPOINT) {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      form.reset();
      status.textContent = `Thanks, ${data.first_name}! We're pulling the lead-volume report for ${data.industry} in ${data.zip} and will be in touch within one business day.`;
      status.classList.add('success');
    } catch (err) {
      status.textContent = 'Something went wrong sending your request. Please try again in a moment.';
      status.classList.add('error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Check my territory';
    }
  });

  form.addEventListener('input', (e) => {
    const label = e.target.closest('label');
    if (label) label.classList.remove('invalid');
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
  initForm();
  initReveal();
});
