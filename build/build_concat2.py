# Ghép âm tiết ghi âm người thật thành từ, liền mạch: cắt lặng, rút ngắn âm tiết giữa từ,
# nửa thanh 3, thanh nhẹ, nối chồng mép (crossfade) và áp đủ quy tắc biến điệu.
import json, subprocess, os, sys, re, wave
import numpy as np
from concurrent.futures import ThreadPoolExecutor
SP='/tmp/claude-0/-home-user/6e654d41-477d-514b-a054-8ec0674c0303/scratchpad/'
APP='/home/user/hsk-tung-buoc/app/'
A=APP+'audio/'
sys.path.insert(0,SP); from seg import segment
syl=set(open(SP+'syl_have.txt').read().split())
human=set(open(SP+'audio_have.txt').read().split())
SR=24000
VOCAB=set()
for L in range(1,7):
    for h,*_ in json.load(open(f'{APP}data/hsk{L}.json')): VOCAB.add(h)
ext=json.load(open(APP+'data/ext.json'))
for L in ext:
    for a in ext[L]: VOCAB.add(a[0])
NUMS='零一二三四五六七八九十百千万两'
KEEP_YI_NEXT=set('月号楼层')  # 一月, 一号, 一楼: đọc số đếm/thứ tự, giữ yī
def sandhi(h, ss):
    b=[x[:-1] for x in ss]; o=[int(x[-1]) for x in ss]; t=o[:]; n=len(t); notes=[]
    # 1) A一A, A不A -> thanh nhẹ
    for i in range(1,n-1):
        if h[i] in '一不' and h[i-1]==h[i+1] and b[i] in ('yi','bu'): t[i]=5
    # 2) 一
    for i in range(n):
        if h[i]!='一' or b[i]!='yi' or t[i]!=1: continue
        if i+1>=n: continue                                   # cuối từ: 统一, 唯一, 第一
        if i>0 and (h[i-1] in '第初' or h[i-1] in NUMS or h[i-1]=='期'): continue  # 第一, 十一, 星期一...
        if h[i+1] in NUMS or h[i+1] in KEEP_YI_NEXT: continue
        if h[i:i+3]=='一年级': continue
        t[i]=2 if o[i+1]==4 else 4 if o[i+1] in (1,2,3) else t[i]
    # 3) 不 (chỉ khi đang là thanh 4)
    for i in range(n-1):
        if h[i]=='不' and b[i]=='bu' and t[i]==4 and o[i+1]==4: t[i]=2
    # 4) thanh 3 nối thanh 3
    if n==3 and o==[3,3,3]:
        t=[3,2,3] if (h[1:] in VOCAB and h[:2] not in VOCAB) else [2,2,3]
    else:
        for i in range(n-1):
            if o[i]==3 and t[i]==3 and o[i+1]==3: t[i]=2
    return b,o,t
def sylwav(base,tone,prev,final,half):
    key=f'{base}{tone}'; neutral = tone==5
    if neutral and key not in syl: key=f'{base}{1 if prev==3 else 4}'
    if key not in syl: return None
    tag=('n' if neutral else '')+('f' if final else 'm')+('h' if half else '')
    out=f'{SP}aud2/syl/{key}_{tag}.wav'
    if not os.path.exists(out):
        af=['silenceremove=start_periods=1:start_threshold=-42dB','areverse','silenceremove=start_periods=1:start_threshold=-42dB','areverse','loudnorm=I=-18:TP=-2:LRA=7']
        if neutral: af+=['atempo=1.6','volume=-5dB']
        elif not final: af+=['atempo=1.22']
        subprocess.run(['ffmpeg','-v','error','-y','-i',f'{A}py/{key}.mp3','-af',','.join(af),'-ar',str(SR),'-ac','1',out],check=True)
    return out
def load(p):
    with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)
def build(h,p,out):
    ss=segment(p,syl)
    if not ss or len(ss)!=len(h) or any(not re.fullmatch(r'[a-z]+[1-5]',x) for x in ss): return None
    b,o,t=sandhi(h,ss); n=len(b); parts=[]
    for i in range(n):
        half = t[i]==3 and i+1<n            # thanh 3 không đứng cuối: nửa thanh 3 (chỉ xuống, không lên)
        w=sylwav(b[i],t[i],t[i-1] if i else None,i==n-1,half)
        if w is None: return None
        x=load(w)
        if half:
            k=int(len(x)*0.62); x=x[:k].copy(); f=int(0.04*SR); x[-f:]*=np.linspace(1,0,f)
        parts.append(x)
    X=parts[0]; cf=int(0.035*SR)
    for y in parts[1:]:
        c=min(cf,len(X)//3,len(y)//3); fo=np.cos(np.linspace(0,np.pi/2,c)); fi=np.sin(np.linspace(0,np.pi/2,c))
        X=np.concatenate([X[:-c], X[-c:]*fo+y[:c]*fi, y[c:]])
    X=np.clip(X,-32767,32767).astype(np.int16)
    tmp=f'{SP}aud2/{abs(hash(h))}.wav'
    with wave.open(tmp,'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(X.tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',tmp,'-af','afade=t=out:st=0:d=0,loudnorm=I=-18:TP=-2','-ar',str(SR),'-ac','1','-b:a','48k',out],check=True)
    os.remove(tmp)
    return ''.join(f'{b[i]}{t[i]}' for i in range(n))
if __name__=='__main__':
    jobs=[]
    plan=json.load(open(SP+'audio_plan.json'))
    for h,p in plan['miss']: jobs.append((h,p,f'{A}w/{h}.mp3',f'w/{h}.mp3'))
    os.makedirs(A+'x',exist_ok=True)
    for L in ext:
        for a in ext[L]:
            if a[0] in human: continue
            jobs.append((a[0],a[1],f'{A}x/{a[0]}.mp3',f'x/{a[0]}.mp3'))
    if len(sys.argv)>1: jobs=[j for j in jobs if j[0] in sys.argv[1:]]
    # tạo trước các âm tiết (tránh ghi trùng khi chạy song song)
    res={}; sk=[]
    def run(j):
        try: r=build(j[0],j[1],j[2])
        except Exception as e: r=None
        return j,r
    with ThreadPoolExecutor(4) as ex:
        for j,r in ex.map(run,jobs):
            if r: res[j[0]]=(j[3],r)
            else: sk.append(j[0])
    json.dump({'made':{k:v[0] for k,v in res.items()},'read':{k:v[1] for k,v in res.items()},'skipped':sk},open(SP+'concat2_result.json','w'),ensure_ascii=False)
    print('made',len(res),'skipped',len(sk),sk[:40])
