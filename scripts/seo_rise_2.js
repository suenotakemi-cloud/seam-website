/* SEAM: もう一段あがりやすくする（2026-09-18 ②）
 *
 * 【なぜ】9/18 の再測（順位道具/順位表_2026-09-18）で 見えた弱点
 *   ・headspa の h1 が「毎日を頑張るあなたの「脳」に特別な休息を」だけで 検索語（ヘッドスパ・個室）を持たない
 *   ・salon-* の h1 も「銀座で髪を知る人に任せる」だけ（美容室・個室が無い）。coa-ginza.com のような単店サイトは
 *     「銀座 美容室 個室」で1ページ目に居る＝単店でも語を持てば入れる
 *   ・title が上限（36字）を超える頁（headspa-osaka 40字・headspa-ginza 36字・salon-ginza 35字）
 *   ・ヘッドスパのハブへ内部リンクしている頁が 218 枚中 32 枚しか無い（ブランド・地域ブランド・guide 149 枚の footer は 髪格診断/店舗/取扱ブランド だけ）
 *   ・「銀座 ヘッドスパ 頭浸浴」は FAQ だけで h2 が無い
 *
 * 【やること】
 *   1. title を 32 字以内へ（headspa-ginza に「頭浸浴」・headspa-osaka・salon-ginza）＋ 辞書 ja.meta.title ＋ JSON-LD（seo_sync_jsonld）
 *   2. headspa：kicker「JAPANESE HEAD SPA」を h1 の中の日本語「完全個室のジャパニーズヘッドスパ専門店」に（見た目は同じ小さな一行）
 *   3. salon-*（5枚）：kicker「Hair Salon · 銀座」を h1 の中の「銀座 完全個室の美容室」に（個室の種類は各頁の記述どおり 完全/半）
 *   4. ブランド・地域ブランド・guide の footer（149枚）に「ヘアサロン」「ヘッドスパ」のリンク
 *   5. headspa-ginza：h2「頭浸浴つきのヘッドスパ 銀座店」の節（料金は表の値）
 *   6. 訳を足して i18n_extract → i18n_add → i18n_merge → seo_sync_jsonld
 *
 * 【書き方の決まり】句点「。」は使わない・言えることだけ書く（個室の種類は頁の本文から取る）
 * 冪等。使い方: node scripts/seo_rise_2.js .
 */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = process.argv[2] || '.';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s, 'utf8');
const keyOf = s => 'x.' + crypto.createHash('sha1').update(s.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 8); // i18n_extract.js と同じ
const log = [];

function dictSpan(src) {
  const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src); if (!m) return null;
  const bs = src.indexOf('{', m.index); let d = 0, mode = null, esc = false;
  for (let i = bs; i < src.length; i++) { const c = src[i];
    if (esc) { esc = false; continue; } if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return [bs, i + 1]; } }
  return null;
}
function withDict(file, fn) {           // fn(dict) → 変えた数
  let src = rd(file); const span = dictSpan(src); if (!span) throw new Error(file + ': 辞書なし');
  const raw = src.slice(span[0], span[1]); const dict = JSON.parse(raw);
  if (JSON.stringify(dict) !== raw) throw new Error(file + ': 辞書が往復できない');
  const n = fn(dict); if (n) wr(file, src.slice(0, span[0]) + JSON.stringify(dict) + src.slice(span[1])); return n;
}
const L = ['en', 'zh', 'tw', 'ko'];
const add = { en: {}, zh: {}, tw: {}, ko: {} };
// 既にある訳は上書きしない（footer の「ヘッドスパ」は他の頁でも使う共有鍵。上書きすると guide/journal の訳まで変わる）
const HAVE = Object.fromEntries(L.map(l => [l, fs.existsSync(path.join(ROOT, 'i18n', l + '.json')) ? JSON.parse(rd('i18n/' + l + '.json')) : {}]));
const JA = {};
function trans(ja, t) { const k = keyOf(ja); JA[k] = ja.replace(/\s+/g, ' ').trim(); for (const l of L) if (HAVE[l][k] === undefined) add[l][k] = t[l]; return k; }
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── 1. title（32字以内）──
const TITLES = {
  'headspa-ginza.html': '銀座のヘッドスパ専門店 完全個室・頭浸浴｜SEAM GINZA',
  'headspa-osaka.html': '大阪 堀江のヘッドスパ専門店 完全個室｜SEAM OSAKA',
  'salon-ginza.html': '銀座の完全個室美容室｜髪質改善・縮毛矯正｜SEAM GINZA',
};
for (const [f, t] of Object.entries(TITLES)) {
  if ([...t].length > 32) throw new Error(f + ': title が 32 字を超える ' + [...t].length);
  let s = rd(f); const m = /<title>([^<]*)<\/title>/.exec(s);
  if (m && m[1] !== t) { s = s.replace(m[0], `<title>${t}</title>`); wr(f, s); log.push(`  ◎ ${f}: title ${[...m[1]].length}字 → ${[...t].length}字`); }
  withDict(f, d => { let c = 0; if (d.ja && d.ja['meta.title'] !== t) { d.ja['meta.title'] = t; c++; } return c; });
}

