# Bổ sung Hán Việt cho chữ còn thiếu: lấy từ cột Hán Việt trong tài liệu PDF (tách theo từng chữ khi số âm khớp).
import json, collections
cj = json.load(open('app/data/chars.json'))
cand = collections.defaultdict(collections.Counter)
for L in range(1, 7):
    for h, p, v, hv, *_ in json.load(open(f'app/data/hsk{L}.json')):
        parts = hv.split()
        if len(parts) == len(h):
            for c, x in zip(h, parts): cand[c][x] += 1
fix = []
for c, info in cj['chars'].items():
    if not info.get('hv') and cand[c]:
        info['hv'] = cand[c].most_common(1)[0][0]; fix.append(c + ':' + info['hv'])
print('bổ sung', len(fix), ' '.join(fix)); print('vẫn thiếu', [c for c, i in cj['chars'].items() if not i.get('hv')])
json.dump(cj, open('app/data/chars.json', 'w'), ensure_ascii=False, separators=(',', ':'))
