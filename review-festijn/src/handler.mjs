import { RULES, score, starsOf } from "./score.mjs";

const DB_KEY = "db";
const OG_KEY = "og/latest";
const UNDO_MS = 15 * 60 * 1000; // eigen invoer 15 minuten lang ongedaan te maken
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const PLATFORMS = ["Google", "Trustpilot"];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

function parseAdmins(raw) {
  // ADMIN_CODES="Amin:geheim1,Erber:geheim2"
  const out = [];
  for (const part of (raw || "").split(",")) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    const name = part.slice(0, i).trim(), code = part.slice(i + 1).trim();
    if (name && code) out.push({ name, code });
  }
  return out;
}

function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function auth(req, url, env) {
  const admins = parseAdmins(env.ADMIN_CODES);
  const adminCode = req.headers.get("x-admin-code");
  const admin = adminCode ? admins.find(a => safeEqual(a.code, adminCode)) : null;
  const teamCode = env.TEAM_CODE || "";
  const given = req.headers.get("x-team-code") || url.searchParams.get("t") || "";
  const team = !teamCode || safeEqual(teamCode, given) || !!admin;
  // Open modus (standaard): iedereen mag invoeren, alles telt meteen mee. LOCKED=on: alleen beheerders.
  const open = !isLocked(env);
  return { admin: admin ? admin.name : open ? "Team" : null, isAdmin: !!admin, open, team };
}
const isLocked = env => /^(on|true|1|ja|yes)$/i.test(env.LOCKED || "");

