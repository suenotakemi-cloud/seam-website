/* SEAM: ページ固有の鍵（台帳に無い文）の AI っぽい言い回しを直す（2026-09-15）
 * shop / headspa / hairsalon / onlineshop / brand の 5言語辞書を直接書き 見えている HTML も同じ文にする。冪等。
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '.';
function span(s) { const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(s); let d = 0, i = s.indexOf('{', m.index), st = i, mode = null, esc = false;
  for (; i < s.length; i++) { const c = s[i]; if (esc) { esc = false; continue; } if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; } if (c === "'" || c === '"' || c === '`') { mode = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return [st, i + 1]; } } }
const T = {
  'shop.html': {
    'concept.lead': { ja: '棚から選んで買うだけでも歓迎です<br>店頭ではヘアケアのプロが髪質と履歴をうかがい<br class="hidden sm:block">197ブランドから候補を一緒に絞り込むこともできます',
      en: 'You are welcome to simply pick from the shelf.<br>In store, hair care professionals can also listen to your hair type and history<br class="hidden sm:block">and narrow down the candidates with you, from all 197 brands.',
      zh: '只从货架上挑选购买也欢迎<br>在店内 护发专家也可以了解您的发质与履历<br class="hidden sm:block">从197个品牌中一起缩小候选范围',
      tw: '只從貨架上挑選購買也歡迎<br>在店內 護髮專家也可以了解您的髮質與履歷<br class="hidden sm:block">從197個品牌中一起縮小候選範圍',
      ko: '진열대에서 골라 사기만 해도 환영합니다<br>매장에서는 헤어케어 전문가가 모발 타입과 이력을 듣고<br class="hidden sm:block">197개 브랜드에서 후보를 함께 좁혀 드릴 수도 있습니다' },
    'authorized.body': { ja: '取り扱うのは 各メーカーと正規に契約した正規品だけです 並行輸入品や転売品は扱いません',
      en: 'Everything we carry is genuine, under direct contracts with each maker. We do not handle parallel imports or resold goods',
      zh: '我们只经营与各厂商正规签约的正品 不经营平行进口品或转卖品', tw: '我們只經營與各原廠正規簽約的正品 不經營平行輸入品或轉賣品', ko: '취급하는 것은 각 제조사와 정규 계약한 정품뿐입니다 병행 수입품이나 되팔이 상품은 취급하지 않습니다' },
  },
  'headspa.html': {
    'fit.i4': { ja: '自分へのご褒美に ゆっくり休む時間がほしい', en: 'You want a proper rest as a treat for yourself', zh: '想给自己一个奖励 好好休息一段时间', tw: '想給自己一個獎勵 好好休息一段時間', ko: '나에게 주는 선물로 푹 쉬는 시간이 필요하다' },
    'change.desc': { ja: 'その日の気持ちよさと 翌朝の軽さの両方を見て組み立てます', en: 'We build the treatment around both how good it feels that day and how light you feel the next morning', zh: '既看当天的舒适感 也看第二天早上的轻盈感来安排', tw: '既看當天的舒適感 也看第二天早上的輕盈感來安排', ko: '그날의 기분 좋음과 다음 날 아침의 가벼움 둘 다 보고 짭니다' },
  },
  'hairsalon.html': {
    'concerns.bridge': { ja: 'ひとつでも当てはまるなら 髪格診断へ →', en: 'If even one applies, take the Hair Finder →', zh: '只要有一项符合 就去做发格诊断 →', tw: '只要有一項符合 就去做髮格診斷 →', ko: '하나라도 해당되면 헤어 파인더로 →' },
    'concept.desc': { ja: 'カットやカラーのあと 仕上がりを支えるホームケアまで提案するのがSEAMのサロンです 施術後の髪に合うケアをその場で選べます',
      en: 'After the cut or colour, a SEAM salon also proposes the home care that keeps the finish. You can choose the care that suits your hair right there',
      zh: '剪染之后 连支撑发型效果的居家护理也一并提案 这就是SEAM的沙龙 可以当场选择适合施术后头发的护理', tw: '剪染之後 連支撐髮型效果的居家護理也一併提案 這就是SEAM的沙龍 可以當場選擇適合施術後頭髮的護理', ko: '컷이나 컬러 뒤 마무리를 지탱하는 홈케어까지 제안하는 것이 SEAM의 살롱입니다 시술 후 머리에 맞는 케어를 그 자리에서 고를 수 있습니다' },
  },
  'onlineshop.html': {
    'rank.desc': { ja: '今月よく選ばれている SEAMのセレクション', en: "This month's most chosen, from SEAM's selection", zh: '本月最常被选择的 SEAM精选', tw: '本月最常被選擇的 SEAM精選', ko: '이달 많이 선택된 SEAM 셀렉션' },
  },
  'brand.html': {
    'hero.eyebrow': { ja: 'Curated Brands · 197 Worldwide', en: 'Curated Brands · 197 Worldwide', zh: 'Curated Brands · 197 Worldwide', tw: 'Curated Brands · 197 Worldwide', ko: 'Curated Brands · 197 Worldwide' },
    'pm.banner.eyebrow': { ja: 'Not Sure Which?', en: 'Not Sure Which?', zh: 'Not Sure Which?', tw: 'Not Sure Which?', ko: 'Not Sure Which?' },
    'concept.sub': { ja: 'SEAMがこのブランドを選ぶ基準と プロが信頼する理由', en: 'How SEAM chooses these brands, and why professionals trust them', zh: 'SEAM挑选这些品牌的标准 以及专业人士信赖的理由', tw: 'SEAM挑選這些品牌的標準 以及專業人士信賴的理由', ko: 'SEAM이 이 브랜드를 고르는 기준과 전문가가 신뢰하는 이유' },
    'concept.c3.title': { ja: '世界から選んだグローバルブランド', en: 'Global brands chosen from around the world', zh: '从世界各地挑选的全球品牌', tw: '從世界各地挑選的全球品牌', ko: '세계에서 고른 글로벌 브랜드' },
    'concept.c4.desc': { ja: '環境への配慮 持続可能な原材料調達 エシカルな生産プロセス 機能性に加えて ブランドの姿勢や未来への取り組みも選定の基準にしています',
      en: 'Care for the environment, sustainable sourcing and ethical production. Alongside performance, a brand’s stance and its work for the future are part of how we choose',
      zh: '环境考量 可持续的原料采购 合乎伦理的生产过程 除了功能性 品牌的态度和对未来的努力也是我们的选择标准', tw: '環境考量 可持續的原料採購 合乎倫理的生產過程 除了功能性 品牌的態度和對未來的努力也是我們的選擇標準', ko: '환경 배려 지속 가능한 원료 조달 윤리적인 생산 과정 기능성에 더해 브랜드의 자세와 미래를 향한 노력도 선정 기준에 넣고 있습니다' },
    'featured.aujua': { ja: '一人ひとりの髪の今に合わせるパーソナルケア', en: 'Personal care matched to each person’s hair, as it is now', zh: '贴合每个人此刻头发状态的个人化护理', tw: '貼合每個人此刻頭髮狀態的個人化護理', ko: '한 사람 한 사람의 지금 머리에 맞추는 퍼스널 케어' },
  },
};
let pages = 0, keys = 0, warn = [];
for (const [f, kv] of Object.entries(T)) {
  const p = path.join(ROOT, f); let s = fs.readFileSync(p, 'utf8'); const [a, b] = span(s); const D = JSON.parse(s.slice(a, b));
  if (JSON.stringify(D) !== s.slice(a, b)) { warn.push(f + ' 往復NG'); continue; }
  let n = 0;
  for (const [k, v] of Object.entries(kv)) {
    const old = D.ja[k];
    for (const l of Object.keys(v)) if (D[l] && D[l][k] !== v[l]) { D[l][k] = v[l]; n++; }
    if (old && old !== v.ja) {                                     // HTML 側も同じ文に（要素の中身＝旧 ja 値）
      const re = new RegExp('(data-i18n="' + k.replace(/\./g, '\\.') + '"[^>]*>)' + old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=<)');
      const s2 = s.replace(re, '$1' + v.ja); if (s2 === s) warn.push(f + ' ' + k + ' HTML側の旧文が見つからない'); else s = s2;
    }
  }
  if (n) { const [a2, b2] = span(s); s = s.slice(0, a2) + JSON.stringify(D) + s.slice(b2); fs.writeFileSync(p, s, 'utf8'); pages++; keys += n; }
}
console.log(`  ${pages}枚 / ${keys}件` + (warn.length ? '\n  ✘ ' + warn.join('\n  ✘ ') : ''));
