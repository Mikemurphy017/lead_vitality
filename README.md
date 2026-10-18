# Lead Vitality™

Marketing site for **Lead Vitality™**, which delivers high-intent, ready-to-buy leads to service-based businesses: lawyers, general contractors, plumbers, roofers, HVAC and electrical pros, financial advisors, insurance agents and other small businesses.

## What's on the page

- **Hero with industry picker.** Pick an industry and the headline copy and sample lead card change to match it.
- **Problem vs. solution comparison** with typical lead vendors.
- **How it works** in four steps: capture, qualify, score, deliver.
- **Industries grid.** Clicking a card pre-selects that industry in the sign-up form.
- **Vitality Score™** explainer.
- **Feature overview.**
- **ROI calculator.** Uses the visitor's own numbers.
- **Pricing tiers** (Starter / Growth / Dominate), quote-based.
- **FAQ.**
- **"Check my territory" lead-capture form** with validation and an SMS/email consent checkbox.

## Project structure

```
index.html              Page markup
assets/css/styles.css   Styles (responsive, honors reduced motion)
assets/js/main.js       Industry data, ROI calculator, nav, form handling
assets/img/favicon.svg  Logo mark
```

There is no build step. It is plain HTML, CSS and JS.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Receiving form submissions

By default the form only shows a confirmation message on screen. To receive submissions, set `FORM_ENDPOINT` at the top of `assets/js/main.js` to any endpoint that accepts a JSON POST, such as Formspree, a Zapier/Make webhook or your CRM's intake URL.

## Customizing industries

Industries live in the `INDUSTRIES` array in `assets/js/main.js`. Each entry drives the hero chips, the sample lead card, the industries grid, the footer links and the form dropdown. To add a niche, add one object there.

## Deploying

Any static host works: GitHub Pages, Netlify, Vercel, Cloudflare Pages or S3. Point it at the repository root.
