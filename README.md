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
- **Exit-intent popup** offering 15 free high-intent leads for the visitor's niche (see below).

## Project structure

```
server.js                      Node server: serves the site, stores leads, admin API
public/index.html              Marketing page
public/assets/css/styles.css   Site styles (responsive, honors reduced motion)
public/assets/js/main.js       Industry data, ROI calculator, popup, form handling
public/assets/img/favicon.svg  Logo mark
public/admin/                  Admin dashboard (index.html, admin.css, admin.js)
```

There is no build step and no npm dependencies. It needs Node 20 or newer.

## Run locally

```bash
ADMIN_PASSWORD=choose-a-password npm start
# site:  http://localhost:3000
# admin: http://localhost:3000/admin
```

## Admin dashboard

Go to `/admin` and sign in. The dashboard shows:

- **Summary:** total sign-ups, last 7 days, leads not yet contacted, the split between the 15 free leads popup and the territory check, and how many you've won.
- **Charts:** sign-ups per day for the last 30 days, and sign-ups by niche.
- **A table of every prospect**, with search and filters for source, status, niche and date range. Change a lead's status right in the table.
- **A detail panel** (click a row) with every field, the UTM campaign and referrer they came from, call/text/email buttons, notes, and delete.
- **Export CSV** of every lead.

The page refreshes on its own every minute.

### Server settings (environment variables)

| Variable | Purpose |
|---|---|
| `ADMIN_EMAIL` | Admin login email. Defaults to `mike@bluestonepartnersllc.com`. |
| `ADMIN_PASSWORD` | Admin login password. **Required**: logins are refused until it's set. |
| `SESSION_SECRET` | Long random string used to sign login sessions. Without it, you're signed out whenever the server restarts. |
| `DATA_DIR` | Folder where `leads.json` is stored. On Railway, point it at a mounted volume (`/data`) so leads survive redeploys. |
| `PORT` | Set automatically by Railway. |

## Form submissions

Both forms post to `/api/leads` on the same server, which saves them to `leads.json` in `DATA_DIR`. Each lead records:

- its `source`: `territory-check` for the main form, `exit-intent-15-free-leads` for the popup
- the visitor's UTM tags and referring site, if any

The endpoint is rate-limited per IP address and has a hidden spam-trap field.

## Exit-intent popup

The "15 free leads" offer opens when a visitor looks likely to leave:

- **Desktop:** the cursor moves up out of the page toward the tabs or close button.
- **Phones/tablets:** a fast scroll back up after reading about a third of the page.
- **Any device:** returning to the tab after switching away (after 30+ seconds on the page).

It never opens in the first 5 seconds, shows at most once per visit, stays hidden for 3 days after being dismissed, and never shows again once someone submits either form. These settings are in `initExitIntent()` in `assets/js/main.js`.

## Customizing industries

Industries live in the `INDUSTRIES` array in `assets/js/main.js`. Each entry drives the hero chips, the sample lead card, the industries grid, the footer links and the form dropdown. To add a niche, add one object there.

## Deploying

The site runs on Railway as a Node service (`npm start`). It needs:

- a volume mounted at `/data`
- `DATA_DIR=/data`
- `ADMIN_PASSWORD` and `SESSION_SECRET` set in the service's variables

A static-only host won't work anymore, because the forms and the admin page need the server.
