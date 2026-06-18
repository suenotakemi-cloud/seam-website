/**
 * fetch-ranking.js
 * salon.town にログインしてランキングを取得し ranking.json に保存する
 */
const https = require('https');
const fs = require('fs');

const MAIL = process.env.SALON_TOWN_MAIL;
const PASS = process.env.SALON_TOWN_PASS;

if (!MAIL || !PASS) {
  console.error('❌ 環境変数 SALON_TOWN_MAIL / SALON_TOWN_PASS が未設定です');
  process.exit(1);
}

function post(path, body, cookies = '') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'salon.town',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': cookies,
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ json: JSON.parse(raw), headers: res.headers }); }
        catch { resolve({ json: null, headers: res.headers, raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // 1. ログイン
  console.log('🔑 salon.town にログイン中...');
  const login = await post('/login', { mail: MAIL, pass: PASS, add_invite_shop_data: true });
  
  if (!login.json?.result) {
    console.error('❌ ログイン失敗:', login.json?.msg || login.raw);
    process.exit(1);
  }

  const { id: user_id, token } = login.json.data;
  console.log(`✅ ログイン成功 (user_id: ${user_id})`);

  // 2. ランキング取得
  console.log('📊 ランキング取得中...');
  const rank = await post('/get/rank', {
    user_id,
    token,
    filter: { type: 'ec_item' },
  });

  if (!rank.json?.result) {
    console.error('❌ ランキング取得失敗:', rank.json?.msg);
    process.exit(1);
  }

  const BASE_DOMAIN = 'salon.town';
  // デバッグ: 1件目のキー一覧を出力
  if (rank.json.data.length > 0) {
    console.log('=== 1位データのキー ===');
    console.log(JSON.stringify(rank.json.data[0], null, 2));
  }

  const items = rank.json.data.slice(0, 5).map((d, i) => {
    const img = d.img_prifix
      ? `https://asset.${BASE_DOMAIN}/item/thumb/${d.item_id}_${d.img_prifix}${d.format}`
      : `https://asset.${BASE_DOMAIN}/item/thumb/${d.jan}.jpg`;
    // フィールド名の候補を幅広く試す
    const brand = d.maker_name || d.brand_name || d.brand || d.makerName || '';
    const name  = d.item_name  || d.name       || d.itemName || d.product_name || d.title || '';
    return {
      rank: i + 1,
      brand,
      name,
      img,
      href: 'brand.html',
    };
  });

  // 安全弁: 取得件数が少なすぎる場合は本番(index.html)を上書きしない＝ホームのランキング空白化を防止
  if (!Array.isArray(items) || items.length < 3) {
    console.error(`❌ 取得件数が ${items.length} 件のみのため中止します（本番は変更しません）`);
    process.exit(1);
  }

  const now = new Date();
  const month = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  const output = { month, items };

  fs.writeFileSync('.github/scripts/ranking.json', JSON.stringify(output, null, 2));
  console.log(`✅ ランキング保存完了 (${month}, ${items.length}件)`);
  items.forEach(it => console.log(`  ${it.rank}位: ${it.brand} ${it.name}`));
}

main().catch(e => { console.error(e); process.exit(1); });
