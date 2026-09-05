/* SEAM 商品マスタ統一（PIM）— 正規化ライブラリ
 *
 * メーカーごとにバラバラな CSV / Excel の行を、統一フォーマットの1商品に揃える。
 *   統一フォーマット = JAN・商品名・価格・税込/税抜・内容量(数値+単位)・メーカー・ブランド・カテゴリ・説明
 *
 * ブラウザ(pim/import.html)と Node(検証スクリプト)の両方で動くよう、依存なしの素の JS。
 *   window.PimNormalize / module.exports の両方に出す。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PimNormalize = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── 文字の下ごしらえ ──────────────────────────────────────
  // 全角英数字・記号 → 半角。全角空白 → 半角。
  function toHalf(s) {
    return String(s == null ? '' : s)
      .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/　/g, ' ');
  }
  function clean(s) {
    return toHalf(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function cleanKeepLines(s) {
    return toHalf(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')
      .split(/\r?\n/).map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); })
      .filter(function (l, i, a) { return l || (i > 0 && a[i - 1]); }).join('\n').trim();
  }
  function digitsOnly(s) { return toHalf(s).replace(/[^0-9]/g, ''); }
  // 商品名の表記ゆれを揃える（「250mL」「250ｍｌ」「250 ml」「250cc」→「250ml」、「１０００ＭＬ」→「1000ml」、「×」の統一）
  //   意味を変えない範囲だけ。ブランド名の大文字小文字などは触らない
  function normalizeName(name) {
    var s = clean(name);
    try { s = s.replace(/[ｦ-ﾟ]+/g, function (m) { return m.normalize('NFKC'); }); } catch (e) { /* 半角カナ → 全角 */ }
    s = s.replace(/(\d)\s*(ml|mL|Ml|ML|cc|CC)(?![a-zA-Z])/g, '$1ml')
      .replace(/(\d)\s*(g|G)(?![a-zA-Z])/g, '$1g')
      .replace(/(\d)\s*(kg|KG|Kg)(?![a-zA-Z])/g, '$1kg')
      .replace(/(\d)\s*(l|L|ℓ)(?![a-zA-Z])/g, '$1L')
      .replace(/(\d)\s*(mg|MG|Mg)(?![a-zA-Z])/g, '$1mg')
      .replace(/(\d)\s*[xX×✕＊*]\s*(?=\d)/g, '$1×')
      .replace(/\s+/g, ' ').trim();
    return s;
  }
  // 「似ている判定」キー（functions/api/pim/_lib.js の nameKey と同じ規則。変えるときは両方）
  function nameKey(name) {
    var s = toHalf(name);
    try { s = s.normalize('NFKC'); } catch (e) { /* */ }
    s = s.toLowerCase();
    s = s.replace(/(\d)\s*(ml|cc)\b/g, '$1ml').replace(/(\d)\s*l\b/g, '$1l').replace(/(\d)\s*(kg)\b/g, '$1kg').replace(/(\d)\s*g\b/g, '$1g');
    s = s.replace(/[\s\-_/・･.,、。()（）\[\]【】「」『』〈〉<>:：;；'"’”`~〜～!?！？#＊*&＆%％]/g, ''); // 「+」は残す（エマルジョン と エマルジョン+ は別商品）
    return s.slice(0, 200);
  }

  // ── JAN ───────────────────────────────────────────────────
  // 返り値: { jan, valid, reason }
  //   jan    … 揃えた後のコード（13桁 or 8桁）。取り出せなければ ''
  //   valid  … チェックデジットが合っていれば true
  //   reason … 問題があるときの説明（日本語）
  function normalizeJan(raw) {
    var s = toHalf(raw).trim();
    if (!s) return { jan: '', valid: false, reason: 'JANが空です' };
    // Excel で 4.90128E+12 のように壊れたもの
    if (/^\d(\.\d+)?E\+?\d+$/i.test(s)) {
      var n = Number(s);
      var d = isFinite(n) ? String(Math.round(n)) : '';
      // 指数表記は下位桁が失われているので、桁数が合っても信用しない
      return { jan: d, valid: false, reason: 'Excelの指数表記(' + s + ')で下位桁が失われています。元データをテキスト形式で出し直してください' };
    }
    var d2 = digitsOnly(s);
    if (!d2) return { jan: '', valid: false, reason: 'JANに数字がありません(' + s + ')' };
    if (d2.length === 14 && d2[0] === '0') d2 = d2.slice(1);      // GTIN-14 の先頭0
    if (d2.length === 12) d2 = '0' + d2;                            // UPC-A → EAN-13
    if (d2.length !== 13 && d2.length !== 8) {
      return { jan: d2, valid: false, reason: 'JANの桁数が' + d2.length + '桁です(13桁または8桁が正しい形)' };
    }
    var ok = checkDigitOk(d2);
    return { jan: d2, valid: ok, reason: ok ? '' : 'JANのチェックデジットが合いません(' + d2 + ')。打ち間違いの可能性' };
  }
  function checkDigitOk(d) {
    var sum = 0, L = d.length;
    for (var i = 0; i < L - 1; i++) {
      var w = ((L - 1 - i) % 2 === 1) ? 3 : 1; // 右から数えて奇数位置(=末尾の1つ左)が×3
      sum += (d.charCodeAt(i) - 48) * w;
    }
    var cd = (10 - (sum % 10)) % 10;
    return cd === (d.charCodeAt(L - 1) - 48);
  }

  // ── 価格 ──────────────────────────────────────────────────
  // "¥1,500" "1500円" "1,500(税込)" "1500.00" → { value:1500, taxHint:'in'|'ex'|null }
  function parsePrice(raw) {
    var s = toHalf(raw).trim();
    if (!s) return { value: null, taxHint: null };
    var hint = /税込/.test(s) ? 'in' : (/税抜|税別|本体/.test(s) ? 'ex' : null);
    var m = s.replace(/[,，¥￥円\s]/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!m) return { value: null, taxHint: hint };
    var v = Math.round(parseFloat(m[0]));
    if (!isFinite(v) || v < 0) return { value: null, taxHint: hint };
    return { value: v, taxHint: hint };
  }
  // 税込/税抜 の両方を出す（税込は切り捨て）
  function priceBoth(value, taxIncluded, rate) {
    if (value == null) return { ex: null, inc: null };
    var r = (rate == null ? 10 : rate) / 100;
    if (taxIncluded) return { ex: Math.round(value / (1 + r)), inc: value };
    return { ex: value, inc: Math.floor(value * (1 + r)) };
  }
  // "税込" "込" "1" "true" "included" → true / "税抜" "税別" "0" → false / それ以外 null
  function parseTaxFlag(raw) {
    var s = toHalf(raw).trim().toLowerCase();
    if (!s) return null;
    if (/税込|込み|込$|incl|included|^true$|^yes$/.test(s)) return true;
    if (/税抜|税別|抜き|本体|excl|excluded|^false$|^no$/.test(s)) return false;
    return null;   // 「1」「2」「課税」などの課税区分コードは税込/税抜の意味ではないので触らない
  }
  // 税率のヒント: "8%" "軽減" → 8 / "非課税" "免税" "不課税" "0%" → 0 / "10%" "標準" → 10 / それ以外 null
  function parseTaxRate(raw) {
    var s = toHalf(raw).trim().toLowerCase();
    if (!s) return null;
    if (/非課税|免税|不課税|対象外|^0%?$/.test(s)) return 0;
    if (/軽減|^8%?$/.test(s)) return 8;
    if (/標準|^10%?$/.test(s)) return 10;
    return null;
  }

  // ── 内容量 ────────────────────────────────────────────────
  var UNIT_MAP = {
    'g': 'g', 'gram': 'g', 'grams': 'g', 'グラム': 'g',
    'kg': 'kg', '㎏': 'kg', 'k': 'kg',
    'ml': 'ml', '㎖': 'ml', 'cc': 'ml', 'ｍｌ': 'ml',
    'l': 'L', 'ℓ': 'L', 'リットル': 'L',
    '枚': '枚', '本': '本', '個': '個', '包': '包', '粒': '粒', '袋': '袋', '錠': '錠', '箱': '箱', '組': '組', 'set': '組', 'セット': '組', 'p': '個', 'pcs': '個',
  };
  // 数値+単位のトークン。名前の途中の「D-1」「SP」などは数値として拾わない（単位が付いているものだけ）
  var AMOUNT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|㎏|ml|㎖|cc|g|l|ℓ|リットル|グラム|枚|本|個|包|粒|袋|錠|箱|組|セット|set|pcs|k)(?![a-zA-Z0-9])/i;
  // "×3" "3個入" "5包入り" などの入数
  function parseAmount(raw, opts) {
    var s = toHalf(raw).trim();
    if (!s) return { amount: null, unit: '' };
    var m = s.match(AMOUNT_RE);
    if (m) {
      var num = parseFloat(m[1].replace(',', '.'));
      var u = m[2];
      var key = u.toLowerCase();
      var unit = UNIT_MAP[key] || UNIT_MAP[u] || u;
      if (key === 'k') unit = 'kg';                    // 「1K」= 1kg（業務用の書き方）
      return { amount: num, unit: unit };
    }
    // 単位無しの数値だけ（"250" や "スリムバランサー SP 250"）は、内容量列のときだけ数値として受ける
    if (opts && opts.bareNumberOk) {
      var m2 = s.match(/^(\d+(?:\.\d+)?)$/);
      if (m2) return { amount: parseFloat(m2[1]), unit: '' };
    }
    return { amount: null, unit: '' };
  }
  // 商品名の末尾の数値(単位なし)を内容量として推定する（"アクアモイスチュア 230(N)" → 230）
  function guessAmountFromName(name) {
    var a = parseAmount(name);
    if (a.amount != null) return a;
    var m = toHalf(name).match(/(?:^|\s)(\d{2,4})(?:\s*\([A-Za-z0-9]+\))?\s*$/);
    if (m) return { amount: parseFloat(m[1]), unit: '' };
    return { amount: null, unit: '' };
  }
  // 単位なしの数値のとき、商品名・カテゴリの語から g / ml を推定する（液体→ml・固形/クリーム→g）
  var ML_WORDS = /シャンプー|ローション|ミスト|リキッド|オイル|ウォーター|エッセンス|セラム|美容液|スプレー|トニック|トナー|ミルク|乳液|化粧水|フォーム|ジェル|ソープ|クレンジング|リンス|コンディショナー|シャワー|ボディウォッシュ|ハンドウォッシュ|フレグランス|香水|ドロップ|フルイド|グロス/;
  var G_WORDS  = /トリートメント|マスク|パック|クリーム|ワックス|バター|パウダー|クレイ|バーム|ヘナ|カラー剤|染毛|ソルト|スクラブ|石けん|石鹸|固形|グリース|ポマード|ペースト|ジャム|クレイ|パテ|マット/;
  function guessUnit(text) {
    var t = String(text || '');
    var g = G_WORDS.test(t), ml = ML_WORDS.test(t);
    if (g && !ml) return 'g';
    if (ml && !g) return 'ml';
    if (g && ml) return /トリートメント|マスク|クリーム|パック/.test(t) ? 'g' : 'ml'; // 「モイストシャンプー＆トリートメント」のような併記は主語側
    return '';
  }
  function formatAmount(amount, unit) {
    if (amount == null || amount === '') return '';
    var n = Number(amount);
    var s = (Math.round(n * 100) / 100).toString();
    return s + (unit || '');
  }

  // ── 列名の当たり（マッピングの自動推定）──────────────────────
  // 各フィールドに対して「こう書いてあったらそれ」の候補。上から順に強い。
  var ALIASES = {
    jan:         ['jan', 'janコード', 'jancode', 'jan code', 'ean', 'ean13', 'gtin', 'バーコード', 'barcode', 'upc', 'ｊａｎ', 'ジャン', 'ジャンコード', '商品jan'],
    name:        ['ec表示名', '商品名', '商品名称', '品名', '名称', 'product name', 'productname', 'name', 'title', 'item name', '商品タイトル', '表示名'],
    price:       ['価格', '売価', '販売価格', '販売単価', '標準売上単価', '売上単価', '卸価格', '卸単価', '卸値', '仕切', '仕切価格', '単価', 'price', '税抜価格', '税込価格', '本体価格', '金額', 'ec価格', '納価', '納入価格'],
    retail:      ['上代', '上代単価', '上代価格', '希望小売価格', 'メーカー希望小売価格', '定価', '小売価格', 'msrp', 'retail', 'list price', '参考価格'],
    cost:        ['仕入', '仕入単価', '仕入価格', '標準仕入単価', '原価', 'cost', '下代'],
    amount:      ['内容量', '容量', 'グラム数', '重量', '規格', '内容', 'サイズ', 'size', 'volume', 'weight', 'quantity', 'capacity', '入数', '内容量(g)', '内容量(ml)'],
    unit:        ['単位', 'unit'],
    tax:         ['税区分', '税込区分', '税込/税抜', '税込税抜', '税込・税抜', '税', 'tax', 'tax type', '課税'],
    maker:       ['メーカー名称', 'メーカー名', 'メーカー', '製造元', '製造者', 'maker', 'manufacturer', 'vendor', '仕入先', '仕入先名'],
    brand:       ['ブランド名', 'ブランド', 'brand', 'シリーズ大', 'シリーズ', 'series', 'ライン', 'line'],
    category:    ['カテゴリ大名称', 'カテゴリ中名称', 'カテゴリ小名称', 'カテゴリ', 'カテゴリー', 'カテゴリ名', '分類', '大分類', '中分類', '小分類', 'category', 'ジャンル', '種別', '商品区分'],
    description: ['商品説明', '商品詳細', '説明', '詳細', '商品紹介', '特徴', 'description', 'detail', 'コメント', '商品説明文', 'pr文'],
    sku:         ['商品コード', '商品cd', '品番', '商品番号', 'コード', 'sku', 'item code', 'itemcode', '型番', '品番コード', 'メーカー品番'],
    image:       ['画像', '画像url', '商品画像', 'image', 'img', 'photo', 'picture', '画像1', '画像2', '画像3', '画像4', '画像5', 'image1', 'image2', 'image3', 'image4', 'image5'],
  };
  var MULTI = { category: true, image: true }; // 複数列を許すフィールド
  function normHeader(h) { return clean(h).toLowerCase().replace(/[\s_\-()（）【】\[\]:：]/g, ''); }
  function guessMapping(headers) {
    var map = {};      // field -> index | index[]
    var used = {};
    var hn = headers.map(normHeader);
    Object.keys(ALIASES).forEach(function (field) {
      var hits = [];
      ALIASES[field].forEach(function (alias) {
        var a = normHeader(alias);
        hn.forEach(function (h, i) {
          if (used[i] || !h) return;
          if (h === a && hits.indexOf(i) < 0) hits.push(i);
        });
      });
      if (!hits.length) {
        // 完全一致がなければ部分一致（ただし短い別名は誤爆するので4文字以上）
        ALIASES[field].forEach(function (alias) {
          var a = normHeader(alias);
          if (a.length < 3) return;
          hn.forEach(function (h, i) {
            if (used[i] || !h) return;
            if (h.indexOf(a) >= 0 && hits.indexOf(i) < 0) hits.push(i);
          });
        });
      }
      if (!hits.length) return;
      if (MULTI[field]) { map[field] = hits; hits.forEach(function (i) { used[i] = 1; }); }
      else { map[field] = hits[0]; used[hits[0]] = 1; }
    });
    // 「コード」だけの列を JAN に取られないよう、JAN が無く sku が13桁数値ならそちらを JAN 候補にするのは呼び出し側で判断
    return map;
  }

  // ── 1行 → 統一商品 ────────────────────────────────────────
  // row: 文字列配列 / mapping: guessMapping の結果 / opts: { taxIncluded:bool, taxRate:number, source:string }
  // 返り値: { product, warnings:[], errors:[] }  errors があれば登録不可
  function normalizeRow(row, mapping, opts) {
    opts = opts || {};
    var get = function (f) { var i = mapping[f]; return (i == null || Array.isArray(i)) ? '' : (row[i] == null ? '' : String(row[i])); };
    var getAll = function (f) { var a = mapping[f]; if (a == null) return []; if (!Array.isArray(a)) a = [a]; return a.map(function (i) { return row[i] == null ? '' : String(row[i]); }); };
    var warnings = [], errors = [];

    var j = normalizeJan(get('jan'));
    if (!j.jan) errors.push(j.reason);
    else if (!j.valid) warnings.push(j.reason);

    var rawName = clean(get('name'));
    var name = normalizeName(rawName);
    if (!name) errors.push('商品名が空です');
    else if (name !== rawName) warnings.push('商品名の表記を揃えました(' + rawName + ' → ' + name + ')');

    var pr = parsePrice(get('price'));
    var taxIncluded = opts.taxIncluded ? 1 : 0;
    var flag = parseTaxFlag(get('tax'));
    if (flag != null) taxIncluded = flag ? 1 : 0;
    if (pr.taxHint === 'in') taxIncluded = 1;
    if (pr.taxHint === 'ex') taxIncluded = 0;
    if (pr.value == null) warnings.push('価格が読めません(' + get('price') + ')');
    var taxRate = (opts.taxRate == null ? 10 : Number(opts.taxRate));
    var rateHint = parseTaxRate(get('tax'));
    if (rateHint != null) taxRate = rateHint;
    var both = priceBoth(pr.value, !!taxIncluded, taxRate);

    var retail = parsePrice(get('retail')).value;
    if (retail === 0) retail = null;
    var cost = parsePrice(get('cost')).value;
    if (cost === 0) cost = null;

    var am = parseAmount(get('amount'), { bareNumberOk: true });
    var unit = clean(get('unit'));
    if (am.amount != null && !am.unit && unit) am.unit = UNIT_MAP[unit.toLowerCase()] || unit;
    var amountFrom = 'column';
    if (am.amount == null) { am = guessAmountFromName(name); amountFrom = am.amount != null ? 'name' : ''; }
    if (am.amount != null && !am.unit) {
      var gu = guessUnit(name + ' ' + getAll('category').join(' '));
      if (gu) { am.unit = gu; amountFrom = 'guess'; warnings.push('内容量の単位を商品名から推定しました(' + formatAmount(am.amount, gu) + ')。違っていれば直してください'); }
      else warnings.push('内容量の単位が分かりません(' + formatAmount(am.amount, '') + ')。g か ml か確認してください');
    }

    var cats = getAll('category').map(clean).filter(function (c, i, a) { return c && a.indexOf(c) === i; });

    var product = {
      jan: j.jan,
      jan_valid: j.valid ? 1 : 0,
      name: name,
      price: pr.value,
      tax_included: taxIncluded,
      tax_rate: taxRate,
      price_ex: both.ex,
      price_in: both.inc,
      retail_price: retail,
      cost_price: cost,
      amount: am.amount,
      unit: am.unit || '',
      amount_from: amountFrom,
      maker: clean(get('maker')) || clean(opts.maker || ''),
      brand: clean(get('brand')),
      category: cats.join(' > '),
      description: cleanKeepLines(get('description')).slice(0, 4000),
      sku: clean(get('sku')).slice(0, 64),
      source: clean(opts.source || ''),
      name_key: nameKey(name),
      images: getAll('image').map(clean).filter(Boolean).slice(0, 5),
    };
    return { product: product, warnings: warnings, errors: errors };
  }

  // ── ファイル内の JAN 重複を見つける ──────────────────────
  // items: normalizeRow の結果配列（product.jan 付き）。返り値: { jan: [index,...] }（2件以上のものだけ）
  function findFileDuplicates(items) {
    var by = {};
    items.forEach(function (it, i) {
      var jan = it.product && it.product.jan;
      if (!jan) return;
      (by[jan] = by[jan] || []).push(i);
    });
    var out = {};
    Object.keys(by).forEach(function (k) { if (by[k].length > 1) out[k] = by[k]; });
    return out;
  }

  // ── ファイル内で「商品名が似ている」組を見つける（JAN は違うのに名前がほぼ同じ＝表記ゆれ or 登録ミスの疑い）──
  // 返り値: { key: [index,...] }（2件以上・JAN が 2 種類以上あるものだけ）
  function findSimilarNames(items) {
    var by = {};
    items.forEach(function (it, i) {
      var p = it.product; if (!p || !p.jan || !p.name_key) return;
      var k = (p.maker || '') + '\u0000' + p.name_key;
      (by[k] = by[k] || []).push(i);
    });
    var out = {};
    Object.keys(by).forEach(function (k) {
      var idx = by[k]; if (idx.length < 2) return;
      var jans = {}; idx.forEach(function (i) { jans[items[i].product.jan] = 1; });
      if (Object.keys(jans).length >= 2) out[k] = idx;
    });
    return out;
  }

  // ── 統一フォーマットの出力（CSV）─────────────────────────
  var OUT_COLUMNS = [
    ['jan', 'JAN'], ['name', '商品名'],
    ['price_ex', '価格(税抜)'], ['price_in', '価格(税込)'], ['tax_included', '入力価格の税区分'], ['tax_rate', '税率(%)'],
    ['amount', '内容量'], ['unit', '単位'], ['amount_text', '内容量表記'],
    ['retail_price', '上代(税抜)'], ['cost_price', '仕入価格'],
    ['maker', 'メーカー'], ['brand', 'ブランド'], ['category', 'カテゴリ'], ['description', '商品説明'], ['sku', '元商品コード'],
    ['image1', '画像1'], ['image2', '画像2'], ['image3', '画像3'], ['image4', '画像4'], ['image5', '画像5'],
    ['image_count', '画像枚数'], ['updated_at', '更新日時'],
  ];
  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toUnifiedCsv(products, imageBase) {
    var lines = [OUT_COLUMNS.map(function (c) { return csvCell(c[1]); }).join(',')];
    products.forEach(function (p) {
      var imgs = p.image_urls || [];
      var rec = Object.assign({}, p, {
        tax_included: p.tax_included ? '税込' : '税抜',
        amount_text: formatAmount(p.amount, p.unit),
      });
      for (var k = 1; k <= 5; k++) rec['image' + k] = imgs[k - 1] || '';
      lines.push(OUT_COLUMNS.map(function (c) { return csvCell(rec[c[0]]); }).join(','));
    });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  // ── CSV の読み取り（RFC4180・区切り自動判定）───────────────
  function detectDelimiter(text) {
    var head = text.slice(0, 20000);
    var cands = [',', '\t', ';'];
    var best = ',', bestScore = -1;
    cands.forEach(function (d) {
      var lines = head.split(/\r?\n/).filter(Boolean).slice(0, 20);
      if (!lines.length) return;
      var counts = lines.map(function (l) { return l.split(d).length - 1; });
      var min = Math.min.apply(null, counts), max = Math.max.apply(null, counts);
      var score = min > 0 ? min - (max - min) * 0.5 : -1;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }
  function parseCsv(text, delimiter) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var d = delimiter || detectDelimiter(text);
    var rows = [], row = [], cur = '', inQ = false, i = 0, L = text.length;
    while (i < L) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i += 2; continue; } inQ = false; i++; continue; }
        cur += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === d) { row.push(cur); cur = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += c; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    // 空行を落とす
    rows = rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
    return rows;
  }
  // ヘッダー行がどこか（先頭に説明行が混ざっているファイル対策）: JAN/商品名らしき列名が最も多く当たる行
  function findHeaderRow(rows) {
    var best = 0, bestScore = -1;
    for (var r = 0; r < Math.min(rows.length, 10); r++) {
      var m = guessMapping(rows[r]);
      var score = Object.keys(m).length + (m.jan != null ? 2 : 0) + (m.name != null ? 2 : 0);
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best;
  }
  // バイト列 → 文字列（BOM / UTF-16 / UTF-8 / Shift_JIS を判定）
  function decodeBytes(buf) {
    var b = new Uint8Array(buf);
    var td = function (enc, fatal) { return new TextDecoder(enc, { fatal: !!fatal }).decode(b); };
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return { text: td('utf-8'), encoding: 'UTF-8 (BOM)' };
    if (b[0] === 0xFF && b[1] === 0xFE) return { text: td('utf-16le'), encoding: 'UTF-16LE' };
    if (b[0] === 0xFE && b[1] === 0xFF) return { text: td('utf-16be'), encoding: 'UTF-16BE' };
    // BOM無し UTF-16: 偶数/奇数バイトに 0x00 が大量
    var zeros = 0, n = Math.min(b.length, 4000);
    for (var i = 0; i < n; i++) if (b[i] === 0) zeros++;
    if (zeros > n / 5) return { text: td('utf-16le'), encoding: 'UTF-16LE (BOMなし)' };
    try { return { text: td('utf-8', true), encoding: 'UTF-8' }; } catch (e) { /* fallthrough */ }
    try { return { text: td('shift_jis'), encoding: 'Shift_JIS' }; } catch (e2) { return { text: td('utf-8'), encoding: 'UTF-8 (一部化け)' }; }
  }

  return {
    toHalf: toHalf, clean: clean, digitsOnly: digitsOnly,
    normalizeJan: normalizeJan, checkDigitOk: checkDigitOk,
    parsePrice: parsePrice, priceBoth: priceBoth, parseTaxFlag: parseTaxFlag, parseTaxRate: parseTaxRate,
    parseAmount: parseAmount, guessAmountFromName: guessAmountFromName, guessUnit: guessUnit, formatAmount: formatAmount,
    ALIASES: ALIASES, guessMapping: guessMapping, normHeader: normHeader,
    normalizeRow: normalizeRow, findFileDuplicates: findFileDuplicates, normalizeName: normalizeName, nameKey: nameKey, findSimilarNames: findSimilarNames,
    OUT_COLUMNS: OUT_COLUMNS, toUnifiedCsv: toUnifiedCsv, csvCell: csvCell,
    detectDelimiter: detectDelimiter, parseCsv: parseCsv, findHeaderRow: findHeaderRow, decodeBytes: decodeBytes,
  };
});
