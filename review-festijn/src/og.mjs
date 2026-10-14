// Linkvoorbeeld (og:image) met de actuele stand, 1200×630 PNG.
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// WebAssembly-versie: werkt op elk besturingssysteem, ook als je vanaf Mac/Windows deployt.
let ready;
const loadResvg = () => ready ??= readFile(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm")).then(initWasm);
import { MONTSERRAT_600, MONTSERRAT_700, MONTSERRAT_800 } from "./fonts.mjs";

const OLIVE = "#BCB731", CHAR = "#2E3338", INK = "#23271B", WHITE = "#FFFFFF";
const fonts = [[600, MONTSERRAT_600], [700, MONTSERRAT_700], [800, MONTSERRAT_800]]
  .map(([weight, b64]) => ({ name: "Montserrat", weight, style: "normal", data: Buffer.from(b64, "base64") }));

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter(c => c != null && c !== false) } });
const star = (size, color) => ({
  type: "svg",
  props: { width: size, height: size, viewBox: "0 0 24 24", children: { type: "path", props: { fill: color, d: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" } } },
});
const eur = c => "€" + (Math.max(0, c) / 100).toLocaleString("nl-NL", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const avg = v => v.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** score: resultaat van score(); photo: optionele data-URL van de winnaar. */
export async function renderOg({ score, daysLeft, dateLabel, photo }) {
  const rows = score.rows.filter(r => r.reviews > 0).slice(0, 6);
  const leaders = score.rows.filter(r => score.leaders.includes(r.id));
  const lead = leaders.length === 1 ? leaders[0] : null;
  const T = score.totals;

  const left = h("div", { flexDirection: "column", width: 500, justifyContent: "space-between" },
    h("div", { flexDirection: "column" },
      h("div", { color: OLIVE, fontSize: 22, fontWeight: 700, letterSpacing: 2 }, "VEG · TEG · KEG"),
      h("div", { color: WHITE, fontSize: 64, fontWeight: 800, lineHeight: 1, marginTop: 14 }, "REVIEW FESTIJN"),
      h("div", { color: OLIVE, fontSize: 64, fontWeight: 800, lineHeight: 1.05 }, "OKTOBER"),
      h("div", { color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: 600, marginTop: 16 }, `Stand van ${dateLabel} · nog ${daysLeft} dagen`),
    ),
    h("div", { backgroundColor: OLIVE, borderRadius: 22, padding: 18, alignItems: "center" },
      h("div", { flexDirection: "column", alignItems: "center", backgroundColor: INK, borderRadius: 14, padding: "12px 16px" },
        h("div", { color: OLIVE, fontSize: 40, fontWeight: 800, lineHeight: 1 }, "€200"),
        h("div", { color: OLIVE, fontSize: 14, fontWeight: 800, letterSpacing: 2, marginTop: 4 }, "BONUS")),
      h("div", { flexDirection: "column", marginLeft: 18, flex: 1, color: INK },
        h("div", { fontSize: 16, fontWeight: 800, letterSpacing: 1.5 }, leaders.length > 1 ? "GEDEELDE KOPPOSITIE" : "WINNAAR NU"),
        h("div", { fontSize: 34, fontWeight: 800, lineHeight: 1.15 }, leaders.length ? leaders.map(r => r.name).join(" & ").slice(0, 28) : "Nog niemand"),
        h("div", { fontSize: 18, fontWeight: 700, alignItems: "center" },
          leaders.length ? `${score.top}× 5 sterren` : "Wie wordt de eerste?",
          lead && lead.avgStars ? h("div", { marginLeft: 10, alignItems: "center" }, star(18, INK), h("div", { marginLeft: 4 }, avg(lead.avgStars))) : null)),
      photo ? { type: "img", props: { src: photo, width: 84, height: 84, style: { borderRadius: 42, border: `4px solid ${INK}`, objectFit: "cover" } } } : null),
  );

  const list = rows.length
    ? rows.map((r, i) => h("div", { alignItems: "center", height: 64, padding: "0 16px", borderRadius: 14, backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.07)" : "transparent" },
        h("div", { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: r.rank === 1 ? OLIVE : "rgba(255,255,255,0.14)", color: r.rank === 1 ? INK : WHITE, fontSize: 20, fontWeight: 800 }, String(r.rank)),
        h("div", { flexDirection: "column", flex: 1, marginLeft: 16 },
          h("div", { color: WHITE, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }, r.name.slice(0, 18)),
          h("div", { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: 700, alignItems: "center" }, r.team,
            r.avgStars ? h("div", { marginLeft: 10, alignItems: "center", color: "#E5C547" }, star(14, "#E5C547"), h("div", { marginLeft: 3 }, avg(r.avgStars))) : null)),
        h("div", { color: WHITE, fontSize: 24, fontWeight: 800, width: 70, justifyContent: "flex-end", alignItems: "center" }, String(r.reviews), h("div", { marginLeft: 4 }, star(18, WHITE))),
        h("div", { color: OLIVE, fontSize: 26, fontWeight: 800, width: 130, justifyContent: "flex-end" }, eur(r.netCents))))
    : [h("div", { color: "rgba(255,255,255,0.8)", fontSize: 26, fontWeight: 600, padding: 16 }, "Nog geen goedgekeurde reviews.")];

  const right = h("div", { flexDirection: "column", flex: 1, marginLeft: 44, justifyContent: "space-between" },
    h("div", { flexDirection: "column" }, ...list),
    h("div", { color: "rgba(255,255,255,0.7)", fontSize: 18, fontWeight: 600, borderTop: "2px solid rgba(255,255,255,0.15)", paddingTop: 14 },
      `${T.approved} reviews · ${T.five}× 5 sterren · ${T.bad}× 1 ster`),
  );

  await loadResvg();
  const svg = await satori(h("div", { width: 1200, height: 630, backgroundColor: CHAR, padding: 48, fontFamily: "Montserrat" }, left, right), { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}
