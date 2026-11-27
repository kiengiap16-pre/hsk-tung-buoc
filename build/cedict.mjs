// Từ điển mở rộng: tra được hầu hết mọi từ tiếng Trung (ngoài danh sách HSK 1–6 và từ ghép 7–9 đã có).
// Nguồn: CC-CEDICT (nghĩa tiếng Anh, MDBG, CC BY-SA 4.0, qua gói npm cedict-json), CVDICT của Phong Phan
// (nghĩa tiếng Việt, CC BY-SA 4.0), hanviet-pinyin-words (Hán Việt, MIT), Make Me a Hanzi (cấu tạo chữ),
// từ điển tần suất của jieba (MIT) để xếp từ thông dụng lên trước.
// Từ không có trong CVDICT: nghĩa tiếng Việt do AI dịch từ nghĩa tiếng Anh (build/cd_vi_mt.json), web ghi rõ là bản dịch máy.
// Chỉ ĐỌC các file dữ liệu đã tải về, không chạy code của gói nào.
// Chạy: node build/cedict.mjs <thư mục nguồn>/ app/
//   <nguồn>/cej/package/cedict.json, vi/CVDICT.u8, hv/package/src/hanvietData.js, mmah_dict.txt, jieba.txt
// Kết quả:
//   app/data/cd/NNN.json  mục từ, chia 256 phần theo chữ đầu tiên: {từ: [Hán Việt, hạng tần suất, [[phồn thể, pinyin, nghĩa Việt, nghĩa Anh, lượng từ, dịch máy?], ...]]}
//                         chữ phồn thể trỏ về giản thể: {phồn thể: "giản thể"}
//   app/data/cs/XX.json   chỉ mục tra bằng chữ Latin (pinyin, Hán Việt, nghĩa Việt, nghĩa Anh), chia theo 2 chữ cái đầu: [[khoá, từ, pinyin, nghĩa ngắn], ...]
//   app/data/cc/N.json    chữ Hán ngoài HSK 1–6 (cùng dạng chars.json), chia 8 phần
import fs from 'fs';
const [, , D, APP] = process.argv;
const OUT = APP + 'data/';
const NSH = 256, shardOf = h => h.codePointAt(0) % NSH;

// --- Hán Việt
const hvText = fs.readFileSync(D + 'hv/package/src/hanvietData.js', 'utf8');
const hanvietData = JSON.parse(hvText.slice(hvText.indexOf('{')));
const hvChar = (trad, simp, num) => {
  const d = hanvietData[trad] || hanvietData[simp]; if (!d) return '';
  if (num && d[num]?.length) return d[num][0];
  if (num) { const base = num.replace(/[1-5]$/, ''); for (const k in d) if (k.replace(/[1-5]$/, '') === base && d[k].length) return d[k][0]; }
  return Object.values(d).flat()[0] || '';
};

// --- pinyin số -> có dấu
function numToMark(n) {
  const m = n.match(/^([a-zA-Zü:v]+)([1-5])?$/); if (!m) return n; let [, s, t] = m; s = s.replace(/u:|v/g, 'ü').replace(/U:|V/g, 'Ü'); if (!t || t === '5') return s;
  const marks = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ', A: 'ĀÁǍÀ', E: 'ĒÉĚÈ', O: 'ŌÓǑÒ' };
  let idx = s.search(/[aeAE]/); if (idx < 0) idx = s.search(/ou|Ou/);
  if (idx < 0) for (let i = s.length - 1; i >= 0; i--) if ('iouüIOU'.includes(s[i])) { idx = i; break; }
  return idx < 0 || !marks[s[idx]] ? s : s.slice(0, idx) + marks[s[idx]][+t - 1] + s.slice(idx + 1);
}
const pyMarks = num => { const syl = num.split(/\s+/).filter(Boolean).map(x => /^[a-zA-Zü:]+[1-5]$/.test(x) ? numToMark(x) : x.replace(/^,$/, ''));
  return (syl.length > 4 ? syl.join(' ') : syl.join('')).replace(/\s+/g, ' ').trim(); };
