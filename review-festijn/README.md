# Review Festijn oktober

Mobile web app for the October review campaign: a live ranking (home page), review submission with a screenshot, approval by admins, and a ranking image to share on WhatsApp.

Runs fully on Netlify: static page + one Netlify Function + Netlify Blobs as the database. No external services, no accounts for employees.

## Rules (src/score.mjs)

- 5 stars: €20 per approved review that mentions the employee by name.
- 1 star: €20 per review, divided evenly over all winners (everyone with ≥1 approved 5-star review).
- 2–4 stars: no money, but they count toward the person's review total and average stars (shown under their name).
- €200 bonus for the person with the most approved 5-star reviews; split on a tie.
- Nobody goes below €0 (`noNegative: true`; set to `false` to allow negative totals).
- Only reviews dated 1–31 October 2026 are accepted.

All amounts are computed in cents on the server; `npm test` covers the rules, including the example from the announcement (10 bad reviews, 5 winners → €40 each).

## Deploy on Netlify

1. Netlify → **Add new site → Import an existing project** → pick this repository and branch.
2. **Base directory:** `review-festijn` (build command empty, publish directory `public` comes from `netlify.toml`).
3. **Site configuration → Environment variables:**
   - `ADMIN_CODES` — only used when `LOCKED=on`: admins and their secret codes, e.g. `Amin:lange-code-1,Arber:lange-code-2`
   - `TEAM_CODE` — optional code to open the site at all (leave empty: anyone with the link can open it)
   - `LOCKED` — leave empty (default): open mode, anyone with the link can add reviews and they count immediately (the screenshot is the proof), no codes needed. Set to `on` to go back to admin codes and approval.
   - `EMPLOYEE_SUBMIT` — leave empty so only admins can add reviews (everyone else only sees the ranking). Set to `on` to let employees submit reviews too; theirs wait for approval.
   - `REVIEW_LINK` — your Google review link for the QR codes under **Info**, e.g. `https://g.page/r/XXXX/review`. One link per team also works: `VEG=https://…,TEG=https://…,KEG=https://…`. Leave empty to hide the QR codes.
4. Deploy. Netlify Blobs needs no setup.

Admins log in under **Info** with their code, or open their personal link once: `https://<site>/?beheer=<their code>` (shown under Info after logging in). The phone remembers it. Admins get a **+1 ★5** button next to every name, a **+1 slechte review** button, and an undo in the toast. There they can also add employees in advance (they show up in the ranking with 0) and add a photo per employee (optional; without a photo only the name is shown). Reviews an admin enters are approved immediately; reviews from employees wait in **Inzendingen** until an admin approves or rejects them (the approved count can be corrected).

## WhatsApp link preview

`/api/og.png` renders the current standings as a 1200×630 image (cached 5 minutes) and `public/index.html` points `og:image` at it. The **Link delen** button adds `?stand=<date-time>` to the link, so WhatsApp builds a fresh preview each time instead of reusing an old one. On another domain, change the two `og:image` / `twitter:image` lines in `public/index.html`.

## Local development

```
npm install
npm test            # rules + API tests
npx netlify dev     # runs the site and functions locally
```
