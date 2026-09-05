#!/usr/bin/env bash
# salon.town トップの AI 生成ビジュアルを Higgsfield の結果URLから salontown/img/ に取り込む。
# この作業環境（Claude Code on the web）からは配信CDNへの接続が組織ポリシーで拒否されるため、
# 手元の PC で一度だけ実行してコミットしてください。取り込み後は index.html の img/video 参照を
# 相対パス（img/xxx.jpg 等）に切り替える → sed の行を参照。
set -euo pipefail
cd "$(dirname "$0")/../salontown/img"
B="https://d8j0ntlcm91z4.cloudfront.net/user_3ECYorMiZpoHNvjrZdo8FCGk7KB/hf_20260905_060307_"
curl -fsSL -o hero.png     "${B}ffbe4bda-1365-4cb3-ad33-8cb323c5e0ce.png"
curl -fsSL -o reserve.png  "${B}16b5038e-4185-4362-9bd5-d3b7c87dc076.png"
curl -fsSL -o ec.png       "${B}70d611c3-3a51-456c-aed4-3f6c368af54d.png"
curl -fsSL -o dealer.png   "${B}03959967-6998-41a5-8f96-bce73b75c672.png"
curl -fsSL -o pim.png      "${B}379464a0-9d7f-4d17-a151-b1c0787ccf5f.png"
curl -fsSL -o ai.png       "${B}86354b5b-38ef-4481-939e-ebc59d0b54e1.png"
curl -fsSL -o globe.png    "${B}c34bfa29-fee9-4e41-aad8-76191aa18b73.png"
curl -fsSL -o security.png "https://d8j0ntlcm91z4.cloudfront.net/user_3ECYorMiZpoHNvjrZdo8FCGk7KB/hf_20260905_060743_57c802f4-b2e7-4765-a017-20effe871c01.png"
curl -fsSL -o hero.mp4     "https://d8j0ntlcm91z4.cloudfront.net/user_3ECYorMiZpoHNvjrZdo8FCGk7KB/hf_20260905_060311_47445d3d-77f5-4338-8df8-a20ff08c49df.mp4"
# 軽量化（任意）: ImageMagick があれば 1600px 幅の jpg に
if command -v magick >/dev/null 2>&1; then for f in *.png; do magick "$f" -resize 1600x -quality 84 "${f%.png}.jpg"; done; fi
echo "done. 次に salontown/index.html 内の https://d8j0ntlcm91z4.cloudfront.net/... を img/ の相対パスへ置換してください"
