// Kleine server tussen het verkoopformulier en Airtable.
// De Airtable-sleutel staat alleen hier (Netlify environment variable), nooit in de browser.
// Alleen de acties hieronder zijn toegestaan; andere tabellen (zoals Sync instellingen) zijn niet bereikbaar.
// Iedereen logt in met een persoonlijke code uit "Badkamer verkopers". Verkopers zien alleen hun eigen orders;
// beheerders zien alles en beheren de verkopers. ACCESS_CODE (Netlify) is de noodcode voor beheer.

const BASE = process.env.AIRTABLE_BASE || "apprg09P0WXuq0rzl";
const T = {
  rel: "tblxZx3pO1pt37SZG", // Relaties
  art: "tblflzdxZAO4aCgVu", // Artikelen
  pak: "tblHEO5vWtnSA4kVr", // Badkamer pakketten
  upg: "tblElNRfyMPz3KzmX", // Badkamer upgrades
  ord: "tbl0vRCH72NdNOW2M", // Badkamer orders
  reg: "tblaFJnyCVwAJx4UT", // Badkamer orderregels
  lev: "tblWnJXRB591VAfD1", // Badkamer leveranciers
  ond: "tblCICnqPvxnwgIMp", // Badkamer onderdelen
  vk: "tblnRzUX5noE9m9tI",  // Badkamer verkopers
};
const VK = { naam: "fld6VmxLgstYALSw8", code: "fldLhe0vT5aprB2wa", rol: "fldQ7HNWhZAdXdYvb", actief: "fldDUXrwsAlKyAtyQ", email: "fldTQS1d1uJhh7f9q", tel: "fldl1SX4CC5Dr1wO0", login: "fldxTp7YHGFNuvtaX", codeDatum: "fld1G8plSczHUdaPS" };
const O = { verkoper: "fld6xoOuZha6Yexij", verkoperId: "fldPd1GRu4Kd2vjQS", status: "fldhkfLpjUt04onwS", exactId: "fld39NWuhp7DKmrus" };
// Velden voor het beheer-dashboard (geen handtekening of formulierdata: die zijn groot)
const ORD_ADMIN = ["fldr72EvSG7cQGvJi", "fldZml0moCee9wDm4", "fldrI2vyYjR0uCEJw", "fldhkfLpjUt04onwS", "fldYdNEpk7qan0wif", "fldAI9KgGanil4f17", "fld6xoOuZha6Yexij", "fldPd1GRu4Kd2vjQS", "fldNzctp3jsuKfwdJ", "fldljWPPlsWoqx5Ks", "fldKWzFZQJnjofO6z", "fldXZMwv3gWFbZUmv", "fld5HHPPO2QaKZMUn", "flda28DE4BREpa9wj", "fldJGMRSo3a1AXQHm", "fld3DgCfcj4TUOwyw", "fldZjfxnENfLIJpzG", "fldFIVEt6LnU38Rrm", "fldPv2MVjO8CGYNAx"];
const REL_FIELDS = ["fldcuASIPQCUQei30", "fldhPuYjCpknPiYF5", "fldT8we6MEL43xbWY", "fldC0989e2hSnyG0q", "fldBbEI9mqzDExPbZ", "fld0V1vNSde0OdAxr", "fldsWFkhGBxRSpofv"];
const ART_FIELDS = ["fldrHdHMKvcA6PX4I", "fldonc2CQ6CNu6UHI", "fldf6c1D4Ebqx4zdY", "fld66bhS7SRJYI39U"];
const PAK_FIELDS = ["fldnXAJnpqT1O64uW", "fldKI0TAQwQv4v6tK", "fld9XRHFtLPfh1m3Z", "fldjykmKI8oa8Npq6", "fldKNIzZpisWllX38", "fldDQa6SKW3D2F50k", "fldS6b5ve0WtMXNEs"];
const UPG_FIELDS = ["fldmupd1lBOG6Qsej", "fldFDFgr1hAjBCFuj", "fldUiwjN9eW7eJTTP", "fldbaFO0qFczWU9Vl", "fldFyCNPwExbJG5qy", "fldIsPzOIRrO5sBoC"];
// Velden die het formulier in Badkamer orders mag schrijven
const ORD_WRITE = new Set(["fldZml0moCee9wDm4", "fldhkfLpjUt04onwS", "fld6xoOuZha6Yexij", "fldAI9KgGanil4f17", "fldzdF2SMp78jWJCC", "fldrI2vyYjR0uCEJw", "fldVaakhfS7FR5nIg", "fld4av3cWJCzsBFup", "fldZjfxnENfLIJpzG", "fldtjawfpDu2cE54a", "fldZYZ4FTwjynF6Lh", "fldvEDw2nDPaMpVWj", "fldycdxAzfuHVm9pu", "fldU9SPTvaZpm8JfL", "fldDszrRvki1F99dt", "fldUzk8Gz0wdOWuvW", "fldTYBXzLGSzeYTgk", "fldnash9dvP6cCBxv", "fldPv2MVjO8CGYNAx", "fldl0LEfTekP5Xomq", "fldrshouPbhAoWGvS", "fldKWzFZQJnjofO6z", "fldJ3VQsBPSW6ME8f", "fldX313TIfcL8H5KP", "fldE4mhMCb9lhqYY2", "fldYdNEpk7qan0wif", "fldEexHOijIkBVBK1", "fldSUEJeMM83KFVNc", "fldJwcYL3itv3lt8I", "fldzXsLlw4hq5IfQf", "fldPA13g3eKW09xA7", "fld37fz81UfoWYsb8", "fldLXVVNPpDnLghZO", "fldXZMwv3gWFbZUmv", "fldxWZWqgOxRXLNU5", "fldYLjfuFZ73YOo1n", "fldeYw0PvEml1JcJt", "fldNzctp3jsuKfwdJ", "fldljWPPlsWoqx5Ks", "fld54kzLI9JV676mZ"]);
const ORD_READ = ["fldr72EvSG7cQGvJi", "fldPd1GRu4Kd2vjQS", "fld5HHPPO2QaKZMUn", "flda28DE4BREpa9wj", "fldJGMRSo3a1AXQHm", "fld3DgCfcj4TUOwyw", "fldlDVzaCDy9mCtQH", "fldrI2vyYjR0uCEJw", "fldhkfLpjUt04onwS", "fldYdNEpk7qan0wif", "fldAI9KgGanil4f17", "fldXZMwv3gWFbZUmv", "fld6xoOuZha6Yexij", "fldeYw0PvEml1JcJt", "fldYLjfuFZ73YOo1n", "fld5t6II9cqH4Erpe", "fldZjfxnENfLIJpzG"];
const REG_WRITE = new Set(["fldjtj1MRoqJDl32e", "fldfkqPrjBLHn8bve", "fldmLe18tpTrsBqjU", "fldZuTFQlv4OGlK4b", "fldociuEcgRvHyERC", "fldee4jj5m3NEdXB7", "fldU7D2ngw3UhFLrt", "fldVO5mxqJrAjGdyv", "fld52sdBnQBkbkbov", "fldDuNjSVTjYSPflP", "fldUsIrhfylzAbfwJ"]);

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
class Fail extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code } }