// REVIEW_LINK: één Google-reviewlink voor iedereen, of per team: "VEG=https://…,TEG=https://…"
export function parseReviewLinks(raw) {
  const out = {};
  for (const part of (raw || "").split(",").map(x => x.trim()).filter(Boolean)) {
    const m = /^([A-Z]{2,5})=(https?:\/\/.+)$/.exec(part);
    if (m) out[m[1]] = m[2];
    else if (/^https?:\/\//.test(part)) out["*"] = part;
  }
  return out;
}

// Standaard voeren alleen beheerders reviews in; EMPLOYEE_SUBMIT=on laat medewerkers ook insturen (ter controle).
const openSubmit = env => /^(on|true|1|ja|yes)$/i.test(env.EMPLOYEE_SUBMIT || "");

const empty = () => ({ people: {}, subs: {}, flags: {} });
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
export const normLink = u => (u || "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

async function readDb(store) {
  const cur = await store.getWithMetadata(DB_KEY, { type: "json" });
  if (!cur) return { db: empty(), etag: null };
  if (cur.etag) return { db: { ...empty(), ...cur.data }, etag: cur.etag };
  // Lokale dev-server geeft geen ETag bij lezen: eerst de ETag via list, dan de data.
  // In die volgorde faalt een tussentijdse wijziging altijd veilig op de ETag-check.
  const { blobs } = await store.list({ prefix: DB_KEY });
  const etag = (blobs.find(b => b.key === DB_KEY) || {}).etag;
  const data = await store.get(DB_KEY, { type: "json" });
  return { db: { ...empty(), ...data }, etag: etag || null };
}

// Lees-wijzig-schrijf met een ETag-check: gelijktijdige inzendingen overschrijven elkaar nooit.
async function mutate(store, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { db, etag } = await readDb(store);
    const result = fn(db);
    const res = await store.setJSON(DB_KEY, db, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (res.modified) return result;
    await sleep(Math.random() * 40 * 2 ** attempt);
  }
  throw new HttpError(503, "Het is even druk. Probeer het opnieuw.");
}

function publicState(db, who, device, env) {
  const linkCount = {};
  for (const s of Object.values(db.subs)) { const k = normLink(s.link); if (k) linkCount[k] = (linkCount[k] || 0) + 1; }
  const subs = Object.values(db.subs).sort((a, b) => b.createdAt - a.createdAt).map(s => {
    const f = db.flags[s.id] || {};
    const k = normLink(s.link);
    return {
      id: s.id, stars: starsOf(s), personId: s.personId, count: s.count, platform: s.platform, link: s.link,
      client: s.client, date: s.date, note: s.note, byName: s.byName, createdAt: s.createdAt,
      image: !!s.image, nameInReview: !!s.nameInReview, review: s.review || null,
      flags: Object.keys(f).length, flagged: !!(device && f[device]), mine: !!(device && s.device === device),
      dup: k ? linkCount[k] : 0,
    };
  });
  return {
    admin: who.admin,
    isAdmin: who.isAdmin,
    open: who.open,
    rules: RULES,
    reviewLinks: parseReviewLinks(env.REVIEW_LINK),
    openSubmit: openSubmit(env),
    people: Object.values(db.people).sort((a, b) => a.name.localeCompare(b.name, "nl")),
    subs,
    score: score(db),
  };
}

function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw new HttpError(400, "Het printscreen moet een JPG-, PNG- of WebP-afbeelding zijn.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Het printscreen is te groot (max 4,5 MB).");
  return { type: m[1], bytes };
}

async function submit(store, body, who) {
  const stars = int(body.stars, 1, 5);
  if (!stars) throw new HttpError(400, "Kies het aantal sterren (1 t/m 5).");
  const count = int(body.count, 1, 50);
  if (!count) throw new HttpError(400, "Aantal moet tussen 1 en 50 liggen.");
  const date = str(body.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < RULES.start || date > RULES.end)
    throw new HttpError(400, "De datum moet in de actieperiode liggen (1 t/m 31 oktober).");
  const link = str(body.link, 500);
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, "De link moet beginnen met https://");
  if (stars > 1 && body.nameInReview !== true)
    throw new HttpError(400, "Een review telt alleen als de naam van de medewerker erin staat.");
  if (!body.image && !who.admin) throw new HttpError(400, "Voeg een printscreen toe.");
  const platform = PLATFORMS.includes(body.platform) ? body.platform : "Google";
  const newName = str(body.newName, 60);
  const team = RULES.teams.includes(body.team) ? body.team : RULES.teams[0];

  const id = newId();
  let image = null;
  if (body.image) {
    const img = decodeImage(body.image);
    await store.set("img/" + id, img.bytes, { metadata: { type: img.type } });
    image = "img/" + id;
  }

  try {
    return await mutate(store, db => {
      let personId = null;
      // Bij 2-5 sterren is de medewerker verplicht, bij 1 ster optioneel.
      if (stars > 1 || newName || body.personId) {
        if (newName) {
          const existing = Object.values(db.people).find(p => p.name.toLowerCase() === newName.toLowerCase());
          if (existing) personId = existing.id;
          else { personId = newId(); db.people[personId] = { id: personId, name: newName, team, createdAt: Date.now() }; }
        } else {
          personId = str(body.personId, 40);
          if (!db.people[personId]) throw new HttpError(400, "Kies voor wie de review is.");
        }
      }
      const k = normLink(link);
      if (k && Object.values(db.subs).some(s => normLink(s.link) === k))
        throw new HttpError(409, "Deze link is al eerder ingestuurd.");
      db.subs[id] = {
        id, stars, personId, count, platform, link, date, image,
        client: str(body.client, 60), note: str(body.note, 140),
        byName: str(body.byName, 60) || (who.isAdmin ? who.admin : "Onbekend"),
        device: str(body.device, 64), nameInReview: stars > 1 && body.nameInReview === true,
        createdAt: Date.now(),
        // Een beheerder die zelf invoert keurt meteen goed.
        review: who.admin ? { decision: "ok", count, by: who.admin, at: Date.now() } : null,
      };
      return { id, personId, approved: !!who.admin };
    });
  } catch (e) {
    if (image) await store.delete(image).catch(() => {});
    throw e;
  }
}

