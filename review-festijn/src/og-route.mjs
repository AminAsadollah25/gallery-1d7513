// Linkvoorbeeld voor WhatsApp, als losse functie: als deze stuk gaat, blijft de rest van de site werken.
import { RULES, score } from "./score.mjs";
import { renderOg } from "./og.mjs";

export async function handleOg(store) {
  const data = await store.get("db", { type: "json" });
  const sc = score({ people: {}, subs: {}, ...(data || {}) });
  const now = new Date();
  const end = new Date(RULES.end + "T23:59:59+01:00");
  const lead = sc.rows.filter(r => sc.leaders.includes(r.id));
  let photo = null;
  if (lead.length === 1 && lead[0].photo) {
    const a = await store.getWithMetadata("avatar/" + lead[0].id, { type: "arrayBuffer" }).catch(() => null);
    if (a) photo = `data:${a.metadata?.type || "image/jpeg"};base64,${Buffer.from(a.data).toString("base64")}`;
  }
  const png = await renderOg({
    score: sc, photo,
    daysLeft: Math.max(0, Math.floor((end - now) / 864e5)),
    dateLabel: now.toLocaleDateString("nl-NL", { day: "numeric", month: "long", timeZone: "Europe/Amsterdam" }),
  });
  return new Response(png, { headers: {
    "content-type": "image/png",
    "cache-control": "public, max-age=300",
    "netlify-cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=600",
  } });
}