async function at(method, path, { query, body } = {}) {
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
    else if (v != null) url.searchParams.set(k, String(v));
  }
  let res;
  try {
    res = await fetch(url, { method, headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Fail(503, "server_unavailable", "Airtable is niet bereikbaar.") }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.type || data?.error || `HTTP ${res.status}`;
    if (res.status === 429 || res.status >= 500) throw new Fail(503, "server_unavailable", String(msg));
    throw new Fail(502, "tool_error", String(msg));
  }
  return data;
}
const out = r => ({ id: r.id, createdTime: r.createdTime, cellValuesByFieldId: r.fields || {} });
const list = async (table, query) => (await at("GET", table, { query: { returnFieldsByFieldId: true, ...query } })).records.map(out);

// Zoektekst veilig in een Airtable-formule zetten
const str = s => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
// Telefoonnummer: alleen cijfers, zonder 0031/+31/0 vooraan, zodat 06…, +316… en 00316… elkaar vinden
function phoneDigits(s) {
  let d = String(s).replace(/\D/g, "");
  if (d.startsWith("0031")) d = d.slice(4);
  else if (d.startsWith("31") && d.length >= 11) d = d.slice(2);
  if (d.startsWith("0") && d.length >= 9) d = d.slice(1);
  return d;
}
function terms(q) {
  const s = String(q || "").toLowerCase().trim().slice(0, 100);
  if (/^[\d\s+()\-\/.]+$/.test(s) && s.replace(/\D/g, "").length >= 9) return [phoneDigits(s)];
  return s.split(/\s+/).filter(Boolean).slice(0, 5).map(t => {
    const d = t.replace(/\D/g, "");
    return /^[\d+()\-\/.]+$/.test(t) && d.length >= 3 ? d : t;
  });
}
const allIn = (hay, ts) => "AND(" + ts.map(t => `FIND(${str(t)},${hay})`).join(",") + ")";
const isRec = v => typeof v === "string" && /^rec[A-Za-z0-9]{14}$/.test(v);