const normPy = s => s.toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v').replace(/\s+/g, ' ').trim();
const unacc = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// --- nghĩa: bỏ chú thích kỹ thuật, tách lượng từ
const BADVI = /^(CL:|LT:)/;
const cleanSense = d => d.replace(/\b(CL|LT):\S*/g, '').replace(/(\S+)\|(\S+?)\[([^\]]*)\]/g, '$2').replace(/\[([^\]]*)\]/g, '').replace(/\s+/g, ' ').replace(/[;,]\s*$/, '').trim();
// bỏ ghi chú cách đọc ở Đài Loan (sau khi xoá phần [pinyin] chỉ còn trơ lại câu chữ)
const TWNOTE = /^(Taiwan pr\.?|(phát âm|cách đọc|cách phát âm|tiếng Đài Loan đọc là|đọc ở Đài Loan là|Ấn phẩm Đài Loan)( ở| tại| của)?( Đài Loan)?( là)?:?)$/i;
const senses = defs => [...new Set(defs.filter(d => !BADVI.test(d)).map(cleanSense).filter(d => d && !TWNOTE.test(d)))];
const classifiers = defs => { const out = []; for (const d of defs) { const m = d.match(/^CL:(.*)/); if (m) for (const x of m[1].split(',')) { const k = x.trim().match(/^(?:\S+\|)?([^\[\s]+)/); if (k) out.push(k[1]); } } return [...new Set(out)]; };

// --- CVDICT
const cv = {}, cvT = {}; // theo giản thể / theo phồn thể
for (const line of fs.readFileSync(D + 'vi/CVDICT.u8', 'utf8').split('\n')) {
  if (!line || line[0] === '#') continue;
  const m = line.match(/^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/); if (!m) continue;
  const o = { trad: m[1], py: normPy(m[3]), defs: m[4].split('/') };
  (cv[m[2]] ||= []).push(o); if (m[1] !== m[2]) (cvT[m[1]] ||= []).push(o);
}
function viOf(simp, trad, num) {
  const L = cv[simp] || []; if (!L.length) return null;
  const p = normPy(num), strip = x => x.replace(/[1-5]/g, '');
  const e = L.find(x => x.trad === trad && x.py === p) || L.find(x => x.py === p) || L.find(x => strip(x.py) === strip(p));
  return e ? senses(e.defs) : null;
}
const MT = fs.existsSync(APP + '../build/cd_vi_mt.json') ? JSON.parse(fs.readFileSync(APP + '../build/cd_vi_mt.json', 'utf8')) : {};

// --- tần suất (jieba): hạng 1 = thông dụng nhất
const freq = {};
for (const l of fs.readFileSync(D + 'jieba.txt', 'utf8').split('\n')) { const a = l.split(' '); if (a.length >= 2) freq[a[0]] = +a[1]; }
const rankOf = {}; Object.keys(freq).sort((a, b) => freq[b] - freq[a]).forEach((h, i) => rankOf[h] = i + 1);

// --- từ đã có trong web (HSK 1–6 + từ ghép 7–9) thì bỏ qua
const have = new Set();
for (let L = 1; L <= 6; L++) for (const [h] of JSON.parse(fs.readFileSync(OUT + `hsk${L}.json`, 'utf8'))) have.add(h);
for (const list of Object.values(JSON.parse(fs.readFileSync(OUT + 'ext.json', 'utf8')))) for (const a of list) have.add(a[0]);

// --- gom mục từ theo chữ giản thể
const all = JSON.parse(fs.readFileSync(D + 'cej/package/cedict.json', 'utf8'));
const isHanWord = h => /^[\p{Script=Han}〇]+$/u.test(h);
const entries = {}; let needMt = {}, mtUsed = 0, noVi = 0;
for (const e of all) {
  const h = e.simplified; if (have.has(h) || !isHanWord(h)) continue;
  const en = e.english.filter(d => !/^CL:/.test(d)).map(cleanSense).filter(d => d && !TWNOTE.test(d));
  if (!en.length || en.every(d => /^(variant of|old variant of|archaic variant of|Japanese variant of|see )/i.test(d))) {
    // mục chỉ ghi "biến thể của ..." vẫn giữ nếu chưa có mục nào khác cho từ đó
    if (entries[h]) continue;
  }
  let vi = viOf(h, e.traditional, e.pinyin), mt = 0;
  if (!vi || !vi.length) { const k = h + '|' + e.pinyin; if (MT[k]) { vi = MT[k]; mt = 1; mtUsed++; } else { vi = []; noVi++; needMt[k] = en.join('; '); } }
  const cl = classifiers(e.english);
  (entries[h] ||= { trad: new Set(), r: [] }).r.push([e.traditional !== h ? e.traditional : '', pyMarks(e.pinyin), vi.join('; '), en.join('; '), cl, mt, /^[A-Z]/.test(e.pinyin), e.pinyin]);
  if (e.traditional !== h) entries[h].trad.add(e.traditional);
}
// cách đọc thường (chữ thường) trước, tên riêng sau; trong mỗi nhóm giữ thứ tự của CC-CEDICT
const shards = Array.from({ length: NSH }, () => ({}));
const latin = {};
const addKey = (k, h, py, vi, rank) => {
  k = k.trim(); if (!k || k.length > 32) return;
  // gom theo 3 ký tự đầu của khoá không dấu (thêm "_" cho đủ 3); lúc ghi file sẽ gộp lại theo 2 ký tự nếu nhỏ
  const ku = unacc(k); if (!/^[a-z0-9]/.test(ku)) return;
  const p = (ku.replace(/ /g, '_') + '__').slice(0, 3);
  (latin[p] ||= new Map());
  const id = k + '\u0001' + h; if (!latin[p].has(id)) latin[p].set(id, [k, h, py, vi, rank]);
};
for (const [h, o] of Object.entries(entries)) {
  const r = o.r.sort((a, b) => a[6] - b[6]);
  const first = r[0], nums = first[7].toLowerCase().replace(/u:/g, 'v').split(/\s+/);
  const hv = [...h].map((c, i) => hvChar([...(first[0] || h)][i] || c, c, nums[i] || '')).join(' ').replace(/\s+/g, ' ').trim();
  const rank = rankOf[h] || 0;
  shards[shardOf(h)][h] = [hv, rank, r.map(x => { const a = [x[0], x[1], x[2], x[3]]; if (x[4].length || x[5]) a.push(x[4]); if (x[5]) a.push(1); return a; })];
  for (const t of o.trad) if (t !== h && !shards[shardOf(t)][t]) shards[shardOf(t)][t] = h;
  // chỉ mục Latin
  const R = rank || 999999;
  for (const x of r) {
    const viShort = (x[2] || x[3]).split('; ')[0].slice(0, 36);
    addKey(unacc(x[1]).replace(/[^a-z]/g, ''), h, x[1], viShort, R);
    for (const s of x[2].split(/;\s*/)) { const t = s.replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim(); if (t.split(' ').length <= 4) addKey(t, h, x[1], viShort, R); }
    for (const s of x[3].split(/;\s*/)) { const t = s.replace(/\([^)]*\)/g, '').toLowerCase().replace(/^to /, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); if (t.split(' ').length <= 3) addKey(t, h, x[1], viShort, R); }
  }
  if (hv) addKey(hv.toLowerCase(), h, first[1], (first[2] || first[3]).split('; ')[0].slice(0, 36), R);
}
fs.rmSync(OUT + 'cd', { recursive: true, force: true }); fs.mkdirSync(OUT + 'cd');
let total = 0;
shards.forEach((s, i) => { total += Object.values(s).filter(Array.isArray).length; fs.writeFileSync(OUT + `cd/${i}.json`, JSON.stringify(s)); });
fs.rmSync(OUT + 'cs', { recursive: true, force: true }); fs.mkdirSync(OUT + 'cs');
// mỗi nhóm 2 ký tự đầu một file; nhóm nào quá lớn thì tách theo 3 ký tự và ghi tên vào cs/split.json
const byP2 = {};
for (const [p, m] of Object.entries(latin)) (byP2[p.slice(0, 2)] ||= []).push(...m.values());
const split = []; let nfile = 0;
const write = (name, rows) => { fs.writeFileSync(OUT + `cs/${name}.json`, JSON.stringify(rows.sort((a, b) => a[4] - b[4]).map(x => x.slice(0, 4)))); nfile++; };
for (const [p2, rows] of Object.entries(byP2)) {
  if (JSON.stringify(rows).length < 160000) { write(p2, rows); continue; }
  split.push(p2); const g = {};
  for (const r of rows) (g[(unacc(r[0]).replace(/ /g, '_') + '__').slice(0, 3)] ||= []).push(r);
  for (const [p3, rs] of Object.entries(g)) write(p3, rs);
}
fs.writeFileSync(OUT + 'cs/split.json', JSON.stringify(split.sort()));
console.log('file chỉ mục Latin', nfile, 'nhóm tách', split.length);
console.log('mục từ', total, '| dịch máy dùng', mtUsed, '| chưa có nghĩa Việt', noVi, '| chỉ mục Latin', Object.keys(latin).length, 'file');
// danh sách cần dịch, xếp theo tần suất
fs.writeFileSync(D + 'need_mt.json', JSON.stringify(Object.entries(needMt).sort((a, b) => (rankOf[a[0].split('|')[0]] || 9e9) - (rankOf[b[0].split('|')[0]] || 9e9))));

