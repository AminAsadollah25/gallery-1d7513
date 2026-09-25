// Validates the default layout in index.html. Run: node scripts/check-layout.js
const path = require('path');
const s = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = s.split('<script>')[1].split('</script>')[0];
new Function(js); // syntax check
const pick = (a, b) => js.slice(js.indexOf(a), js.indexOf(b)).replace(/const |let /g, 'var ');
eval(pick('const MAIN', 'const USABLE'));
eval(pick('const USABLE', '/* ---------- furniture'));
eval(pick('const DEFS', 'const KEY'));
function localRects(d){ return d.rects || [[-d.w/2, -d.d/2, d.w/2, d.d/2]]; }
eval(pick('function worldRects', 'function evaluate'));
console.log('usable floor m2:', USABLE.toFixed(1), ' gross m2:', ((MAIN.x1*MAIN.y1 + (CORR.x1-CORR.x0)*(CORR.y1-CORR.y0))/1e4).toFixed(1));
let fail = 0;
for (const door of ['bottom', 'top']) {
  balDoor = door;
  const all = DEFS.map(d => Object.assign({}, d, { flip: !!d.flip }));
  all.forEach(it => it.wr = worldRects(it));
  const counts = {};
  all.forEach(it => {
    const R = it.wr; let st = 'ok';
    if (R.every(r => !touchesHouse(r))) st = 'out';
    else if (R.some(r => !inHouse(r))) st = 'bad-wall';
    else {
      const o = OBST.find(ob => R.some(r => ov(r, ob)));
      if (o) st = 'bad ' + o.fa;
      else {
        const other = all.find(x => x !== it && x.wr.some(q => touchesHouse(q)) && x.wr.some(q => R.some(r => ov(r, q))));
        if (other) st = 'bad on ' + other.id;
        else { const z = zonesActive().find(zz => R.some(r => ov(r, zz))); if (z) st = 'warn ' + z.fa; }
      }
    }
    const k = st.split(' ')[0]; counts[k] = (counts[k] || 0) + 1;
    if (st !== 'ok' && st !== 'out') console.log(door, it.id.padEnd(9), st);
    if (door === 'bottom' && st.startsWith('bad')) fail = 1;
  });
  console.log(door, JSON.stringify(counts));
}
process.exit(fail);
