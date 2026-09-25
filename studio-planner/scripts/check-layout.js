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
  all.forEach(it => it.name = it.name || it.id);
  all.forEach(it => {
    const [st0, why] = judge(it, all);
    const st = st0 === 'ok' || st0 === 'out' ? st0 : st0 + ' ' + why;
    const k = st.split(' ')[0]; counts[k] = (counts[k] || 0) + 1;
    if (st !== 'ok' && st !== 'out') console.log(door, it.id.padEnd(9), st);
    if (door === 'bottom' && st.startsWith('bad')) fail = 1;
  });
  console.log(door, JSON.stringify(counts));
}
process.exit(fail);
