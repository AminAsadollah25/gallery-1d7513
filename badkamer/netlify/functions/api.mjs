// Kleine server tussen het verkoopformulier en Airtable.
// De Airtable-sleutel staat alleen hier (Netlify environment variable), nooit in de browser.
// Alleen de acties hieronder zijn toegestaan; andere tabellen (zoals Sync instellingen) zijn niet bereikbaar.

const BASE = process.env.AIRTABLE_BASE || "apprg09P0WXuq0rzl";
const T = {
  rel: "tblxZx3pO1pt37SZG", // Relaties
  art: "tblflzdxZAO4aCgVu", // Artikelen
  pak: "tblHEO5vWtnSA4kVr", // Badkamer pakketten
  upg: "tblElNRfyMPz3KzmX", // Badkamer upgrades
  ord: "tbl0vRCH72NdNOW2M", // Badkamer orders
  reg: "tblaFJnyCVwAJx4UT", // Badkamer orderregels
};
const REL_FIELDS = ["fldcuASIPQCUQei30", "fldhPuYjCpknPiYF5", "fldT8we6MEL43xbWY", "fldC0989e2hSnyG0q", "fldBbEI9mqzDExPbZ", "fld0V1vNSde0OdAxr", "fldsWFkhGBxRSpofv"];
const ART_FIELDS = ["fldrHdHMKvcA6PX4I", "fldonc2CQ6CNu6UHI", "fldf6c1D4Ebqx4zdY", "fld66bhS7SRJYI39U"];
const PAK_FIELDS = ["fldnXAJnpqT1O64uW", "fldKI0TAQwQv4v6tK", "fld9XRHFtLPfh1m3Z", "fldjykmKI8oa8Npq6", "fldKNIzZpisWllX38", "fldDQa6SKW3D2F50k", "fldS6b5ve0WtMXNEs"];
const UPG_FIELDS = ["fldmupd1lBOG6Qsej", "fldFDFgr1hAjBCFuj", "fldUiwjN9eW7eJTTP", "fldbaFO0qFczWU9Vl", "fldFyCNPwExbJG5qy", "fldIsPzOIRrO5sBoC"];
// Velden die het formulier in Badkamer orders mag schrijven
const ORD_WRITE = new Set(["fldZml0moCee9wDm4", "fldhkfLpjUt04onwS", "fld6xoOuZha6Yexij", "fldAI9KgGanil4f17", "fldzdF2SMp78jWJCC", "fldrI2vyYjR0uCEJw", "fldVaakhfS7FR5nIg", "fld4av3cWJCzsBFup", "fldZjfxnENfLIJpzG", "fldtjawfpDu2cE54a", "fldZYZ4FTwjynF6Lh", "fldvEDw2nDPaMpVWj", "fldycdxAzfuHVm9pu", "fldU9SPTvaZpm8JfL", "fldDszrRvki1F99dt", "fldUzk8Gz0wdOWuvW", "fldTYBXzLGSzeYTgk", "fldnash9dvP6cCBxv", "fldPv2MVjO8CGYNAx", "fldl0LEfTekP5Xomq", "fldrshouPbhAoWGvS", "fldKWzFZQJnjofO6z", "fldJ3VQsBPSW6ME8f", "fldX313TIfcL8H5KP", "fldE4mhMCb9lhqYY2", "fldYdNEpk7qan0wif", "fldEexHOijIkBVBK1", "fldSUEJeMM83KFVNc", "fldJwcYL3itv3lt8I", "fldzXsLlw4hq5IfQf", "fldPA13g3eKW09xA7", "fld37fz81UfoWYsb8", "fldLXVVNPpDnLghZO", "fldXZMwv3gWFbZUmv", "fldxWZWqgOxRXLNU5", "fldYLjfuFZ73YOo1n", "fldeYw0PvEml1JcJt", "fldNzctp3jsuKfwdJ", "fldljWPPlsWoqx5Ks", "fld54kzLI9JV676mZ"]);
const ORD_READ = ["fldr72EvSG7cQGvJi", "fldlDVzaCDy9mCtQH", "fldrI2vyYjR0uCEJw", "fldhkfLpjUt04onwS", "fldYdNEpk7qan0wif", "fldAI9KgGanil4f17", "fldXZMwv3gWFbZUmv", "fld6xoOuZha6Yexij", "fldeYw0PvEml1JcJt", "fldYLjfuFZ73YOo1n", "fld5t6II9cqH4Erpe", "fldZjfxnENfLIJpzG"];
const REG_WRITE = new Set(["fldmLe18tpTrsBqjU", "fldZuTFQlv4OGlK4b", "fldociuEcgRvHyERC", "fldee4jj5m3NEdXB7", "fldU7D2ngw3UhFLrt", "fldVO5mxqJrAjGdyv", "fld52sdBnQBkbkbov", "fldDuNjSVTjYSPflP", "fldUsIrhfylzAbfwJ"]);

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
  ping: async () => ({ ok: true }),

  catalog: async () => {
    const [pak, upg] = await Promise.all([list(T.pak, { pageSize: 50, "fields[]": PAK_FIELDS }), list(T.upg, { pageSize: 100, "fields[]": UPG_FIELDS })]);
    return { pak, upg };
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

  saveOrder: async ({ id, fields }) => {
    const f = pick(fields, ORD_WRITE);
    if (id != null && !isRec(id)) throw new Fail(400, "bad_request", "Ongeldige order.");
    const r = id
      ? await at("PATCH", `${T.ord}/${id}`, { body: { fields: f, typecast: true, returnFieldsByFieldId: true } })
      : (await at("POST", T.ord, { body: { records: [{ fields: f }], typecast: true, returnFieldsByFieldId: true } })).records[0];
    // Ordernummer is een formule: opnieuw ophalen zodat het zeker mee komt
    const full = await at("GET", `${T.ord}/${r.id}`, { query: { returnFieldsByFieldId: true } });
    return { records: [out({ ...full, fields: Object.fromEntries(ORD_READ.map(k => [k, full.fields?.[k]]).filter(([, v]) => v != null)) })] };
  },

  createLines: async ({ records }) => {
    if (!Array.isArray(records) || !records.length || records.length > 10) throw new Fail(400, "bad_request", "1 tot 10 regels per keer.");
    const body = { records: records.map(r => ({ fields: pick(r?.fields, REG_WRITE) })), typecast: true };
    const res = await at("POST", T.reg, { body });
    return { ids: res.records.map(r => r.id) };
  },

  deleteLines: async ({ ids }) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 10 || !ids.every(isRec)) throw new Fail(400, "bad_request", "1 tot 10 regels per keer.");
    await at("DELETE", T.reg, { query: { "records[]": ids } });
    return { ok: true };
  },

  listOrders: async ({ verkoper }) => {
    const v = String(verkoper || "").trim().slice(0, 100);
    const records = await list(T.ord, {
      pageSize: 60, maxRecords: 60, "fields[]": ORD_READ,
      "sort[0][field]": "Aangemaakt", "sort[0][direction]": "desc",
      ...(v ? { filterByFormula: `{Verkoper}=${str(v)}` } : {}),
    });
    return { records };
  },
};

export default async (req) => {
  if (req.method !== "POST") return json(405, { code: "method", message: "Alleen POST." });
  if (!process.env.AIRTABLE_TOKEN || !process.env.ACCESS_CODE) return json(500, { code: "config", message: "AIRTABLE_TOKEN of ACCESS_CODE ontbreekt in de Netlify-instellingen." });
  if ((req.headers.get("x-access-code") || "") !== process.env.ACCESS_CODE) return json(401, { code: "unauthorized", message: "Toegangscode onjuist." });
  let body;
  try { body = await req.json() } catch { return json(400, { code: "bad_request", message: "Ongeldig verzoek." }) }
  const fn = actions[body?.action];
  if (!fn) return json(400, { code: "bad_request", message: "Onbekende actie." });
  try { return json(200, await fn(body.payload || {})) }
  catch (e) {
    if (e instanceof Fail) return json(e.status, { code: e.code, message: e.message });
    console.error(e);
    return json(500, { code: "server_error", message: "Er ging iets mis op de server." });
  }
};

export const config = { path: "/api" };
