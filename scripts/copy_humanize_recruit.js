/* SEAM: 求人ページの文章を文体ルールに合わせる（2026-09-15）
 * 求人16枚は別担当が 9/7 に書き直した版で 句点「。」34・読点「、」36・否定→肯定の対比が残っていた。
 * 事実（指名売上70万円から歩合50%・復帰率100%・完全週休2日 等）はそのまま、句読点を落とし 対比を言いたい側だけにする。
 * 鍵は x. の共有鍵なので外して置く → i18n_extract → 訳 → i18n_merge。冪等。
 */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = process.argv[2] || '.';
const R = {
  'x.88e6a1e9': '美容師を<br>続けられる仕事に',
  'x.22ba0e1e': '集客 収入 休日 子育て 成長 将来<br>美容師を辞める理由を 会社が一つずつ減らします',
  'x.aafabbbf': '美容師を<br>あきらめなくていい',
  'x.4825a546': '働き方に限界を感じて辞める美容師がいます SEAMは その限界を会社の仕組みで変えます',
  'x.ddb810e8': '顧客が少なく 入客できない',
  'x.658c6440': '<strong>新規のお客様は店からご案内します</strong>　自分で集客するより 担当したお客様にまた来ていただくことに集中できます',
  'x.0541f493': '新規のお客様は店からご案内します',
  'x.4ba9a805': '売上を上げても 収入が増えない',
  'x.62602586': '<strong>指名売上70万円から 歩合50%</strong>　売上100万円なら給与50万円 頑張った結果が そのまま収入になります',
  'x.cf3040a1': '指名売上70万円から 歩合50%',
  'x.15b50ee6': '結婚や出産のあと 戻れるか不安',
  'x.26d2a664': '<strong>産休・育休からの復帰率は100%</strong>　時短で働くスタッフや 子育て中の美容師が実際に在籍しています',
  'x.0697ac34': '産休・育休からの復帰率は100%',
  'x.f00833a7': '<strong>技術のほかにも道があります</strong>　商品開発 教育 店舗運営 ショップなど 経験を次の仕事へ広げられます',
  'x.532f18c9': '技術のほかにも道があります',
  'x.cba5b251': '美容師として もっと成長したい',
  'x.e464fd7e': '<strong>技術とヘアケアの両方を学べます</strong>　197ブランドの商品知識と 一人ひとりの髪を読み解く提案力が身につきます',
  'x.464b3680': '技術とヘアケアの両方を学べます',
  'x.8102ba49': 'あなたの経験を<br>次の仕事につなげる',
  'x.8406149a': 'スタイリスト以外の道もあります<br>経験や得意なことに合う仕事を選べます',
  'x.f9372835': 'カットやカラーに加えて ヘアケアや補修の提案まで 一人ひとりに向き合いたい方へ 本当に必要だと思うものを勧められる環境です<br><span class="text-mainBrown">商品開発に関わりたい方も歓迎します</span>',
  'x.9da7fcfa': 'ヘッドスパを ひとつの技術として深めたい方へ 空き時間に入る付属メニューとしては扱いません<br><span class="text-mainBrown">商品開発に関わりたい方も歓迎します</span>',
  'x.fc26ac05': '業務内で学び<br>着実にデビューする',
  'x.f887de98': '美容師の未来を<br>会社が支える',
  'x.c49ec18e': '技術を磨いても収入が増えない 顧客を持っていないと入客できない 休みの日まで練習がある 結婚や出産のあとに戻る場所がない<br>SEAMを運営する株式会社hanicoは こうした美容師の悩みを会社の責任として解決するために生まれました',
  'x.0a3c273e': '集客の仕組み 成果が収入に届く歩合 完全週休2日 業務内の教育 産休・育休から戻れる環境<br>その先には 商品開発や教育 店舗運営へ進む道もあります',
  'x.ce2143e0': '美容師を続けたい人が あきらめなくていい会社をつくります',
  'x.f530ac62': '一人ひとりに<br>向き合う仕事を',
  'x.f1269b96': '髪の状態を見て 履歴を聞いて 今のその方に合うものを一緒に選ぶ<br>SEAMでは施術に加えて ヘアケアやスパの提案まで含めて お客様との関係をつくっていきます',
  'x.ffba7f6b': '美容を ずっと続けよう',
  'x.df9cd652': '技術に加えて 接客やヘアケアの考え方まで基礎から学べるアシスタント職です サロン専売197ブランドが並ぶ環境で 商品知識も一緒に育ちます<br>勤務地は SEAM 福岡（天神・大名エリア）です',
  'x.190e92e8': 'サロンの入口にあるビューティーショップの運営をお任せします 接客と売場づくりに加えて 今後は商品開発や広報にも関わっていける仕事です<br>勤務地は SEAM 表参道（表参道・青山エリア）です',
  'x.2bf2209f': 'サロンの入口にあるビューティーショップの運営をお任せします 接客と売場づくりに加えて 今後は商品開発や広報にも関わっていける仕事です<br>勤務地は SEAM 銀座（銀座・有楽町エリア）です',
  'x.e598b3ce': 'サロンの入口にあるビューティーショップの運営をお任せします 接客と売場づくりに加えて 今後は商品開発や広報にも関わっていける仕事です<br>勤務地は SEAM 札幌（大通・札幌駅エリア）です',
};
let pages = 0, spots = 0;
for (const f of fs.readdirSync(ROOT).filter(f => /^recruit[a-z0-9-]*\.html$/.test(f))) {
  const p = path.join(ROOT, f); const html = fs.readFileSync(p, 'utf8');
  if (!Object.keys(R).some(k => html.includes('data-i18n="' + k + '"'))) continue;
  const dom = new JSDOM(html); const d = dom.window.document; let n = 0;
  for (const [k, v] of Object.entries(R)) d.querySelectorAll('[data-i18n="' + k + '"]').forEach(e => { e.innerHTML = v; e.removeAttribute('data-i18n'); n++; });
  if (!n) continue;
  let out = dom.serialize().replace(/^<!DOCTYPE html><html/i, '<!DOCTYPE html>\n<html'); if (!out.endsWith('\n')) out += '\n';
  fs.writeFileSync(p, out, 'utf8'); pages++; spots += n;
}
// recruit.html の description / og / twitter も句読点なしに（辞書 ja.meta.description も同じ文に）
{
  const p = path.join(ROOT, 'recruit.html'); let s = fs.readFileSync(p, 'utf8'); const before = s;
  const oldD = '美容師を長く続けたい方へ。SEAM（株式会社hanico）は、新規集客、収入、休日、子育て、技術教育、将来のキャリアに向き合う美容室です。完全週休2日、指名歩合50%、産休育休からの復帰率100%。銀座・札幌・大阪・名古屋・福岡ほかで採用中。';
  const newD = '美容師を長く続けたい方へ｜SEAM（株式会社hanico）は 新規集客 収入 休日 子育て 技術教育 将来のキャリアに向き合う美容室です｜完全週休2日 指名歩合50% 産休育休からの復帰率100%｜銀座・札幌・大阪・名古屋・福岡ほかで採用中';
  s = s.split(oldD).join(newD);
  s = s.replace(/(og:description" content=")集客・収入・休日・子育て・成長・将来。([^"]*)"/, (m, a, rest) => a + '集客・収入・休日・子育て・成長・将来｜' + rest.replace(/。$/, '').replace(/[、。]/g, ' ') + '"');
  s = s.replace(/(twitter:description" content=")([^"]*)"/, (m, a, v) => a + v.replace(/。$/, '').replace(/[、。]/g, ' ') + '"');
  s = s.replace(/(og:title" content=")([^"]*)"/, (m, a, v) => a + v.replace(/、/g, ' ').replace(/。$/, '') + '"').replace(/(twitter:title" content=")([^"]*)"/, (m, a, v) => a + v.replace(/、/g, ' ').replace(/。$/, '') + '"');
  if (s !== before) { fs.writeFileSync(p, s, 'utf8'); console.log('  recruit.html の description/og を直した'); }
}
console.log(`  書き直した ${pages}枚 / ${spots}箇所（表 ${Object.keys(R).length}本）`);