// ── 2. headspa の h1 に日本語の kicker ──
{
  const f = 'headspa.html'; let s = rd(f);
  const OLD = /<p class="sn-kicker">JAPANESE HEAD SPA<\/p>\s*<h1 id="sn-title" data-i18n="x\.1339ba30">毎日を頑張る<br>あなたの「脳」に<br>特別な休息を<\/h1>/;
  const KICK = { ja: '完全個室のジャパニーズヘッドスパ専門店', en: 'Private-room Japanese head spa', zh: '完全包厢的日式头部水疗专门店', tw: '完全包廂的日式頭部水療專門店', ko: '완전 프라이빗 재패니즈 헤드스파 전문점' };
  const H1 = { ja: '毎日を頑張る<br>あなたの「脳」に<br>特別な休息を', en: 'Special rest<br>for the "brain"<br>that carries you every day', zh: '为每天努力的<br>您的「大脑」<br>献上特别的休息', tw: '為每天努力的<br>您的「大腦」<br>獻上特別的休息', ko: '매일 애쓰는<br>당신의 「뇌」에<br>특별한 휴식을' };
  const inner = l => `<span class="sn-kicker" style="display:block;margin-bottom:12px">${KICK[l]}</span>${H1[l]}`;
  trans(inner('ja'), { en: inner('en'), zh: inner('zh'), tw: inner('tw'), ko: inner('ko') });
  trans(KICK.ja, { en: KICK.en, zh: KICK.zh, tw: KICK.tw, ko: KICK.ko }); // h1 の中の span にも extract が鍵を振る
  if (OLD.test(s)) { s = s.replace(OLD, `<h1 id="sn-title">${inner('ja')}</h1>`); wr(f, s); log.push('  ◎ headspa.html: h1 に kicker「完全個室のジャパニーズヘッドスパ専門店」'); }
  else if (!s.includes(KICK.ja)) log.push('  ✘ headspa.html: h1 の形が想定と違う');
}

