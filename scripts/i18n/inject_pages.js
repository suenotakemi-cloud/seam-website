// SEAM: 店舗7 + 地域LP19 を多言語化する。
//  1. 翻訳単位の要素に data-i18n="sN" を付ける(冪等: 既にあれば付け直さない)
//  2. dict_all.json から 5言語ぶんの SEAM_PAGE_I18N を組み立てて <script> で埋める
//  3. meta.title / meta.description は テンプレ+実データから生成(手書きしない)
//  4. hreflang 6本を jsonld マーカーの「外側」に張る(過去に inject_jsonld で消えた事故あり)
//
// マークアップは触らない。訳文は「元のHTMLのテキスト片だけ」を差し替えて組み立てる。
const fs = require('fs');
const path = require('path');
const SP = process.env.SP;
const { JSDOM } = require(path.join(SP, 'node_modules/jsdom'));
const ROOT = process.argv[2];
const DRY = process.argv.includes('--dry');

const DICT = JSON.parse(fs.readFileSync(path.join(SP, 'dict_all.json'), 'utf8'));
const LANGS = ['ja', 'en', 'zh', 'tw', 'ko'];
const INLINE = new Set(['BR','SPAN','A','STRONG','EM','B','I','SMALL','SUP','SUB','U','MARK','CODE','WBR','TIME','ABBR','S','DEL','INS','BDI','RUBY','RT','RP']);
const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','SVG','PATH','CIRCLE','LINE','RECT']);
const hasJa = s => /[ぁ-んァ-ヶ一-龠]/.test(s || '');
const HTMLNS = 'http://www.w3.org/1999/xhtml';
// 【罠】SVG配下の要素は jsdom の tagName が小文字(svg/path/circle)で返るため
//   SKIP.has(tagName) に当たらない。素朴に walk すると <path> を空要素として書き出し
//   閉じタグが消えてSVGが壊れる。名前空間で判定して丸ごと outerHTML を使う。
const isForeign = n => n.namespaceURI && n.namespaceURI !== HTMLNS;
const TAG = n => (n.tagName || '').toUpperCase();

// ─────────────────────────────────────────────
// meta のテンプレ。title は英60字/日32字を目安に短く、desc は英155字/日120字。
const STORE = {
  ginza:      { name:'SEAM GINZA',        area:{ja:'銀座',en:'Ginza',zh:'银座',tw:'銀座',ko:'긴자'},           taxfree:true },
  omotesando: { name:'gallica / SEAM',    area:{ja:'表参道',en:'Omotesando',zh:'表参道',tw:'表參道',ko:'오모테산도'} },
  osaka:      { name:'SEAM OSAKA HORIE',  area:{ja:'大阪',en:'Osaka',zh:'大阪',tw:'大阪',ko:'오사카'} },
  nagoya:     { name:'SEAM NAGOYA',       area:{ja:'名古屋',en:'Nagoya',zh:'名古屋',tw:'名古屋',ko:'나고야'} },
  fukuoka:    { name:'SEAM FUKUOKA',      area:{ja:'福岡',en:'Fukuoka',zh:'福冈',tw:'福岡',ko:'후쿠오카'} },
  sapporo:    { name:'SEAM SAPPORO',      area:{ja:'札幌',en:'Sapporo',zh:'札幌',tw:'札幌',ko:'삿포로'} },
  utsunomiya: { name:'gigi SEAM',         area:{ja:'宇都宮',en:'Utsunomiya',zh:'宇都宫',tw:'宇都宮',ko:'우쓰노미야'} },
};
const BRAND = {
  aujua:'Aujua', kerastase:'Kérastase', tokio:'TOKIO IE', bykarte:'BYKARTE',
  'shu-uemura':'shu uemura', lashaddict:'LASHADDICT', sublimic:'SUBLIMIC',
  'shiseido-professional':'Shiseido Professional', tsururincho:'Tsururincho',
  'system-professional':'System Professional', milbon:'Milbon',
};
const TOKYO = { en:'Tokyo', zh:'东京', tw:'東京', ko:'도쿄' };

