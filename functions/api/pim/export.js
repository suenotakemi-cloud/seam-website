// 統一フォーマットの出力
//   GET /api/pim/export?format=csv|json&maker=&only_images=1&noimg=1
//   列は js/pim-normalize.js の OUT_COLUMNS と同じ（ここでも同じ順で出す。変えるときは両方）
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

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const maker = (url.searchParams.get('maker') || '').trim();
  const onlyImages = url.searchParams.get('only_images') === '1';
  const noimg = url.searchParams.get('noimg') === '1';
  const where = [], binds = [];
  if (maker) { where.push('maker=?'); binds.push(maker); }
  if (onlyImages) where.push('image_count>0');
  if (noimg) where.push('image_count=0');
  const W = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const rows = [];
  for (let off = 0; ; off += 1000) {
    const rs = await env.DB.prepare('SELECT * FROM pim_products' + W + ' ORDER BY maker, brand, name LIMIT 1000 OFFSET ?').bind(...binds, off).all();
    const r = rs.results || [];
    rows.push(...r);
    if (r.length < 1000) break;
  }
  const imgs = await loadImages(env, rows.filter((r) => r.image_count > 0).map((r) => r.jan));
  const out = rows.map((r) => {
    const list = (imgs[r.jan] || []).slice().sort((a, b) => a.slot - b.slot).map((im) => imageUrl(origin, r.jan, im.slot, im.created_at));
    const o = Object.assign({}, r, { image_urls: list });
    return o;
  });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    return json({ ok: true, count: out.length, exported_at: new Date().toISOString(), products: out }, 200, {
      'content-disposition': 'attachment; filename="seam-products-' + stamp + '.json"',
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
      'content-disposition': 'attachment; filename="seam-products-' + stamp + '.csv"',
    },
  });
}