// ── 3. salon-* の h1 に kicker（個室の種類は本文から）──
const SALON = {
  'salon-ginza.html': ['銀座', 'Ginza', '银座', '銀座', '긴자'],
  'salon-osaka.html': ['大阪 堀江', 'Osaka Horie', '大阪 堀江', '大阪 堀江', '오사카 호리에'],
  'salon-nagoya.html': ['名古屋 栄', 'Nagoya Sakae', '名古屋 荣', '名古屋 榮', '나고야 사카에'],
  'salon-sapporo.html': ['札幌', 'Sapporo', '札幌', '札幌', '삿포로'],
  'salon-fukuoka.html': ['福岡', 'Fukuoka', '福冈', '福岡', '후쿠오카'],
};
const ROOM = { full: ['完全個室の美容室', 'Fully private hair salon', '完全包厢美容室', '完全包廂美容室', '완전 프라이빗 헤어살롱'], semi: ['半個室の美容室', 'Semi-private hair salon', '半包厢美容室', '半包廂美容室', '세미 프라이빗 헤어살롱'] };
const KCLS = 'block mb-3 font-mono tracking-widest2 text-[10px] uppercase text-gold';
for (const [f, place] of Object.entries(SALON)) {
  let s = rd(f);
  const body = s.replace(/<script[\s\S]*?<\/script>/g, '');
  const full = (body.match(/完全個室/g) || []).length, semi = (body.match(/半個室/g) || []).length;
  const room = full > semi ? ROOM.full : ROOM.semi;
  const kick = ['ja', ...L].map((l, i) => l === 'ja' ? `${place[0]} ${room[0]}` : `${place[i]} · ${room[i]}`);
  trans(kick[0], { en: kick[1], zh: kick[2], tw: kick[3], ko: kick[4] }); // h1 の中の span にも extract が鍵を振るので 訳を持たせる
  const H1_RE = /<p class="mt-7 font-mono tracking-widest2 text-\[10px\] uppercase text-gold" data-i18n="s3">[^<]*<\/p>\s*<h1 class="mt-3 ([^"]*)" style="([^"]*)" data-i18n="s4">([^<]*)<\/h1>/;
  const m = H1_RE.exec(s);
  if (m) {
    const inner = `<span class="${KCLS}">${kick[0]}</span>${m[3]}`;
    s = s.replace(m[0], `<h1 class="mt-7 ${m[1]}" style="${m[2]}" data-i18n="s4">${inner}</h1>`); wr(f, s);
    withDict(f, d => { let c = 0; ['ja', ...L].forEach((l, i) => { if (!d[l] || !d[l].s4) return; const v = `<span class="${KCLS}">${kick[i]}</span>${d[l].s4.replace(/^<span[^>]*>[^<]*<\/span>/, '')}`; if (d[l].s4 !== v) { d[l].s4 = v; c++; } }); return c; });
    log.push(`  ◎ ${f}: h1 に kicker「${kick[0]}」（本文 完全個室${full}回・半個室${semi}回）`);
  } else if (!s.includes(kick[0])) log.push('  ✘ ' + f + ': h1 の形が想定と違う');
}

// ── 4. 149枚の footer にヘアサロン・ヘッドスパ ──
{
  const ANCHOR = 'data-i18n="bp.ui.brands">取扱ブランド</a>';
  const ADD = '\n<a href="hairsalon.html" class="hover:text-ink">ヘアサロン</a>\n<a href="headspa.html" class="hover:text-ink">ヘッドスパ</a>';
  trans('ヘアサロン', { en: 'Hair Salon', zh: '美发沙龙', tw: '美髮沙龍', ko: '헤어살롱' });
  trans('ヘッドスパ', { en: 'Head Spa', zh: '头疗', tw: '頭皮SPA', ko: '헤드스파' });
  let n = 0;
  for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f))) {
    const s = rd(f); if (!s.includes('<footer class="border-t border-line mt-12">') || !s.includes(ANCHOR) || s.includes('href="headspa.html" class="hover:text-ink">ヘッドスパ</a>')) continue;
    wr(f, s.replace(ANCHOR, ANCHOR + ADD)); n++;
  }
  if (n) log.push(`  ◎ footer にヘアサロン・ヘッドスパ ${n}枚`);
}