function metaFor(file, doc) {
  const jaT = (doc.querySelector('title') || {}).textContent || '';
  const jaD = (doc.querySelector('meta[name="description"]') || { getAttribute: () => '' }).getAttribute('content') || '';
  const out = { ja: { t: jaT, d: jaD } };

  let m;
  if ((m = file.match(/^store-([a-z]+)\.html$/))) {
    const s = STORE[m[1]]; if (!s) return null;
    const tax = {
      en: s.taxfree ? ' Tax-free from ¥5,000 with a passport.' : '',
      zh: s.taxfree ? ' 满5,000日元免税，请出示护照。' : '',
      tw: s.taxfree ? ' 滿5,000日圓免稅，請出示護照。' : '',
      ko: s.taxfree ? ' 5,000엔 이상 면세, 여권을 제시해 주세요.' : '',
    };
    out.en = { t: `Salon-Exclusive Hair Care in ${s.area.en} | ${s.name}`,
      d: `Authorized retailer of salon-exclusive hair care in ${s.area.en}. 197 brands on the shelf. Shopping-only visits are welcome, with no booking and no treatment.${tax.en}` };
    out.zh = { t: `${s.area.zh}的沙龙专售护发店 | ${s.name}`,
      d: `${s.area.zh}的沙龙专售护发品牌授权零售商。197个品牌在售，无需预约与护理，欢迎只为购物到店。${tax.zh}` };
    out.tw = { t: `${s.area.tw}的沙龍專售護髮店 | ${s.name}`,
      d: `${s.area.tw}的沙龍專售護髮品牌授權零售商。197個品牌在售，無需預約與護理，歡迎只為購物到店。${tax.tw}` };
    out.ko = { t: `${s.area.ko}의 살롱 전용 헤어케어 매장 | ${s.name}`,
      d: `${s.area.ko}의 살롱 전용 헤어케어 정규 취급점. 197개 브랜드를 매장에서. 예약·시술 없이 구매만 하셔도 됩니다.${tax.ko}` };
    return out;
  }
  if ((m = file.match(/^headspa-([a-z]+)\.html$/))) {
    const s = STORE[m[1]]; if (!s) return null;
    out.en = { t: `Head Spa in ${s.area.en} | Private Rooms | ${s.name}`,
      d: `A Japanese head spa in a private room in ${s.area.en}. Our own hydrogen and carbonated menu, from a trained spa specialist. Book online.` };
    out.zh = { t: `${s.area.zh}的头部水疗 | 完全包间 | ${s.name}`,
      d: `${s.area.zh}的完全包间头部水疗。由专业头疗师操作，采用氢与碳酸的独家疗程。可在线预约。` };
    out.tw = { t: `${s.area.tw}的頭部水療 | 完全包廂 | ${s.name}`,
      d: `${s.area.tw}的完全包廂頭部水療。由專業頭療師操作，採用氫與碳酸的獨家療程。可線上預約。` };
    out.ko = { t: `${s.area.ko}의 헤드스파 | 완전 개인실 | ${s.name}`,
      d: `${s.area.ko}의 완전 개인실 헤드스파. 수소와 탄산을 사용하는 독자 메뉴를 스파니스트가 담당합니다. 온라인 예약 가능.` };
    return out;
  }
  if ((m = file.match(/^salon-([a-z]+)\.html$/))) {
    const s = STORE[m[1]]; if (!s) return null;
    out.en = { t: `Hair Salon in ${s.area.en} | ${s.name}`,
      d: `Cut, colour, perm, straightening and treatments in ${s.area.en}, from people who know 197 salon-exclusive brands. Private rooms.` };
    out.zh = { t: `${s.area.zh}的美发沙龙 | ${s.name}`,
      d: `在${s.area.zh}提供剪发、染发、烫发、缩毛矫正与护发。由熟知197个沙龙专售品牌的专业人员担当，设有包间。` };
    out.tw = { t: `${s.area.tw}的美髮沙龍 | ${s.name}`,
      d: `在${s.area.tw}提供剪髮、染髮、燙髮、縮毛矯正與護髮。由熟知197個沙龍專售品牌的專業人員擔當，設有包廂。` };
    out.ko = { t: `${s.area.ko}의 헤어살롱 | ${s.name}`,
      d: `${s.area.ko}에서 커트·컬러·펌·매직·트리트먼트를. 197개 살롱 전용 브랜드를 아는 전문가가 개인실에서 담당합니다.` };
    return out;
  }
  if ((m = file.match(/^(.+)-tokyo\.html$/))) {
    const b = BRAND[m[1]]; if (!b) return null;
    out.en = { t: `Buy ${b} in Tokyo | Authorized Retailer SEAM`,
      d: `Where to buy ${b} in Tokyo. Authorized retailer at our Ginza and Omotesando stores. In-store purchase with no booking and no treatment.` };
    out.zh = { t: `在东京购买${b} | 品牌授权零售商 SEAM`,
      d: `在东京哪里可以买到${b}。银座与表参道两家门店正规代理，无需预约与护理即可到店购买。` };
    out.tw = { t: `在東京購買${b} | 品牌授權零售商 SEAM`,
      d: `在東京哪裡可以買到${b}。銀座與表參道兩家門市正規代理，無需預約與護理即可到店購買。` };
    out.ko = { t: `도쿄에서 ${b} 구매 | 정규 취급점 SEAM`,
      d: `도쿄에서 ${b}를 살 수 있는 곳. 긴자·오모테산도 두 매장에서 정규 취급. 예약·시술 없이 매장에서 구매하실 수 있습니다.` };
    return out;
  }
  return null;
}