// --- chữ Hán ngoài HSK 1–6: cấu tạo theo Make Me a Hanzi
const OLD = JSON.parse(fs.readFileSync(OUT + 'chars.json', 'utf8'));
const mm = {};
for (const l of fs.readFileSync(D + 'mmah_dict.txt', 'utf8').split('\n')) { if (l.trim()) { const o = JSON.parse(l); mm[o.character] = o; } }
const TYPE = { pictophonetic: 'ht', ideographic: 'hy', pictographic: 'tg' };
const LAYOUT = '⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻';
const TM = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };
const numOf = p => { const x = p.normalize('NFD').toLowerCase().replace(/u\u0308/g, 'v'); let t = 5; for (const k in TM) if (x.includes(k)) t = TM[k]; return x.replace(/[^a-z]/g, '') + t; };
const isHan = c => /\p{Script=Han}/u.test(c);
const cc = Array.from({ length: 8 }, () => ({}));
let nc = 0;
for (const [c, m] of Object.entries(mm)) {
  if (OLD.chars[c]) continue;
  const L = cv[c] || cvT[c] || [];
  const e = L.find(x => !/^[A-Z]/.test(x.py) && senses(x.defs).length && !/^(biến thể|dạng cổ)/i.test(x.defs[0])) || L[0];
  const mean = e ? senses(e.defs).slice(0, 3).join(', ') : (m.definition || '');
  const firstPy = (() => { let x = shards[shardOf(c)][c]; if (typeof x === 'string') x = shards[shardOf(x)][x]; return Array.isArray(x) ? x[2][0][1] : ''; })();
  const py = firstPy || m.pinyin?.[0] || '';
  const info = { py, hv: hvChar(c, c, '') , m: mean };
  { const d = hanvietData[c]; if (d) { const num = numOf(py), t = (d[num]?.length && [num, d[num]]) || Object.entries(d).find(([k]) => k.replace(/[1-5]$/, '') === num.replace(/[1-5]$/, ''));
    if (t?.[1]?.length) info.hv = t[1][t[1].length - 1]; } }
  const et = m.etymology || {}, dec = [...(m.decomposition || '')];
  info.k = TYPE[et.type] || 'gt';
  if (LAYOUT.includes(dec[0])) info.lay = dec[0];
  if (et.type === 'pictophonetic') { info.am = et.phonetic || ''; info.y = et.semantic || ''; if (!info.am || !info.y) info.k = 'gt'; }
  else if (et.type === 'ideographic') info.parts = dec.filter(x => isHan(x));
  if (m.radical) info.rad = m.radical;
  info.L = 0;
  cc[c.codePointAt(0) % 8][c] = info; nc++;
}
fs.rmSync(OUT + 'cc', { recursive: true, force: true }); fs.mkdirSync(OUT + 'cc');
cc.forEach((s, i) => fs.writeFileSync(OUT + `cc/${i}.json`, JSON.stringify(s)));
console.log('chữ ngoài HSK', nc);