// ---------- inloggen ----------
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // zonder 0/O, 1/I/L
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join("");
  return s.slice(0, 4) + "-" + s.slice(4);
}
const userCache = new Map(); // code -> { user, t }
const fails = new Map();     // ip -> { n, t }
const vkUser = r => ({ id: r.id, naam: r.fields?.[VK.naam] || "", rol: r.fields?.[VK.rol] || "Verkoper" });
async function whoIs(rawCode) {
  const code = normCode(rawCode);
  if (!code) return null;
  if (code === normCode(process.env.ACCESS_CODE)) return { id: null, naam: "Beheer", rol: "Beheerder", nood: true };
  const c = userCache.get(code);
  if (c && Date.now() - c.t < 30000) return c.user;
  const recs = (await at("GET", T.vk, { query: {
    returnFieldsByFieldId: true, maxRecords: 1, "fields[]": [VK.naam, VK.rol],
    filterByFormula: `AND({Actief},REGEX_REPLACE(UPPER({Code}&""),"[^A-Z0-9]","")=${str(code)})`,
  } })).records;
  const user = recs.length && recs[0].fields?.[VK.naam] ? vkUser(recs[0]) : null;
  userCache.set(code, { user, t: Date.now() });
  return user;
}
const isAdmin = u => u?.rol === "Beheerder";
function mustAdmin(u) { if (!isAdmin(u)) throw new Fail(403, "forbidden", "Alleen voor beheerders."); }
// Een verkoper mag alleen zijn eigen orders zien en wijzigen
function mustOwn(u, fields) {
  if (isAdmin(u)) return;
  if (!fields || fields[O.verkoperId] !== u.id) throw new Fail(403, "forbidden", "Deze order is van een andere verkoper.");
}
async function getOrder(u, id) {
  if (!isRec(id)) throw new Fail(400, "bad_request", "Ongeldige order.");
  const r = await at("GET", `${T.ord}/${id}`, { query: { returnFieldsByFieldId: true } });
  mustOwn(u, r.fields);
  return r;
}
async function listAll(table, query, max = 3000) {
  let all = [], offset;
  do {
    const res = await at("GET", table, { query: { returnFieldsByFieldId: true, pageSize: 100, ...query, ...(offset ? { offset } : {}) } });
    all = all.concat(res.records.map(out)); offset = res.offset;
  } while (offset && all.length < max);
  return all;
}
const sellerOut = r => ({ id: r.id, naam: r.cellValuesByFieldId[VK.naam] || "", code: r.cellValuesByFieldId[VK.code] || "", rol: r.cellValuesByFieldId[VK.rol] || "Verkoper",
  actief: !!r.cellValuesByFieldId[VK.actief], email: r.cellValuesByFieldId[VK.email] || "", tel: r.cellValuesByFieldId[VK.tel] || "",
  login: r.cellValuesByFieldId[VK.login] || null, codeDatum: r.cellValuesByFieldId[VK.codeDatum] || null });