// ─────────────────────────────────────────────
function hasBlockJaDescendant(el) {
  for (const c of el.children) {
    if (SKIP.has(TAG(c)) || isForeign(c)) continue;
    if (!INLINE.has(TAG(c)) && hasJa(c.textContent)) return true;
    if (hasBlockJaDescendant(c)) return true;
  }
  return false;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 要素の innerHTML を 言語lang で組み立てる(マークアップは元のまま)
function renderFor(el, lang) {
  let out = '';
  let missing = 0;
  const walk = node => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const raw = n.nodeValue;
        if (!hasJa(raw)) { out += esc(raw); continue; }
        const key = raw.replace(/\s+/g, ' ').trim();
        const tr = DICT[key];
        if (!tr) { missing++; out += esc(raw); continue; }
        const val = lang === 'ja' ? key : tr[lang];
        // 元の前後の空白を保つ(語間が詰まるのを防ぐ)
        const lead = raw.match(/^\s*/)[0] ? ' ' : '';
        const tail = raw.match(/\s*$/)[0] ? ' ' : '';
        out += lead + esc(val) + tail;
      } else if (n.nodeType === 1) {
        if (SKIP.has(TAG(n)) || isForeign(n)) { out += n.outerHTML; continue; }
        const tag = n.tagName.toLowerCase();
        // a.value は実体参照が解決済みで返るので & を必ず戻す(href の &amp; が壊れる)
        const attrs = [...n.attributes].map(a =>
          ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
        if (!n.innerHTML && n.children.length === 0) { out += `<${tag}${attrs}>`; continue; }
        out += `<${tag}${attrs}>`;
        walk(n);
        out += `</${tag}>`;
      }
    }
  };
  walk(el);
  return { html: out, missing };
}

const HREFLANG = url => [
  `<link rel="alternate" hreflang="ja" href="https://seam.site${url}">`,
  `<link rel="alternate" hreflang="en" href="https://seam.site/en${url}">`,
  `<link rel="alternate" hreflang="zh-Hans" href="https://seam.site/zh${url}">`,
  `<link rel="alternate" hreflang="zh-Hant" href="https://seam.site/tw${url}">`,
  `<link rel="alternate" hreflang="ko" href="https://seam.site/ko${url}">`,
  `<link rel="alternate" hreflang="x-default" href="https://seam.site${url}">`,
].join('\n  ');

const files = fs.readdirSync(ROOT)
  .filter(f => /^(store|headspa|salon)-[a-z]+\.html$/.test(f) || /-tokyo\.html$/.test(f)).sort();

