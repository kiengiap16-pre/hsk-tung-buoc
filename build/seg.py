import unicodedata, re
TM={'̄':1,'́':2,'̌':3,'̀':4}
def _bases(syl): return {s[:-1] for s in syl if not s.startswith('_')}
def segment(p, syl):
    B=_bases(syl)|{'r'}
    out=[]
    for chunk in re.split(r"[\s'’\-·]+", p.strip().lower()):
        if not chunk: continue
        d=unicodedata.normalize('NFD',chunk).replace('ü','v')
        letters=[]; tones=[]
        for ch in d:
            if ch in TM: tones[-1]=TM[ch]
            elif unicodedata.category(ch)=='Mn': continue
            elif ch.isalpha(): letters.append(ch); tones.append(0)
        s=''.join(letters); n=len(s)
        best=[None]*(n+1); best[n]=[]
        for i in range(n-1,-1,-1):
            for j in range(min(n,i+6),i,-1):
                if s[i:j] in B and best[j] is not None and sum(1 for t in tones[i:j] if t)<=1:
                    # tránh cắt sai kiểu "xian" vs "xi'an": ưu tiên âm tiết dài (đã duyệt j giảm dần)
                    best[i]=[(i,j)]+best[j]; break
        if best[0] is None: return None
        for i,j in best[0]:
            t=max(tones[i:j]) or 5
            out.append(s[i:j]+str(t))
    return out
