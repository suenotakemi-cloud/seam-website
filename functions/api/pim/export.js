// 統一フォーマットの出力（ログイン中のアカウントの分だけ。EC 連携は ADMIN_KEY + x-seam-account でも可）
//   GET /api/pim/export?format=csv|json|source|images&maker=&only_images=1&noimg=1
//     csv / json … 統一フォーマット（列は js/pim-normalize.js の OUT_COLUMNS と同じ。変えるときは両方）
//     source     … 取り込んだ CSV そのままの列（例: 菊池 CSV の 22 列）＋ 画像1〜5 ＋ 画像枚数。
//                  EC 側は「商品コード（商品ID）」で突き合わせる。見出しは最後に取り込んだファイルのもの
//     images     … 商品ID（元商品コード）・JAN・商品名・画像1〜5・画像枚数 だけ（EC 側が既に商品を持っているとき）
import { json, imageUrl, loadImages } from './_lib.js';

const COLS = [
  ['jan', 'JAN'], ['name', '商品名'],
  ['price_ex', '価格(税抜)'], ['price_in', '価格(税込)'], ['tax_included', '入力価格の税区分'], ['tax_rate', '税率(%)'],
  ['amount', '内容量'], ['unit', '単位'], ['amount_text', '内容量表記'],
  ['retail_price', '上代(税抜)'], ['cost_price', '仕入価格'],
  ['maker', 'メーカー'], ['brand', 'ブランド'], ['category', 'カテゴリ'], ['description', '商品説明'], ['sku', '元商品コード'],
  ['image1', '画像1'], ['image2', '画像2'], ['image3', '画像3'], ['image4', '画像4'], ['image5', '画像5'],
  ['image_count', '画像枚数'], ['updated_at', '更新日時'],
];
function cell(v) { if (v == null) return ''; const s = String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function fmtAmount(a, u) { if (a == null || a === '') return ''; return String(Math.round(Number(a) * 100) / 100) + (u || ''); }

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const origin = url.origin;
  const fmtRaw = url.searchParams.get('format') || 'csv';
  const format = ['json', 'source', 'images'].indexOf(fmtRaw) >= 0 ? fmtRaw : 'csv';
  const maker = (url.searchParams.get('maker') || '').trim();
  const onlyImages = url.searchParams.get('only_images') === '1';
  const noimg = url.searchParams.get('noimg') === '1';
  const where = ['account_id=?'], binds = [acct];
  if (maker) { where.push('maker=?'); binds.push(maker); }
  if (onlyImages) where.push('image_count>0');
  if (noimg) where.push('image_count=0');
  const W = ' WHERE ' + where.join(' AND ');

  const rows = [];
  for (let off = 0; ; off += 1000) {
    const rs = await env.DB.prepare('SELECT * FROM pim_products' + W + ' ORDER BY maker, brand, name LIMIT 1000 OFFSET ?').bind(...binds, off).all();
    const r = rs.results || [];
    rows.push(...r);
    if (r.length < 1000) break;
  }
  const imgs = await loadImages(env, acct, rows.filter((r) => r.image_count > 0).map((r) => r.jan));
  const out = rows.map((r) => {
    const list = (imgs[r.jan] || []).slice().sort((a, b) => a.slot - b.slot).map((im) => imageUrl(origin, acct, r.jan, im.slot, im.created_at));
    const o = Object.assign({}, r, { image_urls: list });
    delete o.account_id;
    if (format !== 'source') delete o.raw;
    return o;
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const fname = 'seam-products-' + data.account.login_id + '-' + stamp;
  const csvResponse = (lines, name) => new Response('\uFEFF' + lines.join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': 'attachment; filename="' + name + '.csv"' },
  });
  const imgCols = (p) => { const a = []; for (let k = 1; k <= 5; k++) a.push(cell(p.image_urls[k - 1] || '')); a.push(String(p.image_urls.length)); return a; };

  if (format === 'images') {
    const lines = ['商品ID,JAN,商品名,画像1,画像2,画像3,画像4,画像5,画像枚数'];
    for (const p of out) lines.push([cell(p.sku), cell(p.jan), cell(p.name)].concat(imgCols(p)).join(','));
    return csvResponse(lines, fname + '-images');
  }
  if (format === 'source') {
    // 見出し: 最後に取り込んだファイルのもの。無ければ raw の鍵の和集合（取り込み順）
    let headers = null;
    // 見出しは「通常の取り込み」の最新のもの（改定CSVなど列の少ない更新取り込みは使わない）
    const last = await env.DB.prepare('SELECT headers FROM pim_imports WHERE account_id=? AND headers IS NOT NULL AND (kind IS NULL OR kind=\'normal\') ORDER BY id DESC LIMIT 1').bind(acct).first()
      || await env.DB.prepare('SELECT headers FROM pim_imports WHERE account_id=? AND headers IS NOT NULL ORDER BY id DESC LIMIT 1').bind(acct).first();
    if (last && last.headers) { try { headers = JSON.parse(last.headers); } catch (e) { headers = null; } }
    const raws = out.map((p) => { if (!p.raw) return null; try { return JSON.parse(p.raw); } catch (e) { return null; } });
    if (!headers || !headers.length) {
      headers = [];
      raws.forEach((r) => { if (r) Object.keys(r).forEach((k) => { if (headers.indexOf(k) < 0) headers.push(k); }); });
    }
    // 取り込みの列対応（raw の無い商品＝スマホで新規登録したものは、対応が分かる列だけ埋める）
    let mapping = {};
    const lastMap = await env.DB.prepare('SELECT mapping FROM pim_imports WHERE account_id=? AND headers IS NOT NULL AND (kind IS NULL OR kind=\'normal\') ORDER BY id DESC LIMIT 1').bind(acct).first()
      || await env.DB.prepare('SELECT mapping FROM pim_imports WHERE account_id=? AND headers IS NOT NULL ORDER BY id DESC LIMIT 1').bind(acct).first();
    if (lastMap && lastMap.mapping) { try { mapping = JSON.parse(lastMap.mapping) || {}; } catch (e) { mapping = {}; } }
    const colOf = (field) => (typeof mapping[field] === 'number' ? headers[mapping[field]] : null);
    const fieldByHeader = {};
    [['jan', 'jan'], ['name', 'name'], ['price', 'price'], ['retail', 'retail_price'], ['cost', 'cost_price'], ['maker', 'maker'], ['brand', 'brand'], ['description', 'description'], ['sku', 'sku']].forEach(([f, col]) => { const h = colOf(f); if (h) fieldByHeader[h] = col; });
    const lines = [headers.map(cell).concat(['画像1', '画像2', '画像3', '画像4', '画像5', '画像枚数']).join(',')];
    out.forEach((p, i) => {
      const r = raws[i];
      const vals = headers.map((h) => {
        if (r && Object.prototype.hasOwnProperty.call(r, h)) return cell(r[h]);
        const f = fieldByHeader[h]; return f ? cell(p[f]) : '';
      });
      lines.push(vals.concat(imgCols(p)).join(','));
    });
    return csvResponse(lines, fname + '-source');
  }
  if (format === 'json') {
    return json({ ok: true, count: out.length, account: data.account.login_id, exported_at: new Date().toISOString(), products: out }, 200, {
      'content-disposition': 'attachment; filename="' + fname + '.json"',
    });
  }
  const lines = [COLS.map((c) => cell(c[1])).join(',')];
  for (const p of out) {
    const rec = Object.assign({}, p, { tax_included: p.tax_included ? '税込' : '税抜', amount_text: fmtAmount(p.amount, p.unit) });
    for (let k = 1; k <= 5; k++) rec['image' + k] = p.image_urls[k - 1] || '';
    lines.push(COLS.map((c) => cell(rec[c[0]])).join(','));
  }
  return new Response('\uFEFF' + lines.join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="' + fname + '.csv"',
    },
  });
}
