#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEAM Finder 回帰シミュレータ
- 目的: finder-app.jsx の診断ロジックを Python で忠実に再現し、ランダム回答を大量投入して
        advice/originId/damageTier/warning の分布を実測する（外部監査の推測を数値で検証）。
- 重要: 各設問オプションの score 重みは finder-app.jsx から「自動抽出」する（ハードコードしない）
        ので、scoreを変えて本ファイルを再実行すれば常に最新の実数が出る。
- ロジック関数(computeScores後処理 / selectOriginAnimalId / selectAdviceKey /
   computeDamageTier / maskMissing)は finder-app.jsx と1:1で移植（コメントに該当行）。
usage: python3 scripts/finder_sim.py [N]
"""
import re, sys, os, random, collections

random.seed(42)  # 再現性
HERE = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(HERE, '..', 'js', 'finder-app.jsx')

# ───────── 1. finder-app.jsx から各オプションの score 重みを抽出 ─────────
def extract_scores(path):
    src = open(path, encoding='utf-8').read()
    # Q (L11付近) と Q_DEEP_NEW を含む先頭ブロックだけ対象（const Q = [ ... ]; const Q_DEEP_NEW = [ ... ];）
    start = src.index('const Q = [')
    end   = src.index('const Q_DEEP_BY_ID')
    region = src[start:end]
    opt = {}          # qid -> { v -> {scoreKey:int} }
    types = {}        # qid -> type
    order_in = {}     # qid -> list of option v (非exclusive判定用)
    excl = {}         # qid -> set of exclusive v
    cur = None
    for line in region.splitlines():
        mid = re.search(r"\bid:\s*'([a-zA-Z]+)'", line)
        if mid and 'v:' not in line:
            cur = mid.group(1); opt.setdefault(cur, {}); order_in.setdefault(cur, []); excl.setdefault(cur, set())
            mt = re.search(r"type:\s*'([a-z-]+)'", line)  # 同一行にtypeは無いが念のため
            continue
        mt = re.search(r"type:\s*'([a-z-]+)'", line)
        if mt and cur: types[cur] = mt.group(1)
        if cur and re.search(r"\bv:\s*'", line) and 'label:' in line:
            mv = re.search(r"\bv:\s*'([^']+)'", line)
            ms = re.search(r"score:\s*\{([^}]*)\}", line)   # score は無い設問(length等)もある
            if mv:
                v = mv.group(1)
                sc = {k: int(n) for k, n in re.findall(r"(\w+)\s*:\s*(-?\d+)", ms.group(1))} if ms else {}
                opt[cur][v] = sc
                order_in[cur].append(v)
                if 'exclusive' in line: excl[cur].add(v)
    return opt, types, order_in, excl

OPT, TYPES, ORDER, EXCL = extract_scores(JSX)

# styling は toolOptions/tempOptions を1つの 'styling' qid 配下に持つ（抽出済）。
# tool系/temp系の v を分離して保持
TOOL_VS = ['ironDaily','ironWeekly','curlerDaily','curlerWeekly','bangsDaily','rare']
TEMP_VS = ['t140','t160','t180','t200','tUnknown']

EMPTY_SCORES = dict(dryness=0,damage=0,bleachHistory=0,colorFade=0,frizz=0,curl=0,
                    heatDamage=0,scalpDryness=0,scalpOiliness=0,volumeLoss=0,aging=0,
                    longHairHistory=0,smoothness=0)
LONG = {'shoulderDown','chestUp','long'}

def addscore(t, add):
    for k,val in (add or {}).items(): t[k] = t.get(k,0)+val

# ───────── 2. computeScores（finder-app.jsx L630-711 を忠実移植） ─────────
def deriveBleach(a):
    if a.get('bleach') and a['bleach']!='none': return a['bleach']
    c=a.get('color')
    return {'multi_bleach':'multi','bleach_recent':'within3m','bleach_past':'within1y','highlight':'highlight'}.get(c)

# computeScores のループ対象になる設問id（Q + Q_DEEP_NEW のうち score を持つもの）
SCORE_QIDS = list(OPT.keys())

def compute_scores(a):
    s = dict(EMPTY_SCORES)
    for qid in SCORE_QIDS:
        if qid == 'styling':  # heat-tools 特別処理
            st = a.get('styling') or {}
            for v in (st.get('tools') or []):
                addscore(s, OPT['styling'].get(v))
            if st.get('temp'): addscore(s, OPT['styling'].get(st['temp']))
            continue
        val = a.get(qid)
        if val is None: continue
        if isinstance(val, list):
            for v in val: addscore(s, OPT[qid].get(v))
        else:
            addscore(s, OPT[qid].get(val))
    # --- 後処理（L661-711） ---
    length=a.get('length'); bleach=deriveBleach(a); color=a.get('color'); straighten=a.get('straighten')
    st=a.get('styling') or {}; tools=st.get('tools') or []; temp=st.get('temp'); items=a.get('items') or []
    if length in LONG:
        if bleach and bleach!='none': s['longHairHistory']+=2; s['damage']+=1
        if color and color not in ('none','over1y'): s['longHairHistory']+=1
    if bleach=='over1y' and length in LONG:
        s['longHairHistory']+=2; s['damage']+=1
    if straighten in ('within6m','within1y','over1y'):  # 現値では発火しない死枝（原典通り移植）
        s['frizz']+=2; s['heatDamage']+=1
    dailyHeat = ('ironDaily' in tools) or ('curlerDaily' in tools)
    if dailyHeat: s['heatDamage']+=2; s['dryness']+=1
    hot180 = temp in ('t180','t200'); hot200 = temp=='t200'
    hasColor = bool(color and color!='none'); hasBleach = bool(bleach and bleach!='none')
    hasStraighten = bool(straighten and straighten!='none')
    usesHeat = len(tools)>0 and ('rare' not in tools)
    heatColorWarning = hot180 and hasColor and usesHeat
    heatBleachWarning = hot200 and (hasBleach or hasStraighten) and usesHeat
    if heatBleachWarning: s['damage']+=2; s['heatDamage']+=1
    onlyOil = ('oil' in items) and ('milk' not in items) and ('mask' not in items)
    maskMissing = ('mask' not in items) and s['damage']>=5
    flags = dict(onlyOil=onlyOil, maskMissing=maskMissing,
                 heatColorWarning=heatColorWarning, heatBleachWarning=heatBleachWarning,
                 temp=temp, dailyHeat=dailyHeat)
    return s, flags

# ───────── 3. 判定関数（現行 finder-app.jsx と1:1） ─────────
def select_origin(a):  # L5940-5951
    t = 'T' if a.get('thickness')=='thick' else ('N' if a.get('thickness')=='normal' else 'F')
    d = 'H' if a.get('density')=='high' else ('N' if a.get('density')=='normal' else 'L')
    w = 'S'
    if a.get('wave') in ('humid','surface'): w='W'
    elif a.get('wave') in ('midEnd','root','whole'): w='C'
    return t+d+w

def select_advice(s):  # L5979-5993（batch-2 是正後）
    if s.get('heatDamage',0) >= 6: return 'heat'
    if s.get('damage',0) >= 7: return 'damage'
    if s.get('scalpDryness',0) >= 2 or s.get('scalpOiliness',0) >= 2: return 'scalp'
    if s.get('frizz',0) >= 3: return 'frizz'
    if s.get('colorFade',0) >= 3: return 'color'
    if s.get('dryness',0) >= 3: return 'dry'
    if s.get('volumeLoss',0) >= 2: return 'volume'
    if s.get('heatDamage',0) >= 4: return 'heat'
    if s.get('damage',0) >= 5: return 'damage'
    return 'calm'

def compute_damage_tier(s):  # batch-2 新設（現行）
    dmg=s.get('damage',0); heat=s.get('heatDamage',0); bleach=s.get('bleachHistory',0)
    load=dmg+heat+bleach
    if heat>=5 or dmg>=7 or bleach>=5 or load>=11: return 3
    if heat>=2 or dmg>=3 or bleach>=2 or load>=4: return 2
    return 1

# ── 現行プロダクション: 主訴(concerns)からadviceを引く（heat/damageは履歴ランクに任せ、adviceは"悩み"に一致）。finder-app.jsx selectAdviceKey と1:1 ──
CONCERN_MAP = {  # concerns選択 → adviceKey
    'dry':'dry','rough':'dry','noShine':'dry',
    'frizz':'frizz','wave':'frizz',
    'damage':'damage','split':'damage','tangle':'damage',
    'colorFade':'color','grayFade':'color',
    'volumeDown':'volume','topFlat':'volume','thinning':'volume',
    'scalpDry':'scalp','scalpOily':'scalp',
}
CONCERN_PRIO = ['scalp','color','frizz','volume','damage','dry']  # 同点時の優先（heat/damageは最後回し）
def select_advice_v2(s, a):
    cons=[CONCERN_MAP[c] for c in (a.get('concerns') or []) if c in CONCERN_MAP]
    if cons:
        for k in CONCERN_PRIO:
            if k in cons: return k
        return cons[0]
    return select_advice(s)  # 主訴が無い時だけ従来のスコアカスケード

# ───────── 4. ランダム回答生成（MODE_B_ORDER + when ゲート 忠実） ─────────
# 各設問の選択肢一覧（score抽出時のorderから。styling/chip/checkは特別扱い）
def opts_of(qid):  # 非styling
    return ORDER.get(qid, [])

CHIP_MULTI = {'concerns'}                       # max3
CHECK_MULTI = {'lifestyle','concernsItem','stylingFinish','menStyling','wellness',
               'deviceInterest','heatProtect','scalpAllergy','hairTrouble'}
CARD_MULTI  = {'items'}

def gen_check(qid, maxpick=None):
    opts=opts_of(qid); ex=EXCL.get(qid,set())
    if random.random()<0.18:  # 「特になし/exclusive」を選ぶ確率
        exo=[v for v in opts if v in ex]
        if exo: return [random.choice(exo)]
    pool=[v for v in opts if v not in ex]
    if not pool: return []
    k=random.randint(0, min(len(pool), maxpick or len(pool)))
    return random.sample(pool, k) if k else []

def gen_answers():
    a={}
    # STEP1
    a['age']=random.choice(opts_of('age')); a['gender']=random.choice(opts_of('gender'))
    a['length']=random.choice(opts_of('length')); a['thickness']=random.choice(opts_of('thickness'))
    a['density']=random.choice(opts_of('density')); a['rootVolume']=random.choice(opts_of('rootVolume'))
    a['wave']=random.choice(opts_of('wave')); a['scalpType']=random.choice(opts_of('scalpType'))
    a['scalpSensitivity']=random.choice(opts_of('scalpSensitivity'))
    # STEP2 履歴
    a['color']=random.choice(opts_of('color'))
    if a['color']!='none':
        a['colorFreq']=random.choice(opts_of('colorFreq'))
        a['grayHair']=random.choice(opts_of('grayHair'))
        if a['grayHair']=='yes': a['grayFreq']=random.choice(opts_of('grayFreq'))
    a['bleach']=random.choice(opts_of('bleach'))
    if re.match(r'^(multi|within3m|within1y|highlight)$', a['bleach'] or ''):
        a['bleachLocation']=random.choice(opts_of('bleachLocation'))
    a['straighten']=random.choice(opts_of('straighten'))
    a['perm']=random.choice(opts_of('perm'))
    if a['perm']!='none':
        a['permType']=random.choice(opts_of('permType'))
        if a['perm']!='past': a['permLoose']=random.choice(opts_of('permLoose'))
    # styling heat-tools
    if random.random()<0.25:
        a['styling']={'tools':['rare'],'temp':None}
    else:
        tk=random.randint(1,3); tools=random.sample([v for v in TOOL_VS if v!='rare'], min(tk,5))
        a['styling']={'tools':tools,'temp':random.choice(TEMP_VS)}
    a['heatProtect']=gen_check('heatProtect')
    a['scalpAllergy']=gen_check('scalpAllergy')
    a['hairTrouble']=gen_check('hairTrouble')
    # STEP3
    a['concerns']=random.sample(opts_of('concerns'), random.randint(1,3))
    a['concernsItem']=gen_check('concernsItem')
    a['goalTexture']=random.choice(opts_of('goalTexture'))
    a['goal']=random.choice(opts_of('goal'))
    a['stylingFinish']=gen_check('stylingFinish')
    if a['gender']=='male': a['menStyling']=gen_check('menStyling')
    a['deviceInterest']=gen_check('deviceInterest')
    a['headSpaInterest']=random.choice(opts_of('headSpaInterest'))
    if a['headSpaInterest']=='yes': a['wellness']=gen_check('wellness')
    a['items']=gen_check('items')
    return a

# ───────── 5. 実行 ─────────
N = int(sys.argv[1]) if len(sys.argv)>1 else 2000
advice=collections.Counter(); advice2=collections.Counter(); origin=collections.Counter(); tier=collections.Counter()
mask=0; hcw=0; hbw=0; crash=0; empty=0
for _ in range(N):
    try:
        a=gen_answers(); s,fl=compute_scores(a)
        advice[select_advice(s)]+=1; advice2[select_advice_v2(s,a)]+=1
        origin[select_origin(a)]+=1; tier[compute_damage_tier(s)]+=1
        if fl['maskMissing']: mask+=1
        if fl['heatColorWarning']: hcw+=1
        if fl['heatBleachWarning']: hbw+=1
    except Exception as e:
        crash+=1
        if crash<=3: print("ERR:", e)

print(f"\n=== SEAM Finder simulator — N={N} (seed=42) ===")
print(f"score抽出: {len(OPT)}設問 / 例: bleach.multi={OPT['bleach']['multi']}  concerns.split={OPT['concerns']['split']}")
print(f"\n[ハード障害] crash={crash}  到達タイプ={len(origin)}/27")
def dist(title, c, total=N):
    print(f"\n{title}")
    for k,v in c.most_common():
        print(f"  {str(k):10} {v:5}  {100*v/total:5.1f}%")
dist("[adviceKey — 旧ロジック(参考: スコアカスケードのみ)] heat/damageに偏る", advice)
dist("[adviceKey — 現行プロダクション(主訴優先)] ← BUG-01/07 解消の実測", advice2)
dist("[damageTier 分布] ← batch-2 履歴ランク(uniform入力では重め寄り=入力分布の偏りに注意)", tier)
print(f"\n[warning 発火率] ← BUG-02/08")
print(f"  maskMissing(※UI非表示の内部フラグ) {mask:5} {100*mask/N:5.1f}%")
print(f"  heatColorWarning(表示)            {hcw:5} {100*hcw/N:5.1f}%")
print(f"  heatBleachWarning(表示)           {hbw:5} {100*hbw/N:5.1f}%")

# ───────── 6. 軸チェック（監査の再現: 同条件でダメージ/density だけ変える） ─────────
print("\n=== 軸チェック（監査 BUG-03/04/05 の再現） ===")
def axis_case(name, over):
    base=dict(thickness='normal',density='normal',wave='humid',length='shoulderDown',
              color='none',straighten='none',perm='none',styling={'tools':['rare'],'temp':None},
              items=['shampoo','treatment'],concerns=['dry'])
    base.update(over)
    s,fl=compute_scores(base)
    return select_origin(base), compute_damage_tier(s), select_advice(s), fl['maskMissing']
lo=axis_case('low', {})
hi=axis_case('high', {'color':'multi_bleach','straighten':'frequent',
                      'styling':{'tools':['ironDaily'],'temp':'t200'},
                      'bleachLocation':'whole','heatProtect':['none']})
print(f"  低ダメージ : origin={lo[0]} 履歴Tier={lo[1]} advice={lo[2]} maskFlag={lo[3]}")
print(f"  高ダメージ : origin={hi[0]} 履歴Tier={hi[1]} advice={hi[2]} maskFlag={hi[3]}")
print(f"  → originは{'不変(設計どおり=27型は素材)' if lo[0]==hi[0] else '変化'} / 履歴Tierは{'変化(=ダメージが結果に効く)' if lo[1]!=hi[1] else '不変'}")
for dv in ('low','normal','high'):
    o,t,_,_=axis_case('d', {'density':dv})
    print(f"  density={dv:7} → origin={o} (BUG-05: density は軸2=設計どおり)")