export async function handle(req, { store, env = {} }) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const who = auth(req, url, env);

  try {
    if (path === "login" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const admin = parseAdmins(env.ADMIN_CODES).find(a => safeEqual(a.code, body.code));
      if (!admin) throw new HttpError(401, "Onbekende beheerderscode.");
      return json(200, { admin: admin.name });
    }
    if (path === "team" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const ok = !env.TEAM_CODE || safeEqual(env.TEAM_CODE, body.code);
      if (!ok) throw new HttpError(401, "Deze teamcode klopt niet.");
      return json(200, { ok: true });
    }

    // Linkvoorbeeld voor WhatsApp: publiek. Het plaatje zelf tekent de browser (zie POST og).
    if (url.pathname === "/og.png" && req.method === "GET") {
      const r = await store.getWithMetadata(OG_KEY, { type: "arrayBuffer" });
      if (!r) return new Response("Nog geen linkvoorbeeld", { status: 404 });
      return new Response(r.data, { headers: { "content-type": "image/png", "cache-control": "public, max-age=60", "netlify-cdn-cache-control": "public, s-maxage=60" } });
    }

    if (!who.team) throw new HttpError(401, "Teamcode nodig.");

    if (path === "state" && req.method === "GET") {
      const [{ db }, og] = await Promise.all([readDb(store), store.getMetadata(OG_KEY).catch(() => null)]);
      return json(200, { ...publicState(db, who, url.searchParams.get("d"), env), ogFp: og?.metadata?.fp || null });
    }

    if (path.startsWith("img/") && req.method === "GET") {
      const key = "img/" + path.slice(4).replace(/[^a-z0-9]/gi, "");
      const r = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (!r) return new Response("Niet gevonden", { status: 404 });
      return new Response(r.data, { headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "private, max-age=31536000, immutable" } });
    }

    if (path.startsWith("avatar/") && req.method === "GET") {
      const key = "avatar/" + path.slice(7).replace(/[^a-z0-9]/gi, "");
      const r = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (!r) return new Response("Niet gevonden", { status: 404 });
      return new Response(r.data, { headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "private, max-age=31536000, immutable" } });
    }

    if (req.method !== "POST") throw new HttpError(404, "Onbekend adres.");
    const body = await req.json().catch(() => { throw new HttpError(400, "Ongeldige aanvraag."); });

    if (path === "og") {
      if (!who.admin) throw new HttpError(403, "Alleen beheerders.");
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(body.image || "");
      if (!m) throw new HttpError(400, "Linkvoorbeeld moet een PNG zijn.");
      const bytes = Buffer.from(m[1], "base64");
      if (bytes.length > 1.5 * 1024 * 1024) throw new HttpError(413, "Linkvoorbeeld is te groot.");
      await store.set(OG_KEY, bytes, { metadata: { fp: str(body.fp, 200), at: Date.now() } });
      return json(200, { ok: true });
    }

    if (path === "submit") {
      if (!who.admin && !openSubmit(env)) throw new HttpError(403, "Alleen beheerders kunnen reviews invoeren.");
      return json(200, await submit(store, body, who));
    }

    if (path === "flag") {
      const device = str(body.device, 64);
      if (!device) throw new HttpError(400, "Apparaat onbekend.");
      await mutate(store, db => {
        if (!db.subs[body.id]) throw new HttpError(404, "Inzending bestaat niet meer.");
        const f = db.flags[body.id] || (db.flags[body.id] = {});
        if (body.on) f[device] = true; else delete f[device];
        if (!Object.keys(f).length) delete db.flags[body.id];
      });
      return json(200, { ok: true });
    }

    if (path === "delete") {
      const removed = await mutate(store, db => {
        const s = db.subs[body.id];
        if (!s) return null;
        // Eigen invoer mag je kort daarna nog ongedaan maken; verder alleen via de beheerderslink.
        const own = s.device && s.device === str(body.device, 64) && (!s.review || Date.now() - s.createdAt < UNDO_MS);
        if (!who.isAdmin && !own) throw new HttpError(403, "Verwijderen kan alleen via de beheerderslink.");
        delete db.subs[body.id]; delete db.flags[body.id];
        return s;
      });
      if (removed && removed.image) await store.delete(removed.image).catch(() => {});
      return json(200, { ok: true });
    }

    // Deelnemer toevoegen mag iedereen (open modus); al het andere hieronder alleen via de beheerderslink.
    if (path === "person" && body.action === "add" && who.admin) {
      await mutate(store, db => {
        const name = str(body.name, 60);
        if (!name) throw new HttpError(400, "Vul een naam in.");
        if (Object.values(db.people).some(p => p.name.toLowerCase() === name.toLowerCase()))
          throw new HttpError(409, name + " staat er al in.");
        const id = newId();
        db.people[id] = { id, name, team: RULES.teams.includes(body.team) ? body.team : RULES.teams[0], createdAt: Date.now() };
      });
      return json(200, { ok: true });
    }

    if (!who.isAdmin) throw new HttpError(403, "Dit kan alleen via de beheerderslink.");

    if (path === "decide") {
      await mutate(store, db => {
        const s = db.subs[body.id];
        if (!s) throw new HttpError(404, "Inzending bestaat niet meer.");
        if (body.decision === "reset") { s.review = null; return; }
        if (body.decision === "no") { s.review = { decision: "no", count: 0, by: who.admin, at: Date.now() }; return; }
        const count = int(body.count, 1, 50);
        if (body.decision !== "ok" || !count) throw new HttpError(400, "Kies goedkeuren (aantal 1-50) of afkeuren.");
        s.review = { decision: "ok", count, by: who.admin, at: Date.now() };
      });
      return json(200, { ok: true });
    }

    if (path === "person" && body.action === "photo") {
      const id = str(body.id, 40).replace(/[^a-z0-9]/gi, "");
      if (body.image) {
        const img = decodeImage(body.image);
        await store.set("avatar/" + id, img.bytes, { metadata: { type: img.type } });
      } else await store.delete("avatar/" + id).catch(() => {});
      await mutate(store, db => {
        const p = db.people[id];
        if (!p) throw new HttpError(404, "Persoon bestaat niet.");
        if (body.image) p.photo = Date.now(); else delete p.photo;
      });
      return json(200, { ok: true });
    }

    if (path === "person") {
      await mutate(store, db => {
        if (body.action === "add") {
          const name = str(body.name, 60);
          if (!name) throw new HttpError(400, "Vul een naam in.");
          if (Object.values(db.people).some(p => p.name.toLowerCase() === name.toLowerCase()))
            throw new HttpError(409, name + " staat er al in.");
          const id = newId();
          db.people[id] = { id, name, team: RULES.teams.includes(body.team) ? body.team : RULES.teams[0], createdAt: Date.now() };
        } else if (body.action === "delete") {
          if (Object.values(db.subs).some(s => s.personId === body.id))
            throw new HttpError(409, "Deze persoon heeft nog inzendingen. Verwijder die eerst.");
          delete db.people[body.id];
        } else if (body.action === "update") {
          const p = db.people[body.id];
          if (!p) throw new HttpError(404, "Persoon bestaat niet.");
          const name = str(body.name, 60);
          if (name) p.name = name;
          if (RULES.teams.includes(body.team)) p.team = body.team;
        } else throw new HttpError(400, "Onbekende actie.");
      });
      if (body.action === "delete") await store.delete("avatar/" + str(body.id, 40).replace(/[^a-z0-9]/gi, "")).catch(() => {});
      return json(200, { ok: true });
    }

    throw new HttpError(404, "Onbekend adres.");
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: "Er ging iets mis op de server. Probeer het opnieuw.", detail: String(e && e.message || e) });
  }
}
