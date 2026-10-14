// Spelregels van het Review Festijn. Alle bedragen in centen, zodat er geen afrondingsfouten ontstaan.
export const RULES = {
  perReviewCents: 2000, // €20 per goedgekeurde 5-sterren review
  penaltyCents: 2000, // €20 per 1-ster review, verdeeld over alle winnaars
  bonusCents: 20000, // €200 voor wie de meeste 5-sterren reviews heeft (bij gelijke stand gedeeld)
  noNegative: true, // niemand komt onder €0 uit
  start: "2026-10-01",
  end: "2026-10-31",
  teams: ["VEG", "TEG", "KEG"],
};

// Oudere inzendingen hadden alleen kind good/bad.
export const starsOf = s => s.stars || (s.kind === "bad" ? 1 : 5);

/**
 * Berekent de ranglijst uit de database.
 * - Alleen goedgekeurde inzendingen tellen; het goedgekeurde aantal (review.count) is leidend.
 * - 5 sterren = €20. 1 ster = €20 aftrek, verdeeld over alle winnaars. 2-4 sterren: geen geld,
 *   maar telt wel mee voor het aantal reviews en het gemiddelde.
 * - Winnaar = iemand met minstens 1 goedgekeurde 5-sterren review.
 * - Bonus = €200 voor wie de meeste 5-sterren reviews heeft; bij gelijke stand gedeeld.
 */
export function score(db, rules = RULES) {
  const people = db.people || {};
  const five = {}, all = {}, starSum = {}, waiting = {};
  let bad = 0, waitingBad = 0, waitingAll = 0;

  for (const s of Object.values(db.subs || {})) {
    const stars = starsOf(s), r = s.review, p = people[s.personId] ? s.personId : null;
    if (r && r.decision === "ok") {
      const n = r.count;
      if (stars === 1) bad += n;
      if (p) {
        all[p] = (all[p] || 0) + n;
        starSum[p] = (starSum[p] || 0) + n * stars;
        if (stars === 5) five[p] = (five[p] || 0) + n;
      }
    } else if (!r) {
      waitingAll += s.count;
      if (stars === 1) waitingBad += s.count;
      if (p) waiting[p] = (waiting[p] || 0) + s.count;
    }
  }

  const rows = Object.values(people).map(p => ({
    id: p.id, name: p.name, team: p.team, photo: p.photo || null,
    reviews: five[p.id] || 0,
    total: all[p.id] || 0,
    avgStars: all[p.id] ? Math.round(starSum[p.id] / all[p.id] * 10) / 10 : null,
    waiting: waiting[p.id] || 0,
  }));
  const winners = rows.filter(r => r.reviews > 0);
  const top = winners.reduce((m, r) => Math.max(m, r.reviews), 0);
  const leaders = winners.filter(r => r.reviews === top);
  const shareCents = winners.length ? Math.round(bad * rules.penaltyCents / winners.length) : 0;
  const bonusEachCents = leaders.length ? Math.round(rules.bonusCents / leaders.length) : 0;

  for (const r of rows) {
    r.earnedCents = r.reviews * rules.perReviewCents;
    r.minusCents = r.reviews > 0 ? shareCents : 0;
    r.bonusCents = r.reviews > 0 && r.reviews === top ? bonusEachCents : 0;
    const raw = r.earnedCents - r.minusCents + r.bonusCents;
    r.netCents = rules.noNegative ? Math.max(0, raw) : raw;
  }

  rows.sort((a, b) => b.reviews - a.reviews || b.total - a.total || (b.avgStars || 0) - (a.avgStars || 0) || b.waiting - a.waiting || a.name.localeCompare(b.name, "nl"));
  // Gedeelde plekken: 1, 1, 3, …
  let rank = 0, prev = -1;
  rows.forEach((r, i) => {
    if (r.reviews !== prev) { rank = i + 1; prev = r.reviews; }
    r.rank = r.reviews > 0 ? rank : null;
  });

  return {
    rows,
    leaders: leaders.map(r => r.id),
    top,
    totals: {
      approved: rows.reduce((s, r) => s + r.total, 0),
      five: winners.reduce((s, r) => s + r.reviews, 0),
      waiting: waitingAll,
      bad,
      waitingBad,
      winners: winners.length,
      penaltyCents: bad * rules.penaltyCents,
      shareCents,
      bonusEachCents,
      potCents: rows.reduce((s, r) => s + r.netCents, 0),
    },
  };
}
