# Badkamer verkooporder (testversie)

Verkoopformulier voor De Badkamer Expert. Leest en schrijft direct in Airtable
(base "Exact Sync - TESTOMGEVING (99)").

- `public/index.html` – het formulier (één pagina)
- `netlify/functions/api.mjs` – kleine server die met Airtable praat. De Airtable-sleutel staat alleen hier, nooit in de browser.
  Alleen vaste acties op Relaties, Artikelen en de Badkamer-tabellen zijn toegestaan.

## Online zetten op Netlify

1. **Airtable-sleutel maken**: airtable.com/create/tokens → *Create token*
   - Scopes: `data.records:read` en `data.records:write`
   - Access: alleen de base *Exact Sync - TESTOMGEVING (99)*
2. **Netlify**: *Add new site → Import an existing project* → deze GitHub-repo
   - Branch: de branch met deze map
   - **Base directory: `badkamer`** (publish en functions komen uit `netlify.toml`)
3. **Environment variables** (Site configuration → Environment variables):
   - `AIRTABLE_TOKEN` = de sleutel uit stap 1
   - `ACCESS_CODE` = een code die je aan de testers geeft
4. Deploy. Testers openen de link en vullen de toegangscode in.

## Wat wordt opgeslagen
Elke order komt in **Badkamer orders** (ordernummer automatisch, 1000 + volgnummer),
de regels in **Badkamer orderregels**. Handtekening en formulierdata staan bij de order,
zodat de PDF later opnieuw te maken is.