// ── 5. headspa-ginza：頭浸浴の h2 ──
{
  const f = 'headspa-ginza.html'; let s = rd(f);
  const Q = '頭浸浴つきのヘッドスパ 銀座店';
  const P = '首肩までほどけるクリームヘッドスパ 90min ¥17,800 深く落ちるプレミアムヘッドスパ 120min ¥20,800 プレミアムスパ 150min ¥25,000 の3コースに頭浸浴が付きます 人気No.1は90分 いずれも完全個室です';
  trans(Q, { en: 'Head spa with head bathing at the Ginza store', zh: '含头浸浴的头部水疗 银座店', tw: '含頭浸浴的頭部水療 銀座店', ko: '두침욕이 포함된 헤드스파 긴자점' });
  trans(P, { en: 'Head bathing is included in three courses: the cream head spa 90 min ¥17,800, the premium head spa 120 min ¥20,800 and the premium spa 150 min ¥25,000. The 90-minute course is our most popular, and every course takes place in a fully private room',
    zh: '奶油头部水疗90分钟 ¥17,800 深度放松高阶头部水疗120分钟 ¥20,800 高阶水疗150分钟 ¥25,000 这3个方案均含头浸浴 人气No.1为90分钟 均为完全包厢',
    tw: '奶油頭部水療90分鐘 ¥17,800 深度放鬆高階頭部水療120分鐘 ¥20,800 高階水療150分鐘 ¥25,000 這3個方案均含頭浸浴 人氣No.1為90分鐘 均為完全包廂',
    ko: '크림 헤드스파 90분 ¥17,800 프리미엄 헤드스파 120분 ¥20,800 프리미엄 스파 150분 ¥25,000 의 3개 코스에 두침욕이 포함됩니다 인기 No.1은 90분 모두 완전 프라이빗 룸입니다' });
  if (!s.includes('seo-rise:tou')) {
    const anchor = '<section class="mt-12">\n      <h2 class="font-serif text-[19px] text-ink" data-i18n="s41">よくあるご質問</h2>';
    const i = s.indexOf(anchor);
    if (i < 0) log.push('  ✘ headspa-ginza.html: FAQ の節が見つからない');
    else { s = s.slice(0, i) + `<!-- seo-rise:tou --><section class="mt-11"><h2 class="font-serif text-[19px] text-ink">${Q}</h2><p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;">${P}</p></section>\n\n    ` + s.slice(i); wr(f, s); log.push('  ◎ headspa-ginza.html: h2「頭浸浴つきのヘッドスパ 銀座店」'); }
  }
}

// ── 6. 訳を流す → JSON-LD を title にそろえる ──
const tmp = path.join(os.tmpdir(), 'seo_rise_2_' + Date.now() + '.json');
fs.writeFileSync(tmp, JSON.stringify(add));
const env = { ...process.env, NODE_PATH: path.resolve(ROOT, 'node_modules') };
function ensureSource() { // extract は「頁の辞書に訳がある鍵」を飛ばすので 2回目以降は台帳に載らない → 自分の鍵は自分で載せる
  const p = path.join(ROOT, 'i18n', 'source.json'); const src = JSON.parse(fs.readFileSync(p, 'utf8')); let n = 0;
  for (const [k, ja] of Object.entries(JA)) if (!src[k]) { src[k] = ja; n++; }
  if (n) fs.writeFileSync(p, JSON.stringify(src, null, 1), 'utf8'); return n;
}
for (const args of [['scripts/i18n_extract.js', ROOT], ['ensureSource'], ['scripts/i18n_add.js', ROOT, tmp], ['scripts/i18n_merge.js', ROOT], ['scripts/seo_sync_jsonld.js', ROOT]])
  if (args[0] === 'ensureSource') log.push('  台帳に足した鍵 ' + ensureSource() + '本'); else log.push('  ' + args[0] + ': ' + execFileSync('node', args.map(a => a.startsWith('scripts/') ? path.join(ROOT, a) : a), { env, encoding: 'utf8' }).trim().split('\n').pop());
fs.unlinkSync(tmp);

const src = JSON.parse(rd('i18n/source.json'));
const miss = Object.keys(add.en).filter(k => !(k in src));
console.log(log.join('\n'));
console.log(miss.length ? `  ✘ 台帳に無い鍵 ${miss.length}本: ${miss.join(' ')}` : `  ◎ 訳 ${Object.keys(add.en).length}本 すべて台帳に載っている`);
if (miss.length) process.exit(1);