function pick(fields, allowed) {
  if (!fields || typeof fields !== "object") throw new Fail(400, "bad_request", "Geen velden.");
  const f = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.has(k)) throw new Fail(400, "bad_request", `Veld ${k} mag niet worden geschreven.`);
    f[k] = v;
  }
  return f;
}

const actions = {
  ping: async (_, u) => {
    if (u.id) at("PATCH", `${T.vk}/${u.id}`, { body: { fields: { [VK.login]: new Date().toISOString() } } }).catch(() => {});
    return { ok: true, me: { id: u.id, naam: u.naam, rol: u.rol, nood: !!u.nood } };
  },

  catalog: async () => {
    const [pak, upg, lev, ond] = await Promise.all([
      list(T.pak, { pageSize: 50, "fields[]": PAK_FIELDS }),
      list(T.upg, { pageSize: 100, "fields[]": UPG_FIELDS }),
      list(T.lev, { pageSize: 20, "fields[]": ["fldPZgN0Qewbc5BQP", "fldnqmFcifUQNZti3", "fldxiPnZZIWgpgG8K", "flduzpHmvYZp6NYt0"] }).catch(() => []),
      list(T.ond, { pageSize: 100, "fields[]": ["fldtL67vGDL10ohdI", "fldKR9PpoYcRd75ec"] }).catch(() => []),
    ]);
    return { pak, upg, lev, ond };
  },

  searchKlant: async ({ q, limit }) => {
    const ts = terms(q);
    if (!ts.length || ts.join("").length < 2) return { records: [] };
    const hay = `LOWER({Naam}&" "&{Code}&" "&{E-mail}&" "&{Postcode}&" "&SUBSTITUTE({Postcode}&""," ","")&" "&REGEX_REPLACE({Telefoon}&"","[^0-9]",""))`;
    const records = await list(T.rel, { filterByFormula: `AND(NOT({Verwijderd in Exact}),${allIn(hay, ts)})`, maxRecords: Math.min(Number(limit) || 8, 10), "fields[]": REL_FIELDS });
    return { records };
  },

  searchArtikel: async ({ q }) => {
    const ts = terms(q);
    if (!ts.length || ts.join("").length < 2) return { records: [] };
    const hay = `LOWER({Code}&" "&{Omschrijving})`;
    const records = await list(T.art, { filterByFormula: `AND(NOT({Verwijderd in Exact}),OR({Artikelgroep}="Sanitair",{Artikelgroep}="Tegels"),${allIn(hay, ts)})`, maxRecords: 40, "fields[]": ART_FIELDS });
    return { records };
  },

  saveOrder: async ({ id, fields }, u) => {
    const f = pick(fields, ORD_WRITE);
    if (id != null && !isRec(id)) throw new Fail(400, "bad_request", "Ongeldige order.");
    if (id) {
      // Bestaande order: alleen de eigen order, en de verkoper blijft wie hem gemaakt heeft
      await getOrder(u, id);
      delete f[O.verkoper];
    } else {
      // De verkoper komt van de inlogcode, nooit uit de browser
      f[O.verkoper] = u.naam;
      if (u.id) f[O.verkoperId] = u.id;
    }
    const r = id
      ? await at("PATCH", `${T.ord}/${id}`, { body: { fields: f, typecast: true, returnFieldsByFieldId: true } })
      : (await at("POST", T.ord, { body: { records: [{ fields: f }], typecast: true, returnFieldsByFieldId: true } })).records[0];
    // Ordernummer is een formule: opnieuw ophalen zodat het zeker mee komt
    const full = await at("GET", `${T.ord}/${r.id}`, { query: { returnFieldsByFieldId: true } });
    return { records: [out({ ...full, fields: Object.fromEntries(ORD_READ.map(k => [k, full.fields?.[k]]).filter(([, v]) => v != null)) })] };
  },

  createLines: async ({ records }, u) => {
    if (!Array.isArray(records) || !records.length || records.length > 10) throw new Fail(400, "bad_request", "1 tot 10 regels per keer.");
    const body = { records: records.map(r => ({ fields: pick(r?.fields, REG_WRITE) })), typecast: true };
    const orderIds = [...new Set(body.records.map(r => (r.fields.fldmLe18tpTrsBqjU || [])[0]))];
    if (orderIds.some(x => !isRec(x))) throw new Fail(400, "bad_request", "Elke regel hoort bij een order.");
    for (const oid of orderIds) await getOrder(u, oid);
    const res = await at("POST", T.reg, { body });
    return { ids: res.records.map(r => r.id) };
  },

  deleteLines: async ({ ids }, u) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 10 || !ids.every(isRec)) throw new Fail(400, "bad_request", "1 tot 10 regels per keer.");
    if (!isAdmin(u)) {
      const lines = await list(T.reg, { filterByFormula: "OR(" + ids.map(x => `RECORD_ID()=${str(x)}`).join(",") + ")", "fields[]": ["fldmLe18tpTrsBqjU"] });
      for (const oid of new Set(lines.map(l => (l.cellValuesByFieldId.fldmLe18tpTrsBqjU || [])[0]))) await getOrder(u, oid);
    }
    await at("DELETE", T.reg, { query: { "records[]": ids } });
    return { ok: true };
  },

  // Getekende order klaarzetten voor automation 7 (pas nadat de regels zijn opgeslagen)
  exactKlaar: async ({ id }, u) => {
    const r = await getOrder(u, id);
    if (r.fields?.fldhkfLpjUt04onwS !== "Getekend") throw new Fail(400, "bad_request", "Alleen getekende orders gaan naar Exact.");
    if (r.fields?.fld39NWuhp7DKmrus) return { ok: true, al: true };
    await at("PATCH", `${T.ord}/${id}`, { body: { fields: { fld5HHPPO2QaKZMUn: "Klaar voor Exact" }, typecast: true } });
    return { ok: true };
  },

  orderStatus: async ({ id }, u) => {
    const r = await getOrder(u, id);
    const f = r.fields || {};
    return { nr: f.fldy7Jq2dzAHhb6rO ?? null, exact: f.fld5HHPPO2QaKZMUn || "", melding: f.flda28DE4BREpa9wj || "", klantmail: f.fld3DgCfcj4TUOwyw || "" };
  },

  // PDF met ordernummer bij de order zetten; daarna (optioneel) de klantmail klaarzetten
  uploadPdf: async ({ id, filename, data, mail }, u) => {
    if (typeof data !== "string" || !data || data.length > 6_500_000) throw new Fail(400, "bad_request", "PDF ontbreekt of is te groot.");
    const name = String(filename || "Koopovereenkomst.pdf").replace(/[^\w .,()\-]/g, "").slice(0, 120) || "Koopovereenkomst.pdf";
    const r = await getOrder(u, id);
    if (!r.fields?.fldy7Jq2dzAHhb6rO) throw new Fail(400, "bad_request", "De order heeft nog geen ordernummer uit Exact.");
    await at("PATCH", `${T.ord}/${id}`, { body: { fields: { fldJGMRSo3a1AXQHm: [] } } });
    let res;
    try {
      res = await fetch(`https://content.airtable.com/v0/${BASE}/${id}/fldJGMRSo3a1AXQHm/uploadAttachment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ contentType: "application/pdf", file: data, filename: name }),
      });
    } catch { throw new Fail(503, "server_unavailable", "Airtable is niet bereikbaar.") }
    if (!res.ok) throw new Fail(502, "tool_error", "PDF uploaden mislukt: " + (await res.text()).slice(0, 200));
    const zetMail = !!mail && !!r.fields?.fldvEDw2nDPaMpVWj && r.fields?.fld3DgCfcj4TUOwyw !== "Verstuurd";
    if (zetMail) await at("PATCH", `${T.ord}/${id}`, { body: { fields: { fld3DgCfcj4TUOwyw: "Klaar" }, typecast: true } });
    return { ok: true, mail: zetMail };
  },

  // Mijn orders: een verkoper krijgt alleen zijn eigen orders; een beheerder kan "alle" vragen
  listOrders: async ({ all }, u) => {
    const alles = all && isAdmin(u);
    const filter = alles ? null : u.id ? `{Verkoper ID}=${str(u.id)}` : `{Verkoper ID}=""`;
    const records = await list(T.ord, {
      pageSize: 60, maxRecords: 60, "fields[]": ORD_READ,
      "sort[0][field]": "Aangemaakt", "sort[0][direction]": "desc",
      ...(filter ? { filterByFormula: filter } : {}),
    });
    return { records };
  },

  // ---------- beheer ----------
  adminSellers: async (_, u) => {
    mustAdmin(u);
    const recs = await listAll(T.vk, { "sort[0][field]": "Naam" });
    return { sellers: recs.map(sellerOut) };
  },

  adminSaveSeller: async ({ id, naam, rol, actief, email, tel }, u) => {
    mustAdmin(u);
    naam = String(naam || "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (!naam) throw new Fail(400, "bad_request", "Vul een naam in.");
    rol = rol === "Beheerder" ? "Beheerder" : "Verkoper";
    email = String(email || "").trim().slice(0, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Fail(400, "bad_request", "Ongeldig e-mailadres.");
    tel = String(tel || "").trim().slice(0, 40);
    if (id != null && !isRec(id)) throw new Fail(400, "bad_request", "Ongeldige verkoper.");
    if (id && id === u.id && (rol !== "Beheerder" || !actief)) throw new Fail(400, "bad_request", "Je kunt jezelf geen beheerder-af maken of uitschakelen.");
    const zelfdeNaam = await list(T.vk, { filterByFormula: `LOWER(TRIM({Naam}))=${str(naam.toLowerCase())}`, "fields[]": [VK.naam] });
    if (zelfdeNaam.some(r => r.id !== id)) throw new Fail(400, "bad_request", "Er is al een verkoper met deze naam.");
    const fields = { [VK.naam]: naam, [VK.rol]: rol, [VK.actief]: !!actief, [VK.email]: email || null, [VK.tel]: tel || null };
    let rec, oudeNaam = null;
    if (id) {
      const old = await at("GET", `${T.vk}/${id}`, { query: { returnFieldsByFieldId: true } });
      oudeNaam = old.fields?.[VK.naam] || null;
      rec = await at("PATCH", `${T.vk}/${id}`, { body: { fields, typecast: true, returnFieldsByFieldId: true } });
    } else {
      fields[VK.code] = newCode(); fields[VK.codeDatum] = new Date().toISOString();
      rec = (await at("POST", T.vk, { body: { records: [{ fields }], typecast: true, returnFieldsByFieldId: true } })).records[0];
    }
    userCache.clear();
    // Naam gewijzigd: ook op de bestaande orders van deze verkoper
    let bijgewerkt = 0;
    if (id && oudeNaam && oudeNaam !== naam) {
      const orders = await listAll(T.ord, { filterByFormula: `{Verkoper ID}=${str(id)}`, "fields[]": [O.verkoper] });
      for (let i = 0; i < orders.length; i += 10) {
        await at("PATCH", T.ord, { body: { records: orders.slice(i, i + 10).map(o => ({ id: o.id, fields: { [O.verkoper]: naam } })) } });
      }
      bijgewerkt = orders.length;
    }
    return { seller: sellerOut(out(rec)), ordersBijgewerkt: bijgewerkt };
  },

  adminResetCode: async ({ id }, u) => {
    mustAdmin(u);
    if (!isRec(id)) throw new Fail(400, "bad_request", "Ongeldige verkoper.");
    const rec = await at("PATCH", `${T.vk}/${id}`, { body: { fields: { [VK.code]: newCode(), [VK.codeDatum]: new Date().toISOString() }, returnFieldsByFieldId: true } });
    userCache.clear();
    return { seller: sellerOut(out(rec)) };
  },

  adminDeleteSeller: async ({ id }, u) => {
    mustAdmin(u);
    if (!isRec(id)) throw new Fail(400, "bad_request", "Ongeldige verkoper.");
    if (id === u.id) throw new Fail(400, "bad_request", "Je kunt jezelf niet verwijderen.");
    const orders = await list(T.ord, { filterByFormula: `{Verkoper ID}=${str(id)}`, maxRecords: 1, "fields[]": [O.verkoper] });
    if (orders.length) throw new Fail(400, "bad_request", "Deze verkoper heeft orders. Zet hem op niet actief in plaats van verwijderen.");
    await at("DELETE", `${T.vk}/${id}`);
    userCache.clear();
    return { ok: true };
  },

  adminOrders: async (_, u) => {
    mustAdmin(u);
    const records = await listAll(T.ord, { "fields[]": ORD_ADMIN, "sort[0][field]": "Aangemaakt", "sort[0][direction]": "desc" });
    return { records };
  },

  // Volledige order (voor het maken van de PDF als die nog niet bij de order staat)
  adminOrder: async ({ id }, u) => {
    mustAdmin(u);
    const r = await getOrder(u, id);
    return { record: out({ ...r, fields: Object.fromEntries(ORD_READ.map(k => [k, r.fields?.[k]]).filter(([, v]) => v != null)) }) };
  },
};

export default async (req) => {
  if (req.method !== "POST") return json(405, { code: "method", message: "Alleen POST." });
  if (!process.env.AIRTABLE_TOKEN || !process.env.ACCESS_CODE) return json(500, { code: "config", message: "AIRTABLE_TOKEN of ACCESS_CODE ontbreekt in de Netlify-instellingen." });
  const ip = req.headers.get("x-nf-client-connection-ip") || "?";
  const f = fails.get(ip);
  if (f && f.n >= 15 && Date.now() - f.t < 10 * 60000) return json(429, { code: "too_many", message: "Te vaak een verkeerde code. Probeer het over 10 minuten opnieuw." });
  let u;
  try { u = await whoIs(req.headers.get("x-access-code")) }
  catch (e) { return json(e.status || 503, { code: e.code || "server_unavailable", message: e.message }) }
  if (!u) {
    const n = f && Date.now() - f.t < 10 * 60000 ? f.n + 1 : 1;
    fails.set(ip, { n, t: Date.now() });
    await new Promise(r => setTimeout(r, 400));
    return json(401, { code: "unauthorized", message: "Deze code klopt niet of is niet meer actief." });
  }
  fails.delete(ip);
  let body;
  try { body = await req.json() } catch { return json(400, { code: "bad_request", message: "Ongeldig verzoek." }) }
  const fn = actions[body?.action];
  if (!fn) return json(400, { code: "bad_request", message: "Onbekende actie." });
  try { return json(200, await fn(body.payload || {}, u)) }
  catch (e) {
    if (e instanceof Fail) return json(e.status, { code: e.code, message: e.message });
    console.error(e);
    return json(500, { code: "server_error", message: "Er ging iets mis op de server." });
  }
};

export const config = { path: "/api" };
