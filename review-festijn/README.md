# Review Festijn oktober

Mobile web app for the October review campaign: a live ranking (home page), review submission with a screenshot, approval by admins, and a ranking image to share on WhatsApp.

Runs fully on Netlify: static page + one Netlify Function + Netlify Blobs as the database. No external services, no accounts for employees.

## Rules (src/score.mjs)

- €20 per approved review that mentions the employee by name.
- €200 bonus for the person with the most approved reviews; split on a tie.
- €20 per bad review, divided evenly over all winners (everyone with ≥1 approved review).
- Nobody goes below €0 (`noNegative: true`; set to `false` to allow negative totals).
- Only reviews dated 1–31 October 2026 are accepted.

All amounts are computed in cents on the server; `npm test` covers the rules, including the example from the announcement (10 bad reviews, 5 winners → €40 each).

## Deploy on Netlify

1. Netlify → **Add new site → Import an existing project** → pick this repository and branch.
2. **Base directory:** `review-festijn` (build command empty, publish directory `public` comes from `netlify.toml`).
3. **Site configuration → Environment variables:**
   - `ADMIN_CODES` — admins and their secret codes, e.g. `Amin:lange-code-1,Erber:lange-code-2`
   - `TEAM_CODE` — code employees enter once to open the site (leave empty to make it open to anyone with the link)
4. Deploy. Netlify Blobs needs no setup.

Admins log in under **Info** with their code. Reviews an admin enters are approved immediately; reviews from employees wait in **Inzendingen** until an admin approves or rejects them (the approved count can be corrected).

## Local development

```
npm install
npm test            # rules + API tests
npx netlify dev     # runs the site and functions locally
```