let totMissing = 0, report = [];
const roundtripNG = [];
const pending = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('SEAM_PAGE_I18N')) { report.push(`SKIP ${f} (既にi18n済み)`); continue; }

  const dom = new JSDOM(src);
  const doc = dom.window.document;
  const meta = metaFor(f, doc);
  if (!meta) { report.push(`ERR  ${f} (metaテンプレ無し)`); continue; }

  // 1) data-i18n 付与 + 各言語の値を作る
  const dict = {}; LANGS.forEach(L => dict[L] = {});
  let i = 0, miss = 0;
  const walk = el => {
    for (const c of el.children) {
      if (SKIP.has(TAG(c)) || isForeign(c)) continue;
      if (hasJa(c.textContent) && !hasBlockJaDescendant(c)) {
        const key = 's' + (++i);
        // 【安全弁】ja を組み立て直して元の innerHTML と一致しなければ中断する。
        // 一致するということは「マークアップは無傷で、差し替わったのは日本語テキストだけ」の証明。
        const orig = c.innerHTML.replace(/\s+/g, ' ').trim();
        c.setAttribute('data-i18n', key);
        for (const L of LANGS) {
          const r = renderFor(c, L);
          dict[L][key] = r.html.replace(/\s+/g, ' ').trim();
          if (L === 'en') miss += r.missing;
        }
        if (dict.ja[key] !== orig) {
          roundtripNG.push({ f, key, orig, back: dict.ja[key] });
        }
        continue;
      }
      walk(c);
    }
  };
  walk(doc.body);

  // 2) 属性(alt / aria-label / title)
  let ai = 0;
  for (const el of doc.querySelectorAll('[alt],[aria-label],[title]')) {
    const specs = [];
    for (const a of ['alt', 'aria-label', 'title']) {
      const v = el.getAttribute(a);
      if (!v || !hasJa(v)) continue;
      const tr = DICT[v.replace(/\s+/g, ' ').trim()];
      if (!tr) { miss++; continue; }
      const key = 'a' + (++ai);
      specs.push(`${a}:${key}`);
      dict.ja[key] = v;
      for (const L of ['en', 'zh', 'tw', 'ko']) dict[L][key] = tr[L];
    }
    if (specs.length) el.setAttribute('data-i18n-attr', specs.join(';'));
  }

  // 3) meta
  for (const L of LANGS) {
    dict[L]['meta.title'] = meta[L].t;
    dict[L]['meta.description'] = meta[L].d;
  }

  // 4) 出力(jsdomのserializeは属性順を保つ)
  let out = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

  // 辞書スクリプトを </body> 直前に
  const script = '<script>\nwindow.SEAM_PAGE_I18N = ' + JSON.stringify(dict) + ';\n</script>\n';
  out = out.replace('</body>', script + '</body>');

  // 5) hreflang(jsonldマーカーの外＝</head>直前)。既にあれば入れない
  if (!/rel="alternate"\s+hreflang/.test(out)) {
    const url = '/' + f.replace(/\.html$/, '');
    out = out.replace('</head>', '  ' + HREFLANG(url) + '\n</head>');
  }

  // 書き込みは全ファイルの検証が終わってから(途中で失敗して半端に書かないため)
  pending.push({ p, out });
  totMissing += miss;
  report.push(`OK   ${f}  単位${i} 属性${ai}  未訳${miss}`);
}
console.log(report.join('\n'));
console.log('\n未訳の合計:', totMissing);
console.log('ja往復の不一致:', roundtripNG.length);
if (roundtripNG.length) {
  roundtripNG.slice(0, 5).forEach(x => {
    let i = 0; while (x.orig[i] === x.back[i] && i < x.orig.length) i++;
    console.log(`\n-- ${x.f} ${x.key} (位置 ${i})`);
    console.log(' 元:', JSON.stringify(x.orig.slice(Math.max(0, i - 30), i + 70)));
    console.log(' 復:', JSON.stringify(x.back.slice(Math.max(0, i - 30), i + 70)));
  });
  console.error('\n❌ 往復が一致しないため書き込みを中止しました');
  process.exit(1);
}
if (DRY) {
  console.log('(dry run — 書き込みなし)', pending.length, 'ファイル分を検証');
} else {
  pending.forEach(x => fs.writeFileSync(x.p, x.out));
  console.log('✅ 書き込み完了:', pending.length, 'ファイル');
}
