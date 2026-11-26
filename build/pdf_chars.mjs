// Dựng lại chars.json và strokes{L}.json theo danh sách từ mới (app/data/hsk{L}.json, soạn theo tài liệu PDF).
// Chữ đã có giữ nguyên thông tin, chỉ cập nhật cấp xuất hiện đầu tiên; chữ mới lấy từ Make Me a Hanzi, Hán Việt, CVDICT.
// Chỉ ĐỌC các file dữ liệu đã tải về như dữ liệu, không chạy code của gói nào.
import fs from 'fs';
const [, , D, APP] = process.argv;
const OUT = APP + 'data/';
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
for (const l of fs.readFileSync(D + 'mmah_dict.txt', 'utf8').split('\n')) { if (l.trim()) { const o = JSON.parse(l); mm[o.character] = o; } }

const firstLevel = {}, charPy = {};
const isHan = c => /\p{Script=Han}/u.test(c);
const TM = {'\u0304':1,'\u0301':2,'\u030c':3,'\u0300':4};
const numOf = p => { const s = p.normalize('NFD').toLowerCase().replace(/u\u0308/g,'v'); let t = 5; for (const k in TM) if (s.includes(k)) t = TM[k]; return s.replace(/[\u0300-\u036f]/g,'') + t; };
const OLD = JSON.parse(fs.readFileSync(OUT + 'chars.json', 'utf8'));
for (let L = 1; L <= 6; L++) for (const [h, p] of JSON.parse(fs.readFileSync(OUT + `hsk${L}.json`, 'utf8')))
  for (const c of h) if (isHan(c) && !firstLevel[c]) { firstLevel[c] = L; if ([...h].length === 1) charPy[c] = { num: numOf(p), trad: c }; }
const TYPE = { pictophonetic: 'ht', ideographic: 'hy', pictographic: 'tg' };
const LAYOUT = '⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻';
function numToMark(n) {
  const m = n.match(/^([a-zv]+)([1-5])?$/); if (!m) return n; let [, s, t] = m; s = s.replace(/v/g, 'ü'); if (!t || t === '5') return s;
  const marks = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  let idx = s.search(/[ae]/); if (idx < 0) idx = s.indexOf('ou');
  if (idx < 0) for (let i = s.length - 1; i >= 0; i--) if ('iouü'.includes(s[i])) { idx = i; break; }
  return idx < 0 ? s : s.slice(0, idx) + marks[s[idx]][+t - 1] + s.slice(idx + 1);
}
const comps = new Set();
function charInfo(c, withParts) {
  const m = mm[c] || {}, cp = charPy[c], num = cp?.num || null;
  const info = { py: num ? numToMark(num) : (m.pinyin?.[0] || ''), hv: hvChar(cp?.trad || c, c, num) || ({'只':'chỉ'})[c] || '' };
  const L = cv[c] || [];
  const e = (num && L.find(x => x.py === num && !x.cap && !BAD.test(x.defs[0]))) || L.find(x => !x.cap && !BAD.test(x.defs[0])) || L[0];
  info.m = e ? cleanDefs(e.defs, 2) : '';
  if (withParts) {
    const et = m.etymology || {}, dec = [...(m.decomposition || '')];
    info.k = TYPE[et.type] || 'gt';
    if (LAYOUT.includes(dec[0])) info.lay = dec[0];
    if (et.type === 'pictophonetic') { info.am = et.phonetic || ''; info.y = et.semantic || ''; }
    else if (et.type === 'ideographic') info.parts = dec.filter(x => isHan(x));
    if (info.k === 'ht' && m.matches && info.y && dec.length) {
      // vị trí thành phần cấp 1 trong decomposition, để biết nét nào thuộc phần ý
      let need = 1, pos = 0, idx = -1;
      const stack = [];
      for (const ch of dec.slice(1)) {
        if (stack.length === 0) { if (ch === info.y) idx = pos; pos++; }
        if (LAYOUT.includes(ch)) stack.push('⿲⿳'.includes(ch) ? 3 : 2);
        else { while (stack.length) { stack[stack.length - 1]--; if (stack[stack.length - 1] === 0) stack.pop(); else break; } }
      }
      if (idx >= 0) info.sem = m.matches.map((mt, i) => (mt && mt[0] === idx) ? i : -1).filter(i => i >= 0);
    }
    for (const x of [info.am, info.y, ...(info.parts || [])]) if (x) comps.add(x);
  }
  return info;
}
const chars = {};
let added = 0;
for (const c of Object.keys(firstLevel)) { if (OLD.chars[c]) chars[c] = { ...OLD.chars[c], L: firstLevel[c] }; else { chars[c] = { ...charInfo(c, true), L: firstLevel[c] }; added++; } }
console.log('chữ mới', added, 'bỏ', Object.keys(OLD.chars).filter(c => !firstLevel[c]).length);
const compInfo = { ...OLD.comps };
for (const c of Object.values(chars)) for (const x of [c.am, c.y, ...(c.parts || [])]) if (x) comps.add(x);
for (const c of comps) if (!chars[c]) compInfo[c] = charInfo(c, false);
fs.writeFileSync(OUT + 'chars.json', JSON.stringify({ chars, comps: compInfo }));
console.log('chars', Object.keys(chars).length, 'comps', Object.keys(compInfo).length);

// --- thứ tự nét: mỗi cấp một file
const RADS = '亻刂力又口囗土夕大女子宀寸小山巾广彳忄戈扌攵日月木氵灬牛犭王田疒目石禾竹米纟耳艹虫衤讠贝走足钅门阝雨饣心手水火犬玉糸衣言食';
let miss = 0;
for (let L = 1; L <= 6; L++) {
  const st = {};
  const add = c => { const f = D + 'dl/package/' + c + '.json'; if (fs.existsSync(f)) st[c] = JSON.parse(fs.readFileSync(f, 'utf8')); else miss++; };
  for (const [c, l] of Object.entries(firstLevel)) if (l === L) add(c);
  if (L === 1) for (const c of RADS) add(c);
  fs.writeFileSync(OUT + `strokes${L}.json`, JSON.stringify(st));
}
console.log('missing strokes', miss);
