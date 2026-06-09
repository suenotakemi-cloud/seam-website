'use strict';

/**
 * SEAM Hair Care Finder — Matching Engine
 *
 * 診断回答 (Answers) と商品マスター (products) を受け取り、商品ごとのスコアを算出。
 * カテゴリ別の Top-N を返す。
 *
 * 使い方（ブラウザ）:
 *   const products = (await fetch('data/products.json').then(r=>r.json())).products;
 *   const result = SEAMMatch.recommend(answers, products);
 *
 * 使い方（Node.js / テスト）:
 *   const { recommend, scoreProduct } = require('./js/match.js');
 *
 * Answers の型:
 * {
 *   concerns:      string[]   // concernTags のkey配列。Q1 + 派生（最大3つ重み付け）
 *   primaryConcern:string     // 第1悩み（concerns[0] と同じことが多いが明示）
 *   thickness:     'thin'|'normal'|'thick'
 *   density:       'low'|'normal'|'high'
 *   wave:          'none'|'weak'|'medium'|'strong'|'straightened'
 *   length:        'short'|'bob'|'medium'|'long'
 *   bleach:        'no'|'light'|'medium'|'heavy'|'multi-bleach'
 *   colorCare:     'no'|'maintain'|'fade-prevent'|'gray-cover'
 *   straighten:    'no'|'new'|'mid'|'old'|'acid'|'kaizen'
 *   perm:          'no'|'normal'|'digital'|'loose-prevent'
 *   heatTemp:      't140'|'t160'|'t180'|'t200'|'t200p'
 *   lifestyle:     string[]
 *   preferences:   string[]   // preferenceFit のkey配列
 *   goalTexture:   string[]   // finish のkey配列（しっとり/ふんわり等）
 *   goals:         string[]   // goalFit のkey配列
 *   scalp:         string     // 'dry-scalp'|'oily-scalp'|...
 * }
 *
 * 戻り値:
 * {
 *   byCategory: { shampoo: [{product, score}, ...], treatment: [...], ... },
 *   top:        [{product, score, category}, ...]   // カテゴリ別Top1を平坦化
 *   debug:      { scored: [{id, score, breakdown}] } // デバッグ用
 * }
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SEAMMatch = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ── スコアの重み（中央集権的に管理して調整しやすく） ─────────
  const WEIGHTS = {
    // 履歴・施術系（最重要：合わない商品を弾く）
    bleach:              30,
    bleachMismatch:     -40,   // ハイブリーチ毛 × ノンブリーチ向け商品の強いペナルティ
    heat:                25,
    straighten:          15,
    perm:                15,

    // 悩み
    concernPrimary:      25,   // 第1悩み一致
    concernOther:        15,   // 第2・第3悩み一致

    // 髪質
    thickness:           10,
    density:             10,
    wave:                10,

    // 仕上がり目標
    finish:              15,
    weightMismatch:     -20,   // パーマ毛 × heavy などのペナルティ

    // ライフスタイル・好み・頭皮
    lifestyle:            5,
    preference:           5,
    scalp:                8,
    length:               5,

    // ゴール
    goal:                 8,

    // 価格
    priceMismatch:      -10
  };

  // ─────────────────────────────────────────
  // ユーティリティ
  // ─────────────────────────────────────────

  function asArray(x) {
    if (Array.isArray(x)) return x;
    if (x == null) return [];
    return [x];
  }

  function intersect(a, b) {
    const setB = new Set(asArray(b));
    return asArray(a).filter(v => setB.has(v));
  }

  // heatTemp の数値変換（t140=140, t200p=210）
  const HEAT_NUM = { t140:140, t160:160, t180:180, t200:200, t200p:210 };
  function heatNum(key) { return HEAT_NUM[key] || 0; }

  // bleach 段階の数値変換
  const BLEACH_LEVEL = { no:0, light:1, medium:2, heavy:3, 'multi-bleach':4 };
  function bleachLevel(key) { return BLEACH_LEVEL[key] != null ? BLEACH_LEVEL[key] : 0; }

  // ─────────────────────────────────────────
  // 1商品スコアリング
  // ─────────────────────────────────────────

  function scoreProduct(product, answers) {
    let score = 0;
    const breakdown = {};

    // ── 1. ブリーチ履歴 ─────────────────────
    if (answers.bleach && product.damageTags && product.damageTags.bleachOk) {
      const userLv = bleachLevel(answers.bleach);
      const prodLv = bleachLevel(product.damageTags.bleachOk);
      if (userLv === 0) {
        // 非ブリーチ毛なら気にしない
      } else if (prodLv >= userLv) {
        score += WEIGHTS.bleach;
        breakdown.bleach = WEIGHTS.bleach;
      } else if (userLv - prodLv >= 2) {
        // ハイブリーチ毛 × ノンブリーチ向けの大きな乖離はペナルティ
        score += WEIGHTS.bleachMismatch;
        breakdown.bleach = WEIGHTS.bleachMismatch;
      } else {
        // 1段階の乖離は無視
      }
    }

    // ── 2. アイロン耐熱 ─────────────────────
    if (answers.heatTemp && product.damageTags) {
      const userTemp = heatNum(answers.heatTemp);
      const prodTemp = heatNum(product.damageTags.heatTolerance);
      const hasProtect = product.damageTags.heatProtect === true;
      if (userTemp >= 180 && hasProtect) {
        score += WEIGHTS.heat;
        breakdown.heat = WEIGHTS.heat;
      } else if (userTemp >= 200 && !hasProtect && prodTemp < 200) {
        score -= 15;
        breakdown.heat = -15;
      } else if (userTemp <= prodTemp && prodTemp > 0) {
        score += Math.round(WEIGHTS.heat * 0.4);
        breakdown.heat = Math.round(WEIGHTS.heat * 0.4);
      }
    }

    // ── 3. 縮毛矯正 ──────────────────────────
    if (answers.straighten && answers.straighten !== 'no' && product.damageTags) {
      if (product.damageTags.straightenOk && product.damageTags.straightenOk !== 'no') {
        score += WEIGHTS.straighten;
        breakdown.straighten = WEIGHTS.straighten;
      }
    }

    // ── 4. パーマ ────────────────────────────
    if (answers.perm && answers.perm !== 'no' && product.damageTags) {
      if (product.damageTags.permOk && product.damageTags.permOk !== 'no') {
        score += WEIGHTS.perm;
        breakdown.perm = WEIGHTS.perm;
      }
      // パーマ毛に重すぎる商品はペナルティ
      if (product.finishTags && product.finishTags.weight === 'heavy') {
        score += WEIGHTS.weightMismatch;
        breakdown.weightMismatch = WEIGHTS.weightMismatch;
      }
    }

    // ── 5. 悩み一致 ──────────────────────────
    const productConcerns = product.concernTags || [];
    if (answers.primaryConcern && productConcerns.includes(answers.primaryConcern)) {
      score += WEIGHTS.concernPrimary;
      breakdown.concernPrimary = WEIGHTS.concernPrimary;
    }
    const otherConcerns = asArray(answers.concerns).filter(c => c !== answers.primaryConcern);
    const otherHits = intersect(otherConcerns, productConcerns).length;
    if (otherHits > 0) {
      const pts = otherHits * WEIGHTS.concernOther;
      score += pts;
      breakdown.concernOther = pts;
    }

    // ── 6. 髪質 ──────────────────────────────
    if (product.hairType) {
      if (answers.thickness && product.hairType.thickness && product.hairType.thickness.includes(answers.thickness)) {
        score += WEIGHTS.thickness;
        breakdown.thickness = WEIGHTS.thickness;
      }
      if (answers.density && product.hairType.density && product.hairType.density.includes(answers.density)) {
        score += WEIGHTS.density;
        breakdown.density = WEIGHTS.density;
      }
      if (answers.wave && product.hairType.wave && product.hairType.wave.includes(answers.wave)) {
        score += WEIGHTS.wave;
        breakdown.wave = WEIGHTS.wave;
      }
    }

    // ── 7. 仕上がり目標 ──────────────────────
    if (product.finishTags && product.finishTags.finish) {
      const finishHits = intersect(answers.goalTexture, product.finishTags.finish).length;
      if (finishHits > 0) {
        const pts = finishHits * WEIGHTS.finish;
        score += pts;
        breakdown.finish = pts;
      }
    }

    // ── 8. ライフスタイル ───────────────────
    if (product.lifestyleFit && answers.lifestyle) {
      const hits = intersect(answers.lifestyle, product.lifestyleFit).length;
      if (hits > 0) {
        const pts = hits * WEIGHTS.lifestyle;
        score += pts;
        breakdown.lifestyle = pts;
      }
    }

    // ── 9. 好み ─────────────────────────────
    if (product.preferenceFit && answers.preferences) {
      const hits = intersect(answers.preferences, product.preferenceFit).length;
      if (hits > 0) {
        const pts = hits * WEIGHTS.preference;
        score += pts;
        breakdown.preference = pts;
      }
    }

    // ── 10. 頭皮タイプ ──────────────────────
    if (product.scalpFit && answers.scalp && product.scalpFit.includes(answers.scalp)) {
      score += WEIGHTS.scalp;
      breakdown.scalp = WEIGHTS.scalp;
    }

    // ── 11. 長さ ────────────────────────────
    if (product.lengthFit && answers.length) {
      if (product.lengthFit === 'all' || product.lengthFit === answers.length) {
        score += WEIGHTS.length;
        breakdown.length = WEIGHTS.length;
      }
    }

    // ── 12. ゴール ──────────────────────────
    if (product.goalFit && answers.goals) {
      const hits = intersect(answers.goals, product.goalFit).length;
      if (hits > 0) {
        const pts = hits * WEIGHTS.goal;
        score += pts;
        breakdown.goal = pts;
      }
    }

    // ── 13. 価格回避（budget-friendly 表明時のラグジュアリーペナルティ） ─────
    if (asArray(answers.preferences).includes('budget-friendly') && product.priceTier === 'luxury') {
      score += WEIGHTS.priceMismatch;
      breakdown.priceMismatch = WEIGHTS.priceMismatch;
    }

    return { score, breakdown };
  }

  // ─────────────────────────────────────────
  // カテゴリ別Top-N抽出
  // ─────────────────────────────────────────

  // 結果ページに並べる順序（routineStep順）
  const CATEGORY_ORDER = [
    'shampoo',
    'treatment',
    'hair-mask',
    'out-bath-milk',
    'out-bath-oil',
    'scalp-essence',
    'heat-protect',
    'styling',
    'beauty-tool'
  ];

  function recommend(answers, products, opts) {
    opts = opts || {};
    const topN = opts.topN || 3;
    const minScore = opts.minScore != null ? opts.minScore : 1;

    // ブランドフィルタ：answers.brands が指定されていれば、そのブランドだけに絞る
    let pool = products;
    if (Array.isArray(answers.brands) && answers.brands.length > 0) {
      const set = new Set(answers.brands);
      pool = products.filter(p => set.has(p.brand));
    }

    // 全商品をスコアリング
    const scored = pool.map(p => {
      const { score, breakdown } = scoreProduct(p, answers);
      return { product: p, score, breakdown };
    });

    // カテゴリ別にグループ化
    const byCategory = {};
    CATEGORY_ORDER.forEach(cat => { byCategory[cat] = []; });
    scored.forEach(s => {
      const cat = s.product.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(s);
    });

    // カテゴリ内をスコア降順でソートし、Top-N に絞る
    Object.keys(byCategory).forEach(cat => {
      byCategory[cat].sort((a, b) => b.score - a.score);
      byCategory[cat] = byCategory[cat]
        .filter(s => s.score >= minScore)
        .slice(0, topN);
    });

    // カテゴリ別Top1を平坦化（結果ページの7ステップ表示用）
    const top = CATEGORY_ORDER
      .map(cat => byCategory[cat][0] ? { ...byCategory[cat][0], category: cat } : null)
      .filter(Boolean);

    return {
      byCategory,
      top,
      debug: { scored: scored.map(s => ({ id: s.product.id, score: s.score, breakdown: s.breakdown })) }
    };
  }

  // ─────────────────────────────────────────
  // カバレッジレポート（タグカバレッジ確認用）
  // ─────────────────────────────────────────

  function coverage(products) {
    const cats = {};
    products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    const missingTags = products
      .filter(p => !p.concernTags || !p.hairType || !p.damageTags || !p.finishTags)
      .map(p => p.id);
    return { byCategory: cats, total: products.length, missingPhase1Tags: missingTags };
  }

  return {
    scoreProduct,
    recommend,
    coverage,
    WEIGHTS,
    CATEGORY_ORDER
  };
}));
