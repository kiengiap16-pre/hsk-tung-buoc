# Dựng lại từ vựng HSK 1–6 theo tài liệu "HSK 3.0 cô Mỹ Hạnh - Meiday Chinese" (Google Drive của Kien).
# Đầu vào: vocab_raw.json (bảng tách từ PDF bằng pdfplumber), complete.json (complete-hsk-vocabulary: nghĩa Anh, phồn thể, tần suất).
# Đầu ra: app/data/hsk{L}.json = [[chữ, pinyin, nghĩa Việt, Hán Việt, ví dụ, khoá thẻ (nếu khác chữ)], ...] xếp theo độ thông dụng
#         app/data/dict{L}.json = {khoá: [nghĩa Anh, [từ loại], phồn thể, [lượng từ], tần suất, bộ thủ]}
import json, re, sys, unicodedata
SP, APP = sys.argv[1], sys.argv[2]
raw = json.load(open(SP + 'vocab_raw.json'))
comp = json.load(open(SP + 'hskdata79/complete.json'))
old = {}
for L in range(1, 7):
    for k, v in json.load(open(APP + f'data/dict{L}.json')).items(): old.setdefault(k, v)
POS = {'danh':'danh từ','động':'động từ','tính':'tính từ','phó':'phó từ','lượng':'lượng từ','đại':'đại từ','liên':'liên từ','giới':'giới từ',
       'số':'số từ','trợ':'trợ từ','thán':'thán từ','hậu tố':'hậu tố','hậutố':'hậu tố','hậu':'hậu tố','tiền tố':'tiền tố','tt':'tính từ',
       'số lượng':'số lượng từ','câu hỏi':'câu hỏi',
       '名':'danh từ','动':'động từ','(动)':'động từ','形':'tính từ','副':'phó từ','量':'lượng từ','连':'liên từ','介':'giới từ','代':'đại từ',
       '叹':'thán từ','助':'trợ từ','成语':'thành ngữ','数量':'số lượng từ','数':'số từ','拟声':'từ tượng thanh','祝语':'lời chúc',
       '后缀':'hậu tố','前缀':'tiền tố'}
unknown = set()
def pos_of(s):
    out = []
    for x in re.split(r'[/、，,]', s.replace('\n', '')):
        x = x.strip(); k = x.lower()
        if not x or x in ('—', '-'): continue
        if k in POS: v = POS[k]
        else: unknown.add(x); continue
        if v not in out: out.append(v)
    return out
han = r'[㐀-鿿，。？！、：；“”（）]'
def clean_ex(s):
    s = s.replace('\n', ' ')
    s = re.sub(rf'(?<={han}) +(?={han})', '', s)
    return re.sub(r'\s+', ' ', s).strip()
def clean_txt(s): return re.sub(r'\s+', ' ', s.replace('\n', ' ')).strip()
def clean_h(s): return re.sub(r'[\s（）()0-9]', '', s)
def clean_p(s):
    s = s.replace('\n', '').replace('-', '').replace('’', "'").replace('(', '').replace(')', '')
    s = s.split('/')[0]
    return re.sub(r'\s+', '', s).strip()
def bare(p): return ''.join(c for c in unicodedata.normalize('NFD', p.lower()) if c.isalpha() and ord(c) < 0x300 or c in 'ü')
def toneless(p): return re.sub(r"[\s']", '', unicodedata.normalize('NFC', p.lower()))
CI = {}
for e in comp: CI.setdefault(e['simplified'], []).append(e)
def lookup(h, p):
    es = CI.get(h, [])
    for e in es:
        for f in e['forms']:
            if toneless(f['transcriptions']['pinyin']) == toneless(p): return e, f
    for e in es: return e, e['forms'][0]
    return None, None

# Vài trợ từ tài liệu chỉ ghi "trợ từ": thêm phần giải thích ngắn trong ngoặc để thẻ học dễ hiểu (không đổi nghĩa gốc)
SUPP = {('的','de'):'của; nối định ngữ với danh từ', ('了','le'):'đã, rồi', ('吧','ba'):'nhé, đi; đề nghị, phỏng đoán',
        ('吗','ma'):'không?, à?; cuối câu hỏi', ('呢','ne'):'còn… thì sao?; đang', ('着','zhe'):'đang; trạng thái kéo dài',
        ('啊','a'):'à, nhé, nhỉ; làm câu mềm hơn', ('得','de'):'nối động từ với bổ ngữ', ('地','de'):'nối trạng ngữ với động từ',
        ('头','tou'):'石头, 木头, 念头', ('嘛','ma'):'mà, thôi mà; nhấn mạnh điều hiển nhiên'}
seen_key = {}; counts = {}; report = {'dropped_dup': [], 'unknown_pos': None}
levels = {}
for L in map(str, range(1, 7)):
    words = []; inlv = {}
    for r in raw[L]['rows']:
        h0, p0, hv0, pos0, m0, ex0 = r['f']
        h, p = clean_h(h0), clean_p(p0)
        v, hv, ex = clean_txt(m0), clean_txt(hv0).lower(), clean_ex(ex0)
        if (h, p) in SUPP and '(' not in v: v = f'{v} ({SUPP[(h, p)]})'
        if (h, p) in inlv:   # trùng hẳn trong cùng một cấp (tài liệu lặp dòng)
            prev = inlv[(h, p)]
            if v not in prev['v'].split('; '): prev['v'] += '; ' + v
            report['dropped_dup'].append((int(L), r['n'], h, p, prev['n'])); continue
        key = h if h not in seen_key else f'{h}~{L}-{r["n"]}'
        seen_key.setdefault(h, key)
        e, f = lookup(h, p)
        w = {'h': h, 'p': p, 'v': v, 'hv': hv, 'ex': ex, 'k': key, 'n': r['n'], 'pos': pos_of(pos0), 'shown': clean_txt(h0).replace(' ', ''),
             'freq': (e or {}).get('frequency') or 99999, 'e': e, 'f': f}
        inlv[(h, p)] = w; words.append(w)
    words.sort(key=lambda w: (w['freq'], w['n']))
    levels[int(L)] = words
for L, words in levels.items():
    out, dic = [], {}
    for w in words:
        row = [w['h'], w['p'], w['v'], w['hv'], w['ex']]
        if w['k'] != w['h']: row.append(w['k'])
        out.append(row)
        e, f = w['e'], w['f']; od = old.get(w['h'])
        en = '; '.join(f['meanings'][:4]) if f else (od[0] if od else '')
        trad = f['traditional'] if f and f['traditional'] != w['h'] else ''
        cls = f.get('classifiers', [])[:3] if f else []
        dic[w['k']] = [en, w['pos'], trad, cls, w['freq'] if w['freq'] < 99999 else 0, (e or {}).get('radical', '')]
    json.dump(out, open(APP + f'data/hsk{L}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(dic, open(APP + f'data/dict{L}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print('HSK', L, len(out), 'từ', sum(1 for w in words if not w['f']), 'không có trong complete.json')
report['unknown_pos'] = sorted(unknown)
json.dump(report, open(SP + 'pdf_report.json', 'w'), ensure_ascii=False, indent=1)
print('trùng bỏ:', report['dropped_dup']); print('từ loại lạ:', report['unknown_pos'])
