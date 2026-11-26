// Từ ghép mở rộng: từ HSK 3.0 cấp 7–9 (complete-hsk-vocabulary) chỉ gồm các chữ đã học ở cấp 1–6.
// Chỉ đọc dữ liệu (JSON/văn bản), không chạy code của gói nào.
import fs from 'fs';
const [, , D, APP] = process.argv;
// --- Hán Việt: đọc phần JSON trong hanvietData.js như dữ liệu thuần
const hvText = fs.readFileSync(D + 'hv/package/src/hanvietData.js', 'utf8');
const hanvietData = JSON.parse(hvText.slice(hvText.indexOf('{')));
const hvChar = (trad, simp, num) => {
  const d = hanvietData[trad] || hanvietData[simp]; if (!d) return '';
  if (num && d[num]?.length) return d[num][0];
  if (num) { const base = num.replace(/[1-5]$/, ''); for (const k in d) if (k.replace(/[1-5]$/, '') === base && d[k].length) return d[k][0]; }
  return Object.values(d).flat()[0] || '';
};

// --- CVDICT: phồn thể giản thể [pinyin] /nghĩa/nghĩa/
const cv = {};
for (const line of fs.readFileSync(D + 'vi/CVDICT.u8', 'utf8').split('\n')) {
  if (!line || line[0] === '#') continue;
  const m = line.match(/^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/); if (!m) continue;
  const [, trad, simp, py, defs] = m;
  (cv[simp] ||= []).push({ trad, py: py.toLowerCase().replace(/u:/g, 'v').replace(/\s+/g, ' ').trim(), cap: /^[A-Z]/.test(py), defs: defs.split('/') });
}
const BAD = /^(dùng trong|được dùng trong|biến thể|dạng cổ|xem |họ |họ$|tên |viết tắt của|cũng viết|cách viết|\(cổ\)|\(văn cổ\)|CL:|\(Tw\)|\(Đài Loan\))/i;
function cleanDefs(defs, n = 3) {
  let out = defs.map(d => d.replace(/LT:\S*/g, '').replace(/\S+\|\S+/g, '').replace(/\[[^\]]*\]/g, '').replace(/\([^)]{28,}\)/g, '').replace(/\s+/g, ' ').replace(/[;,]\s*$/, '').trim()).map(d => (d.split('(').length > d.split(')').length) ? d.slice(0, d.lastIndexOf('(')).trim() : d)
    .filter(d => d && !BAD.test(d));
  if (!out.length) out = defs.filter(d => !/^CL:/.test(d)).slice(0, 1);
  const r = []; let len = 0;
  for (const d of out) { if (r.length >= n || (len + d.length > 70 && r.length)) break; r.push(d); len += d.length; }
  return r.join('; ');
}
const normPy = s => s.toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v').replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
function viMeaning(simp, trad, num) {
  const L = cv[simp] || []; if (!L.length) return '';
  const p = normPy(num), strip = x => x.replace(/[1-5]/g, '');
  const ok = e => !e.cap && !BAD.test(e.defs[0]);
  const best = L.find(e => e.trad === trad && e.py === p && ok(e)) || L.find(e => e.py === p && ok(e)) || L.find(e => e.py === p)
    || L.find(e => strip(e.py) === strip(p) && ok(e)) || L.find(ok) || L[0];
  return cleanDefs(best.defs);
}

// --- Make Me a Hanzi: cấu tạo chữ
const mm = {};

const POS={'n':'danh từ','v':'động từ','a':'tính từ','d':'phó từ','m':'số từ','q':'lượng từ','r':'đại từ','p':'giới từ','c':'liên từ','u':'trợ từ','e':'thán từ','y':'ngữ khí từ','o':'từ tượng thanh','f':'phương vị từ','s':'từ chỉ nơi chốn','t':'từ chỉ thời gian','vn':'động danh từ','an':'danh tính từ','ad':'phó tính từ','b':'từ khu biệt','i':'thành ngữ','l':'cụm từ quen dùng','nr':'tên người','ns':'địa danh','z':'từ trạng thái','vd':'động phó từ','j':'từ viết tắt','h':'tiền tố','k':'hậu tố','g':'ngữ tố','nz':'danh từ riêng','tg':'từ thời gian','mq':'số lượng từ'};
const have = new Set(), firstLevel = {};
for (let L = 1; L <= 6; L++) for (const [h] of JSON.parse(fs.readFileSync(APP + `data/hsk${L}.json`, 'utf8'))) {
  have.add(h); for (const c of h) if (!firstLevel[c]) firstLevel[c] = L; }
const all = JSON.parse(fs.readFileSync(D + 'hskdata79/complete.json', 'utf8'));
const out = {1:[],2:[],3:[],4:[],5:[],6:[]}; let skipVi = 0, skipCh = 0;
const seen = new Set();
for (const e of all) {
  const h = e.simplified; if (seen.has(h) || have.has(h) || [...h].length < 2 || !/^\p{Script=Han}+$/u.test(h)) continue;
  const lv = e.level || []; if (!lv.some(x => /-7$/.test(x))) continue;  // chỉ lấy nhóm cấp 7–9
  const Ls = [...h].map(c => firstLevel[c]); if (Ls.some(x => !x)) { skipCh++; continue; }
  const f = e.forms[0], t = f.transcriptions, num = t.numeric;
  const vi = viMeaning(h, f.traditional, num); if (!vi) { skipVi++; continue; }
  const nums = num.split(/\s+/), hv = [...h].map((c, i) => hvChar([...f.traditional][i] || c, c, (nums[i] || '').toLowerCase())).join(' ');
  seen.add(h);
  out[Math.max(...Ls)].push([h, t.pinyin.replace(/\s+/g, ''), vi, hv, f.meanings.slice(0, 3).join('; '), [...new Set((e.pos || []).map(x => POS[x]).filter(Boolean))].slice(0, 3), f.traditional !== h ? f.traditional : '', e.frequency ?? 99999]);
}
for (const L in out) out[L].sort((a, b) => a[7] - b[7]);
fs.writeFileSync(APP + 'data/ext.json', JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), {skipVi, skipCh});
for (const L of [1,2,3]) console.log(L, out[L].slice(0, 8).map(x => x.slice(0, 4).join(' | ')));
