# SEAM: IndexNow で Bing / DuckDuckGo / Yandex に更新を知らせる。
#
# 【なぜ】2026-08-09の実測で、多言語ページ132枚のうち索引に入っていたのは9枚だけだった。
# Search Console(Google)はオーナーのログインが要るので待ちになるが、IndexNow は
# 鍵を自サイトに置くだけで使えて申請も不要。DuckDuckGoはBingの索引を使うので、
# 実測で順位を測っている面にそのまま効く。
#
# 使い方: python3 scripts/indexnow.py <鍵> [sitemapのURL]
import sys, json, urllib.request, re

KEY = sys.argv[1]
SITEMAP = sys.argv[2] if len(sys.argv) > 2 else 'https://seam.site/sitemap.xml'
HOST = 'seam.site'

# 【罠】UAを付けないと Cloudflare に 403 で弾かれる（既定の python-urllib は通らない）
_req = urllib.request.Request(SITEMAP, headers={'User-Agent': 'Mozilla/5.0 (SEAM IndexNow)'})
xml = urllib.request.urlopen(_req, timeout=30).read().decode()
urls = re.findall(r'<loc>([^<]+)</loc>', xml)
print(f'sitemap から {len(urls)} URL')

# IndexNow は1回10,000件まで。念のため1,000件ずつ送る
sent = 0
for i in range(0, len(urls), 1000):
    chunk = urls[i:i+1000]
    body = json.dumps({
        'host': HOST,
        'key': KEY,
        'keyLocation': f'https://{HOST}/{KEY}.txt',
        'urlList': chunk,
    }).encode()
    req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body,
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f'  {len(chunk)}件 → HTTP {r.status}')
            sent += len(chunk)
    except urllib.error.HTTPError as e:
        print(f'  {len(chunk)}件 → HTTP {e.code} {e.read().decode()[:200]}')
print(f'送信 {sent}/{len(urls)}')
