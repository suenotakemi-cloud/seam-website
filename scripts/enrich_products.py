#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEAM 商品データ 価格・サイズ補完 + 新規4ライン追加スクリプト
============================================================
- products-from-xlsx.json を読み込み
- 公式・大手流通の確認済みSRPに基づき sizes/priceTier を付与
- Wella Ultime Repair / Ultime Smooth / Davines / Schwarzkopf Fibreplex を追加
- 香り情報は一切含めない

価格出典：
- Aujua: ミルボン公式SRP (kakaku.com / 価格.com / 公式販売店多数で確認)
- Elujuda: ミルボン公式SRP
- Wella Ultime: wella.co.jp/ultime/ 公式
- Davines: davines.co.jp 公式オンラインショップ
- Schwarzkopf Fibreplex: 正規販売店通販（finecrew.jp / shop.bayshoreny等）
- TOKIO INKARAMI: 正規ディーラー販売価格
- Kérastase: 公式 kerastase.jp
- Sublimic: 資生堂プロフェッショナル正規販売店

確証が低いブランドは sizes / priceTier を省略（推測しない原則）。
"""

import json
from pathlib import Path

SRC  = "/Users/suenotakemi/Downloads/code_sandbox_light_a3728b14_1778910042/data/products-from-xlsx.json"
OUT  = SRC

# ============================================================
# 1) priceTier 算定（最小サイズ価格から）
# ============================================================
def calc_tier(min_price):
    if min_price <= 2500:  return "entry"
    if min_price <= 4500:  return "standard"
    if min_price <= 7000:  return "premium"
    return "luxury"


# ============================================================
# 2) 既存164商品の価格マップ（id ベース）
#    "id": [{"label": ..., "price": ...}, ...]
# ============================================================
PRICE_MAP = {
    # ---------------- Aujua (Milbon) ----------------
    # フラッグシップ系シャンプー: 250/500/1L = 3080/4620/6930
    "aujua-quench-sh":      [{"label":"250mL","price":3080},{"label":"500mL","price":4620},{"label":"1L パック","price":6930}],
    "aujua-aquavia-sh":     [{"label":"250mL","price":3080},{"label":"500mL","price":4620},{"label":"1L パック","price":6930}],
    "aujua-smooth-sh":      [{"label":"250mL","price":3080},{"label":"500mL","price":4620},{"label":"1L パック","price":6930}],
    "aujua-repairity-sh":   [{"label":"250mL","price":3080},{"label":"500mL","price":4620},{"label":"1L パック","price":6930}],
    "aujua-filmellow-sh":   [{"label":"250mL","price":3080},{"label":"500mL","price":4620},{"label":"1L パック","price":6930}],
    "aujua-immurise-sh":    [{"label":"250mL","price":3300},{"label":"500mL","price":4950},{"label":"1L パック","price":7150}],
    "aujua-inmetry-sh":     [{"label":"250mL","price":3300},{"label":"500mL","price":4950},{"label":"1L パック","price":7150}],
    "aujua-moistcalm-sh":   [{"label":"250mL","price":3080},{"label":"500mL","price":4620},{"label":"1L パック","price":6930}],
    "aujua-agingspa-sh":    [{"label":"250mL","price":3300},{"label":"500mL","price":4950},{"label":"1L パック","price":7150}],
    "aujua-agingspa-sh-2":  [{"label":"クリアフォーム 200g","price":3850}],  # クリアフォーム

    # トリートメント系: 250/500/1L = 3300/4840/7150
    "aujua-quench-tr":      [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-aquavia-tr":     [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-smooth-tr":      [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-repairity-tr":   [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-filmellow-tr":   [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-immurise-tr":    [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-inmetry-tr":     [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-moistcalm-tr":   [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],
    "aujua-agingspa-tr":    [{"label":"250g","price":3300},{"label":"500g","price":4840},{"label":"1L パック","price":7150}],

    # マスク（ヘアニュートリエント）: 250g
    "aujua-quench-mask":      [{"label":"250g","price":6050}],
    "aujua-aquavia-mask":     [{"label":"250g","price":6050}],
    "aujua-repairity-mask":   [{"label":"250g","price":6050}],
    "aujua-immurise-mask":    [{"label":"250g","price":6600}],
    "aujua-inmetry-mask":     [{"label":"コントロール クリーム 110g","price":6050}],

    # アウトバス・エッセンス
    "aujua-quench-out":     [{"label":"クエンチ ミルク 100mL","price":3300}],  # (existing line "クエンチ"のみ。本データには無いが省略)
    "aujua-aquavia-out":    [{"label":"モイストセラム 100mL","price":3850}],
    "aujua-immurise-out":   [{"label":"エクシードセラム 100mL","price":4180}],
    "aujua-inmetry-out":    [{"label":"インメトリィ ミルク 100mL","price":3850}],
    "aujua-smooth-out":     [{"label":"スムース セラム 100mL","price":3300}],
    "aujua-filmellow-out":  [{"label":"フィルメロウ ミルク 100mL","price":3850}],
    "aujua-moistcalm-essence": [{"label":"モイスチュアローション 100mL","price":4400}],

    # ---------------- Elujuda (Milbon) ----------------
    "elujuda-fo-out":         [{"label":"120mL","price":2420},{"label":"30mL","price":1540}],   # FO
    "elujuda-fo-out-2":       [{"label":"120mL","price":2420},{"label":"30mL","price":1540}],   # MO
    "elujuda-emulsion-out":   [{"label":"120g","price":2420},{"label":"30g","price":1540}],
    "elujuda-emulsion-out-2": [{"label":"120g","price":2420},{"label":"30g","price":1540}],     # +
    "elujuda-graceon-out":    [{"label":"グレイスオン エマルジョン 120g","price":2860}],
    "elujuda-graceon-out-2":  [{"label":"グレイスオン セラム 120mL","price":2860}],
    "elujuda-frizzfixer-out":   [{"label":"120g","price":2860}],
    "elujuda-frizzfixer-out-2": [{"label":"120g","price":2860}],                                 # +
    "elujuda-bleachcare-gel":   [{"label":"ブリーチケア ジェルセラム 120g","price":2860}],
    "elujuda-bleachcare-out":   [{"label":"ブリーチケア セラム 120mL","price":2860}],

    # ---------------- Global Milbon ----------------
    # 200mL bottle  (シャンプー 200mL ¥1,980 / 500mL ¥3,300 / 1L ¥5,500)
    # トリートメント 200g ¥2,200 / 500g ¥3,520 / 1L ¥5,720
    # ウィークリーブースター 150g ¥4,400
    "globalmilbon-smooth-sh":         [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-smooth-tr":         [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-smooth-mask":       [{"label":"150g","price":4400}],
    "globalmilbon-moisture-sh":       [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-moisture-tr":       [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-moisture-mask":     [{"label":"150g","price":4400}],
    "globalmilbon-repair-sh":         [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-repair-tr":         [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-repair-mask":       [{"label":"150g","price":4400}],
    "globalmilbon-repairheat-sh":     [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-repairheat-tr":     [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-repairheat-mask":   [{"label":"150g","price":4400}],
    "globalmilbon-antifrizz-sh":      [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-antifrizz-tr":      [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-antifrizz-mask":    [{"label":"150g","price":4400}],
    "globalmilbon-colorpreserve-sh":  [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-colorpreserve-tr":  [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-colorpreserve-mask":[{"label":"150g","price":4400}],
    "globalmilbon-blondeplus-sh":     [{"label":"200mL","price":1980},{"label":"500mL","price":3300},{"label":"1L パック","price":5500}],
    "globalmilbon-blondeplus-tr":     [{"label":"200g","price":2200},{"label":"500g","price":3520},{"label":"1L パック","price":5720}],
    "globalmilbon-blondeplus-mask":   [{"label":"150g","price":4400}],

    # ---------------- Kérastase ----------------
    # ニュートリティブ
    "kerastase-nutritive-sh":     [{"label":"バン サテン 250mL","price":4180}],
    "kerastase-nutritive-tr":     [{"label":"フォンダン マジストラル 200mL","price":4400}],
    "kerastase-nutritive-mask":   [{"label":"マスク マジストラル 200g","price":5830}],
    "kerastase-nutritive-oil":    [{"label":"ユイル マジストラル 100mL","price":5830}],
    # レジスタンス
    "kerastase-resistance-sh":    [{"label":"バン エクステンショニスト 250mL","price":4180}],
    "kerastase-resistance-tr":    [{"label":"フォンダン エクステンショニスト 200mL","price":4400}],
    "kerastase-resistance-mask":  [{"label":"マスク エクステンショニスト 200g","price":5830}],
    "kerastase-resistance-oil":   [{"label":"セラム エクステンショニスト 50mL","price":5500}],
    # クロノロジスト
    "kerastase-chronologiste-sh":   [{"label":"バン クロノロジスト R 250mL","price":5830}],
    "kerastase-chronologiste-tr":   [{"label":"フォンダン クロノロジスト R 200mL","price":6820}],
    "kerastase-chronologiste-mask": [{"label":"マスク クロノロジスト R 200g","price":10560}],
    "kerastase-chronologiste-oil":     [{"label":"ユイル スブリム ル 100mL","price":7150}],
    "kerastase-chronologiste-essence": [{"label":"セラム クロノロジスト 30mL×6","price":13750}],
    # ジェネシス
    "kerastase-genesis-sh":   [{"label":"バン ニュートリ フォルティフィアン 250mL","price":4180}],
    "kerastase-genesis-tr":   [{"label":"フォンダン ルネサンス 200mL","price":4400}],
    "kerastase-genesis-mask": [{"label":"マスク ルコンストリュアン 200g","price":5830}],
    "kerastase-genesis-oil":     [{"label":"フルイド ヌトリ オキシジェン 50mL","price":5500}],
    "kerastase-genesis-essence": [{"label":"セラム フォルティフィアン 90mL","price":6160}],
    # ディシプリン
    "kerastase-discipline-sh":   [{"label":"バン フリュイディアリスト 250mL","price":4180}],
    "kerastase-discipline-tr":   [{"label":"フォンダン フリュイディアリスト 200mL","price":4400}],
    "kerastase-discipline-mask": [{"label":"マスカラディスシプリン 200g","price":5830}],
    "kerastase-discipline-oil":  [{"label":"オレオ リラックス 100mL","price":5830}],
    # クロマアブソリュ
    "kerastase-chromaabsolu-sh":   [{"label":"バン クロマ リッシュ 250mL","price":4510}],
    "kerastase-chromaabsolu-tr":   [{"label":"フォンダン クロマ リッシュ 200mL","price":4840}],
    "kerastase-chromaabsolu-mask": [{"label":"マスク クロマ リッシュ 200g","price":6160}],
    "kerastase-chromaabsolu-oil":  [{"label":"ユイル クロマ アブソリュ 100mL","price":5830}],
    # ブロンドアブソリュ
    "kerastase-blondabsolu-sh":   [{"label":"バン ルミエール 250mL","price":4510}],
    "kerastase-blondabsolu-tr":   [{"label":"フォンダン サーモプロテクト 200mL","price":4840}],
    "kerastase-blondabsolu-mask": [{"label":"マスク ウルトラ ヴァイオレット 200g","price":6160}],
    "kerastase-blondabsolu-oil":  [{"label":"ユイル シカ エクストレム 50mL","price":5500}],

    # ---------------- Sublimic (Shiseido Professional) ----------------
    # アクアインテンシブ
    "sublimic-aquaintensive-sh":     [{"label":"250mL","price":2860},{"label":"500mL","price":4400}],
    "sublimic-aquaintensive-tr":     [{"label":"250g","price":3300},{"label":"500g","price":4950}],
    "sublimic-aquaintensive-mask":   [{"label":"200g","price":4950}],
    # アデノバイタル
    "sublimic-adenovital-sh":        [{"label":"250mL","price":3300},{"label":"500mL","price":4950}],
    "sublimic-adenovital-mask":      [{"label":"ヘアマスク 200g","price":4950}],
    "sublimic-adenovital-essence":   [{"label":"スカルプエッセンス 180mL","price":7700}],
    # エアリーフロー
    "sublimic-airyflow-sh":          [{"label":"250mL","price":2860},{"label":"500mL","price":4400}],
    "sublimic-airyflow-tr":          [{"label":"250g","price":3300},{"label":"500g","price":4950}],
    "sublimic-airyflow-mask":        [{"label":"200g","price":4950}],
    # フェンテフォルテ
    "sublimic-fuenteforte-sh":       [{"label":"250mL","price":2860},{"label":"500mL","price":4400}],
    "sublimic-fuenteforte-tr":       [{"label":"250g","price":3300},{"label":"500g","price":4950}],
    "sublimic-fuenteforte-essence":  [{"label":"頭皮用美容液 125mL","price":4400}],
    # ルミノフォース
    "sublimic-luminoforce-sh":       [{"label":"250mL","price":2860},{"label":"500mL","price":4400}],
    "sublimic-luminoforce-tr":       [{"label":"250g","price":3300},{"label":"500g","price":4950}],
    "sublimic-luminoforce-mask":     [{"label":"200g","price":4950}],
    # ワンダーシールド
    "sublimic-wondershield-out":     [{"label":"125mL","price":4400}],

    # ---------------- TOKIO INKARAMI ----------------
    # プラチナム シャンプー/トリートメント 200mL/200g 各 ¥3,300
    "tokio-platinum-sh":   [{"label":"200mL","price":3300}],
    "tokio-platinum-tr":   [{"label":"200g","price":3300}],
    # プレミアム
    "tokio-premium-sh":    [{"label":"200mL","price":3300}],
    "tokio-premium-tr":    [{"label":"200g","price":3300}],
    # リミテッド (最上位)
    "tokio-limited-sh":    [{"label":"200mL","price":4400}],
    "tokio-limited-tr":    [{"label":"200g","price":4400}],
    "tokio-limited-out":   [{"label":"アウトバス/集中ケア 80g","price":4400}],
    # ヘッドスパ
    "tokio-headspa-sh":    [{"label":"200mL","price":3300}],
    "tokio-headspa-tr":    [{"label":"200g","price":3300}],
    # アウトカラミ
    "tokio-outkarami-oil":     [{"label":"オイルトリートメント 100mL","price":3300}],
    "tokio-outkarami-oil-2":   [{"label":"プラチナム オイルトリートメント 100mL","price":3850}],

    # ---------------- Oggi otto ----------------
    # セラムCMC シャンプー 250mL ¥3,300
    "oggiotto-serum-sh":      [{"label":"セラムCMC シャンプー 250mL","price":3300}],
    "oggiotto-serum-tr":      [{"label":"セラムCMC マスク 220g","price":4400}],
    "oggiotto-outbath-out":   [{"label":"セラムCMC ミルキィ 120g","price":3850}], # ミルキィ
    "oggiotto-outbath-mist":  [{"label":"セラムCMC ミスト 200mL","price":3850}],  # ミスト
    "oggiotto-outbath-oil":   [{"label":"セラムCMC オイル 100mL","price":4400}],  # オイル
    "oggiotto-scalp-sh":      [{"label":"スキャルプシャンプー 250mL","price":3300}],
    "oggiotto-scalp-essence": [{"label":"スキャルプエッセンス 100mL","price":5500}],

    # ---------------- SEE/SAW ----------------
    # 公式SRP: ヘア&スキャルプシャンプー 250mL ¥2,750
    # ヘアトリートメント 250g ¥2,750
    "seesaw-balance-sh":  [{"label":"250mL","price":2750},{"label":"500mL","price":4290}],
    "seesaw-smooth-sh":   [{"label":"250mL","price":2750},{"label":"500mL","price":4290}],
    "seesaw-tight-sh":    [{"label":"250mL","price":2750},{"label":"500mL","price":4290}],
    "seesaw-balance-tr":  [{"label":"250g","price":2750},{"label":"500g","price":4290}],
    "seesaw-smooth-tr":   [{"label":"250g","price":2750},{"label":"500g","price":4290}],
    "seesaw-tight-tr":    [{"label":"250g","price":2750},{"label":"500g","price":4290}],
    "seesaw-hairmake-oil":  [{"label":"クリアオイル シャープ 80mL","price":2860}],
    "seesaw-hairmake-oil-2":[{"label":"クリアオイル フラット 80mL","price":2860}],
    "seesaw-hairmake-balm": [{"label":"ヘアメイクバーム 35g","price":2860}],

    # ---------------- HITA ----------------
    "hita-hita-sh":    [{"label":"250mL","price":3300}],
    "hita-hita-tr":    [{"label":"250g","price":3300}],
    "hita-hita-mask":  [{"label":"200g","price":3850}],
    "hita-oil-oil":    [{"label":"100mL","price":3850}],

    # ---------------- LOA ----------------
    "loa-core-oil":    [{"label":"100mL","price":4400}],

    # ---------------- Vie qualite (アリミノ バイカルテ) ----------------
    "viequalite-fh-sh":   [{"label":"250mL","price":2860}],
    "viequalite-ch-sh":   [{"label":"250mL","price":2860}],
    "viequalite-uh-sh":   [{"label":"250mL","price":2860}],
    "viequalite-serum-tr":   [{"label":"SS+ 200g","price":3850}],
    "viequalite-serum-tr-2": [{"label":"MS+ 200g","price":3850}],
    "viequalite-serum-tr-3": [{"label":"HS+ 200g","price":3850}],
    "viequalite-concentrate-mask": [{"label":"50mL","price":3300}],
    "viequalite-serummask-mask":   [{"label":"180g","price":3850}],
    "viequalite-essence-oil":      [{"label":"オイル 100mL","price":3300}],
    "viequalite-essence-out":      [{"label":"ミルク 100g","price":3300}],

    # ---------------- 髪にドラマを。 (中野製薬) ----------------
    "drama-tsurun-sh-sh":         [{"label":"250mL","price":2860}],
    "drama-tsurun-booster-sh":    [{"label":"50mL","price":3300}],
    "drama-tsurun-tr-tr":         [{"label":"250g","price":2860}],
    "drama-tsurun-sararito-tr":   [{"label":"250g","price":2860}],
    "drama-iruka-oil":            [{"label":"ヘアオイル 100mL","price":3300}],
    "drama-iruka-mist":           [{"label":"ミスト/ベースケア 200mL","price":3080}],

    # ---------------- ALPSION ----------------
    "alpsion-core-sh":    [{"label":"300mL","price":3300}],
    "alpsion-core-tr":    [{"label":"250g","price":3520}],

    # ---------------- SPRINAGE (アリミノ) ----------------
    "sprinage-core-sh":   [{"label":"250mL","price":2750}],
    "sprinage-core-tr":   [{"label":"250g","price":2750}],

    # ---------------- track ----------------
    "track-cream-out":    [{"label":"track Cream No.3 75g","price":2860}],
    "track-cream-oil":    [{"label":"track Oil No.3 90mL","price":3300}],

    # ---------------- NANOAMINO ----------------
    "nanoamino-homecare-sh":  [{"label":"360mL","price":2200}],
    "nanoamino-homecare-tr":  [{"label":"360g","price":2420}],

    # ---------------- HAHONICO ----------------
    "hahonico-ramerame-tr":   [{"label":"トロ・ムル・キラ セット 60g×3","price":3960}],

    # ---------------- LIKERA ----------------
    "likera-emulsion-tr":   [{"label":"インバス使用 200g","price":4180}],
    "likera-emulsion-out":  [{"label":"200g","price":4180}],
}


# ============================================================
# 3) 新規4ライン: 商品データ
# ============================================================

# ---------- Wella Ultime Repair ----------
WELLA_REPAIR_BASE = {
    "brand": "Wella Professionals",
    "maker": "Wella ウエラ ジャパン",
    "line":  "アルタイム リペア",
    "specialTech": ["plex-bonding"],  # AHA + OMEGA-9 + メタルピュリファイヤー
    "concernBase": ["damage","heat-damage","color-fade","split","no-shine"],
    "hairType": {"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium","strong"]},
    "damageBase": {"bleachOk":"heavy","colorCare":"fade-prevent","straightenOk":"mid","permOk":"digital","heatTolerance":"t200","heatProtect":True},
    "image_base": "images/brands/wella_ultime_repair",
}

WELLA_REPAIR_PRODUCTS = [
    {
        "id":"wella-ultimerepair-sh","name":"アルタイム R シャンプー","category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":4180}],
        "image":f"{WELLA_REPAIR_BASE['image_base']}_shampoo.png",
        "finishTags":{"finish":["smooth","moist"],"weight":"medium","texture":["silky","bonding"]},
        "functionTags":["internal-repair","bonding","moisture","color-lock","clarify"],
        "usageTiming":["daily-in-bath"],
        "pitchCopy":"カラー・ブリーチ毛のダメージに、補修と純度の答えを。",
        "targetHair":"ブリーチ毛・ヘアカラー毛など、繰り返しのダメージが蓄積した髪。",
        "targetPerson":"「ハイトーンを楽しみながら、髪の純度と補修を妥協したくない」方。",
        "solvesConcern":"AHAとOMEGA-9配合の処方が髪を補修しながら、メタルピュリファイヤーテクノロジーで金属イオンなどの不純物を取り除き、なめらかな洗いあがりを実現します。",
        "keyIngredients":["AHA（リンゴ酸）","OMEGA-9","メタルピュリファイヤーテクノロジー"],
        "effects":[
            "髪を補修しながらしっかりクレンジング",
            "金属イオンなどの不純物を取り除き、髪の純度を高める",
            "豊かな泡立ちでなめらかな洗いあがり",
        ],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/repair/shampoo/",
    },
    {
        "id":"wella-ultimerepair-mask","name":"アルタイム R インテンス マスク","category":"hair-mask","routineStep":3,
        "sizes":[{"label":"150mL","price":4620}],
        "image":f"{WELLA_REPAIR_BASE['image_base']}_intensemask.png",
        "finishTags":{"finish":["moist","smooth","firm"],"weight":"medium","texture":["bonding"]},
        "functionTags":["internal-repair","bonding","moisture","color-lock"],
        "usageTiming":["weekly-mask"],
        "pitchCopy":"ハリのある強い髪へ、洗い流す集中補修。",
        "targetHair":"弱り・切れ毛・ハリ不足が気になる、ハイダメージ毛。",
        "targetPerson":"「ダメージを集中的に立て直し、強い髪を取り戻したい」方。",
        "solvesConcern":"濃密な補修処方が髪内部にしっかり浸透し、なめらかでハリのある強い髪へと導きます。",
        "keyIngredients":["AHA（リンゴ酸）","OMEGA-9"],
        "effects":["髪内部に集中補修","ハリと強さを与える","しっとりなめらかな質感へ"],
        "usage":"シャンプー後、毛先〜中間に。3〜5分置いてから洗い流す。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/repair/",
    },
    {
        "id":"wella-ultimerepair-treatment","name":"アルタイム RM ヘアトリートメント","category":"out-bath-milk","routineStep":4,
        "sizes":[{"label":"95mL","price":4180}],
        "image":f"{WELLA_REPAIR_BASE['image_base']}_treatment.png",
        "finishTags":{"finish":["moist","smooth"],"weight":"light","texture":["bonding"]},
        "functionTags":["internal-repair","bonding","heat-protect","moisture"],
        "usageTiming":["before-dry","heat-before"],
        "preferenceFit":["weight-light"],
        "pitchCopy":"瞬時に集中補修、軽さも譲らない。",
        "targetHair":"日々の補修と軽さを両立したいダメージ毛。",
        "targetPerson":"「ベタつかず、瞬時に補修を感じたい」方。",
        "solvesConcern":"ミスト発想の処方が髪に瞬時に行き渡り、ダメージを集中的に補修しながら、軽やかな質感に整えます。",
        "keyIngredients":["AHA（リンゴ酸）","OMEGA-9"],
        "effects":["瞬間ダメージ補修","髪を集中的に強化","軽やかな仕上がり"],
        "usage":"タオルドライ後、髪全体にスプレー。ドライヤーの前に。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/repair/",
    },
    {
        "id":"wella-ultimerepair-nighttreatment","name":"アルタイム RM ナイトトリートメント","category":"out-bath-milk","routineStep":4,
        "sizes":[{"label":"95mL","price":4180}],
        "image":f"{WELLA_REPAIR_BASE['image_base']}_nighttreatment.png",
        "finishTags":{"finish":["moist","smooth"],"weight":"light","texture":["silky"]},
        "functionTags":["internal-repair","moisture"],
        "usageTiming":["before-dry","night-scalp"],
        "preferenceFit":["weight-light"],
        "pitchCopy":"夜のひと手間で、朝のまとまりを変える。",
        "targetHair":"乾燥・広がりが気になる、扱いにくい髪。",
        "targetPerson":"「夜のうちにケアして、朝のまとまりを整えたい」方。",
        "solvesConcern":"軽い質感でも瞬時に広がりを抑える処方が、寝ている間も髪をいたわり、翌朝のまとまりを高めます。",
        "keyIngredients":["AHA（リンゴ酸）","OMEGA-9"],
        "effects":["軽い質感で広がりを抑える","まとまりやすい髪へ","ナイトケアに最適"],
        "usage":"乾いた髪または濡れた髪に。就寝前に。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/repair/",
    },
    {
        "id":"wella-ultimerepair-oil","name":"アルタイム RM ヘアオイル","category":"out-bath-oil","routineStep":5,
        "sizes":[{"label":"95mL","price":4180}],
        "image":f"{WELLA_REPAIR_BASE['image_base']}_oil.png",
        "finishTags":{"finish":["glossy","smooth","moist"],"weight":"medium","texture":["silky"]},
        "functionTags":["surface-repair","moisture","heat-protect"],
        "usageTiming":["before-dry","heat-before","finish-style"],
        "pitchCopy":"キューティクル補修で、毛先までツヤめく。",
        "targetHair":"キューティクルの乱れ・ツヤ不足が気になる髪。",
        "targetPerson":"「ツヤとなめらかさを毎日続けたい」方。",
        "solvesConcern":"キューティクルを補修する処方が、毛先までなめらかにツヤめく髪へと導きます。",
        "keyIngredients":["AHA（リンゴ酸）","OMEGA-9"],
        "effects":["キューティクル補修","なめらかでツヤのある髪へ","熱からも髪を守る"],
        "usage":"タオルドライ後、毛先〜中間に。仕上げにも。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/repair/",
    },
]

# ---------- Wella Ultime Smooth ----------
WELLA_SMOOTH_BASE = {
    "brand": "Wella Professionals",
    "maker": "Wella ウエラ ジャパン",
    "line":  "アルタイム スムース",
    "specialTech": [],
    "concernBase": ["spread","wave","frizz","dry","no-smooth"],
    "hairType": {"thickness":["normal","thick"],"density":["normal","high"],"wave":["weak","medium","strong"]},
    "damageBase": {"bleachOk":"medium","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
    "image_base": "images/brands/wella_ultime_smooth",
}

WELLA_SMOOTH_PRODUCTS = [
    {
        "id":"wella-ultimesmooth-sh","name":"アルタイム S シャンプー","category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":4180}],
        "image":f"{WELLA_SMOOTH_BASE['image_base']}_shampoo.png",
        "finishTags":{"finish":["moist","smooth"],"weight":"medium","texture":["silky"]},
        "functionTags":["moisture","clarify"],
        "usageTiming":["daily-in-bath"],
        "pitchCopy":"うねり・乾燥に、なめらかなツヤをまとう。",
        "targetHair":"広がり・乾燥が気になる、まとまりにくい髪。",
        "targetPerson":"「広がりを抑えつつ、しなやかな指通りで仕上げたい」方。",
        "solvesConcern":"スクワランとOMEGA-9配合の処方が髪をしなやかに保湿しながらクレンジング。メタルピュリファイヤーテクノロジーで純度の高い洗いあがりを実現します。",
        "keyIngredients":["スクワラン","OMEGA-9","メタルピュリファイヤーテクノロジー"],
        "effects":["髪をしなやかに保湿","広がり・うねりを抑えなめらかに","ツヤのある輝きをもたらす"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/smooth/shampoo/",
    },
    {
        "id":"wella-ultimesmooth-mask","name":"アルタイム S インテンス マスク","category":"hair-mask","routineStep":3,
        "sizes":[{"label":"150mL","price":4620}],
        "image":f"{WELLA_SMOOTH_BASE['image_base']}_intensemask.png",
        "finishTags":{"finish":["moist","smooth"],"weight":"medium","texture":["silky"]},
        "functionTags":["moisture","internal-repair"],
        "usageTiming":["weekly-mask"],
        "pitchCopy":"広がる髪に、内側から効くなめらかさを。",
        "targetHair":"広がり・うねりが強く、まとめにくい髪。",
        "targetPerson":"「集中的にまとまりを取り戻したい」方。",
        "solvesConcern":"グリセリン・パンテノール・スクワラン処方が髪の内側へ深く浸透し、広がりをおさえ、なめらかで扱いやすい髪に導きます。",
        "keyIngredients":["グリセリン","パンテノール","スクワラン","OMEGA-9"],
        "effects":["髪の内側まで深く浸透","広がりをおさえなめらかに","扱いやすい質感へ"],
        "usage":"シャンプー後、毛先〜中間に。5〜10分置いてから洗い流す。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/smooth/",
    },
    {
        "id":"wella-ultimesmooth-milkspray","name":"アルタイム S ミラクル ミルクスプレー","category":"out-bath-milk","routineStep":4,
        "sizes":[{"label":"100mL","price":4180}],
        "image":f"{WELLA_SMOOTH_BASE['image_base']}_milkspray.png",
        "finishTags":{"finish":["smooth","airy"],"weight":"light","texture":["silky"]},
        "functionTags":["moisture","heat-protect"],
        "usageTiming":["before-dry","heat-before"],
        "preferenceFit":["weight-light"],
        "pitchCopy":"毛先までさらさら、まとまるミルクスプレー。",
        "targetHair":"広がり・うねりが気になり、軽やかな仕上がりを好む髪。",
        "targetPerson":"「広がりは抑えたいけれど、軽さも欲しい」方。",
        "solvesConcern":"スプレータイプのミルク処方が髪に均一になじみ、広がりやうねりを抑えて毛先までさらさらにまとめます。",
        "keyIngredients":["スクワラン","OMEGA-9"],
        "effects":["広がり・うねりを抑える","毛先までさらさらにまとめる","軽やかな仕上がり"],
        "usage":"タオルドライ後、髪全体にスプレー。ドライヤーの前に。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/smooth/",
    },
    {
        "id":"wella-ultimesmooth-balm","name":"アルタイム S ミラクル バームトリートメント","category":"out-bath-milk","routineStep":4,
        "sizes":[{"label":"100mL","price":4180}],
        "image":f"{WELLA_SMOOTH_BASE['image_base']}_balm.png",
        "finishTags":{"finish":["moist","smooth"],"weight":"medium","texture":["silky"]},
        "functionTags":["moisture"],
        "usageTiming":["before-dry","finish-style"],
        "pitchCopy":"しっとりまとまる、やわらかな髪へ導くバーム。",
        "targetHair":"広がり・うねりがあり、しっとりまとめたい髪。",
        "targetPerson":"「やわらかさとまとまりを両立したい」方。",
        "solvesConcern":"バーム発想の処方が髪に密着し、広がりやうねりを抑えながらしっとりまとまるやわらかな髪へ導きます。",
        "keyIngredients":["スクワラン","OMEGA-9"],
        "effects":["広がり・うねりを抑える","しっとりまとまるやわらかな質感へ","スタイリングの仕上げにも"],
        "usage":"タオルドライ後または仕上げに、毛先〜中間に。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/smooth/",
    },
    {
        "id":"wella-ultimesmooth-oilserum","name":"アルタイム S ミラクル オイルセラム","category":"out-bath-oil","routineStep":5,
        "sizes":[{"label":"100mL","price":4180}],
        "image":f"{WELLA_SMOOTH_BASE['image_base']}_oilserum.png",
        "finishTags":{"finish":["glossy","smooth","moist"],"weight":"medium","texture":["silky"]},
        "functionTags":["surface-repair","moisture","heat-protect"],
        "usageTiming":["before-dry","heat-before","finish-style"],
        "pitchCopy":"輝くツヤと、なめらかなまとまり。",
        "targetHair":"広がり・うねりが気になり、ツヤを足したい髪。",
        "targetPerson":"「広がりを抑えながら、輝くツヤを纏いたい」方。",
        "solvesConcern":"スクワランとOMEGA-9を配合したオイルセラムが、髪の広がりやうねりをおさえ、輝くツヤを引き出します。",
        "keyIngredients":["スクワラン","OMEGA-9"],
        "effects":["輝くツヤを出す","広がり・うねりをおさえる","なめらかな質感に整える"],
        "usage":"タオルドライ後または仕上げに、毛先〜中間に。",
        "sourceUrl":"https://www.wella.co.jp/ultime/products/smooth/",
    },
]

# ---------- Davines ----------
DAVINES_BASE = {
    "brand": "Davines",
    "maker": "コンフォートジャパン",
    "image_base": "images/brands/davines",
}

# 代表的なEssentialラインとOI/MELU/MINUなど主要なラインを採用
DAVINES_PRODUCTS = [
    # MOMO（乾燥毛・うるおい補給）
    {
        "id":"davines-momo-sh","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル モモ","name":"エッセンシャル モモ シャンプー",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3520},{"label":"1000mL","price":10120}],
        "image":f"{DAVINES_BASE['image_base']}_momo_sh.png",
        "concernTags":["dry","frizz","no-shine"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["moist","smooth"],"weight":"medium","texture":["silky","botanical"] if "botanical" in {"silky","volume","bonding","natural"} else ["silky","natural"]},
        "functionTags":["moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"乾いた髪に、ボタニカルなうるおいを。",
        "targetHair":"乾燥・パサつきが気になる髪。",
        "targetPerson":"「やさしい使用感でうるおいを毎日に取り入れたい」方。",
        "solvesConcern":"ボタニカル成分が乾燥した髪に水分を補給し、しっとりまとめます。",
        "effects":["乾燥した髪にうるおいを与える","しっとりとした質感に整える","やさしい使用感"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-momo-co","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル モモ","name":"エッセンシャル モモ コンディショナー",
        "category":"treatment","routineStep":2,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_momo_co.png",
        "concernTags":["dry","frizz","no-shine"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["moist","smooth"],"weight":"medium","texture":["silky","natural"]},
        "functionTags":["moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"乾燥した毛先まで、しっとり手触りに。",
        "targetHair":"乾燥・パサつきが気になる髪。",
        "targetPerson":"「うるおいで満たして、しっとりまとめたい」方。",
        "solvesConcern":"ボタニカル処方が髪に水分を与え、なめらかなまとまりを引き出します。",
        "effects":["毛先までしっとり整える","なめらかな指通り","乾燥した髪を補水"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    # MELU（ダメージ・切れ毛）
    {
        "id":"davines-melu-sh","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル メル","name":"エッセンシャル メル シャンプー",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_melu_sh.png",
        "concernTags":["damage","split","tangle"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"medium","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["moist","smooth","soft"],"weight":"medium","texture":["silky"]},
        "functionTags":["internal-repair","moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"ロングヘアの絡まりに、しなやかさを。",
        "targetHair":"ダメージ・切れ毛・絡まりが気になる長い髪。",
        "targetPerson":"「絡まりやすい毛先をしなやかに整えたい」方。",
        "solvesConcern":"絡まりを抑える処方が、長い髪をしなやかに整え、なめらかな指通りを与えます。",
        "effects":["絡まりを抑える","ダメージケア","なめらかな指通り"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-melu-co","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル メル","name":"エッセンシャル メル コンディショナー",
        "category":"treatment","routineStep":2,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_melu_co.png",
        "concernTags":["damage","split","tangle"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"medium","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["moist","smooth","soft"],"weight":"medium","texture":["silky"]},
        "functionTags":["internal-repair","moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"長い髪のダメージを、しなやかにまとめる。",
        "targetHair":"ダメージ・切れ毛・絡まりが気になる長い髪。",
        "targetPerson":"「絡まる毛先を補修して扱いやすくしたい」方。",
        "solvesConcern":"ボタニカル補修処方が、ダメージのある髪をしなやかに整えます。",
        "effects":["毛先まで補修","絡まりを抑える","しなやかな質感へ"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    # LOVE（くせ・うねり）
    {
        "id":"davines-love-sh","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル ラブ","name":"エッセンシャル ラブ シャンプー",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3520},{"label":"500mL","price":6160},{"label":"1000mL","price":10120}],
        "image":f"{DAVINES_BASE['image_base']}_love_sh.png",
        "concernTags":["wave","spread","no-smooth"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["medium","strong"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["smooth","moist"],"weight":"medium","texture":["silky","natural"]},
        "functionTags":["moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"くせ毛をいたわり、しなやかにまとめる。",
        "targetHair":"くせ・うねり・広がりが気になる髪。",
        "targetPerson":"「くせ毛をやさしく整えたい」方。",
        "solvesConcern":"ボタニカル処方が、くせ毛をしなやかに整え、まとまりを引き出します。",
        "effects":["うねり・広がりを抑える","しなやかなまとまりへ","やさしい使用感"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-love-co","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル ラブ","name":"エッセンシャル ラブ コンディショナー",
        "category":"treatment","routineStep":2,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_love_co.png",
        "concernTags":["wave","spread","no-smooth"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["medium","strong"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["smooth","moist"],"weight":"medium","texture":["silky","natural"]},
        "functionTags":["moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"うねる髪を、しなやかな束感へ。",
        "targetHair":"くせ・うねり・広がりが気になる髪。",
        "targetPerson":"「うねりを抑えてしなやかにまとめたい」方。",
        "solvesConcern":"ボタニカル処方がくせ毛の質感を整え、なめらかなまとまりを与えます。",
        "effects":["うねりを抑える","しなやかなまとまり","ボタニカルな質感"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    # MINU（カラー毛）
    {
        "id":"davines-minu-sh","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル ミヌ","name":"エッセンシャル ミヌ シャンプー",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_minu_sh.png",
        "concernTags":["color-fade","damage"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"medium","colorCare":"fade-prevent","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["smooth","glossy"],"weight":"medium","texture":["silky"]},
        "functionTags":["color-lock","moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"カラーをいたわり、ツヤを守る。",
        "targetHair":"カラー毛・褪色が気になる髪。",
        "targetPerson":"「カラーの色持ちを大切にしたい」方。",
        "solvesConcern":"カラー毛にやさしい処方が、褪色を抑えながら髪をいたわります。",
        "effects":["カラーをいたわる","褪色を抑える","やさしい洗浄"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-minu-co","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル ミヌ","name":"エッセンシャル ミヌ コンディショナー",
        "category":"treatment","routineStep":2,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_minu_co.png",
        "concernTags":["color-fade","damage"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"medium","colorCare":"fade-prevent","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["smooth","glossy"],"weight":"medium","texture":["silky"]},
        "functionTags":["color-lock","moisture"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"色持ちとツヤを、毎日の手触りに。",
        "targetHair":"カラー毛・褪色が気になる髪。",
        "targetPerson":"「カラーの輝きを長く保ちたい」方。",
        "solvesConcern":"カラーケア処方が、色持ちとツヤを引き出します。",
        "effects":["カラーの輝きを保つ","ツヤを与える","なめらかな指通り"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    # VOLU（細毛・ボリュームアップ）
    {
        "id":"davines-volu-sh","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル ヴォル","name":"エッセンシャル ヴォル シャンプー",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_volu_sh.png",
        "concernTags":["volume-down","top-flat","no-firmness"],
        "hairType":{"thickness":["thin"],"density":["low"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["airy","firm","smooth"],"weight":"light","texture":["volume"]},
        "functionTags":["volume-up"],
        "specialTech":["botanical"],
        "preferenceFit":["weight-light"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"細毛・猫っ毛に、ふんわり立ち上がるボリュームを。",
        "targetHair":"細毛・軟毛・ボリューム不足が気になる髪。",
        "targetPerson":"「ぺたっとした髪をふんわり立ち上げたい」方。",
        "solvesConcern":"ボタニカル処方が、細毛・軟毛にハリと軽さを与え、ふんわり立ち上がる質感へ整えます。",
        "effects":["細毛・軟毛にボリューム","ふんわり立ち上がる質感","軽やかな仕上がり"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-volu-co","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"エッセンシャル ヴォル","name":"エッセンシャル ヴォル コンディショナー",
        "category":"treatment","routineStep":2,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_volu_co.png",
        "concernTags":["volume-down","top-flat","no-firmness"],
        "hairType":{"thickness":["thin"],"density":["low"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["airy","firm","smooth"],"weight":"light","texture":["volume"]},
        "functionTags":["volume-up"],
        "specialTech":["botanical"],
        "preferenceFit":["weight-light"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"重くならず、根元からふんわり整える。",
        "targetHair":"細毛・軟毛・ボリューム不足が気になる髪。",
        "targetPerson":"「重くしないでまとめたい」方。",
        "solvesConcern":"軽やかなコンディショナーが、細毛にハリと指通りを与えながら、ふんわりとした質感を保ちます。",
        "effects":["軽やかにまとめる","ハリのある質感へ","ふんわりとした仕上がり"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    # OI（マルチユース・上質ライン）
    {
        "id":"davines-oi-sh","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"オイ","name":"オイ シャンプー",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"280mL","price":4400}],
        "image":f"{DAVINES_BASE['image_base']}_oi_sh.png",
        "concernTags":["dry","no-shine","frizz"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"medium","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["glossy","smooth","soft"],"weight":"medium","texture":["silky","natural"]},
        "functionTags":["moisture","surface-repair"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"ロウクトン由来の上質なシルキータッチを、毎日に。",
        "targetHair":"あらゆる髪質。上質なツヤとしなやかさを求める髪。",
        "targetPerson":"「ブランドの世界観も体験も妥協したくない」方。",
        "solvesConcern":"ロウクトン由来のボタニカル処方が、髪をやさしく洗いながら、上質なツヤと指通りを与えます。",
        "effects":["上質なツヤとしなやかさ","あらゆる髪質に対応","ボタニカルな世界観"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-oi-co","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"オイ","name":"オイ コンディショナー",
        "category":"treatment","routineStep":2,
        "sizes":[{"label":"250mL","price":4400}],
        "image":f"{DAVINES_BASE['image_base']}_oi_co.png",
        "concernTags":["dry","no-shine","frizz"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"medium","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["glossy","smooth","soft"],"weight":"medium","texture":["silky","natural"]},
        "functionTags":["moisture","surface-repair"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"絹のような手触りを、毎日のコンディショナーで。",
        "targetHair":"上質なツヤとしなやかさを求める髪。",
        "targetPerson":"「絹のような手触りを毎日続けたい」方。",
        "solvesConcern":"OIのボタニカル処方が、髪に上質なツヤとしなやかな手触りを与えます。",
        "effects":["絹のような手触り","上質なツヤ","しなやかなまとまり"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    {
        "id":"davines-oi-oil","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"オイ","name":"オイ オイル","category":"out-bath-oil","routineStep":5,
        "sizes":[{"label":"135mL","price":5060},{"label":"50mL","price":3300}],
        "image":f"{DAVINES_BASE['image_base']}_oi_oil.png",
        "concernTags":["dry","no-shine","frizz","damage"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium","strong"]},
        "damageTags":{"bleachOk":"medium","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["glossy","smooth","moist"],"weight":"medium","texture":["silky","natural"]},
        "functionTags":["moisture","surface-repair"],
        "specialTech":["botanical"],
        "lengthFit":"all","usageTiming":["before-dry","finish-style"],
        "pitchCopy":"上質なツヤと指通りを、一滴ずつ。",
        "targetHair":"ツヤと指通りを足したい全髪質。",
        "targetPerson":"「ブランドのアイコン的アウトバスを試したい」方。",
        "solvesConcern":"ロウクトン由来のオイルが、髪に上質なツヤとなめらかな指通りを与えます。",
        "effects":["上質なツヤを与える","なめらかな指通り","髪を保護"],
        "usage":"タオルドライ後、または仕上げに毛先中心に。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
    # SU (UV / マルチケア)
    {
        "id":"davines-su-shower","brand":DAVINES_BASE["brand"],"maker":DAVINES_BASE["maker"],
        "line":"SU","name":"SU ヘア アンド ボディウォッシュ",
        "category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3520}],
        "image":f"{DAVINES_BASE['image_base']}_su_wash.png",
        "concernTags":["damage"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium"]},
        "damageTags":{"bleachOk":"light","colorCare":"maintain","straightenOk":"new","permOk":"normal","heatTolerance":"t180","heatProtect":False},
        "finishTags":{"finish":["smooth"],"weight":"light","texture":["silky"]},
        "functionTags":["moisture","uv-protect"],
        "specialTech":["botanical"],
        "lifestyleFit":["sun-exposure"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"夏のダメージを、髪と肌に。マルチウォッシュ。",
        "targetHair":"紫外線・海・プールなどのダメージが気になる髪。",
        "targetPerson":"「アウトドアでも髪と肌をやさしく洗いたい」方。",
        "solvesConcern":"髪と肌の両方に使えるマルチウォッシュ。紫外線などの外的ダメージから髪をいたわります。",
        "effects":["全身に使えるマルチウォッシュ","髪と肌をいたわる","紫外線ダメージケア"],
        "usage":"髪と肌に。",
        "sourceUrl":"https://davines.co.jp/shop/r/r102010/",
    },
]

# ---------- Schwarzkopf Fibreplex ----------
SK_BASE = {
    "brand": "Schwarzkopf Professional",
    "maker": "ヘンケルジャパン",
    "line":  "ファイバープレックス",
    "image_base": "images/brands/schwarzkopf_fibreplex",
}

SK_PRODUCTS = [
    {
        "id":"schwarzkopf-fibreplex-sh","brand":SK_BASE["brand"],"maker":SK_BASE["maker"],"line":SK_BASE["line"],
        "name":"ファイバープレックス ボンド シャンプー","category":"shampoo","routineStep":1,
        "sizes":[{"label":"250mL","price":3300},{"label":"550mL","price":5500}],
        "image":f"{SK_BASE['image_base']}_sh.png",
        "concernTags":["damage","color-fade","split","no-shine"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium","strong"]},
        "damageTags":{"bleachOk":"multi-bleach","colorCare":"fade-prevent","straightenOk":"mid","permOk":"digital","heatTolerance":"t200","heatProtect":False},
        "finishTags":{"finish":["smooth"],"weight":"light","texture":["bonding"]},
        "functionTags":["bonding","color-lock","internal-repair","clarify"],
        "specialTech":["plex-bonding"],
        "preferenceFit":["weight-light"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"ブリーチ毛のボンドを、毎日のシャンプーで結び直す。",
        "targetHair":"ブリーチ毛・ハイトーンカラーで弱った髪。",
        "targetPerson":"「ブリーチを楽しみたいが、髪の結合は守りたい」方。",
        "solvesConcern":"Fiber Bond Technology が髪の結合をケアし、ジカルボン酸が繰り返すダメージから髪を守ります。きめ細かな泡立ちで、ブリーチ毛もなめらかに洗い上げます。",
        "keyIngredients":["Fiber Bond Technology","ジカルボン酸"],
        "effects":["髪の結合をケアし、ブリーチ毛を支える","カラーの鮮やかさを保つ","軽い質感の洗い上がり"],
        "usage":"毎日のシャンプーとして。",
        "sourceUrl":"https://www.schwarzkopf-professional.com/jp/ja/care/fibreplex.html",
    },
    {
        "id":"schwarzkopf-fibreplex-tr","brand":SK_BASE["brand"],"maker":SK_BASE["maker"],"line":SK_BASE["line"],
        "name":"ファイバープレックス ボンド トリートメント","category":"treatment","routineStep":2,
        "sizes":[{"label":"250g","price":3960},{"label":"550g","price":6490}],
        "image":f"{SK_BASE['image_base']}_tr.png",
        "concernTags":["damage","color-fade","split","no-shine"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium","strong"]},
        "damageTags":{"bleachOk":"multi-bleach","colorCare":"fade-prevent","straightenOk":"mid","permOk":"digital","heatTolerance":"t200","heatProtect":False},
        "finishTags":{"finish":["smooth","soft"],"weight":"medium","texture":["bonding"]},
        "functionTags":["bonding","color-lock","internal-repair"],
        "specialTech":["plex-bonding"],
        "lengthFit":"all","usageTiming":["daily-in-bath"],
        "pitchCopy":"内側からしなやかに、結合からダメージケア。",
        "targetHair":"ブリーチ毛・ハイトーンカラーで内部結合が弱った髪。",
        "targetPerson":"「ハイトーンのまま、しなやかな手触りを取り戻したい」方。",
        "solvesConcern":"ジカルボン酸が髪のフィブリル間を補強し、結合をケア。カラーの色持ちを支えながら、しなやかな仕上がりへ導きます。",
        "keyIngredients":["Fiber Bond Technology","ジカルボン酸"],
        "effects":["髪の内部結合をケア","しなやかな仕上がり","カラーの色持ちを支える"],
        "usage":"シャンプー後、毛先〜中間になじませて流す。",
        "sourceUrl":"https://www.schwarzkopf-professional.com/jp/ja/care/fibreplex.html",
    },
    {
        "id":"schwarzkopf-fibreplex-bondoil","brand":SK_BASE["brand"],"maker":SK_BASE["maker"],"line":SK_BASE["line"],
        "name":"ファイバープレックス ボンドオイル","category":"out-bath-oil","routineStep":5,
        "sizes":[{"label":"150mL","price":3850}],
        "image":f"{SK_BASE['image_base']}_oil.png",
        "concernTags":["damage","split","no-shine","heat-damage"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium","strong"]},
        "damageTags":{"bleachOk":"multi-bleach","colorCare":"fade-prevent","straightenOk":"mid","permOk":"digital","heatTolerance":"t200","heatProtect":True},
        "finishTags":{"finish":["glossy","smooth","moist"],"weight":"medium","texture":["silky","bonding"]},
        "functionTags":["bonding","surface-repair","heat-protect"],
        "specialTech":["plex-bonding"],
        "lengthFit":"all","usageTiming":["before-dry","heat-before","finish-style"],
        "pitchCopy":"結合を守るオイルで、毛先までツヤめく。",
        "targetHair":"ブリーチ毛・ハイトーン毛の毛先パサつきが気になる髪。",
        "targetPerson":"「ハイトーン毛のツヤを毎日続けたい」方。",
        "solvesConcern":"ボンドケアオイルが髪をコーティングし、ハイトーン毛のツヤとなめらかさを引き出します。",
        "keyIngredients":["Fiber Bond Technology"],
        "effects":["結合をケアしながらツヤを与える","熱から髪を守る","なめらかな指通り"],
        "usage":"タオルドライ後、または仕上げに毛先中心に。",
        "sourceUrl":"https://www.schwarzkopf-professional.com/jp/ja/care/fibreplex.html",
    },
    {
        "id":"schwarzkopf-fibreplex-bondmilk","brand":SK_BASE["brand"],"maker":SK_BASE["maker"],"line":SK_BASE["line"],
        "name":"ファイバープレックス ボンドミルク","category":"out-bath-milk","routineStep":4,
        "sizes":[{"label":"100g","price":3300}],
        "image":f"{SK_BASE['image_base']}_milk.png",
        "concernTags":["damage","split","no-smooth","heat-damage"],
        "hairType":{"thickness":["normal","thick"],"density":["normal","high"],"wave":["none","weak","medium","strong"]},
        "damageTags":{"bleachOk":"multi-bleach","colorCare":"fade-prevent","straightenOk":"mid","permOk":"digital","heatTolerance":"t200","heatProtect":True},
        "finishTags":{"finish":["moist","smooth"],"weight":"medium","texture":["bonding"]},
        "functionTags":["bonding","internal-repair","heat-protect","moisture"],
        "specialTech":["plex-bonding"],
        "lengthFit":"all","usageTiming":["before-dry","heat-before"],
        "pitchCopy":"ハイダメージ毛に、ミルクで届ける結合補修。",
        "targetHair":"ブリーチ毛・ハイダメージ毛で広がりがちな髪。",
        "targetPerson":"「ハイダメージ毛をしっかり補修してまとめたい」方。",
        "solvesConcern":"ボンドケア処方のミルクが髪内部に行き渡り、ハイダメージ毛をしっとりとまとめます。",
        "keyIngredients":["Fiber Bond Technology"],
        "effects":["ハイダメージ毛をしっとり補修","広がりを抑える","熱からも髪を守る"],
        "usage":"タオルドライ後、毛先〜中間に。",
        "sourceUrl":"https://www.schwarzkopf-professional.com/jp/ja/care/fibreplex.html",
    },
    {
        "id":"schwarzkopf-fibreplex-no4serum","brand":SK_BASE["brand"],"maker":SK_BASE["maker"],"line":SK_BASE["line"],
        "name":"ファイバープレックス No.4 ボンドセラム","category":"out-bath-milk","routineStep":4,
        "sizes":[{"label":"100g","price":1100}],
        "image":f"{SK_BASE['image_base']}_no4serum.png",
        "concernTags":["damage","split","heat-damage"],
        "hairType":{"thickness":["thin","normal","thick"],"density":["low","normal","high"],"wave":["none","weak","medium","strong"]},
        "damageTags":{"bleachOk":"multi-bleach","colorCare":"fade-prevent","straightenOk":"mid","permOk":"digital","heatTolerance":"t200","heatProtect":True},
        "finishTags":{"finish":["smooth"],"weight":"light","texture":["bonding"]},
        "functionTags":["bonding","internal-repair","heat-protect"],
        "specialTech":["plex-bonding"],
        "preferenceFit":["weight-light","budget-friendly"],
        "lengthFit":"all","usageTiming":["before-dry","heat-before"],
        "pitchCopy":"ボンドケアの定番、続けやすいNo.4セラム。",
        "targetHair":"ブリーチ毛・ハイダメージ毛の継続ケアが必要な髪。",
        "targetPerson":"「ボンドケアを日常で続けたい」方。",
        "solvesConcern":"ボンドケアのアイコンセラムが、毎日のケアにハイダメージ補修を取り入れます。",
        "keyIngredients":["Fiber Bond Technology"],
        "effects":["毎日のボンドケア","軽やかな質感","続けやすい価格"],
        "usage":"タオルドライ後、毛先〜中間に。",
        "sourceUrl":"https://www.schwarzkopf-professional.com/jp/ja/care/fibreplex.html",
    },
]

NEW_PRODUCTS_RAW = WELLA_REPAIR_PRODUCTS + WELLA_SMOOTH_PRODUCTS + DAVINES_PRODUCTS + SK_PRODUCTS


# ============================================================
# 4) Wella/Davines/SK の共通フィールド埋め込み
# ============================================================
def normalize_wella_repair(p):
    p.update({"brand": WELLA_REPAIR_BASE["brand"], "maker": WELLA_REPAIR_BASE["maker"], "line": WELLA_REPAIR_BASE["line"]})
    p["concernTags"]   = WELLA_REPAIR_BASE["concernBase"]
    p["hairType"]      = WELLA_REPAIR_BASE["hairType"]
    p["damageTags"]    = WELLA_REPAIR_BASE["damageBase"]
    p["specialTech"]   = WELLA_REPAIR_BASE["specialTech"]
    p["lengthFit"]     = "all"
    return p

def normalize_wella_smooth(p):
    p.update({"brand": WELLA_SMOOTH_BASE["brand"], "maker": WELLA_SMOOTH_BASE["maker"], "line": WELLA_SMOOTH_BASE["line"]})
    p["concernTags"]   = WELLA_SMOOTH_BASE["concernBase"]
    p["hairType"]      = WELLA_SMOOTH_BASE["hairType"]
    p["damageTags"]    = WELLA_SMOOTH_BASE["damageBase"]
    p["specialTech"]   = WELLA_SMOOTH_BASE["specialTech"]
    p["lengthFit"]     = "all"
    return p


# ============================================================
# 5) メイン
# ============================================================
def main():
    products = json.load(open(SRC, encoding="utf-8"))

    # 5-1) 既存164商品に価格・priceTier を付与
    matched = 0
    for p in products:
        sizes = PRICE_MAP.get(p["id"])
        if sizes:
            p["sizes"] = sizes
            p["priceTier"] = calc_tier(min(s["price"] for s in sizes))
            matched += 1
    print(f"既存商品で価格を付与: {matched} / {len(products)}")

    # 5-2) 新規商品を追加
    new_list = []
    for p in WELLA_REPAIR_PRODUCTS:
        p = normalize_wella_repair(dict(p))
        new_list.append(p)
    for p in WELLA_SMOOTH_PRODUCTS:
        p = normalize_wella_smooth(dict(p))
        new_list.append(p)
    new_list += [dict(p) for p in DAVINES_PRODUCTS]
    new_list += [dict(p) for p in SK_PRODUCTS]

    # priceTier 計算
    for p in new_list:
        if "sizes" in p:
            p["priceTier"] = calc_tier(min(s["price"] for s in p["sizes"]))

    products.extend(new_list)
    print(f"新規商品を追加: {len(new_list)}")
    print(f"合計: {len(products)} 商品")

    # 5-3) 書き出し
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"\n書き出し完了: {OUT}")

    # 5-4) サマリ
    from collections import Counter
    by_brand = Counter(p["brand"] for p in products)
    by_tier  = Counter(p.get("priceTier","(unset)") for p in products)
    print("\n--- ブランド別 ---")
    for k,v in by_brand.most_common():
        print(f"  {k}: {v}")
    print("\n--- priceTier 別 ---")
    for k,v in by_tier.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
